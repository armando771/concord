//! Desenho com Direct2D (software) num DIB de 32 bits com alfa por pixel,
//! entregue ao DWM por UpdateLayeredWindow. Software de propósito: a lista é
//! pequena e só é redesenhada quando muda, então não vale um dispositivo
//! Direct3D (e um contexto na GPU) vivo o tempo todo ao lado do jogo.

use std::cell::RefCell;
use std::collections::HashMap;
use std::mem::ManuallyDrop;

use windows::core::{w, Result};
use windows::Win32::Foundation::{COLORREF, HWND, POINT, RECT, SIZE};
use windows::Win32::Graphics::Direct2D::Common::{
    D2D1_ALPHA_MODE_PREMULTIPLIED, D2D1_BEZIER_SEGMENT, D2D1_COLOR_F, D2D1_FIGURE_BEGIN_FILLED, D2D1_FIGURE_END_CLOSED,
    D2D1_FIGURE_END_OPEN, D2D1_FILL_MODE_WINDING, D2D1_PIXEL_FORMAT, D2D_RECT_F, D2D_SIZE_U,
};
use windows::Win32::Graphics::Direct2D::{
    D2D1CreateFactory, ID2D1Brush, ID2D1DCRenderTarget, ID2D1Factory, ID2D1PathGeometry, ID2D1SolidColorBrush,
    ID2D1StrokeStyle, D2D1_ANTIALIAS_MODE_PER_PRIMITIVE, D2D1_BITMAP_BRUSH_PROPERTIES, D2D1_BITMAP_INTERPOLATION_MODE_LINEAR,
    D2D1_BITMAP_PROPERTIES, D2D1_BRUSH_PROPERTIES, D2D1_CAP_STYLE_FLAT, D2D1_CAP_STYLE_ROUND, D2D1_DASH_STYLE_DASH,
    D2D1_DASH_STYLE_SOLID, D2D1_DRAW_TEXT_OPTIONS_CLIP, D2D1_DRAW_TEXT_OPTIONS_ENABLE_COLOR_FONT, D2D1_ELLIPSE,
    D2D1_EXTEND_MODE_CLAMP, D2D1_FACTORY_TYPE_SINGLE_THREADED, D2D1_FEATURE_LEVEL_DEFAULT, D2D1_LAYER_OPTIONS_NONE,
    D2D1_LAYER_PARAMETERS, D2D1_LINE_JOIN_ROUND, D2D1_RENDER_TARGET_PROPERTIES, D2D1_RENDER_TARGET_TYPE_SOFTWARE,
    D2D1_RENDER_TARGET_USAGE_NONE, D2D1_ROUNDED_RECT, D2D1_STROKE_STYLE_PROPERTIES, D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE,
};
use windows::Win32::Graphics::DirectWrite::{
    DWriteCreateFactory, IDWriteFactory, IDWriteFontCollection, IDWriteTextFormat, DWRITE_FACTORY_TYPE_SHARED,
    DWRITE_FONT_STRETCH_NORMAL, DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_WEIGHT_BOLD, DWRITE_FONT_WEIGHT_MEDIUM,
    DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_TEXT_ALIGNMENT_CENTER, DWRITE_TEXT_METRICS, DWRITE_TRIMMING,
    DWRITE_TRIMMING_GRANULARITY_CHARACTER, DWRITE_WORD_WRAPPING_NO_WRAP,
};
use windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT_B8G8R8A8_UNORM;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject, AC_SRC_ALPHA, AC_SRC_OVER,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS, HBITMAP, HDC, HGDIOBJ,
};
use windows::Win32::UI::WindowsAndMessaging::{UpdateLayeredWindow, ULW_ALPHA};
use windows_numerics::{Matrix3x2, Vector2};

use crate::overlay::gif::Decoded;
use crate::overlay::icons::{parse_path, Seg, EYE, HEADSET, HEADSET_SLASH, MIC_OFF};
use crate::overlay::layout::{css, RectF, Scene};
use crate::overlay::protocol::{Color, State};

/// Fonte do sistema (a Outfit do app vem empacotada só no renderer).
const FONT: windows::core::PCWSTR = w!("Segoe UI");

