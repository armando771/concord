//! Núcleo do voice mod: pitch shift granular (com vibrato) e modulação de
//! amplitude. Porta fiel de `frontend/.../call/lib/voiceModDsp.ts` (o
//! comentário de lá explica o algoritmo); a saída bate com a do JS dentro de
//! arredondamento de f32 (teste `voiceModWasm.test.ts`).
//!
//! Como no JS: a janela da segunda ponta é cos² = 1 − sen² da primeira (as
//! pontas estão defasadas em meia janela), um seno por amostra; e os índices
//! do buffer circular dão a volta com uma comparação, sem `%`.

use core::f64::consts::PI;

const TWO_PI: f64 = 2.0 * PI;
/// Janela do pitch shift, como no JS.
const WINDOW_MS: f64 = 50.0;
/// Maior taxa suportada (o buffer é alocado uma vez, do tamanho dela).
pub const MAX_RATE: f64 = 192_000.0;
const MAX_SIZE: usize = (MAX_RATE * WINDOW_MS / 1000.0) as usize;
const CAPACITY: usize = MAX_SIZE * 2 + 4;

/// Parâmetros vindos da porta do worklet (`VoiceModWorkletMessage`).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct VoiceModParams {
    pub ratio: f64,
    pub mod_hz: f64,
    pub mod_depth: f64,
    pub vibrato_hz: f64,
    pub vibrato_semitones: f64,
}

pub struct VoiceMod {
    params: VoiceModParams,
    rate: f64,
    /// Tamanho da janela em amostras (inteiro, guardado como f64 para as contas).
    size: f64,
    /// Comprimento usado do buffer (2 × janela + 4, como no JS).
    len: usize,
    buffer: [f32; CAPACITY],
    pos: usize,
    phase: f64,
    mod_phase: f64,
    vibrato_phase: f64,
}

impl VoiceMod {
    /// Tudo zerado, para o estático do wasm cair no .bss (não ocupar o
    /// binário). Chame `init` antes de processar.
    pub const fn new() -> Self {
        VoiceMod {
            params: VoiceModParams { ratio: 0.0, mod_hz: 0.0, mod_depth: 0.0, vibrato_hz: 0.0, vibrato_semitones: 0.0 },
            rate: 0.0,
            size: 0.0,
            len: 0,
            buffer: [0.0; CAPACITY],
            pos: 0,
            phase: 0.0,
            mod_phase: 0.0,
            vibrato_phase: 0.0,
        }
    }

    /// Zera o estado para a taxa `rate`. Falso se a taxa não couber no buffer.
    /// Campo a campo (sem `*self = …`): o buffer não cabe na pilha do wasm.
    pub fn init(&mut self, rate: f64) -> bool {
        if !(rate > 0.0 && rate <= MAX_RATE) {
            return false;
        }
        self.params = VoiceModParams { ratio: 1.0, ..VoiceModParams::default() };
        self.rate = rate;
        self.size = (rate * WINDOW_MS / 1000.0).round();
        self.len = self.size as usize * 2 + 4;
        self.buffer.fill(0.0);
        self.pos = 0;
        self.phase = 0.0;
        self.mod_phase = 0.0;
        self.vibrato_phase = 0.0;
        true
    }

    pub fn configure(&mut self, params: VoiceModParams) {
        self.params = params;
    }

    /// Um bloco: `input` = None conta como silêncio (track parada).
    pub fn process(&mut self, input: Option<&[f32]>, output: &mut [f32]) {
        let step = (1.0 - self.block_ratio(output.len())) / self.size;
        let mod_step = (TWO_PI * self.params.mod_hz) / self.rate;
        for (i, out) in output.iter_mut().enumerate() {
            self.buffer[self.pos] = input.and_then(|x| x.get(i)).copied().unwrap_or(0.0);
            let s = (PI * self.phase).sin();
            let weight_a = s * s;
            let phase_b = (self.phase + 0.5) % 1.0;
            let mut y = self.read(self.phase * self.size) * weight_a
                + self.read(phase_b * self.size) * (1.0 - weight_a);
            if self.params.mod_hz > 0.0 {
                let depth = self.params.mod_depth;
                y *= 1.0 - depth + depth * self.mod_phase.sin();
                self.mod_phase = (self.mod_phase + mod_step) % TWO_PI;
            }
            *out = y as f32;
            self.phase += step;
            self.phase -= self.phase.floor();
            self.pos += 1;
            if self.pos == self.len {
                self.pos = 0;
            }
        }
    }

    /// Razão deste bloco: a base com o desvio do vibrato; avança a fase dele.
    fn block_ratio(&mut self, samples: usize) -> f64 {
        let p = &self.params;
        let ratio = p.ratio * 2f64.powf((p.vibrato_semitones * self.vibrato_phase.sin()) / 12.0);
        let step = (TWO_PI * p.vibrato_hz * samples as f64) / self.rate;
        self.vibrato_phase = (self.vibrato_phase + step) % TWO_PI;
        ratio
    }

    /// Lê o buffer `delay` amostras atrás da última escrita (interpolação linear).
    #[inline(always)]
    fn read(&self, delay: f64) -> f64 {
        let p = self.pos as f64 - delay;
        let floor = p.floor();
        let frac = p - floor;
        // delay ∈ [0, janela): o índice cai em [−janela, len), uma volta basta.
        let mut i0 = floor as isize;
        if i0 < 0 {
            i0 += self.len as isize;
        }
        let i0 = i0 as usize;
        let i1 = if i0 + 1 == self.len { 0 } else { i0 + 1 };
        let a = self.buffer[i0] as f64;
        let b = self.buffer[i1] as f64;
        a + (b - a) * frac
    }
}

