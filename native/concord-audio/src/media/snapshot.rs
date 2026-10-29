//! A leitura das sessões de mídia virando a linha JSON que a Salinha lê. Puro
//! (testado no Linux). O formato é o mesmo do script PowerShell que este modo
//! substitui (frontend/src/main/activity/smtcMedia.ts), para o parser ser um só:
//! `[{"app","title","artist","album","status","position","duration","updated"}]`.

use crate::overlay::json::quote;

/// Uma sessão do SMTC como o Windows informa (tempos já em milissegundos).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaSession {
    /// AppUserModelId de quem toca (o nome amigável sai do catálogo da Salinha).
    pub app: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// PlaybackStatus do SMTC: 4 = tocando, 5 = pausado...
    pub status: i32,
    pub position_ms: i64,
    pub duration_ms: i64,
    /// Quando o Windows atualizou a posição (Unix, ms; 0 = não informou).
    pub updated_ms: i64,
}

/// Ticks do WinRT (100 ns) → ms. `TimeSpan` (posição, início, fim).
pub fn ticks_to_ms(ticks: i64) -> i64 {
    ticks / 10_000
}

/// 1601-01-01 (época do `DateTime` do WinRT) até 1970-01-01, em ticks de 100 ns.
const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

/// `DateTime` do WinRT → Unix em ms; antes de 1970 (não informado) = 0.
pub fn winrt_time_to_unix_ms(universal_time: i64) -> i64 {
    if universal_time <= UNIX_EPOCH_TICKS {
        return 0;
    }
    (universal_time - UNIX_EPOCH_TICKS) / 10_000
}

/// Duração da faixa pela linha do tempo (fim − início), nunca negativa.
pub fn duration_ms(start_ticks: i64, end_ticks: i64) -> i64 {
    ticks_to_ms(end_ticks.saturating_sub(start_ticks)).max(0)
}

/// A sessão atual do Windows (a do painel de volume) vem primeiro: com duas
/// tocando, é ela que a Salinha mostra. O resto mantém a ordem.
pub fn current_first(mut sessions: Vec<MediaSession>, current_app: Option<&str>) -> Vec<MediaSession> {
    if let Some(index) = current_app.and_then(|app| sessions.iter().position(|s| s.app == app)) {
        let current = sessions.remove(index);
        sessions.insert(0, current);
    }
    sessions
}

fn session_json(s: &MediaSession) -> String {
    format!(
        "{{\"app\":{},\"title\":{},\"artist\":{},\"album\":{},\"status\":{},\"position\":{},\"duration\":{},\"updated\":{}}}",
        quote(&s.app),
        quote(&s.title),
        quote(&s.artist),
        quote(&s.album),
        s.status,
        s.position_ms,
        s.duration_ms,
        s.updated_ms
    )
}

/// A linha inteira (lista JSON, sem quebra de linha no fim).
pub fn snapshot_line(sessions: &[MediaSession]) -> String {
    let items: Vec<String> = sessions.iter().map(session_json).collect();
    format!("[{}]", items.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::overlay::json::parse;

    fn session(app: &str, status: i32) -> MediaSession {
        MediaSession {
            app: app.to_string(),
            title: "Águas de Março".to_string(),
            artist: "Elis Regina".to_string(),
            album: "Elis & Tom".to_string(),
            status,
            position_ms: 83_000,
            duration_ms: 225_000,
            updated_ms: 1_761_580_000_000,
        }
    }

    #[test]
    fn converte_ticks_e_datas_do_winrt() {
        assert_eq!(ticks_to_ms(2_250_000_000), 225_000);
        assert_eq!(duration_ms(10_000_000, 2_260_000_000), 225_000);
        assert_eq!(duration_ms(5, 0), 0);
        // 2025-10-27T15:46:40Z
        assert_eq!(winrt_time_to_unix_ms(UNIX_EPOCH_TICKS + 17_615_800_000_000_000), 1_761_580_000_000);
        assert_eq!(winrt_time_to_unix_ms(0), 0);
    }

    #[test]
    fn linha_no_formato_do_script_powershell() {
        let line = snapshot_line(&[session("Spotify.exe", 4)]);
        assert_eq!(
            line,
            r#"[{"app":"Spotify.exe","title":"Águas de Março","artist":"Elis Regina","album":"Elis & Tom","status":4,"position":83000,"duration":225000,"updated":1761580000000}]"#
        );
        assert_eq!(snapshot_line(&[]), "[]");
    }

    #[test]
    fn escapa_textos_e_continua_uma_linha_so() {
        let mut s = session("Chrome", 5);
        s.title = "Aspas \" e\nquebra".to_string();
        let line = snapshot_line(&[s]);
        assert!(!line.contains('\n'));
        let parsed = parse(&line).unwrap();
        let first = &parsed.as_arr().unwrap()[0];
        assert_eq!(first.get("title").and_then(|t| t.as_str()), Some("Aspas \" e\nquebra"));
    }

    #[test]
    fn sessao_atual_vai_para_a_frente() {
        let list = vec![session("Chrome", 4), session("Spotify.exe", 4), session("AIMP.exe", 5)];
        let apps = |l: &[MediaSession]| l.iter().map(|s| s.app.clone()).collect::<Vec<_>>();
        assert_eq!(apps(&current_first(list.clone(), Some("Spotify.exe"))), ["Spotify.exe", "Chrome", "AIMP.exe"]);
        assert_eq!(apps(&current_first(list.clone(), Some("Outro"))), ["Chrome", "Spotify.exe", "AIMP.exe"]);
        assert_eq!(apps(&current_first(list, None)), ["Chrome", "Spotify.exe", "AIMP.exe"]);
    }
}
