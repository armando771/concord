//! Helper do Concord: captura o áudio de um processo para o compartilhamento
//! de tela e escreve PCM float32 48 kHz estéreo intercalado em stdout.
//! Escreve "ready" em stderr quando a captura começa; erros também em stderr.
//! No modo `foreground`, informa em stdout a janela em tela cheia na frente
//! (overlay de jogo).

mod args;
// Regra pura (testada no Linux); só o laço do Windows a usa.
#[cfg_attr(not(windows), allow(dead_code))]
mod fullscreen;
#[cfg(windows)]
mod capture;
#[cfg(windows)]
mod foreground;

use std::process::ExitCode;

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mode = match args::parse_args(&argv) {
        Ok(mode) => mode,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::from(2);
        }
    };
    exit_when_parent_goes_away();
    run(&mode)
}

/// O Concord mantém o stdin aberto; quando ele fecha (Concord saiu ou morreu),
/// o helper encerra — mesmo se o app capturado estiver em silêncio.
fn exit_when_parent_goes_away() {
    std::thread::spawn(|| {
        use std::io::Read;
        let mut stdin = std::io::stdin();
        let mut buf = [0u8; 64];
        loop {
            match stdin.read(&mut buf) {
                Ok(0) | Err(_) => std::process::exit(0),
                Ok(_) => {}
            }
        }
    });
}

#[cfg(windows)]
fn run(mode: &args::Mode) -> ExitCode {
    let result = match mode {
        args::Mode::Foreground => foreground::run(),
        _ => capture::run(mode),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("erro em {err}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(not(windows))]
fn run(_mode: &args::Mode) -> ExitCode {
    eprintln!("erro: o helper só funciona no Windows");
    ExitCode::FAILURE
}
