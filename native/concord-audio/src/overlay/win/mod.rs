//! Janela Win32 do overlay: camada (WS_EX_LAYERED) com alfa por pixel,
//! click-through (WS_EX_TRANSPARENT, menos na edição), sempre no topo, sem
//! foco (WS_EX_NOACTIVATE) e fora da barra de tarefas (WS_EX_TOOLWINDOW).
//!
//! Threads: a de stdin lê e interpreta as linhas; a de imagens decodifica os
//! avatares; as duas acordam a janela com PostMessage. A thread da janela só
//! roda quando chega mensagem, timer de GIF ou mouse (na edição).

mod app;
mod images;
mod render;

use std::cell::Cell;
use std::io::BufRead;
use std::sync::mpsc;

use windows::core::{w, Result};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::HiDpi::{SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetCursorPos, GetMessageW, LoadCursorW, PostMessageW, PostQuitMessage,
    RegisterClassExW, SetCursor, SetWindowDisplayAffinity, TranslateMessage, IDC_SIZEALL, IDC_SIZENWSE, MSG,
    WDA_EXCLUDEFROMCAPTURE, WDA_MONITOR, WINDOW_EX_STYLE, WM_APP, WM_CAPTURECHANGED, WM_DESTROY, WM_DISPLAYCHANGE,
    WM_DPICHANGED, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_SETCURSOR, WM_SETTINGCHANGE, WM_TIMER,
    WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    MA_NOACTIVATE,
};

use crate::overlay::protocol::{event_line, parse_command, Command, Event};
use app::App;

/// Linha nova de stdin na fila.
const WM_STATE: u32 = WM_APP + 1;
/// stdin fechou: a Salinha saiu.
const WM_STDIN_CLOSED: u32 = WM_APP + 2;
/// Avatar decodificado na fila.
const WM_AVATAR: u32 = WM_APP + 3;
/// Mudou monitor/área de trabalho: redesenhar no lugar certo.
const WM_RELAYOUT: u32 = WM_APP + 4;
/// O mouse foi tirado da janela no meio do arraste.
const WM_LOST_MOUSE: u32 = WM_APP + 5;

thread_local! {
    /// Editando: cursor de mover; sobre o canto (tela), de redimensionar.
    static CURSOR: Cell<Option<RECT>> = const { Cell::new(None) };
}

pub(crate) fn set_cursor_area(handle: Option<RECT>) {
    CURSOR.with(|c| c.set(handle));
}

pub(crate) fn emit(event: &Event) {
    use std::io::Write;
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{}", event_line(event)).and_then(|_| out.flush());
}

fn post(hwnd: isize, msg: u32) {
    unsafe {
        let _ = PostMessageW(Some(HWND(hwnd as *mut _)), msg, WPARAM(0), LPARAM(0));
    }
}

extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_SETCURSOR => {
                if let Some(handle) = CURSOR.with(Cell::get) {
                    let mut p = POINT::default();
                    let _ = GetCursorPos(&mut p);
                    let over = p.x >= handle.left && p.x < handle.right && p.y >= handle.top && p.y < handle.bottom;
                    if let Ok(cursor) = LoadCursorW(None, if over { IDC_SIZENWSE } else { IDC_SIZEALL }) {
                        SetCursor(Some(cursor));
                        return LRESULT(1);
                    }
                }
                DefWindowProcW(hwnd, msg, wparam, lparam)
            }
            // Clique na edição não tira o foco do jogo.
            WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
            WM_CAPTURECHANGED => {
                post(hwnd.0 as isize, WM_LOST_MOUSE);
                LRESULT(0)
            }
            // O tamanho e o lugar são nossos (UpdateLayeredWindow): não deixa o
            // Windows redimensionar sozinho ao trocar de monitor.
            WM_DPICHANGED => LRESULT(0),
            WM_DISPLAYCHANGE | WM_SETTINGCHANGE => {
                post(hwnd.0 as isize, WM_RELAYOUT);
                DefWindowProcW(hwnd, msg, wparam, lparam)
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

fn create_window() -> Result<HWND> {
    unsafe {
        let instance = GetModuleHandleW(None)?;
        let class = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(wndproc),
            hInstance: instance.into(),
            lpszClassName: w!("SalinhaOverlay"),
            ..Default::default()
        };
        if RegisterClassExW(&class) == 0 {
            return Err(windows::core::Error::from_thread());
        }
        let style: WINDOW_EX_STYLE = WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
        let hwnd = CreateWindowExW(style, w!("SalinhaOverlay"), w!("Overlay da Salinha"), WS_POPUP, 0, 0, 1, 1, None, None, Some(instance.into()), None)?;
        // Fora do compartilhamento de tela (quem assiste não vê o overlay);
        // Windows antes do 10 2004 só sabe pintar de preto.
        if SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE).is_err() {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_MONITOR);
        }
        Ok(hwnd)
    }
}

/// Lê o stdin linha a linha até ele fechar.
fn spawn_stdin(hwnd: isize, commands: mpsc::Sender<Command>) {
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            match parse_command(&line) {
                Ok(Command::Ignored) => {}
                Ok(command) => {
                    if commands.send(command).is_err() {
                        break;
                    }
                    post(hwnd, WM_STATE);
                }
                Err(err) => emit(&Event::Error(format!("linha inválida: {err}"))),
            }
        }
        post(hwnd, WM_STDIN_CLOSED);
    });
}

pub fn run() -> std::result::Result<(), String> {
    unsafe {
        // Pixels físicos em todo monitor: o modo foreground também fala neles.
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    let hwnd = create_window().map_err(|err| format!("janela do overlay: {err}"))?;
    let raw = hwnd.0 as isize;

    let (command_tx, command_rx) = mpsc::channel();
    let (request_tx, request_rx) = mpsc::channel();
    let (avatar_tx, avatar_rx) = mpsc::channel();
    images::spawn_loader(request_rx, avatar_tx, move || post(raw, WM_AVATAR));
    let mut app = App::new(hwnd, request_tx).map_err(|err| format!("Direct2D/DirectWrite: {err}"))?;
    spawn_stdin(raw, command_tx);
    emit(&Event::Ready);

    let mut msg = MSG::default();
    loop {
        let got = unsafe { GetMessageW(&mut msg, None, 0, 0) };
        if got.0 <= 0 {
            return Ok(());
        }
        match msg.message {
            WM_STATE => {
                // Várias linhas na fila: só a última importa.
                if let Some(Command::State(state)) = command_rx.try_iter().last() {
                    app.on_state(*state);
                }
            }
            WM_AVATAR => {
                for (path, result) in avatar_rx.try_iter() {
                    app.on_avatar(path, result);
                }
            }
            WM_RELAYOUT => app.redraw(),
            WM_TIMER => app.on_timer(),
            WM_LBUTTONDOWN => app.on_mouse_down(message_pos()),
            WM_MOUSEMOVE => app.on_mouse_move(message_pos()),
            WM_LBUTTONUP | WM_LOST_MOUSE => app.on_mouse_up(),
            WM_STDIN_CLOSED => return Ok(()),
            _ => unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            },
        }
    }
}

/// Posição do mouse na tela quando a mensagem saiu (a janela anda no arraste,
/// então coordenadas da janela não servem).
fn message_pos() -> (f64, f64) {
    let pos = unsafe { windows::Win32::UI::WindowsAndMessaging::GetMessagePos() };
    let x = (pos & 0xffff) as u16 as i16 as f64;
    let y = (pos >> 16) as u16 as i16 as f64;
    (x, y)
}