/// O que a janela desenha agora (coordenadas da janela, pixels físicos).
pub struct Frame<'a> {
    pub state: &'a State,
    pub scene: &'a Scene,
    /// Canto da caixa da lista dentro da janela.
    pub origin: (f32, f32),
    pub editing: bool,
    /// Dica e canto de redimensionar, em coordenadas da caixa (só editando).
    pub hint: Option<RectF>,
    pub handle: Option<RectF>,
    /// Avatar pronto de cada pílula e o quadro a mostrar.
    pub avatar: &'a dyn Fn(usize) -> Option<(&'a Decoded, usize)>,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct FormatKey {
    size: u32,
    bold: bool,
    centered: bool,
}

pub struct Renderer {
    d2d: ID2D1Factory,
    dwrite: IDWriteFactory,
    rt: ID2D1DCRenderTarget,
    formats: RefCell<HashMap<FormatKey, IDWriteTextFormat>>,
    mic: ID2D1PathGeometry,
    headset: ID2D1PathGeometry,
    eye: ID2D1PathGeometry,
    round: ID2D1StrokeStyle,
    dashed: ID2D1StrokeStyle,
    memory_dc: HDC,
    dib: Option<(HBITMAP, HGDIOBJ, i32, i32)>,
}

fn color(c: Color, alpha: f32) -> D2D1_COLOR_F {
    D2D1_COLOR_F { r: c.r as f32 / 255.0, g: c.g as f32 / 255.0, b: c.b as f32 / 255.0, a: alpha }
}

fn rect(r: RectF) -> D2D_RECT_F {
    D2D_RECT_F { left: r.x, top: r.y, right: r.right(), bottom: r.bottom() }
}

fn rounded(r: RectF, radius: f32) -> D2D1_ROUNDED_RECT {
    D2D1_ROUNDED_RECT { rect: rect(r), radiusX: radius, radiusY: radius }
}

fn inset(r: RectF, by: f32) -> RectF {
    RectF { x: r.x + by, y: r.y + by, w: (r.w - by * 2.0).max(0.0), h: (r.h - by * 2.0).max(0.0) }
}

fn offset(r: RectF, (dx, dy): (f32, f32)) -> RectF {
    RectF { x: r.x + dx, y: r.y + dy, ..r }
}

fn utf16(text: &str) -> Vec<u16> {
    text.encode_utf16().collect()
}

fn geometry(factory: &ID2D1Factory, d: &str) -> Result<ID2D1PathGeometry> {
    let segs = parse_path(d).unwrap_or_default();
    unsafe {
        let geometry = factory.CreatePathGeometry()?;
        let sink = geometry.Open()?;
        sink.SetFillMode(D2D1_FILL_MODE_WINDING);
        let mut open = false;
        for seg in segs {
            match seg {
                Seg::Move(x, y) => {
                    if open {
                        sink.EndFigure(D2D1_FIGURE_END_OPEN);
                    }
                    sink.BeginFigure(Vector2::new(x, y), D2D1_FIGURE_BEGIN_FILLED);
                    open = true;
                }
                Seg::Line(x, y) => sink.AddLine(Vector2::new(x, y)),
                Seg::Cubic(x1, y1, x2, y2, x, y) => sink.AddBezier(&D2D1_BEZIER_SEGMENT {
                    point1: Vector2::new(x1, y1),
                    point2: Vector2::new(x2, y2),
                    point3: Vector2::new(x, y),
                }),
                Seg::Close => {
                    if open {
                        sink.EndFigure(D2D1_FIGURE_END_CLOSED);
                        open = false;
                    }
                }
            }
        }
        if open {
            sink.EndFigure(D2D1_FIGURE_END_OPEN);
        }
        sink.Close()?;
        Ok(geometry)
    }
}

