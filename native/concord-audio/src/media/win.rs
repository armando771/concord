//! O laço do Windows: assina os eventos do SMTC, lê as sessões quando algo
//! muda e escreve a linha em stdout (e repete a última a cada `HEARTBEAT`).

use std::io::Write;
use std::sync::mpsc::{channel, Sender};
use std::time::Duration;

use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as Properties,
};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

use super::pacing::{wait_change, Event, Wake};
use super::snapshot::{current_first, duration_ms, snapshot_line, ticks_to_ms, winrt_time_to_unix_ms, MediaSession};

/// Abaixo dos 10 s em que a Salinha desiste de uma fonte calada.
const HEARTBEAT: Duration = Duration::from_secs(4);
const DEBOUNCE: Duration = Duration::from_millis(200);
const MAX_BURST: Duration = Duration::from_secs(1);
/// Player travado não segura a leitura das outras sessões (o script esperava 5 s).
const PROPERTIES_TIMEOUT: Duration = Duration::from_secs(3);

/// Um handler que só avisa o laço principal.
macro_rules! notify {
    ($tx:expr, $event:expr) => {{
        let tx: Sender<Event> = $tx.clone();
        TypedEventHandler::new(move |_, _| {
            let _ = tx.send($event);
            Ok(())
        })
    }};
}

/// Uma sessão assinada; ao sair da lista, os handlers são removidos.
struct Watched {
    session: Session,
    tokens: [i64; 3],
}

impl Drop for Watched {
    fn drop(&mut self) {
        let [media, playback, timeline] = self.tokens;
        let _ = self.session.RemoveMediaPropertiesChanged(media);
        let _ = self.session.RemovePlaybackInfoChanged(playback);
        let _ = self.session.RemoveTimelinePropertiesChanged(timeline);
    }
}

fn watch_session(session: Session, tx: &Sender<Event>) -> windows::core::Result<Watched> {
    let media = session.MediaPropertiesChanged(&notify!(tx, Event::Session))?;
    let playback = session.PlaybackInfoChanged(&notify!(tx, Event::Session))?;
    let timeline = session.TimelinePropertiesChanged(&notify!(tx, Event::Session))?;
    Ok(Watched { session, tokens: [media, playback, timeline] })
}

/// Assina todas as sessões de agora (a que falhar fica sem eventos, mas é lida igual).
fn watch_all(manager: &Manager, tx: &Sender<Event>) -> Vec<Watched> {
    let Ok(sessions) = manager.GetSessions() else { return Vec::new() };
    sessions.into_iter().filter_map(|s| watch_session(s, tx).ok()).collect()
}

/// `TryGetMediaPropertiesAsync` com prazo (o `join` esperaria para sempre).
fn properties(session: &Session) -> Option<Properties> {
    let (tx, rx) = channel();
    session.TryGetMediaPropertiesAsync().ok()?.when(move |result| {
        let _ = tx.send(result);
    }).ok()?;
    rx.recv_timeout(PROPERTIES_TIMEOUT).ok()?.ok()
}

fn read_session(session: &Session) -> windows::core::Result<MediaSession> {
    let props = properties(session).ok_or_else(windows::core::Error::empty)?;
    let timeline = session.GetTimelineProperties()?;
    Ok(MediaSession {
        app: session.SourceAppUserModelId()?.to_string_lossy(),
        title: props.Title()?.to_string_lossy(),
        artist: props.Artist()?.to_string_lossy(),
        album: props.AlbumTitle()?.to_string_lossy(),
        status: session.GetPlaybackInfo()?.PlaybackStatus()?.0,
        position_ms: ticks_to_ms(timeline.Position()?.Duration),
        duration_ms: duration_ms(timeline.StartTime()?.Duration, timeline.EndTime()?.Duration),
        updated_ms: winrt_time_to_unix_ms(timeline.LastUpdatedTime()?.UniversalTime),
    })
}

/// Todas as sessões legíveis, a atual primeiro, já como a linha JSON.
fn read_line(manager: &Manager) -> String {
    let sessions: Vec<MediaSession> = match manager.GetSessions() {
        Ok(list) => list.into_iter().filter_map(|s| read_session(&s).ok()).collect(),
        Err(_) => Vec::new(),
    };
    let current = manager.GetCurrentSession().and_then(|s| s.SourceAppUserModelId()).ok();
    snapshot_line(&current_first(sessions, current.map(|app| app.to_string_lossy()).as_deref()))
}

fn manager() -> Result<Manager, String> {
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
        .ok()
        .map_err(|err| format!("CoInitializeEx: {err}"))?;
    Manager::RequestAsync()
        .and_then(|op| op.join())
        .map_err(|err| format!("SMTC indisponível: {err}"))
}

/// Roda até stdout fechar (ou o stdin fechar, pela thread do `main`).
pub fn run() -> Result<(), String> {
    let manager = manager()?;
    let (tx, rx) = channel();
    manager.SessionsChanged(&notify!(tx, Event::Sessions)).map_err(|err| format!("SessionsChanged: {err}"))?;
    manager
        .CurrentSessionChanged(&notify!(tx, Event::Sessions))
        .map_err(|err| format!("CurrentSessionChanged: {err}"))?;
    let mut watched = watch_all(&manager, &tx);
    let mut line = read_line(&manager);
    let mut out = std::io::stdout().lock();
    loop {
        if writeln!(out, "{line}").and_then(|_| out.flush()).is_err() {
            // stdout fechado: a Salinha parou de olhar.
            return Ok(());
        }
        match wait_change(&rx, HEARTBEAT, DEBOUNCE, MAX_BURST) {
            Wake::Heartbeat => {}
            Wake::Changed { sessions } => {
                if sessions {
                    drop(std::mem::take(&mut watched));
                    watched = watch_all(&manager, &tx);
                }
                line = read_line(&manager);
            }
            Wake::Closed => return Ok(()),
        }
    }
}
