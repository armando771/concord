//! Máquina de estados do overlay nativo, sem Win32: o que fazer a cada estado
//! da Salinha e a cada arraste do modo de edição. A janela (win/) só executa
//! os efeitos.

use super::layout::{move_box, pixels_to_fraction, resize_scale, settle_draft, shown_layout, Draft, Px, Size};
use super::protocol::{Event, Layout, State};

#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    /// Mostrar a janela; `raise` = pôr no topo de novo (apareceu ou outro jogo).
    Show { raise: bool },
    Hide,
    /// Montar e desenhar a lista de novo.
    Redraw,
    /// Fora da edição os cliques passam para o jogo (WS_EX_TRANSPARENT).
    ClickThrough(bool),
    ReleaseMouse,
    Emit(Event),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DragMode {
    Move,
    Resize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct Drag {
    mode: DragMode,
    x0: f64,
    y0: f64,
    start: Px,
    start_box: Size,
    area: Size,
    start_layout: Layout,
    base: Layout,
}

#[derive(Debug, Default)]
pub struct Controller {
    state: State,
    draft: Option<Draft>,
    drag: Option<Drag>,
    shown: bool,
    raised_for: Option<u32>,
}

impl Controller {
    pub fn state(&self) -> &State {
        &self.state
    }

    /// Posição/escala a desenhar: o arraste em curso (ou recém-solto) ou o salvo.
    pub fn layout(&self) -> Layout {
        shown_layout(self.state.layout, self.draft)
    }

    pub fn dragging(&self) -> bool {
        self.drag.is_some()
    }

    pub fn on_state(&mut self, next: State) -> Vec<Effect> {
        let mut fx = Vec::new();
        let was_editing = self.state.editing;
        self.draft = settle_draft(next.layout, self.draft);
        self.state = next;
        let editing = self.state.editing;
        if was_editing && !editing && self.drag.is_some() {
            // Saiu da edição no meio do arraste (Esc/atalho): salva onde parou.
            fx.extend(self.end_drag());
        }
        if editing != was_editing {
            fx.push(Effect::ClickThrough(!editing));
        }
        if self.state.visible && self.state.monitor.is_some() && !self.state.members.is_empty() {
            let raise = !self.shown || self.raised_for != Some(self.state.game);
            self.shown = true;
            self.raised_for = Some(self.state.game);
            fx.push(Effect::Redraw);
            fx.push(Effect::Show { raise });
        } else if self.shown {
            self.shown = false;
            self.raised_for = None;
            fx.push(Effect::Hide);
        }
        fx
    }

    /// Botão apertado na caixa (só editando). `start` = canto da caixa e
    /// `area` = área de trabalho, em pixels físicos.
    pub fn begin_drag(&mut self, mode: DragMode, x: f64, y: f64, start: Px, start_box: Size, area: Size) -> bool {
        if !self.state.editing || !self.shown {
            return false;
        }
        let layout = self.layout();
        let start_layout = Layout { position: layout.position.or(Some(pixels_to_fraction(start, area))), ..layout };
        self.drag = Some(Drag { mode, x0: x, y0: y, start, start_box, area, start_layout, base: self.state.layout });
        true
    }

    /// Mouse andou com o botão apertado. true = mudou (redesenhar).
    pub fn drag_to(&mut self, x: f64, y: f64) -> bool {
        let Some(d) = self.drag else { return false };
        let (dx, dy) = (x - d.x0, y - d.y0);
        let layout = match d.mode {
            DragMode::Move => Layout { position: Some(move_box(d.start, dx, dy, d.area, d.start_box)), ..d.start_layout },
            DragMode::Resize => Layout { scale: resize_scale(d.start_layout.scale, d.start_box, dx, dy), ..d.start_layout },
        };
        let changed = self.layout() != layout;
        self.draft = Some(Draft { layout, base: d.base });
        changed
    }

    /// Soltou (ou perdeu o mouse): manda a posição nova para a Salinha salvar.
    pub fn end_drag(&mut self) -> Vec<Effect> {
        if self.drag.take().is_none() {
            return Vec::new();
        }
        let mut fx = vec![Effect::ReleaseMouse];
        if let Some(draft) = self.draft {
            fx.push(Effect::Emit(Event::Layout(draft.layout)));
        }
        fx
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::overlay::protocol::{Member, Monitor, Point};

    fn member() -> Member {
        Member {
            id: "u1".into(),
            name: "Ana".into(),
            initial: "A".into(),
            avatar: None,
            animated: false,
            tag: None,
            muted: false,
            deafened: false,
            speaking: false,
            watching: false,
        }
    }

    fn visible() -> State {
        State {
            visible: true,
            game: 42,
            monitor: Some(Monitor { x: 0, y: 0, width: 1920, height: 1080 }),
            members: vec![member()],
            ..State::default()
        }
    }

    const AREA: Size = Size { w: 1920.0, h: 1040.0 };
    const BOX: Size = Size { w: 200.0, h: 120.0 };

    #[test]
    fn aparece_no_topo_uma_vez_e_redesenha_a_cada_estado() {
        let mut c = Controller::default();
        assert_eq!(c.on_state(visible()), vec![Effect::Redraw, Effect::Show { raise: true }]);
        assert_eq!(c.on_state(visible()), vec![Effect::Redraw, Effect::Show { raise: false }]);
        // Outro jogo na frente: sobe de novo.
        assert_eq!(c.on_state(State { game: 7, ..visible() }), vec![Effect::Redraw, Effect::Show { raise: true }]);
    }

    #[test]
    fn some_quando_o_jogo_sai_ou_a_lista_esvazia() {
        let mut c = Controller::default();
        c.on_state(visible());
        assert_eq!(c.on_state(State { visible: false, ..visible() }), vec![Effect::Hide]);
        assert_eq!(c.on_state(State { visible: false, ..visible() }), vec![]);
        c.on_state(visible());
        assert_eq!(c.on_state(State { members: vec![], ..visible() }), vec![Effect::Hide]);
        // Sem monitor não há onde mostrar.
        assert_eq!(c.on_state(State { monitor: None, ..visible() }), vec![]);
        // Voltou: no topo de novo.
        assert_eq!(c.on_state(visible()), vec![Effect::Redraw, Effect::Show { raise: true }]);
    }

    #[test]
    fn edicao_pega_o_mouse_e_sair_devolve_o_click_through() {
        let mut c = Controller::default();
        c.on_state(visible());
        let fx = c.on_state(State { editing: true, ..visible() });
        assert_eq!(fx[0], Effect::ClickThrough(false));
        assert_eq!(c.on_state(State { editing: false, ..visible() })[0], Effect::ClickThrough(true));
    }

    #[test]
    fn arrastar_so_editando() {
        let mut c = Controller::default();
        c.on_state(visible());
        assert!(!c.begin_drag(DragMode::Move, 0.0, 0.0, Px { left: 8.0, top: 460.0 }, BOX, AREA));
        assert!(!c.drag_to(10.0, 10.0));
        assert_eq!(c.end_drag(), vec![]);
    }

    #[test]
    fn arrastar_move_e_ao_soltar_manda_salvar_e_segura_ate_o_salvo_chegar() {
        let mut c = Controller::default();
        let editing = State { editing: true, ..visible() };
        c.on_state(editing.clone());
        assert!(c.begin_drag(DragMode::Move, 100.0, 100.0, Px { left: 100.0, top: 100.0 }, BOX, AREA));
        assert!(c.drag_to(960.0, 260.0));
        let moved = Layout { position: Some(Point { x: 0.5, y: 0.25 }), scale: 1.0 };
        assert_eq!(c.layout(), moved);
        assert_eq!(c.end_drag(), vec![Effect::ReleaseMouse, Effect::Emit(Event::Layout(moved))]);
        // Estado atrasado (ainda com o salvo antigo): continua onde soltou.
        c.on_state(editing.clone());
        assert_eq!(c.layout(), moved);
        // Chegou o salvo.
        c.on_state(State { layout: moved, ..editing.clone() });
        assert_eq!(c.layout(), moved);
        // "Restaurar posição" depois disso vence.
        c.on_state(editing);
        assert_eq!(c.layout(), Layout::default());
    }

    #[test]
    fn redimensionar_segura_o_canto_onde_esta() {
        let mut c = Controller::default();
        c.on_state(State { editing: true, ..visible() });
        c.begin_drag(DragMode::Resize, 0.0, 0.0, Px { left: 960.0, top: 520.0 }, BOX, AREA);
        c.drag_to(32.0, 0.0);
        assert_eq!(c.layout(), Layout { position: Some(Point { x: 0.5, y: 0.5 }), scale: 1.1 });
    }

    #[test]
    fn sair_da_edicao_no_meio_do_arraste_salva() {
        let mut c = Controller::default();
        c.on_state(State { editing: true, ..visible() });
        c.begin_drag(DragMode::Move, 0.0, 0.0, Px { left: 0.0, top: 0.0 }, BOX, AREA);
        c.drag_to(960.0, 0.0);
        let fx = c.on_state(visible());
        assert_eq!(fx[0], Effect::ReleaseMouse);
        assert!(matches!(fx[1], Effect::Emit(Event::Layout(_))));
        assert_eq!(fx[2], Effect::ClickThrough(true));
        assert!(!c.dragging());
    }

    #[test]
    fn soltar_sem_mexer_nao_manda_nada_para_salvar() {
        let mut c = Controller::default();
        c.on_state(State { editing: true, ..visible() });
        c.begin_drag(DragMode::Move, 0.0, 0.0, Px { left: 0.0, top: 0.0 }, BOX, AREA);
        assert_eq!(c.end_drag(), vec![Effect::ReleaseMouse]);
    }
}
