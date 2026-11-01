//! A janela executando a máquina de estados (controller.rs): avatares, relógios
//! dos GIFs, geometria no monitor do jogo e o desenho.

use std::collections::HashMap;
use std::sync::mpsc::Sender;
use std::time::Instant;

use windows::core::Result;
use windows::Win32::Foundation::{HWND, POINT, RECT, SIZE};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromRect, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Input::KeyboardAndMouse::{ReleaseCapture, SetCapture};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, KillTimer, SetTimer, SetWindowLongPtrW, SetWindowPos, ShowWindow, GWL_EXSTYLE, HWND_TOPMOST,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_HIDE, SW_SHOWNOACTIVATE, WS_EX_TRANSPARENT,
};

use super::render::{Frame, Renderer};
use super::{emit, set_cursor_area};
use crate::overlay::controller::{Controller, DragMode, Effect};
use crate::overlay::gif::{next_due, Clock, Decoded};
use crate::overlay::layout::{css, handle_rect, hint_rect, place_box, scene, window_rect, Px, RectF, RectI, Scene, Size};
use crate::overlay::protocol::{Event, State};

const GIF_TIMER: usize = 1;

enum Slot {
    Loading,
    Failed,
    Ready { image: Decoded, clock: Clock },
}

/// Onde a lista está agora, para o mouse da edição (pixels físicos).
#[derive(Clone, Copy)]
struct Placed {
    /// Área de trabalho do monitor do jogo, na tela.
    work: RECT,
    k: f32,
    pos: Px,
    size: Size,
}

pub struct App {
    hwnd: HWND,
    ctl: Controller,
    renderer: Renderer,
    avatars: HashMap<String, Slot>,
    loader: Sender<String>,
    placed: Option<Placed>,
    timer: bool,
    epoch: Instant,
}

fn area_of(work: &RECT) -> Size {
    Size { w: (work.right - work.left) as f64, h: (work.bottom - work.top) as f64 }
}

/// Área de trabalho e escala (DPI/96) do monitor do jogo.
fn monitor_info(state: &State) -> Option<(RECT, f32)> {
    let m = state.monitor?;
    unsafe {
        let r = RECT { left: m.x, top: m.y, right: m.x + m.width, bottom: m.y + m.height };
        let monitor = MonitorFromRect(&r, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        let work = if GetMonitorInfoW(monitor, &mut info).as_bool() { info.rcWork } else { r };
        let (mut dx, mut dy) = (96u32, 96u32);
        let k = if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dx, &mut dy).is_ok() { dx as f32 / 96.0 } else { 1.0 };
        Some((work, k.max(0.5)))
    }
}

impl App {
    pub fn new(hwnd: HWND, loader: Sender<String>) -> Result<App> {
        Ok(App {
            hwnd,
            ctl: Controller::default(),
            renderer: Renderer::new()?,
            avatars: HashMap::new(),
            loader,
            placed: None,
            timer: false,
            epoch: Instant::now(),
        })
    }

    fn now(&self) -> u64 {
        self.epoch.elapsed().as_millis() as u64
    }

    pub fn on_state(&mut self, state: State) {
        self.request_avatars(&state);
        let effects = self.ctl.on_state(state);
        self.sync_clocks();
        self.apply(effects);
        self.schedule();
    }

    /// Pede os avatares novos e esquece os de quem saiu.
    fn request_avatars(&mut self, state: &State) {
        let wanted: Vec<&String> = state.members.iter().filter_map(|m| m.avatar.as_ref()).collect();
        self.avatars.retain(|path, _| wanted.contains(&path));
        for path in wanted {
            if !self.avatars.contains_key(path) && self.loader.send(path.clone()).is_ok() {
                self.avatars.insert(path.clone(), Slot::Loading);
            }
        }
    }

    pub fn on_avatar(&mut self, path: String, result: std::result::Result<Decoded, String>) {
        let Some(slot) = self.avatars.get_mut(&path) else { return };
        *slot = match result {
            Ok(image) => {
                let clock = Clock::new(image.delays.clone());
                Slot::Ready { image, clock }
            }
            Err(err) => {
                emit(&Event::Error(format!("avatar {path}: {err}")));
                Slot::Failed
            }
        };
        self.sync_clocks();
        self.redraw();
        self.schedule();
    }

    /// GIF anima só para quem fala (o resto fica no primeiro quadro).
    fn sync_clocks(&mut self) {
        let now = self.now();
        let state = self.ctl.state();
        let visible = state.visible;
        let speaking: Vec<&String> =
            state.members.iter().filter(|m| m.speaking && m.animated && visible).filter_map(|m| m.avatar.as_ref()).collect();
        for (path, slot) in self.avatars.iter_mut() {
            if let Slot::Ready { clock, .. } = slot {
                if speaking.contains(&path) {
                    clock.play(now);
                } else {
                    clock.stop();
                }
            }
        }
    }

    /// Um timer só, para o próximo quadro de GIF; sem animação, nenhum.
    fn schedule(&mut self) {
        let due = next_due(self.avatars.values().filter_map(|s| match s {
            Slot::Ready { clock, .. } => Some(clock),
            _ => None,
        }));
        unsafe {
            match due {
                Some(due) => {
                    let wait = due.saturating_sub(self.now()).clamp(10, 60_000) as u32;
                    SetTimer(Some(self.hwnd), GIF_TIMER, wait, None);
                    self.timer = true;
                }
                None if self.timer => {
                    let _ = KillTimer(Some(self.hwnd), GIF_TIMER);
                    self.timer = false;
                }
                None => {}
            }
        }
    }