fn stroke(factory: &ID2D1Factory, cap: windows::Win32::Graphics::Direct2D::D2D1_CAP_STYLE, dashed: bool) -> Result<ID2D1StrokeStyle> {
    let props = D2D1_STROKE_STYLE_PROPERTIES {
        startCap: cap,
        endCap: cap,
        dashCap: cap,
        lineJoin: D2D1_LINE_JOIN_ROUND,
        miterLimit: 10.0,
        dashStyle: if dashed { D2D1_DASH_STYLE_DASH } else { D2D1_DASH_STYLE_SOLID },
        dashOffset: 0.0,
    };
    unsafe { factory.CreateStrokeStyle(&props, None) }
}

fn render_target(factory: &ID2D1Factory) -> Result<ID2D1DCRenderTarget> {
    let props = D2D1_RENDER_TARGET_PROPERTIES {
        r#type: D2D1_RENDER_TARGET_TYPE_SOFTWARE,
        pixelFormat: D2D1_PIXEL_FORMAT { format: DXGI_FORMAT_B8G8R8A8_UNORM, alphaMode: D2D1_ALPHA_MODE_PREMULTIPLIED },
        dpiX: 96.0,
        dpiY: 96.0,
        usage: D2D1_RENDER_TARGET_USAGE_NONE,
        minLevel: D2D1_FEATURE_LEVEL_DEFAULT,
    };
    unsafe {
        let rt = factory.CreateDCRenderTarget(&props)?;
        // ClearType num fundo transparente sai com franja colorida.
        rt.SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE);
        Ok(rt)
    }
}

