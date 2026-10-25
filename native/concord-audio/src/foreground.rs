//! Modo `foreground`: a cada 500 ms olha a janela em primeiro plano e escreve
//! em stdout uma linha (`fullscreen <pid> <l> <t> <r> <b>` ou `none`) só
//! quando ela muda. A Salinha usa isso para mostrar o overlay de jogo.

use std::io::Write;
use std::time::Duration;

use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::HiDpi::{SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2};
use windows::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_RUNNING_D3D_FULL_SCREEN};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsZoomed,
};

use crate::fullscreen::{report, ForegroundWindow, Rect};

const INTERVAL: Duration = Duration::from_millis(500);

fn rect(r: RECT) -> Rect {
    Rect { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

/// A janela em primeiro plano agora; qualquer chamada que falhe = `None`.
fn foreground() -> Option<ForegroundWindow> {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let mut class = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut class);
        if len <= 0 {
            return None;
        }
        let mut window = RECT::default();
        GetWindowRect(hwnd, &mut window).ok()?;
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return None;
        }
        let exclusive_d3d = SHQueryUserNotificationState().is_ok_and(|state| state == QUNS_RUNNING_D3D_FULL_SCREEN);
        Some(ForegroundWindow {
            pid,
            class_name: String::from_utf16_lossy(&class[..len as usize]),
            window: rect(window),
            monitor: rect(info.rcMonitor),
            maximized: IsZoomed(hwnd).as_bool(),
            exclusive_d3d,
        })
    }
}

/// Roda até stdout fechar (ou o stdin fechar, pela thread do `main`).
pub fn run() -> Result<(), String> {
    // Coordenadas em pixels físicos; o main converte com screenToDipRect.
    if let Err(err) = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) } {
        eprintln!("SetProcessDpiAwarenessContext: {err}");
    }
    let mut out = std::io::stdout().lock();
    let mut last: Option<String> = None;
    loop {
        let line = report(foreground().as_ref());
        if last.as_deref() != Some(line.as_str()) {
            if writeln!(out, "{line}").and_then(|_| out.flush()).is_err() {
                // stdout fechado: a Salinha parou de olhar.
                return Ok(());
            }
            last = Some(line);
        }
        std::thread::sleep(INTERVAL);
    }
}
