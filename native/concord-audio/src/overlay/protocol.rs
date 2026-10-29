//! Mensagens entre a Salinha e o overlay nativo, uma por linha em JSON
//! (contrato em docs/overlay-nativo.md; o lado TS fica em
//! frontend/src/main/overlay/nativeOverlayProtocol.ts).
//!
//! Salinha → helper (stdin): `{"type":"state", ...}`. Tipo desconhecido é
//! ignorado (versões novas podem mandar mais coisas).
//! Helper → Salinha (stdout): `ready`, `layout` (fim do arraste) e `error`.

use super::json::{self, Json};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Color {
    pub const fn rgb(hex: u32) -> Color {
        Color { r: (hex >> 16) as u8, g: (hex >> 8) as u8, b: hex as u8 }
    }

    /// "#rrggbb" (ou "#rrggbbaa", sem o alfa); o resto é None.
    pub fn parse(text: &str) -> Option<Color> {
        let hex = text.strip_prefix('#')?;
        if !(hex.len() == 6 || hex.len() == 8) || !hex.bytes().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
        u32::from_str_radix(&hex[..6], 16).ok().map(Color::rgb)
    }
}

/// Cores do tema em vigor no app (o overlay segue o tema escolhido).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Theme {
    /// Fundo das pílulas (bg-floating, a 85%).
    pub floating: Color,
    /// Nome de quem fala (text-strong).
    pub strong: Color,
    /// Nome dos outros e dica (text-normal).
    pub normal: Color,
    /// Etiqueta "você" (text-muted).
    pub muted: Color,
    /// Fundo do avatar sem foto e moldura da edição (brand).
    pub brand: Color,
    /// Anel de quem fala (green).
    pub speaking: Color,
    /// Microfone/fone cortados (red-400).
    pub danger: Color,
}

