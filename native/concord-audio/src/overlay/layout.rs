//! Geometria do overlay nativo, igual à da página do overlay do Electron
//! (frontend/src/renderer/src/overlay/OverlayApp.tsx + overlayLayout.ts):
//! pílulas, caixa da lista, posição na área de trabalho, arraste e janela.
//! Puro (o texto é medido por quem chama): os testes rodam no Linux.
//!
//! Unidades: pixels físicos. `k` = DPI do monitor / 96 (1 px do CSS); dentro da
//! lista tudo ainda é multiplicado pela escala (o `zoom` da página).

use super::protocol::{row_opacity, Layout, Member, Point, State, SCALE_MAX, SCALE_MIN, SCALE_STEP};

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct RectF {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl RectF {
    pub fn right(&self) -> f32 {
        self.x + self.w
    }
    pub fn bottom(&self) -> f32 {
        self.y + self.h
    }
    pub fn contains(&self, x: f32, y: f32) -> bool {
        x >= self.x && x < self.right() && y >= self.y && y < self.bottom()
    }
}

/// Tamanhos do CSS da página do overlay (px, escala 1).
pub mod css {
    /// p-2 + border-2 da caixa da lista.
    pub const BOX_INSET: f32 = 10.0;
    pub const BOX_RADIUS: f32 = 12.0;
    pub const BOX_BORDER: f32 = 2.0;
    pub const ROW_GAP: f32 = 6.0;
    pub const PILL_PAD_LEFT: f32 = 4.0;
    pub const PILL_PAD_RIGHT: f32 = 12.0;
    pub const PILL_PAD_Y: f32 = 4.0;
    pub const PILL_GAP: f32 = 8.0;
    pub const PILL_MAX_W: f32 = 240.0;
    pub const AVATAR: f32 = 28.0;
    pub const RING: f32 = 2.0;
    pub const NAME_SIZE: f32 = 14.0;
    pub const NAME_LINE: f32 = 20.0;
    pub const TAG_SIZE: f32 = 10.0;
    pub const TAG_LINE: f32 = 15.0;
    pub const INITIAL_SIZE: f32 = 12.0;
    pub const ICON: f32 = 14.0;
    pub const ICON_GAP: f32 = 2.0;
    /// gap-1.5 entre o olho e o número do selo de espectadores.
    pub const VIEWERS_GAP: f32 = 6.0;
    pub const MORE_PAD_X: f32 = 12.0;
    pub const HINT_SIZE: f32 = 12.0;
    pub const HINT_LINE: f32 = 16.0;
    pub const HINT_PAD_X: f32 = 8.0;
    pub const HINT_PAD_Y: f32 = 4.0;
    pub const HINT_GAP: f32 = 12.0;
    pub const HINT_RADIUS: f32 = 6.0;
    pub const HANDLE: f32 = 16.0;
    /// O canto de redimensionar sai 8 px para fora da área de conteúdo (-bottom-2 -right-2).
    pub const HANDLE_OUT: f32 = 8.0;
    /// Folga da janela em volta da caixa (OVERLAY_WINDOW_MARGIN).
    pub const WINDOW_MARGIN: f32 = 8.0;
    /// Distância da borda esquerda na posição padrão (OVERLAY_EDGE_MARGIN).
    pub const EDGE_MARGIN: f32 = 8.0;
}

/// Texto a medir: tamanho da fonte em px físicos e se é negrito (senão, médio).
pub type Measure<'a> = &'a dyn Fn(&str, f32, bool) -> f32;

#[derive(Debug, Clone, PartialEq)]
pub struct Pill {
    /// Índice em `State::members`.
    pub index: usize,
    pub rect: RectF,
    /// Círculo do avatar.
    pub avatar: RectF,
    pub name: RectF,
    pub tag: Option<RectF>,
    /// Microfone cortado e, se ensurdecido, fone cortado.
    pub icons: Vec<RectF>,
    /// Olho de quem assiste a minha live (depois dos ícones de mudo).
    pub eye: Option<RectF>,
    /// 0–1.
    pub opacity: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct More {
    pub rect: RectF,
    pub label: String,
    pub opacity: f32,
}

/// Selo "olho + número" de espectadores da minha live, no fim da lista.
#[derive(Debug, Clone, PartialEq)]
pub struct Viewers {
    pub rect: RectF,
    pub eye: RectF,
    pub label: String,
    pub label_rect: RectF,
    pub opacity: f32,
}

/// A lista montada, em coordenadas da caixa (0,0 = canto da caixa).
#[derive(Debug, Clone, PartialEq)]
pub struct Scene {
    pub width: f32,
    pub height: f32,
    pub pills: Vec<Pill>,
    pub more: Option<More>,
    pub viewers: Option<Viewers>,
    /// k × escala: tamanho de 1 px do CSS dentro da lista.
    pub unit: f32,
    pub k: f32,
}

fn pill(index: usize, member: &Member, top: f32, u: f32, opacity: u32, measure: Measure) -> Pill {
    use css::*;
    let height = (PILL_PAD_Y * 2.0 + AVATAR) * u;
    let mid = top + height / 2.0;
    let mut x = PILL_PAD_LEFT * u;
    let avatar = RectF { x, y: mid - AVATAR * u / 2.0, w: AVATAR * u, h: AVATAR * u };
    x += AVATAR * u + PILL_GAP * u;

    let tag_w = member.tag.as_deref().map(|t| measure(t, TAG_SIZE * u, false).ceil());
    let icon_count = if member.deafened { 2 } else if member.muted { 1 } else { 0 };
    let icons_w = if icon_count == 0 { 0.0 } else { (ICON * icon_count as f32 + ICON_GAP * (icon_count - 1) as f32) * u };
    let eye_w = if member.watching { PILL_GAP * u + ICON * u } else { 0.0 };
    // Tudo menos o nome; o nome corta com "…" quando a pílula passa de 240 px.
    let fixed = x + tag_w.map_or(0.0, |w| PILL_GAP * u + w) + if icon_count > 0 { PILL_GAP * u + icons_w } else { 0.0 } + eye_w + PILL_PAD_RIGHT * u;
    let natural = measure(&member.name, NAME_SIZE * u, member.speaking).ceil();
    let name_w = natural.min(PILL_MAX_W * u - fixed).max(0.0);
    let name = RectF { x, y: mid - NAME_LINE * u / 2.0, w: name_w, h: NAME_LINE * u };
    x += name_w;

    let tag = tag_w.map(|w| {
        x += PILL_GAP * u;
        let r = RectF { x, y: mid - TAG_LINE * u / 2.0, w, h: TAG_LINE * u };
        x += w;
        r
    });
    let mut icons = Vec::new();
    if icon_count > 0 {
        x += PILL_GAP * u;
        for i in 0..icon_count {
            icons.push(RectF { x, y: mid - ICON * u / 2.0, w: ICON * u, h: ICON * u });
            x += ICON * u + if i + 1 < icon_count { ICON_GAP * u } else { 0.0 };
        }
    }
    let eye = member.watching.then(|| {
        x += PILL_GAP * u;
        let r = RectF { x, y: mid - ICON * u / 2.0, w: ICON * u, h: ICON * u };
        x += ICON * u;
        r
    });
    x += PILL_PAD_RIGHT * u;
    Pill {
        index,
        rect: RectF { x: 0.0, y: top, w: x, h: height },
        avatar,
        name,
        tag,
        icons,
        eye,
        opacity: row_opacity(opacity, member.speaking) as f32 / 100.0,
    }
}

fn shift(r: RectF, dx: f32, dy: f32) -> RectF {
    RectF { x: r.x + dx, y: r.y + dy, ..r }
}

/// Selo de espectadores (mesma altura do "+N"): olho, espaço e o número.
fn viewers_badge(count: u32, top: f32, u: f32, opacity: u32, measure: Measure) -> Viewers {
    use css::*;
    let label = count.to_string();
    let text_w = measure(&label, NAME_SIZE * u, false).ceil();
    let h = (PILL_PAD_Y * 2.0 + NAME_LINE) * u;
    let mid = top + h / 2.0;
    let eye = RectF { x: MORE_PAD_X * u, y: mid - ICON * u / 2.0, w: ICON * u, h: ICON * u };
    let label_rect = RectF { x: eye.right() + VIEWERS_GAP * u, y: mid - NAME_LINE * u / 2.0, w: text_w, h: NAME_LINE * u };
    let rect = RectF { x: 0.0, y: top, w: label_rect.right() + MORE_PAD_X * u, h };
    Viewers { rect, eye, label, label_rect, opacity: row_opacity(opacity, false) as f32 / 100.0 }
}

fn shift_viewers(v: Viewers, by: f32) -> Viewers {
    Viewers { rect: shift(v.rect, by, by), eye: shift(v.eye, by, by), label_rect: shift(v.label_rect, by, by), ..v }
}

/// Monta a lista. `scale` = escala em uso (a salva ou a do arraste); `k` = DPI/96.
pub fn scene(state: &State, scale: f64, k: f32, measure: Measure) -> Scene {
    use css::*;
    let u = k * scale as f32;
    let inset = BOX_INSET * k;
    let mut top = 0.0f32;
    let mut pills = Vec::new();
    for (index, member) in state.members.iter().enumerate() {
        let p = pill(index, member, top, u, state.opacity, measure);
        top += p.rect.h + ROW_GAP * u;
        pills.push(p);
    }
    let more = (state.more > 0).then(|| {
        let label = format!("+{}", state.more);
        let w = MORE_PAD_X * 2.0 * u + measure(&label, NAME_SIZE * u, false).ceil();
        let rect = RectF { x: 0.0, y: top, w, h: (PILL_PAD_Y * 2.0 + NAME_LINE) * u };
        top += rect.h + ROW_GAP * u;
        More { rect, label, opacity: row_opacity(state.opacity, false) as f32 / 100.0 }
    });
    let viewers = state.viewers.map(|count| {
        let badge = viewers_badge(count, top, u, state.opacity, measure);
        top += badge.rect.h + ROW_GAP * u;
        badge
    });
    let column_h = if top > 0.0 { top - ROW_GAP * u } else { 0.0 };
    let column_w = pills.iter().map(|p| p.rect.w).chain(more.iter().map(|m| m.rect.w)).chain(viewers.iter().map(|v| v.rect.w)).fold(0.0, f32::max);

    // Tudo para dentro da caixa (padding + borda, que não escalam).
    for p in &mut pills {
        p.rect = shift(p.rect, inset, inset);
        p.avatar = shift(p.avatar, inset, inset);
        p.name = shift(p.name, inset, inset);
        p.tag = p.tag.map(|t| shift(t, inset, inset));
        for icon in &mut p.icons {
            *icon = shift(*icon, inset, inset);
        }
        p.eye = p.eye.map(|e| shift(e, inset, inset));
    }
    let more = more.map(|m| More { rect: shift(m.rect, inset, inset), ..m });
    let viewers = viewers.map(|v| shift_viewers(v, inset));
    Scene { width: (column_w + inset * 2.0).ceil(), height: (column_h + inset * 2.0).ceil(), pills, more, viewers, unit: u, k }
}

// ---- Posição na área de trabalho (overlayLayout.ts) ----

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Size {
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Px {
    pub left: f64,
    pub top: f64,
}

fn round4(v: f64) -> f64 {
    (v * 10000.0).round() / 10000.0
}

pub fn clamp_box(px: Px, area: Size, size: Size) -> Px {
    let clamp = |v: f64, max: f64| v.min(max).max(0.0).round();
    Px { left: clamp(px.left, area.w - size.w), top: clamp(px.top, area.h - size.h) }
}

pub fn pixels_to_fraction(px: Px, area: Size) -> Point {
    let frac = |v: f64, size: f64| if size > 0.0 { round4((v / size).clamp(0.0, 1.0)) } else { 0.0 };
    Point { x: frac(px.left, area.w), y: frac(px.top, area.h) }
}

/// Onde a caixa aparece: posição salva (ou a padrão, borda esquerda no meio), sempre inteira.
pub fn place_box(position: Option<Point>, area: Size, size: Size, edge: f64) -> Px {
    let px = match position {
        Some(p) => Px { left: (p.x * area.w).round(), top: (p.y * area.h).round() },
        None => Px { left: edge, top: (area.h - size.h) / 2.0 },
    };
    clamp_box(px, area, size)
}

pub fn move_box(start: Px, dx: f64, dy: f64, area: Size, size: Size) -> Point {
    pixels_to_fraction(clamp_box(Px { left: start.left + dx, top: start.top + dy }, area, size), area)
}

/// Puxar o canto: a escala cresce na proporção em que largura + altura cresceriam.
pub fn resize_scale(start_scale: f64, start: Size, dx: f64, dy: f64) -> f64 {
    let clamp = |v: f64| round4(((v / SCALE_STEP).round() * SCALE_STEP).clamp(SCALE_MIN, SCALE_MAX));
    let size = start.w + start.h;
    if size <= 0.0 {
        return clamp(start_scale);
    }
    clamp(start_scale * (size + dx + dy) / size)
}

/// Último arraste, válido enquanto o salvo for o de quando ele começou.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Draft {
    pub layout: Layout,
    pub base: Layout,
}

pub fn shown_layout(saved: Layout, draft: Option<Draft>) -> Layout {
    match draft {
        Some(d) if d.base == saved => d.layout,
        _ => saved,
    }
}

pub fn settle_draft(saved: Layout, draft: Option<Draft>) -> Option<Draft> {
    draft.filter(|d| d.base == saved)
}

// ---- Janela ----

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RectI {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Dica da edição, em coordenadas da caixa: embaixo se couber, à direita se a
/// caixa está na metade direita (como a página).
pub fn hint_rect(pos: Px, size: Size, area: Size, text_w: f32, k: f32) -> RectF {
    use css::*;
    let w = text_w.ceil() + HINT_PAD_X * 2.0 * k;
    let h = (HINT_LINE + HINT_PAD_Y * 2.0) * k;
    let below = pos.top + size.h + 40.0 * k as f64 <= area.h;
    let right = pos.left + size.w / 2.0 > area.w / 2.0;
    let x = if right { size.w as f32 - w } else { 0.0 };
    let y = if below { size.h as f32 + HINT_GAP * k } else { -HINT_GAP * k - h };
    RectF { x, y, w, h }
}

/// Canto de redimensionar, em coordenadas da caixa.
pub fn handle_rect(size: Size, k: f32) -> RectF {
    use css::*;
    let s = HANDLE * k;
    let off = HANDLE_OUT * k - BOX_BORDER * k - s;
    RectF { x: size.w as f32 + off, y: size.h as f32 + off, w: s, h: s }
}

/// Janela em volta da caixa (com folga), mais a dica se houver, cortada na
/// área de trabalho. Coordenadas da área de trabalho.
pub fn window_rect(pos: Px, size: Size, area: Size, margin: f32, hint: Option<RectF>) -> RectI {
    let m = margin as f64;
    let mut left = pos.left - m;
    let mut top = pos.top - m;
    let mut right = pos.left + size.w + m;
    let mut bottom = pos.top + size.h + m;
    if let Some(h) = hint {
        left = left.min(pos.left + h.x as f64);
        top = top.min(pos.top + h.y as f64);
        right = right.max(pos.left + h.right() as f64);
        bottom = bottom.max(pos.top + h.bottom() as f64);
    }
    let l = left.max(0.0).floor() as i32;
    let t = top.max(0.0).floor() as i32;
    let r = right.min(area.w).ceil() as i32;
    let b = bottom.min(area.h).ceil() as i32;
    RectI { x: l, y: t, w: (r - l).max(1), h: (b - t).max(1) }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 7 px por caractere em 14 px (proporcional ao tamanho), negrito +1 px.
    fn measure(text: &str, size: f32, bold: bool) -> f32 {
        text.chars().count() as f32 * size / 2.0 + if bold { 1.0 } else { 0.0 }
    }

    fn member(name: &str) -> Member {
        Member {
            id: name.into(),
            name: name.into(),
            initial: name[..1].into(),
            avatar: None,
            animated: false,
            tag: None,
            muted: false,
            deafened: false,
            speaking: false,
            watching: false,
        }
    }

    fn state(members: Vec<Member>) -> State {
        State { members, ..State::default() }
    }

    #[test]
    fn uma_pilula_como_no_css() {
        let s = scene(&state(vec![member("Ana")]), 1.0, 1.0, &measure);
        let p = &s.pills[0];
        // 4 + 28 + 8 + 21 (nome) + 12 = 73; altura 4 + 28 + 4.
        assert_eq!(p.rect, RectF { x: 10.0, y: 10.0, w: 73.0, h: 36.0 });
        assert_eq!(p.avatar, RectF { x: 14.0, y: 14.0, w: 28.0, h: 28.0 });
        assert_eq!(p.name, RectF { x: 50.0, y: 18.0, w: 21.0, h: 20.0 });
        assert_eq!((s.width, s.height), (93.0, 56.0));
        assert_eq!(p.opacity, 0.3);
    }

    #[test]
    fn quem_fala_fica_mais_forte() {
        let mut ana = member("Ana");
        ana.speaking = true;
        assert_eq!(scene(&state(vec![ana]), 1.0, 1.0, &measure).pills[0].opacity, 0.7);
    }

    #[test]
    fn etiqueta_e_icones_de_mudo_e_surdo() {
        let mut me = member("Ana");
        me.tag = Some("VOCÊ".into());
        me.muted = true;
        me.deafened = true;
        let p = &scene(&state(vec![me]), 1.0, 1.0, &measure).pills[0];
        let tag = p.tag.unwrap();
        assert_eq!(tag.x, 50.0 + 21.0 + 8.0);
        assert_eq!(tag.w, 20.0);
        assert_eq!(p.icons.len(), 2);
        assert_eq!(p.icons[0].x, tag.right() + 8.0);
        assert_eq!(p.icons[1].x, p.icons[0].right() + 2.0);
        assert_eq!(p.rect.right(), p.icons[1].right() + 12.0);
    }

    #[test]
    fn so_mudo_tem_um_icone() {
        let mut ana = member("Ana");
        ana.muted = true;
        assert_eq!(scene(&state(vec![ana]), 1.0, 1.0, &measure).pills[0].icons.len(), 1);
    }

    #[test]
    fn nome_comprido_corta_em_240() {
        let s = scene(&state(vec![member(&"x".repeat(100))]), 1.0, 1.0, &measure);
        let p = &s.pills[0];
        assert_eq!(p.rect.w, 240.0);
        assert_eq!(p.name.w, 240.0 - 4.0 - 28.0 - 8.0 - 12.0);
    }

    #[test]
    fn escala_e_dpi_multiplicam_a_lista_mas_nao_o_padding() {
        let mut st = state(vec![member("Ana")]);
        st.layout.scale = 1.5;
        let s = scene(&st, st.layout.scale, 2.0, &measure);
        let p = &s.pills[0];
        assert_eq!(s.unit, 3.0);
        assert_eq!(p.rect.x, 20.0);
        assert_eq!(p.rect.h, 36.0 * 3.0);
        assert_eq!(s.height, 36.0 * 3.0 + 40.0);
    }

    #[test]
    fn varias_pilulas_e_mais_n() {
        let mut st = state(vec![member("Ana"), member("Bruno")]);
        st.more = 4;
        let s = scene(&st, 1.0, 1.0, &measure);
        assert_eq!(s.pills[1].rect.y, 10.0 + 36.0 + 6.0);
        let more = s.more.unwrap();
        assert_eq!(more.label, "+4");
        assert_eq!(more.rect.y, s.pills[1].rect.bottom() + 6.0);
        assert_eq!(more.rect.h, 28.0);
        assert_eq!(more.rect.w, 24.0 + 14.0);
        assert_eq!(s.height, more.rect.bottom() + 10.0);
        assert_eq!(s.width, s.pills[1].rect.w + 20.0);
    }

    #[test]
    fn olho_de_quem_assiste_vem_depois_dos_icones_e_alarga_a_pilula() {
        let mut ana = member("Ana");
        ana.muted = true;
        ana.watching = true;
        let p = &scene(&state(vec![ana.clone()]), 1.0, 1.0, &measure).pills[0];
        let eye = p.eye.unwrap();
        assert_eq!((eye.w, eye.h), (14.0, 14.0));
        assert_eq!(eye.x, p.icons[0].right() + 8.0);
        assert_eq!(p.rect.right(), eye.right() + 12.0);
        ana.watching = false;
        assert!(scene(&state(vec![ana]), 1.0, 1.0, &measure).pills[0].eye.is_none());
    }

    #[test]
    fn olho_entra_na_conta_do_corte_do_nome() {
        let mut m = member(&"x".repeat(100));
        m.watching = true;
        let p = &scene(&state(vec![m]), 1.0, 1.0, &measure).pills[0];
        assert_eq!(p.rect.w, 240.0);
        assert_eq!(p.name.w, 240.0 - 4.0 - 28.0 - 8.0 - (8.0 + 14.0) - 12.0);
    }

    #[test]
    fn selo_de_espectadores_depois_da_lista() {
        let mut st = state(vec![member("Ana")]);
        st.more = 2;
        st.viewers = Some(12);
        let s = scene(&st, 1.0, 1.0, &measure);
        let more = s.more.as_ref().unwrap();
        let v = s.viewers.as_ref().unwrap();
        assert_eq!(v.label, "12");
        assert_eq!(v.rect.y, more.rect.bottom() + 6.0);
        assert_eq!(v.rect.h, 28.0);
        // 12 + 14 (olho) + 6 + 14 (dois dígitos) + 12.
        assert_eq!(v.rect.w, 12.0 + 14.0 + 6.0 + 14.0 + 12.0);
        assert_eq!(v.eye.x, v.rect.x + 12.0);
        assert_eq!(v.label_rect.x, v.eye.right() + 6.0);
        assert_eq!(s.height, v.rect.bottom() + 10.0);
    }

    #[test]
    fn sem_live_nao_tem_selo_e_zero_espectadores_tem() {
        let mut st = state(vec![member("Ana")]);
        assert!(scene(&st, 1.0, 1.0, &measure).viewers.is_none());
        st.viewers = Some(0);
        assert_eq!(scene(&st, 1.0, 1.0, &measure).viewers.unwrap().label, "0");
    }

    #[test]
    fn lista_vazia() {
        let s = scene(&state(vec![]), 1.0, 1.0, &measure);
        assert_eq!((s.width, s.height), (20.0, 20.0));
        assert!(s.pills.is_empty() && s.more.is_none());
    }

    const AREA: Size = Size { w: 1920.0, h: 1040.0 };
    const BOX: Size = Size { w: 200.0, h: 120.0 };

    #[test]
    fn posicao_padrao_borda_esquerda_no_meio() {
        assert_eq!(place_box(None, AREA, BOX, 8.0), Px { left: 8.0, top: 460.0 });
    }

    #[test]
    fn posicao_salva_em_fracao_e_sempre_inteira_na_tela() {
        assert_eq!(place_box(Some(Point { x: 0.5, y: 0.25 }), AREA, BOX, 8.0), Px { left: 960.0, top: 260.0 });
        assert_eq!(place_box(Some(Point { x: 1.0, y: 1.0 }), AREA, BOX, 8.0), Px { left: 1720.0, top: 920.0 });
    }

    #[test]
    fn arrastar_e_redimensionar() {
        let start = Px { left: 100.0, top: 100.0 };
        assert_eq!(move_box(start, 860.0, 160.0, AREA, BOX), Point { x: 0.5, y: 0.25 });
        assert_eq!(move_box(start, -500.0, 0.0, AREA, BOX).x, 0.0);
        assert_eq!(resize_scale(1.0, BOX, 32.0, 0.0), 1.1);
        assert_eq!(resize_scale(1.0, BOX, -1000.0, 0.0), SCALE_MIN);
        assert_eq!(resize_scale(1.0, Size { w: 0.0, h: 0.0 }, 5.0, 5.0), 1.0);
    }

    #[test]
    fn rascunho_vale_ate_o_salvo_mudar() {
        let saved = Layout::default();
        let dragged = Layout { position: Some(Point { x: 0.5, y: 0.5 }), scale: 1.0 };
        let draft = Some(Draft { layout: dragged, base: saved });
        assert_eq!(shown_layout(saved, draft), dragged);
        assert_eq!(settle_draft(saved, draft), draft);
        // Chegou o salvo novo (ou "Restaurar posição"): o rascunho acabou.
        assert_eq!(shown_layout(dragged, draft), dragged);
        assert_eq!(settle_draft(dragged, draft), None);
    }

    #[test]
    fn janela_em_volta_da_caixa_cortada_na_area() {
        let r = window_rect(Px { left: 8.0, top: 460.0 }, BOX, AREA, 8.0, None);
        assert_eq!(r, RectI { x: 0, y: 452, w: 216, h: 136 });
        let r = window_rect(Px { left: 1720.0, top: 920.0 }, BOX, AREA, 8.0, None);
        assert_eq!(r, RectI { x: 1712, y: 912, w: 208, h: 128 });
    }

    #[test]
    fn editando_a_janela_inclui_a_dica() {
        let pos = Px { left: 8.0, top: 460.0 };
        let hint = hint_rect(pos, BOX, AREA, 300.0, 1.0);
        assert_eq!(hint, RectF { x: 0.0, y: 132.0, w: 316.0, h: 24.0 });
        let r = window_rect(pos, BOX, AREA, 8.0, Some(hint));
        assert_eq!(r, RectI { x: 0, y: 452, w: 324, h: 616 - 452 });
    }

    #[test]
    fn dica_em_cima_e_a_direita_perto_do_canto() {
        let pos = Px { left: 1720.0, top: 920.0 };
        let hint = hint_rect(pos, BOX, AREA, 300.0, 1.0);
        assert_eq!(hint, RectF { x: 200.0 - 316.0, y: -12.0 - 24.0, w: 316.0, h: 24.0 });
    }

    #[test]
    fn canto_de_redimensionar_sai_um_pouco_da_caixa() {
        let h = handle_rect(BOX, 1.0);
        assert_eq!(h, RectF { x: 190.0, y: 110.0, w: 16.0, h: 16.0 });
        assert!(h.contains(205.0, 125.0));
    }
}