    pub fn on_timer(&mut self) {
        let now = self.now();
        let mut changed = false;
        for slot in self.avatars.values_mut() {
            if let Slot::Ready { clock, .. } = slot {
                changed |= clock.tick(now);
            }
        }
        if changed {
            self.redraw();
        }
        self.schedule();
    }

    fn apply(&mut self, effects: Vec<Effect>) {
        for effect in effects {
            match effect {
                Effect::Redraw => self.redraw(),
                Effect::Show { raise } => self.show(raise),
                Effect::Hide => unsafe {
                    let _ = ShowWindow(self.hwnd, SW_HIDE);
                    self.placed = None;
                    set_cursor_area(None);
                },
                Effect::ClickThrough(on) => self.click_through(on),
                Effect::ReleaseMouse => unsafe {
                    let _ = ReleaseCapture();
                },
                Effect::Emit(event) => emit(&event),
            }
        }
    }

    fn show(&self, raise: bool) {
        unsafe {
            if raise {
                // Põe no topo (acima do jogo em tela cheia em janela) só quando
                // aparece ou o jogo é outro: cada troca de z-order custa ao DWM.
                let _ = SetWindowPos(self.hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
            }
            let _ = ShowWindow(self.hwnd, SW_SHOWNOACTIVATE);
        }
    }

    fn click_through(&self, on: bool) {
        unsafe {
            let style = GetWindowLongPtrW(self.hwnd, GWL_EXSTYLE);
            let next = if on { style | WS_EX_TRANSPARENT.0 as isize } else { style & !(WS_EX_TRANSPARENT.0 as isize) };
            if next != style {
                SetWindowLongPtrW(self.hwnd, GWL_EXSTYLE, next);
            }
        }
    }

    /// Monta a lista no monitor do jogo e entrega à janela.
    pub fn redraw(&mut self) {
        let Some((work, k)) = monitor_info(self.ctl.state()) else { return };
        let state = self.ctl.state();
        if state.members.is_empty() {
            return;
        }
        let layout = self.ctl.layout();
        let renderer = &self.renderer;
        let measure = |text: &str, size: f32, bold: bool| renderer.measure(text, size, bold);
        let scene: Scene = scene(state, layout.scale, k, &measure);
        let area = area_of(&work);
        let size = Size { w: scene.width as f64, h: scene.height as f64 };
        let pos = place_box(layout.position, area, size, (css::EDGE_MARGIN * k) as f64);
        let editing = state.editing;
        let hint = editing.then(|| hint_rect(pos, size, area, renderer.measure(&state.hint, css::HINT_SIZE * k, false), k));
        let handle = editing.then(|| handle_rect(size, k));
        let win: RectI = window_rect(pos, size, area, css::WINDOW_MARGIN * k, hint);
        let origin = ((pos.left - win.x as f64) as f32, (pos.top - win.y as f64) as f32);

        let avatars = &self.avatars;
        let lookup = |index: usize| -> Option<(&Decoded, usize)> {
            let path = state.members.get(index)?.avatar.as_ref()?;
            match avatars.get(path)? {
                Slot::Ready { image, clock } => Some((image, clock.frame())),
                _ => None,
            }
        };
        let frame = Frame { state, scene: &scene, origin, editing, hint, handle, avatar: &lookup };
        let screen = POINT { x: work.left + win.x, y: work.top + win.y };
        if let Err(err) = self.renderer.present(self.hwnd, screen, SIZE { cx: win.w, cy: win.h }, &frame) {
            emit(&Event::Error(format!("desenho: {err}")));
        }

        set_cursor_area(handle.map(|h| screen_rect(&work, pos, h)));
        self.placed = Some(Placed { work, k, pos, size });
    }

    pub fn on_mouse_down(&mut self, (x, y): (f64, f64)) {
        let Some(p) = self.placed else { return };
        let (ax, ay) = (x - p.work.left as f64, y - p.work.top as f64);
        let handle = handle_rect(p.size, p.k);
        let (bx, by) = ((ax - p.pos.left) as f32, (ay - p.pos.top) as f32);
        let inside = RectF { x: 0.0, y: 0.0, w: p.size.w as f32, h: p.size.h as f32 };
        let mode = if handle.contains(bx, by) {
            DragMode::Resize
        } else if inside.contains(bx, by) {
            DragMode::Move
        } else {
            return;
        };
        if self.ctl.begin_drag(mode, x, y, p.pos, p.size, area_of(&p.work)) {
            unsafe {
                SetCapture(self.hwnd);
            }
        }
    }

    pub fn on_mouse_move(&mut self, (x, y): (f64, f64)) {
        if self.ctl.dragging() && self.ctl.drag_to(x, y) {
            self.redraw();
        }
    }

    pub fn on_mouse_up(&mut self) {
        if self.ctl.dragging() {
            let effects = self.ctl.end_drag();
            self.apply(effects);
        }
    }
}

fn screen_rect(work: &RECT, pos: Px, r: RectF) -> RECT {
    let left = work.left + (pos.left as f32 + r.x).floor() as i32;
    let top = work.top + (pos.top as f32 + r.y).floor() as i32;
    RECT { left, top, right: left + r.w.ceil() as i32, bottom: top + r.h.ceil() as i32 }
}
