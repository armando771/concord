//! Regra pura de "outra janela ocupa o monitor inteiro" (jogo em tela cheia
//! em janela) para o overlay de jogo. Sem Win32 aqui: os testes rodam no Linux.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

/// O que o laço do Windows sabe da janela em primeiro plano.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ForegroundWindow {
    pub pid: u32,
    pub class_name: String,
    pub window: Rect,
    /// Monitor onde a janela está (rcMonitor, pixels físicos).
    pub monitor: Rect,
    pub maximized: bool,
    /// Algum app em tela cheia exclusiva (Direct3D): fica fora do overlay.
    pub exclusive_d3d: bool,
}

/// `window` cobre o monitor inteiro (pode sobrar borda para fora).
pub fn covers(window: &Rect, monitor: &Rect) -> bool {
    monitor.right > monitor.left
        && monitor.bottom > monitor.top
        && window.left <= monitor.left
        && window.top <= monitor.top
        && window.right >= monitor.right
        && window.bottom >= monitor.bottom
}

/// Janelas do próprio Windows que cobrem o monitor (desktop, barra de
/// tarefas, Alt+Tab, Win+Tab…) e não são jogo.
pub fn is_shell_class(class_name: &str) -> bool {
    matches!(
        class_name,
        "Progman"
            | "WorkerW"
            | "Shell_TrayWnd"
            | "Shell_SecondaryTrayWnd"
            | "XamlExplorerHostIslandWindow"
            | "MultitaskingViewFrame"
            | "TaskSwitcherWnd"
            | "ForegroundStaging"
            | "Windows.UI.Core.CoreWindow"
    )
}

/// Linha que o helper escreve: `fullscreen <pid> <l> <t> <r> <b>` (retângulo
/// do monitor coberto) ou `none`. Janela maximizada não conta: navegador
/// maximizado com a barra de tarefas escondida também cobre o monitor.
pub fn report(foreground: Option<&ForegroundWindow>) -> String {
    match foreground {
        Some(fg)
            if covers(&fg.window, &fg.monitor)
                && !fg.maximized
                && !fg.exclusive_d3d
                && !is_shell_class(&fg.class_name) =>
        {
            let m = fg.monitor;
            format!("fullscreen {} {} {} {} {}", fg.pid, m.left, m.top, m.right, m.bottom)
        }
        _ => "none".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(left: i32, top: i32, right: i32, bottom: i32) -> Rect {
        Rect { left, top, right, bottom }
    }

    fn jogo() -> ForegroundWindow {
        ForegroundWindow {
            pid: 4242,
            class_name: "UnrealWindow".into(),
            window: r(0, 0, 1920, 1080),
            monitor: r(0, 0, 1920, 1080),
            maximized: false,
            exclusive_d3d: false,
        }
    }

    #[test]
    fn cobre_o_monitor_exato() {
        assert!(covers(&r(0, 0, 1920, 1080), &r(0, 0, 1920, 1080)));
    }

    #[test]
    fn cobre_com_sobra_de_borda() {
        assert!(covers(&r(-8, -8, 1928, 1088), &r(0, 0, 1920, 1080)));
    }

    #[test]
    fn janela_menor_nao_cobre() {
        assert!(!covers(&r(0, 0, 1920, 1040), &r(0, 0, 1920, 1080)));
    }

    #[test]
    fn janela_em_outro_monitor_nao_cobre() {
        assert!(!covers(&r(-1920, 0, 0, 1080), &r(0, 0, 1920, 1080)));
    }

    #[test]
    fn monitor_vazio_nao_cobre() {
        assert!(!covers(&r(0, 0, 10, 10), &r(0, 0, 0, 0)));
    }

    #[test]
    fn jogo_em_tela_cheia_em_janela() {
        assert_eq!(report(Some(&jogo())), "fullscreen 4242 0 0 1920 1080");
    }

    #[test]
    fn monitor_secundario_com_coordenada_negativa() {
        let g = ForegroundWindow { window: r(-2560, 0, 0, 1440), monitor: r(-2560, 0, 0, 1440), ..jogo() };
        assert_eq!(report(Some(&g)), "fullscreen 4242 -2560 0 0 1440");
    }

    #[test]
    fn desktop_e_shell_nao_contam() {
        for class in ["Progman", "WorkerW", "XamlExplorerHostIslandWindow"] {
            let g = ForegroundWindow { class_name: class.into(), ..jogo() };
            assert_eq!(report(Some(&g)), "none");
        }
    }

    #[test]
    fn maximizada_nao_conta() {
        let g = ForegroundWindow { window: r(-8, -8, 1928, 1088), maximized: true, ..jogo() };
        assert_eq!(report(Some(&g)), "none");
    }

    #[test]
    fn tela_cheia_exclusiva_nao_conta() {
        assert_eq!(report(Some(&ForegroundWindow { exclusive_d3d: true, ..jogo() })), "none");
    }

    #[test]
    fn sem_janela_em_foco() {
        assert_eq!(report(None), "none");
    }
}