impl Renderer {
    pub fn new() -> Result<Renderer> {
        unsafe {
            let d2d: ID2D1Factory = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, None)?;
            let dwrite: IDWriteFactory = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED)?;
            let rt = render_target(&d2d)?;
            let mic = geometry(&d2d, MIC_OFF)?;
            let headset = geometry(&d2d, HEADSET)?;
            let eye = geometry(&d2d, EYE)?;
            let round = stroke(&d2d, D2D1_CAP_STYLE_ROUND, false)?;
            let dashed = stroke(&d2d, D2D1_CAP_STYLE_FLAT, true)?;
            let memory_dc = CreateCompatibleDC(None);
            Ok(Renderer { d2d, dwrite, rt, formats: RefCell::new(HashMap::new()), mic, headset, eye, round, dashed, memory_dc, dib: None })
        }
    }

    fn format(&self, size: f32, bold: bool, centered: bool) -> Option<IDWriteTextFormat> {
        let key = FormatKey { size: (size * 100.0).round() as u32, bold, centered };
        if let Some(f) = self.formats.borrow().get(&key) {
            return Some(f.clone());
        }
        let weight = if bold { DWRITE_FONT_WEIGHT_BOLD } else { DWRITE_FONT_WEIGHT_MEDIUM };
        let format = unsafe {
            let f = self
                .dwrite
                .CreateTextFormat(FONT, None::<&IDWriteFontCollection>, weight, DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, size.max(1.0), w!("pt-BR"))
                .ok()?;
            let _ = f.SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
            let _ = f.SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);
            if centered {
                let _ = f.SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);
            }
            // Nome comprido termina em "…" (o truncate do CSS).
            if let Ok(sign) = self.dwrite.CreateEllipsisTrimmingSign(&f) {
                let trimming = DWRITE_TRIMMING { granularity: DWRITE_TRIMMING_GRANULARITY_CHARACTER, delimiter: 0, delimiterCount: 0 };
                let _ = f.SetTrimming(&trimming, &sign);
            }
            f
        };
        self.formats.borrow_mut().insert(key, format.clone());
        Some(format)
    }

    /// Largura do texto em px físicos (fonte de `size` px).
    pub fn measure(&self, text: &str, size: f32, bold: bool) -> f32 {
        let Some(format) = self.format(size, bold, false) else { return text.chars().count() as f32 * size * 0.55 };
        unsafe {
            let Ok(layout) = self.dwrite.CreateTextLayout(&utf16(text), &format, 100_000.0, size * 2.0) else { return 0.0 };
            let mut metrics = DWRITE_TEXT_METRICS::default();
            if layout.GetMetrics(&mut metrics).is_err() {
                return 0.0;
            }
            metrics.width
        }
    }

    /// DIB do tamanho da janela (só recria quando o tamanho muda).
    fn ensure_dib(&mut self, w: i32, h: i32) -> Result<()> {
        if let Some((_, _, cw, ch)) = self.dib {
            if cw == w && ch == h {
                return Ok(());
            }
        }
        self.free_dib();
        unsafe {
            let info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bits = std::ptr::null_mut();
            let bitmap = CreateDIBSection(Some(self.memory_dc), &info, DIB_RGB_COLORS, &mut bits, None, 0)?;
            let old = SelectObject(self.memory_dc, bitmap.into());
            self.dib = Some((bitmap, old, w, h));
        }
        Ok(())
    }

    fn free_dib(&mut self) {
        if let Some((bitmap, old, _, _)) = self.dib.take() {
            unsafe {
                SelectObject(self.memory_dc, old);
                let _ = DeleteObject(bitmap.into());
            }
        }
    }

    /// Desenha e entrega à janela em `pos` (tela, pixels físicos).
    pub fn present(&mut self, hwnd: HWND, pos: POINT, size: SIZE, frame: &Frame) -> Result<()> {
        self.ensure_dib(size.cx, size.cy)?;
        unsafe {
            self.rt.BindDC(self.memory_dc, &RECT { left: 0, top: 0, right: size.cx, bottom: size.cy })?;
            self.rt.BeginDraw();
            self.rt.Clear(Some(&D2D1_COLOR_F { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }));
            let drawn = self.draw(frame);
            let ended = self.rt.EndDraw(None, None);
            if ended.is_err() {
                // D2DERR_RECREATE_TARGET e afins: alvo novo no próximo desenho.
                if let Ok(rt) = render_target(&self.d2d) {
                    self.rt = rt;
                }
            }
            drawn?;
            ended?;
            let screen = GetDC(None);
            let blend = BLENDFUNCTION { BlendOp: AC_SRC_OVER as u8, BlendFlags: 0, SourceConstantAlpha: 255, AlphaFormat: AC_SRC_ALPHA as u8 };
            let result = UpdateLayeredWindow(
                hwnd,
                Some(screen),
                Some(&pos),
                Some(&size),
                Some(self.memory_dc),
                Some(&POINT { x: 0, y: 0 }),
                COLORREF(0),
                Some(&blend),
                ULW_ALPHA,
            );
            ReleaseDC(None, screen);
            result
        }
    }

    fn brush(&self, c: D2D1_COLOR_F) -> Result<ID2D1SolidColorBrush> {
        unsafe { self.rt.CreateSolidColorBrush(&c, None) }
    }

    fn text(&self, text: &str, at: RectF, size: f32, bold: bool, centered: bool, c: D2D1_COLOR_F) -> Result<()> {
        let Some(format) = self.format(size, bold, centered) else { return Ok(()) };
        unsafe {
            let layout = self.dwrite.CreateTextLayout(&utf16(text), &format, at.w.max(1.0), at.h.max(1.0))?;
            let brush = self.brush(c)?;
            self.rt.DrawTextLayout(
                Vector2::new(at.x, at.y),
                &layout,
                &brush,
                D2D1_DRAW_TEXT_OPTIONS_ENABLE_COLOR_FONT | D2D1_DRAW_TEXT_OPTIONS_CLIP,
            );
        }
        Ok(())
    }

    fn draw(&self, f: &Frame) -> Result<()> {
        let theme = &f.state.theme;
        let k = f.scene.k;
        let box_rect = RectF { x: f.origin.0, y: f.origin.1, w: f.scene.width, h: f.scene.height };
        unsafe {
            if f.editing {
                // Moldura tracejada sobre um véu leve (bg-black/20 border-dashed border-brand).
                let border = css::BOX_BORDER * k;
                let veil = rounded(inset(box_rect, border / 2.0), css::BOX_RADIUS * k);
                self.rt.FillRoundedRectangle(&veil, &self.brush(D2D1_COLOR_F { r: 0.0, g: 0.0, b: 0.0, a: 0.2 })?);
                self.rt.DrawRoundedRectangle(&veil, &self.brush(color(theme.brand, 1.0))?, border, &self.dashed);
            }
            let layer = self.rt.CreateLayer(None)?;
            for pill in &f.scene.pills {
                let Some(member) = f.state.members.get(pill.index) else { continue };
                self.rt.PushLayer(&layer_params(pill.opacity), &layer);
                let r = offset(pill.rect, f.origin);
                self.rt.FillRoundedRectangle(&rounded(r, r.h / 2.0), &self.brush(color(theme.floating, 0.85))?);
                self.avatar(member, offset(pill.avatar, f.origin), (f.avatar)(pill.index), f)?;
                let name_color = if member.speaking { theme.strong } else { theme.normal };
                self.text(&member.name, offset(pill.name, f.origin), css::NAME_SIZE * f.scene.unit, member.speaking, false, color(name_color, 1.0))?;
                if let (Some(tag), Some(t)) = (&member.tag, pill.tag) {
                    self.text(tag, offset(t, f.origin), css::TAG_SIZE * f.scene.unit, false, false, color(theme.muted, 1.0))?;
                }
                for (i, icon) in pill.icons.iter().enumerate() {
                    self.icon(i == 1, offset(*icon, f.origin), color(theme.danger, 1.0))?;
                }
                if let Some(eye) = pill.eye {
                    self.eye(offset(eye, f.origin), color(theme.speaking, 1.0))?;
                }
                self.rt.PopLayer();
            }
            if let Some(more) = &f.scene.more {
                self.rt.PushLayer(&layer_params(more.opacity), &layer);
                let r = offset(more.rect, f.origin);
                self.rt.FillRoundedRectangle(&rounded(r, r.h / 2.0), &self.brush(color(theme.floating, 0.85))?);
                self.text(&more.label, r, css::NAME_SIZE * f.scene.unit, false, true, color(theme.normal, 1.0))?;
                self.rt.PopLayer();
            }
            if let Some(v) = &f.scene.viewers {
                self.rt.PushLayer(&layer_params(v.opacity), &layer);
                let r = offset(v.rect, f.origin);
                self.rt.FillRoundedRectangle(&rounded(r, r.h / 2.0), &self.brush(color(theme.floating, 0.85))?);
                self.eye(offset(v.eye, f.origin), color(theme.speaking, 1.0))?;
                self.text(&v.label, offset(v.label_rect, f.origin), css::NAME_SIZE * f.scene.unit, false, false, color(theme.normal, 1.0))?;
                self.rt.PopLayer();
            }
            if let Some(h) = f.handle {
                let r = offset(h, f.origin);
                let border = css::BOX_BORDER * k;
                let shape = rounded(inset(r, border / 2.0), 4.0 * k);
                self.rt.FillRoundedRectangle(&shape, &self.brush(color(theme.floating, 1.0))?);
                self.rt.DrawRoundedRectangle(&shape, &self.brush(color(theme.brand, 1.0))?, border, None::<&ID2D1StrokeStyle>);
            }
            if let Some(h) = f.hint {
                let r = offset(h, f.origin);
                self.rt.FillRoundedRectangle(&rounded(r, css::HINT_RADIUS * k), &self.brush(color(theme.floating, 1.0))?);
                let text = RectF { x: r.x + css::HINT_PAD_X * k, y: r.y, w: r.w - css::HINT_PAD_X * 2.0 * k, h: r.h };
                self.text(&f.state.hint, text, css::HINT_SIZE * k, false, false, color(theme.normal, 1.0))?;
            }
        }
        Ok(())
    }

    fn avatar(&self, member: &crate::overlay::protocol::Member, r: RectF, image: Option<(&Decoded, usize)>, f: &Frame) -> Result<()> {
        let theme = &f.state.theme;
        let u = f.scene.unit;
        let radius = r.w / 2.0;
        let center = Vector2::new(r.x + radius, r.y + radius);
        let ellipse = D2D1_ELLIPSE { point: center, radiusX: radius, radiusY: radius };
        unsafe {
            match image.and_then(|(img, i)| img.frames.get(i).map(|px| (img.side, px))) {
                Some((side, pixels)) => {
                    let props = D2D1_BITMAP_PROPERTIES {
                        pixelFormat: D2D1_PIXEL_FORMAT { format: DXGI_FORMAT_B8G8R8A8_UNORM, alphaMode: D2D1_ALPHA_MODE_PREMULTIPLIED },
                        dpiX: 96.0,
                        dpiY: 96.0,
                    };
                    let bitmap = self.rt.CreateBitmap(D2D_SIZE_U { width: side, height: side }, Some(pixels.as_ptr() as _), side * 4, &props)?;
                    let brush_props = D2D1_BITMAP_BRUSH_PROPERTIES {
                        extendModeX: D2D1_EXTEND_MODE_CLAMP,
                        extendModeY: D2D1_EXTEND_MODE_CLAMP,
                        interpolationMode: D2D1_BITMAP_INTERPOLATION_MODE_LINEAR,
                    };
                    let s = r.w / side as f32;
                    let transform = Matrix3x2::scale(s, s) * Matrix3x2::translation(r.x, r.y);
                    let brush = self.rt.CreateBitmapBrush(&bitmap, Some(&brush_props), Some(&D2D1_BRUSH_PROPERTIES { opacity: 1.0, transform }))?;
                    self.rt.FillEllipse(&ellipse, &brush);
                }
                None => {
                    self.rt.FillEllipse(&ellipse, &self.brush(color(theme.brand, 1.0))?);
                    let white = D2D1_COLOR_F { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
                    self.text(&member.initial, r, css::INITIAL_SIZE * u, true, true, white)?;
                }
            }
            if member.speaking {
                // ring-2 ring-success: anel de 2 px por fora do avatar.
                let ring = D2D1_ELLIPSE { point: center, radiusX: radius + css::RING * u / 2.0, radiusY: radius + css::RING * u / 2.0 };
                self.rt.DrawEllipse(&ring, &self.brush(color(theme.speaking, 1.0))?, css::RING * u, None::<&ID2D1StrokeStyle>);
            }
        }
        Ok(())
    }

    /// Olho preenchido (EyeIcon do app) no quadrado `r`.
    fn eye(&self, r: RectF, c: D2D1_COLOR_F) -> Result<()> {
        let s = r.w / 24.0;
        unsafe {
            self.rt.SetTransform(&(Matrix3x2::scale(s, s) * Matrix3x2::translation(r.x, r.y)));
            self.rt.FillGeometry(&self.eye, &self.brush(c)?, None::<&ID2D1Brush>);
            self.rt.SetTransform(&Matrix3x2::identity());
        }
        Ok(())
    }

    fn icon(&self, headset: bool, r: RectF, c: D2D1_COLOR_F) -> Result<()> {
        let s = r.w / 24.0;
        unsafe {
            self.rt.SetTransform(&(Matrix3x2::scale(s, s) * Matrix3x2::translation(r.x, r.y)));
            let brush = self.brush(c)?;
            if headset {
                self.rt.FillGeometry(&self.headset, &brush, None::<&ID2D1Brush>);
                let ((x0, y0), (x1, y1), width) = HEADSET_SLASH;
                self.rt.DrawLine(Vector2::new(x0, y0), Vector2::new(x1, y1), &brush, width, &self.round);
            } else {
                self.rt.FillGeometry(&self.mic, &brush, None::<&ID2D1Brush>);
            }
            self.rt.SetTransform(&Matrix3x2::identity());
        }
        Ok(())
    }
}

fn layer_params(opacity: f32) -> D2D1_LAYER_PARAMETERS {
    D2D1_LAYER_PARAMETERS {
        contentBounds: D2D_RECT_F { left: -1e7, top: -1e7, right: 1e7, bottom: 1e7 },
        geometricMask: ManuallyDrop::new(None),
        maskAntialiasMode: D2D1_ANTIALIAS_MODE_PER_PRIMITIVE,
        maskTransform: Matrix3x2::identity(),
        opacity,
        opacityBrush: ManuallyDrop::new(None),
        layerOptions: D2D1_LAYER_OPTIONS_NONE,
    }
}

impl Drop for Renderer {
    fn drop(&mut self) {
        self.free_dib();
        unsafe {
            let _ = DeleteDC(self.memory_dc);
        }
    }
}
