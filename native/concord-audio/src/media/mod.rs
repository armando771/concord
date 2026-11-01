//! Modo `media-watch`: as sessões de mídia do Windows (SMTC, as mesmas do
//! painel de volume) para a música em atividade (docs/adr/0006-musica-em-atividade.md).
//! Por eventos: a cada mudança (e a cada poucos segundos, para mostrar que está
//! vivo) escreve em stdout uma linha JSON com todas as sessões, a atual primeiro.
//!
//! O formato da linha e o ritmo das escritas são puros e testados no Linux.

pub mod pacing;
pub mod snapshot;
#[cfg(windows)]
mod win;

#[cfg(windows)]
pub use win::run;