impl Default for Theme {
    /// Tema escuro padrão (discord-dark).
    fn default() -> Theme {
        Theme {
            floating: Color::rgb(0x252429),
            strong: Color::rgb(0xfbfbfb),
            normal: Color::rgb(0xefeff1),
            muted: Color::rgb(0x96979e),
            brand: Color::rgb(0x5865f2),
            speaking: Color::rgb(0x45a366),
            danger: Color::rgb(0xff6467),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Posição (fração 0–1 da área de trabalho; None = padrão) e escala da lista.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Layout {
    pub position: Option<Point>,
    pub scale: f64,
}

impl Default for Layout {
    fn default() -> Layout {
        Layout { position: None, scale: 1.0 }
    }
}

/// Retângulo do monitor do jogo em pixels físicos (o que o modo foreground diz).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Monitor {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub initial: String,
    /// Arquivo local do avatar (a Salinha baixa); None = mostra a inicial.
    pub avatar: Option<String>,
    /// O arquivo é um GIF animado: anima só enquanto a pessoa fala.
    pub animated: bool,
    /// Etiqueta depois do nome ("VOCÊ" para o próprio usuário).
    pub tag: Option<String>,
    pub muted: bool,
    pub deafened: bool,
    pub speaking: bool,
    /// Está assistindo a live de quem usa o overlay (olho ao lado do nome).
    pub watching: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct State {
    pub visible: bool,
    pub editing: bool,
    /// Pid do jogo: outro jogo na frente sobe a janela de novo.
    pub game: u32,
    pub monitor: Option<Monitor>,
    /// Opacidade das pílulas em repouso, em % (10–60).
    pub opacity: u32,
    pub layout: Layout,
    /// Dica do modo de edição (texto pronto, vem da Salinha).
    pub hint: String,
    pub theme: Theme,
    pub members: Vec<Member>,
    /// Quantos ficaram de fora ("+N").
    pub more: u32,
    /// Espectadores da live de quem usa o overlay (olho + número); None = sem live.
    pub viewers: Option<u32>,
}

impl Default for State {
    fn default() -> State {
        State {
            visible: false,
            editing: false,
            game: 0,
            monitor: None,
            opacity: OPACITY_DEFAULT,
            layout: Layout::default(),
            hint: String::new(),
            theme: Theme::default(),
            members: Vec::new(),
            more: 0,
            viewers: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Command {
    State(Box<State>),
    /// Tipo que esta versão não conhece.
    Ignored,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    Ready,
    Layout(Layout),
    Error(String),
}

// Mesmas regras de frontend/src/renderer/src/features/overlay/lib/overlayState.ts
// e overlayLayout.ts (a Salinha já manda normalizado; aqui é defesa).
pub const OPACITY_MIN: u32 = 10;
pub const OPACITY_MAX: u32 = 60;
pub const OPACITY_DEFAULT: u32 = 30;
pub const SPEAKING_BOOST: u32 = 40;
pub const SPEAKING_MAX: u32 = 85;
pub const SCALE_MIN: f64 = 0.7;
pub const SCALE_MAX: f64 = 1.6;
pub const SCALE_STEP: f64 = 0.05;
pub const MAX_ROWS: usize = 8;
const MAX_TEXT: usize = 200;

fn round4(v: f64) -> f64 {
    (v * 10000.0).round() / 10000.0
}

pub fn clamp_scale(value: f64) -> f64 {
    if !value.is_finite() {
        return 1.0;
    }
    round4(((value / SCALE_STEP).round() * SCALE_STEP).clamp(SCALE_MIN, SCALE_MAX))
}

pub fn clamp_opacity(value: f64) -> u32 {
    if !value.is_finite() {
        return OPACITY_DEFAULT;
    }
    let stepped = (value / 5.0).round() * 5.0;
    (stepped.clamp(OPACITY_MIN as f64, OPACITY_MAX as f64)) as u32
}

/// Opacidade (em %) de uma pílula: repouso, ou mais forte para quem fala.
pub fn row_opacity(resting: u32, speaking: bool) -> u32 {
    let base = resting.clamp(OPACITY_MIN, OPACITY_MAX);
    if speaking {
        (base + SPEAKING_BOOST).min(SPEAKING_MAX)
    } else {
        base
    }
}

fn text(v: Option<&Json>) -> String {
    let s = v.and_then(Json::as_str).unwrap_or("");
    s.chars().take(MAX_TEXT).collect()
}

fn flag(v: Option<&Json>) -> bool {
    v.and_then(Json::as_bool).unwrap_or(false)
}

fn number(v: Option<&Json>) -> Option<f64> {
    v.and_then(Json::as_f64)
}

fn parse_layout(v: Option<&Json>) -> Layout {
    let Some(v) = v else { return Layout::default() };
    let position = v.get("position").and_then(|p| {
        let x = number(p.get("x"))?;
        let y = number(p.get("y"))?;
        Some(Point { x: round4(x.clamp(0.0, 1.0)), y: round4(y.clamp(0.0, 1.0)) })
    });
    Layout { position, scale: clamp_scale(number(v.get("scale")).unwrap_or(1.0)) }
}

fn parse_monitor(v: Option<&Json>) -> Option<Monitor> {
    let v = v?;
    let int = |key: &str| number(v.get(key)).filter(|n| n.abs() < 1e6).map(|n| n.round() as i32);
    let m = Monitor { x: int("x")?, y: int("y")?, width: int("width")?, height: int("height")? };
    (m.width > 0 && m.height > 0).then_some(m)
}

fn parse_theme(v: Option<&Json>) -> Theme {
    let base = Theme::default();
    let Some(v) = v else { return base };
    let color = |key: &str, fallback: Color| v.get(key).and_then(Json::as_str).and_then(Color::parse).unwrap_or(fallback);
    Theme {
        floating: color("floating", base.floating),
        strong: color("strong", base.strong),
        normal: color("normal", base.normal),
        muted: color("muted", base.muted),
        brand: color("brand", base.brand),
        speaking: color("speaking", base.speaking),
        danger: color("danger", base.danger),
    }
}

fn parse_member(v: &Json) -> Member {
    let name = text(v.get("name"));
    let name = if name.trim().is_empty() { "Usuário".to_string() } else { name };
    let initial = text(v.get("initial"));
    let initial = if initial.is_empty() { name.chars().take(1).flat_map(char::to_uppercase).collect() } else { initial };
    let avatar = v.get("avatar").and_then(Json::as_str).filter(|p| !p.is_empty()).map(str::to_string);
    let tag = v.get("tag").and_then(Json::as_str).filter(|t| !t.is_empty()).map(|t| t.chars().take(20).collect());
    let muted = flag(v.get("muted"));
    Member {
        id: text(v.get("id")),
        name,
        initial,
        avatar,
        animated: flag(v.get("animated")),
        tag,
        muted,
        deafened: flag(v.get("deafened")),
        // Mesmo que no app: mudo não aparece falando.
        speaking: flag(v.get("speaking")) && !muted,
        watching: flag(v.get("watching")),
    }
}

fn parse_state(v: &Json) -> State {
    let members: Vec<Member> = v
        .get("members")
        .and_then(Json::as_arr)
        .map(|items| items.iter().take(MAX_ROWS).map(parse_member).collect())
        .unwrap_or_default();
    let more = number(v.get("more")).filter(|n| *n >= 0.0).map(|n| n.min(1e6) as u32).unwrap_or(0);
    let viewers = number(v.get("viewers")).filter(|n| *n >= 0.0).map(|n| n.min(1e6) as u32);
    State {
        visible: flag(v.get("visible")),
        editing: flag(v.get("editing")),
        game: number(v.get("game")).filter(|n| *n >= 0.0 && *n <= u32::MAX as f64).map(|n| n as u32).unwrap_or(0),
        monitor: parse_monitor(v.get("monitor")),
        opacity: clamp_opacity(number(v.get("opacity")).unwrap_or(OPACITY_DEFAULT as f64)),
        layout: parse_layout(v.get("layout")),
        hint: text(v.get("hint")),
        theme: parse_theme(v.get("theme")),
        members,
        more,
        viewers,
    }
}

pub fn parse_command(line: &str) -> Result<Command, String> {
    let value = json::parse(line.trim_end_matches('\r'))?;
    match value.get("type").and_then(Json::as_str) {
        Some("state") => Ok(Command::State(Box::new(parse_state(&value)))),
        Some(_) => Ok(Command::Ignored),
        None => Err("mensagem sem \"type\"".into()),
    }
}

fn fmt_num(v: f64) -> String {
    let r = round4(v);
    if r == r.trunc() {
        format!("{}", r as i64)
    } else {
        format!("{r}")
    }
}

pub fn event_line(event: &Event) -> String {
    match event {
        Event::Ready => r#"{"type":"ready"}"#.to_string(),
        Event::Error(message) => format!(r#"{{"type":"error","message":{}}}"#, json::quote(message)),
        Event::Layout(layout) => {
            let position = match layout.position {
                Some(p) => format!(r#"{{"x":{},"y":{}}}"#, fmt_num(p.x), fmt_num(p.y)),
                None => "null".to_string(),
            };
            format!(r#"{{"type":"layout","layout":{{"position":{},"scale":{}}}}}"#, position, fmt_num(layout.scale))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FULL: &str = r##"{"type":"state","visible":true,"editing":false,"game":4242,
        "monitor":{"x":-1920,"y":0,"width":1920,"height":1080},"opacity":30,
        "layout":{"position":{"x":0.25,"y":0.5},"scale":1.2},"hint":"Arraste",
        "theme":{"floating":"#111214","strong":"#ffffff","normal":"#eeeeee","muted":"#999999",
          "brand":"#5865f2","speaking":"#00ff00","danger":"#ff0000"},
        "members":[{"id":"u1","name":"Ana","initial":"A","avatar":"C:\\cache\\a.gif","animated":true,
          "tag":"VOCÊ","muted":false,"deafened":false,"speaking":true,"watching":true}],"more":3,"viewers":5}"##;

    fn state(line: &str) -> State {
        match parse_command(line).unwrap() {
            Command::State(s) => *s,
            other => panic!("esperava estado, veio {other:?}"),
        }
    }

    #[test]
    fn estado_completo() {
        let s = state(&FULL.replace('\n', " "));
        assert!(s.visible && !s.editing);
        assert_eq!(s.game, 4242);
        assert_eq!(s.monitor, Some(Monitor { x: -1920, y: 0, width: 1920, height: 1080 }));
        assert_eq!(s.layout, Layout { position: Some(Point { x: 0.25, y: 0.5 }), scale: 1.2 });
        assert_eq!(s.theme.floating, Color::rgb(0x111214));
        assert_eq!(s.more, 3);
        let m = &s.members[0];
        assert_eq!(m.avatar.as_deref(), Some(r"C:\cache\a.gif"));
        assert!(m.animated && m.speaking);
        assert_eq!(m.tag.as_deref(), Some("VOCÊ"));
        assert!(m.watching);
        assert_eq!(s.viewers, Some(5));
    }

    #[test]
    fn espectadores_ausentes_ou_estragados_nao_mostram_o_olho() {
        assert_eq!(state(r#"{"type":"state","viewers":null}"#).viewers, None);
        assert_eq!(state(r#"{"type":"state","viewers":-2}"#).viewers, None);
        assert_eq!(state(r#"{"type":"state","viewers":0}"#).viewers, Some(0));
        assert!(!state(r#"{"type":"state","members":[{"name":"Ana"}]}"#).members[0].watching);
    }

    #[test]
    fn estado_vazio_usa_os_padroes() {
        let s = state(r#"{"type":"state"}"#);
        assert_eq!(s, State::default());
    }

    #[test]
    fn valores_estragados_voltam_ao_padrao_ou_ao_limite() {
        let s = state(
            r##"{"type":"state","opacity":99,"layout":{"position":{"x":5,"y":-1},"scale":9},
            "monitor":{"x":0,"y":0,"width":0,"height":10},"more":-4,"game":-1,
            "theme":{"floating":"vermelho","brand":"#12345"}}"##,
        );
        assert_eq!(s.opacity, OPACITY_MAX);
        assert_eq!(s.layout, Layout { position: Some(Point { x: 1.0, y: 0.0 }), scale: SCALE_MAX });
        assert_eq!(s.monitor, None);
        assert_eq!((s.more, s.game), (0, 0));
        assert_eq!(s.theme, Theme::default());
    }

    #[test]
    fn mudo_nao_aparece_falando_e_nome_vazio_vira_usuario() {
        let s = state(r#"{"type":"state","members":[{"name":"  ","muted":true,"speaking":true}]}"#);
        let m = &s.members[0];
        assert_eq!((m.name.as_str(), m.initial.as_str()), ("Usuário", "U"));
        assert!(!m.speaking);
        assert_eq!(m.avatar, None);
    }

    #[test]
    fn no_maximo_oito_pilulas() {
        let members = vec![r#"{"name":"x"}"#; 12].join(",");
        let s = state(&format!(r#"{{"type":"state","members":[{members}]}}"#));
        assert_eq!(s.members.len(), MAX_ROWS);
    }

    #[test]
    fn tipo_desconhecido_e_ignorado_e_lixo_e_erro() {
        assert_eq!(parse_command(r#"{"type":"futuro","x":1}"#), Ok(Command::Ignored));
        assert!(parse_command(r#"{"x":1}"#).is_err());
        assert!(parse_command("lixo").is_err());
    }

    #[test]
    fn crlf_do_pipe_no_fim_da_linha() {
        assert!(matches!(parse_command("{\"type\":\"state\"}\r"), Ok(Command::State(_))));
    }

    #[test]
    fn opacidade_da_pilula() {
        assert_eq!(row_opacity(30, false), 30);
        assert_eq!(row_opacity(30, true), 70);
        assert_eq!(row_opacity(60, true), SPEAKING_MAX);
        assert_eq!(clamp_opacity(32.0), 30);
        assert_eq!(clamp_opacity(f64::NAN), OPACITY_DEFAULT);
    }

    #[test]
    fn escala_no_passo() {
        assert_eq!(clamp_scale(1.12), 1.1);
        assert_eq!(clamp_scale(0.1), SCALE_MIN);
        assert_eq!(clamp_scale(f64::INFINITY), 1.0);
    }

    #[test]
    fn eventos() {
        assert_eq!(event_line(&Event::Ready), r#"{"type":"ready"}"#);
        assert_eq!(
            event_line(&Event::Layout(Layout { position: Some(Point { x: 0.5, y: 0.12346 }), scale: 1.0 })),
            r#"{"type":"layout","layout":{"position":{"x":0.5,"y":0.1235},"scale":1}}"#
        );
        assert_eq!(event_line(&Event::Layout(Layout::default())), r#"{"type":"layout","layout":{"position":null,"scale":1}}"#);
        let err = event_line(&Event::Error("falhou \"x\"".into()));
        assert_eq!(json::parse(&err).unwrap().get("message").and_then(Json::as_str), Some("falhou \"x\""));
    }
}
