//! Modo `overlay`: a janela nativa do overlay de jogo (Win32 + Direct2D +
//! DirectWrite + WIC). Lê o estado da Salinha em stdin (JSON por linha, ver
//! protocol.rs e docs/overlay-nativo.md) e responde em stdout. Sem estado novo
//! e sem GIF animando, a thread fica parada no GetMessage (zero CPU/GPU).
//!
//! O que não depende do Windows (protocolo, geometria, GIF, ícones, máquina de
//! estados) é puro e testado no Linux com `cargo test`.

pub mod controller;
pub mod gif;
pub mod icons;
pub mod json;
pub mod layout;
pub mod protocol;
#[cfg(windows)]
mod win;

#[cfg(windows)]
pub use win::run;
