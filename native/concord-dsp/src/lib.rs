//! DSP do voice mod da Salinha, compilado para `wasm32-unknown-unknown`.
//!
//! Sem wasm-bindgen e sem alocação dinâmica: o estado e os buffers de entrada
//! e saída são estáticos (memória linear fixa desde a instanciação). Cada
//! AudioWorkletProcessor instancia o módulo; o JS copia o bloco para
//! `dsp_input()`, chama `vm_process` e copia de `dsp_output()`.
//! Ver docs/adr/0005-dsp-de-audio-em-wasm.md.

pub mod voice_mod;

use core::cell::UnsafeCell;
use voice_mod::{VoiceMod, VoiceModParams};

/// Maior bloco aceito por chamada (o quantum do Web Audio é 128).
pub const IO_CAPACITY: usize = 1024;

/// Estado global de uma instância. O wasm roda numa thread só (a do áudio),
/// então basta uma célula sem trava.
struct Global<T>(UnsafeCell<T>);

// SAFETY: o módulo wasm é single-threaded; nos testes do host só um teste usa
// as funções exportadas (`ffi_round_trip`).
unsafe impl<T> Sync for Global<T> {}

impl<T> Global<T> {
    #[allow(clippy::mut_from_ref)]
    fn get(&self) -> &mut T {
        // SAFETY: ver o `impl Sync` acima; nenhuma referência sobrevive à chamada exportada.
        unsafe { &mut *self.0.get() }
    }
}

static INPUT: Global<[f32; IO_CAPACITY]> = Global(UnsafeCell::new([0.0; IO_CAPACITY]));
static OUTPUT: Global<[f32; IO_CAPACITY]> = Global(UnsafeCell::new([0.0; IO_CAPACITY]));
static VOICE_MOD: Global<VoiceMod> = Global(UnsafeCell::new(VoiceMod::new()));

fn block(n: u32) -> usize {
    (n as usize).min(IO_CAPACITY)
}

#[no_mangle]
pub extern "C" fn dsp_input() -> *mut f32 {
    INPUT.get().as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn dsp_output() -> *mut f32 {
    OUTPUT.get().as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn dsp_capacity() -> u32 {
    IO_CAPACITY as u32
}

// ─── Voice mod ─────────────────────────────────────────────────────────────

/// 1 se a taxa é suportada (e o estado foi zerado), 0 se não.
#[no_mangle]
pub extern "C" fn vm_init(rate: f64) -> u32 {
    VOICE_MOD.get().init(rate) as u32
}

#[no_mangle]
pub extern "C" fn vm_configure(ratio: f64, mod_hz: f64, mod_depth: f64, vibrato_hz: f64, vibrato_semitones: f64) {
    VOICE_MOD.get().configure(VoiceModParams { ratio, mod_hz, mod_depth, vibrato_hz, vibrato_semitones });
}

/// Processa `n` amostras de `dsp_input()` (ou silêncio, se `has_input` = 0) em `dsp_output()`.
#[no_mangle]
pub extern "C" fn vm_process(n: u32, has_input: u32) {
    let n = block(n);
    let input = (has_input != 0).then(|| &INPUT.get()[..n]);
    VOICE_MOD.get().process(input, &mut OUTPUT.get()[..n]);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ffi_round_trip() {
        assert_eq!(vm_init(48_000.0), 1);
        assert_eq!(vm_init(1e9), 0);
        assert_eq!(vm_init(48_000.0), 1);
        // SAFETY: os ponteiros apontam para os estáticos de IO_CAPACITY amostras.
        let (input, output) = unsafe {
            (
                core::slice::from_raw_parts_mut(dsp_input(), IO_CAPACITY),
                core::slice::from_raw_parts_mut(dsp_output(), IO_CAPACITY),
            )
        };
        input[..128].fill(0.5);
        vm_configure(1.0, 0.0, 0.0, 0.0, 0.0);
        vm_process(128, 1);
        // Razão 1: sai a entrada atrasada em 25 ms, então o primeiro bloco é silêncio.
        assert!(output[..128].iter().all(|&v| v == 0.0));

        // Mais do que cabe é cortado na capacidade, sem sair da memória.
        vm_process(u32::MAX, 0);
        assert_eq!(dsp_capacity() as usize, IO_CAPACITY);
    }
}