impl Default for VoiceMod {
    fn default() -> Self {
        VoiceMod::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: f64 = 48_000.0;
    const BLOCK: usize = 128;

    fn make(params: VoiceModParams) -> Box<VoiceMod> {
        let mut dsp = Box::new(VoiceMod::new());
        assert!(dsp.init(RATE));
        dsp.configure(VoiceModParams { ratio: if params.ratio == 0.0 { 1.0 } else { params.ratio }, ..params });
        dsp
    }

    fn signal(f: impl Fn(usize) -> f32) -> Vec<f32> {
        (0..RATE as usize).map(f).collect()
    }

    fn sine(hz: f64) -> Vec<f32> {
        signal(|i| (0.5 * (TWO_PI * hz * i as f64 / RATE).sin()) as f32)
    }

    fn run(dsp: &mut VoiceMod, input: &[f32]) -> Vec<f32> {
        let mut out = vec![0.0; input.len()];
        for (inp, o) in input.chunks(BLOCK).zip(out.chunks_mut(BLOCK)) {
            dsp.process(Some(inp), o);
        }
        out
    }

    /// Frequência pelas passagens por zero, ignorando o primeiro quarto de segundo.
    fn frequency(out: &[f32]) -> f64 {
        let from = (RATE * 0.25) as usize;
        let crossings = (from + 1..out.len()).filter(|&i| out[i - 1] < 0.0 && out[i] >= 0.0).count();
        crossings as f64 / ((out.len() - from) as f64 / RATE)
    }

    #[test]
    fn razao_1_devolve_a_entrada_atrasada_em_25_ms() {
        let delay = (RATE * 0.025) as usize;
        let input = sine(440.0);
        let out = run(&mut make(VoiceModParams::default()), &input);
        for i in (delay + 10..out.len()).step_by(97) {
            assert!((out[i] - input[i - delay]).abs() < 1e-4, "amostra {i}");
        }
    }

    #[test]
    fn razao_2_sobe_uma_oitava() {
        let mut dsp = make(VoiceModParams { ratio: 2.0, ..Default::default() });
        assert!((frequency(&run(&mut dsp, &sine(1000.0))) - 2000.0).abs() < 50.0);
    }

    #[test]
    fn razao_meia_desce_uma_oitava() {
        let mut dsp = make(VoiceModParams { ratio: 0.5, ..Default::default() });
        assert!((frequency(&run(&mut dsp, &sine(1000.0))) - 500.0).abs() < 50.0);
    }

    #[test]
    fn a_amplitude_se_mantem() {
        let mut dsp = make(VoiceModParams { ratio: 1.5, ..Default::default() });
        let out = run(&mut dsp, &sine(1000.0));
        let peak = out[RATE as usize / 2..].iter().fold(0.0f32, |m, v| m.max(v.abs()));
        assert!(peak > 0.45 && peak < 0.55, "pico {peak}");
    }

    #[test]
    fn modulacao_em_anel_multiplica_por_um_seno() {
        let mut dsp = make(VoiceModParams { mod_hz: 100.0, mod_depth: 1.0, ..Default::default() });
        assert!((frequency(&run(&mut dsp, &signal(|_| 1.0))) - 100.0).abs() < 5.0);
    }

    #[test]
    fn profundidade_parcial_vira_tremolo() {
        let mut dsp = make(VoiceModParams { mod_hz: 5.0, mod_depth: 0.25, ..Default::default() });
        let out = run(&mut dsp, &signal(|_| 1.0));
        let tail = &out[RATE as usize / 2..];
        let min = tail.iter().fold(f32::MAX, |m, &v| m.min(v));
        let max = tail.iter().fold(f32::MIN, |m, &v| m.max(v));
        assert!((min - 0.5).abs() < 0.01 && (max - 1.0).abs() < 0.01, "{min}..{max}");
    }

    #[test]
    fn vibrato_oscila_o_tom_em_torno_da_razao_base() {
        let mut dsp = make(VoiceModParams { vibrato_hz: 4.0, vibrato_semitones: 1.0, ..Default::default() });
        let out = run(&mut dsp, &sine(1000.0));
        let window = RATE as usize / 40;
        let quarter = RATE as usize / 4;
        let freqs: Vec<f64> = (quarter..=RATE as usize * 3 / 4 - window)
            .step_by(window)
            .map(|from| frequency(&out[from - quarter..from + window]))
            .collect();
        assert!(freqs.iter().cloned().fold(f64::MIN, f64::max) > 1030.0);
        assert!(freqs.iter().cloned().fold(f64::MAX, f64::min) < 970.0);
    }

    #[test]
    fn sem_entrada_conta_como_silencio() {
        let mut dsp = make(VoiceModParams::default());
        let mut out = [1.0f32; BLOCK];
        dsp.process(None, &mut out);
        assert!(out.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn taxa_fora_do_buffer_e_recusada() {
        let mut dsp = Box::new(VoiceMod::new());
        assert!(!dsp.init(MAX_RATE * 2.0));
        assert!(!dsp.init(0.0));
        assert!(dsp.init(MAX_RATE));
    }
}
