//! Quando escrever uma linha nova: o Windows avisa por eventos (que chegam em
//! rajada: título, artista e linha do tempo mudam juntos na troca de faixa), e
//! a Salinha precisa de uma linha de vez em quando mesmo parada — sem leitura
//! fresca por 10 s ela entende que o helper calou (musicDetector.ts). Puro.

use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

/// O que o Windows avisou.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    /// Uma sessão mudou (música, estado ou linha do tempo).
    Session,
    /// A lista de sessões (ou a atual) mudou: precisa assinar as novas.
    Sessions,
}

/// O que fazer depois de esperar.
#[derive(Debug, PartialEq, Eq)]
pub enum Wake {
    /// Nada mudou: repete a última linha.
    Heartbeat,
    /// Mudou: lê de novo (e reassina as sessões se `sessions`).
    Changed { sessions: bool },
    /// Ninguém mais avisa (canal fechado).
    Closed,
}

/// Espera o próximo aviso por até `heartbeat`; depois do primeiro, junta a
/// rajada (sossego de `debounce`, no máximo `max_burst`) num `Changed` só.
pub fn wait_change(rx: &Receiver<Event>, heartbeat: Duration, debounce: Duration, max_burst: Duration) -> Wake {
    let first = match rx.recv_timeout(heartbeat) {
        Ok(event) => event,
        Err(RecvTimeoutError::Timeout) => return Wake::Heartbeat,
        Err(RecvTimeoutError::Disconnected) => return Wake::Closed,
    };
    let mut sessions = first == Event::Sessions;
    let deadline = Instant::now() + max_burst;
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match rx.recv_timeout(debounce.min(left)) {
            Ok(event) => sessions |= event == Event::Sessions,
            Err(_) => break,
        }
    }
    Wake::Changed { sessions }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;

    const MS: Duration = Duration::from_millis(1);

    #[test]
    fn sem_aviso_repete_a_linha() {
        let (_tx, rx) = channel::<Event>();
        assert_eq!(wait_change(&rx, 5 * MS, MS, MS), Wake::Heartbeat);
    }

    #[test]
    fn canal_fechado_encerra() {
        let (tx, rx) = channel::<Event>();
        drop(tx);
        assert_eq!(wait_change(&rx, 5 * MS, MS, MS), Wake::Closed);
    }

    #[test]
    fn junta_a_rajada_e_lembra_de_reassinar() {
        let (tx, rx) = channel();
        tx.send(Event::Session).unwrap();
        tx.send(Event::Sessions).unwrap();
        tx.send(Event::Session).unwrap();
        assert_eq!(wait_change(&rx, 5 * MS, 20 * MS, 200 * MS), Wake::Changed { sessions: true });
        // A rajada foi toda consumida.
        assert_eq!(wait_change(&rx, 5 * MS, MS, MS), Wake::Heartbeat);
    }

    #[test]
    fn so_sessao_nao_reassina() {
        let (tx, rx) = channel();
        tx.send(Event::Session).unwrap();
        assert_eq!(wait_change(&rx, 5 * MS, MS, 10 * MS), Wake::Changed { sessions: false });
    }

    #[test]
    fn rajada_sem_fim_para_no_limite() {
        let (tx, rx) = channel();
        let feeder = std::thread::spawn(move || {
            while tx.send(Event::Session).is_ok() {
                std::thread::sleep(MS);
            }
        });
        let started = Instant::now();
        assert_eq!(wait_change(&rx, 500 * MS, 50 * MS, 30 * MS), Wake::Changed { sessions: false });
        assert!(started.elapsed() < Duration::from_secs(1));
        drop(rx);
        feeder.join().unwrap();
    }
}
