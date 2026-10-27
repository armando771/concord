//! GIF animado sem Win32: montar cada quadro sobre a tela lógica (com o
//! descarte do quadro anterior), reduzir para o tamanho do avatar e o relógio
//! que diz quando trocar de quadro. O WIC só decodifica os quadros soltos.
//!
//! Pixels em BGRA pré-multiplicado (o formato do Direct2D), 4 bytes cada.

/// Lado do avatar guardado na memória (o círculo tem 28 px × escala × DPI; 96
/// cobre 1,6× a 200% e um GIF de 100 quadros fica em ~3,7 MB).
pub const AVATAR_PX: u32 = 96;
/// Quadros guardados no máximo; GIF maior pula quadros somando os atrasos.
pub const MAX_FRAMES: usize = 100;

/// Avatar pronto para desenhar: quadros `side × side` e o atraso (ms) de cada um.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decoded {
    pub side: u32,
    pub frames: Vec<Vec<u8>>,
    pub delays: Vec<u32>,
}

/// Como o quadro anterior sai antes do próximo (campo "disposal" do GIF).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Disposal {
    /// 0/1: fica como está.
    Keep,
    /// 2: a área do quadro volta a transparente.
    Background,
    /// 3: a área volta ao que era antes do quadro.
    Previous,
}

impl Disposal {
    pub fn from_code(code: u8) -> Disposal {
        match code {
            2 => Disposal::Background,
            3 => Disposal::Previous,
            _ => Disposal::Keep,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FrameInfo {
    pub left: u32,
    pub top: u32,
    pub width: u32,
    pub height: u32,
    pub disposal: Disposal,
}

/// Atraso do quadro (centésimos de segundo) como os navegadores: 0 ou 1 vira 100 ms.
pub fn delay_ms(centis: u32) -> u32 {
    if centis <= 1 {
        100
    } else {
        centis * 10
    }
}

/// De quantos em quantos quadros guardar para não passar de `max`.
pub fn keep_every(count: usize, max: usize) -> usize {
    if count <= max || max == 0 {
        1
    } else {
        count.div_ceil(max)
    }
}

/// Monta os quadros do GIF sobre a tela lógica.
pub struct Composer {
    width: u32,
    height: u32,
    canvas: Vec<u8>,
    /// Descarte pendente do último quadro: (área, cópia de antes, se for "Previous").
    pending: Option<(FrameInfo, Option<Vec<u8>>)>,
}

impl Composer {
    pub fn new(width: u32, height: u32) -> Composer {
        Composer { width, height, canvas: vec![0; (width * height * 4) as usize], pending: None }
    }

    /// Recorte da área do quadro dentro da tela (quadro que sai da tela é cortado).
    fn clip(&self, info: &FrameInfo) -> (u32, u32, u32, u32) {
        let x0 = info.left.min(self.width);
        let y0 = info.top.min(self.height);
        let x1 = info.left.saturating_add(info.width).min(self.width);
        let y1 = info.top.saturating_add(info.height).min(self.height);
        (x0, y0, x1, y1)
    }

    fn dispose(&mut self) {
        let Some((info, before)) = self.pending.take() else { return };
        match info.disposal {
            Disposal::Keep => {}
            Disposal::Background => {
                let (x0, y0, x1, y1) = self.clip(&info);
                for y in y0..y1 {
                    let row = ((y * self.width + x0) * 4) as usize..((y * self.width + x1) * 4) as usize;
                    self.canvas[row].fill(0);
                }
            }
            Disposal::Previous => {
                if let Some(before) = before {
                    self.canvas = before;
                }
            }
        }
    }

    /// Desenha o quadro (pixels `width × height` dele) e devolve a tela inteira.
    pub fn add(&mut self, info: FrameInfo, pixels: &[u8]) -> &[u8] {
        self.dispose();
        let before = (info.disposal == Disposal::Previous).then(|| self.canvas.clone());
        let (x0, y0, x1, y1) = self.clip(&info);
        for y in y0..y1 {
            for x in x0..x1 {
                let src = (((y - info.top) * info.width + (x - info.left)) * 4) as usize;
                let Some(p) = pixels.get(src..src + 4) else { continue };
                let a = p[3] as u32;
                if a == 0 {
                    continue;
                }
                let dst = ((y * self.width + x) * 4) as usize;
                if a == 255 {
                    self.canvas[dst..dst + 4].copy_from_slice(p);
                } else {
                    // "over" em pré-multiplicado.
                    for c in 0..4 {
                        let under = self.canvas[dst + c] as u32;
                        self.canvas[dst + c] = (p[c] as u32 + under * (255 - a) / 255).min(255) as u8;
                    }
                }
            }
        }
        self.pending = Some((info, before));
        &self.canvas
    }
}

/// Recorta o centro em quadrado e reduz para `side × side` (o object-cover do
/// avatar), pela média da área de cada pixel.
pub fn cover_square(src: &[u8], width: u32, height: u32, side: u32) -> Vec<u8> {
    let mut out = vec![0u8; (side * side * 4) as usize];
    if width == 0 || height == 0 || side == 0 || src.len() < (width * height * 4) as usize {
        return out;
    }
    let crop = width.min(height) as f64;
    let ox = (width as f64 - crop) / 2.0;
    let oy = (height as f64 - crop) / 2.0;
    let step = crop / side as f64;
    for dy in 0..side {
        let sy0 = oy + dy as f64 * step;
        let sy1 = sy0 + step;
        for dx in 0..side {
            let sx0 = ox + dx as f64 * step;
            let sx1 = sx0 + step;
            let mut acc = [0f64; 4];
            let mut total = 0f64;
            let mut y = sy0.floor() as u32;
            while (y as f64) < sy1 && y < height {
                let wy = (sy1.min(y as f64 + 1.0) - sy0.max(y as f64)).max(0.0);
                let mut x = sx0.floor() as u32;
                while (x as f64) < sx1 && x < width {
                    let wx = (sx1.min(x as f64 + 1.0) - sx0.max(x as f64)).max(0.0);
                    let w = wx * wy;
                    let i = ((y * width + x) * 4) as usize;
                    for c in 0..4 {
                        acc[c] += src[i + c] as f64 * w;
                    }
                    total += w;
                    x += 1;
                }
                y += 1;
            }
            let o = ((dy * side + dx) * 4) as usize;
            if total > 0.0 {
                for c in 0..4 {
                    out[o + c] = (acc[c] / total).round().clamp(0.0, 255.0) as u8;
                }
            }
        }
    }
    out
}

/// Relógio da animação de um avatar. Tempo em ms (de um relógio monotônico
/// qualquer). Parado = primeiro quadro (o "/static" do app).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clock {
    delays: Vec<u32>,
    frame: usize,
    due: Option<u64>,
}

impl Clock {
    pub fn new(delays: Vec<u32>) -> Clock {
        Clock { delays, frame: 0, due: None }
    }

    pub fn frame(&self) -> usize {
        self.frame
    }

    pub fn animates(&self) -> bool {
        self.delays.len() > 1
    }

    /// Quando trocar de quadro (None = parado ou imagem sem animação).
    pub fn due(&self) -> Option<u64> {
        self.due
    }

    /// Começa a animar (se já anima, segue de onde está).
    pub fn play(&mut self, now: u64) {
        if self.animates() && self.due.is_none() {
            self.due = Some(now + self.delays[self.frame] as u64);
        }
    }

    /// Para e volta ao primeiro quadro. true = o quadro mudou.
    pub fn stop(&mut self) -> bool {
        self.due = None;
        let changed = self.frame != 0;
        self.frame = 0;
        changed
    }

    /// Avança o que já venceu. true = trocou de quadro (redesenhar). Atrasado
    /// demais (máquina dormiu), pula para o quadro certo sem laço longo.
    pub fn tick(&mut self, now: u64) -> bool {
        let Some(mut due) = self.due else { return false };
        if now < due {
            return false;
        }
        let total: u64 = self.delays.iter().map(|&d| d as u64).sum();
        if total > 0 && now - due > total {
            due += (now - due) / total * total;
        }
        while due <= now {
            self.frame = (self.frame + 1) % self.delays.len();
            due += self.delays[self.frame].max(1) as u64;
        }
        self.due = Some(due);
        true
    }
}

/// Próximo vencimento entre vários relógios (o timer único da janela).
pub fn next_due<'a>(clocks: impl Iterator<Item = &'a Clock>) -> Option<u64> {
    clocks.filter_map(Clock::due).min()
}

#[cfg(test)]
mod tests {
    use super::*;

    const RED: [u8; 4] = [0, 0, 255, 255];
    const BLUE: [u8; 4] = [255, 0, 0, 255];
    const CLEAR: [u8; 4] = [0, 0, 0, 0];

    fn solid(w: u32, h: u32, px: [u8; 4]) -> Vec<u8> {
        px.repeat((w * h) as usize)
    }

    fn at(canvas: &[u8], w: u32, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * w + x) * 4) as usize;
        canvas[i..i + 4].try_into().unwrap()
    }

    fn info(left: u32, top: u32, width: u32, height: u32, disposal: Disposal) -> FrameInfo {
        FrameInfo { left, top, width, height, disposal }
    }

    #[test]
    fn atrasos_como_os_navegadores() {
        assert_eq!(delay_ms(0), 100);
        assert_eq!(delay_ms(1), 100);
        assert_eq!(delay_ms(2), 20);
        assert_eq!(delay_ms(7), 70);
    }

    #[test]
    fn quadro_parcial_fica_sobre_o_anterior() {
        let mut c = Composer::new(2, 2);
        c.add(info(0, 0, 2, 2, Disposal::Keep), &solid(2, 2, RED));
        let out = c.add(info(1, 1, 1, 1, Disposal::Keep), &BLUE);
        assert_eq!(at(out, 2, 0, 0), RED);
        assert_eq!(at(out, 2, 1, 1), BLUE);
    }

    #[test]
    fn pixel_transparente_nao_apaga() {
        let mut c = Composer::new(1, 1);
        c.add(info(0, 0, 1, 1, Disposal::Keep), &RED);
        assert_eq!(at(c.add(info(0, 0, 1, 1, Disposal::Keep), &CLEAR), 1, 0, 0), RED);
    }

    #[test]
    fn descarte_para_o_fundo_limpa_so_a_area_do_quadro() {
        let mut c = Composer::new(2, 1);
        c.add(info(0, 0, 2, 1, Disposal::Keep), &solid(2, 1, RED));
        c.add(info(1, 0, 1, 1, Disposal::Background), &BLUE);
        let out = c.add(info(0, 0, 1, 1, Disposal::Keep), &CLEAR);
        assert_eq!(at(out, 2, 0, 0), RED);
        assert_eq!(at(out, 2, 1, 0), CLEAR);
    }

    #[test]
    fn descarte_para_o_anterior_desfaz_o_quadro() {
        let mut c = Composer::new(1, 1);
        c.add(info(0, 0, 1, 1, Disposal::Keep), &RED);
        assert_eq!(at(c.add(info(0, 0, 1, 1, Disposal::Previous), &BLUE), 1, 0, 0), BLUE);
        assert_eq!(at(c.add(info(0, 0, 1, 1, Disposal::Keep), &CLEAR), 1, 0, 0), RED);
    }

    #[test]
    fn quadro_fora_da_tela_e_cortado() {
        let mut c = Composer::new(2, 2);
        let out = c.add(info(1, 1, 4, 4, Disposal::Keep), &solid(4, 4, BLUE));
        assert_eq!(at(out, 2, 1, 1), BLUE);
        assert_eq!(at(out, 2, 0, 0), CLEAR);
        // Quadro com menos bytes que o tamanho diz não estoura.
        c.add(info(0, 0, 2, 2, Disposal::Keep), &RED);
    }

    #[test]
    fn meia_transparencia_mistura() {
        let mut c = Composer::new(1, 1);
        c.add(info(0, 0, 1, 1, Disposal::Keep), &[0, 0, 200, 255]);
        let out = c.add(info(0, 0, 1, 1, Disposal::Keep), &[100, 0, 0, 128]);
        assert_eq!(at(out, 1, 0, 0), [100, 0, 99, 255]);
    }

    #[test]
    fn recorte_quadrado_do_centro() {
        // 4×2: metade esquerda vermelha, direita azul; o quadrado do centro (x 1..3).
        let mut src = Vec::new();
        for _ in 0..2 {
            src.extend_from_slice(&[RED, RED, BLUE, BLUE].concat());
        }
        let out = cover_square(&src, 4, 2, 2);
        assert_eq!(at(&out, 2, 0, 0), RED);
        assert_eq!(at(&out, 2, 1, 1), BLUE);
    }

    #[test]
    fn reduzir_tira_a_media() {
        let src = [RED, BLUE, BLUE, RED].concat();
        assert_eq!(at(&cover_square(&src, 2, 2, 1), 1, 0, 0), [128, 0, 128, 255]);
    }

    #[test]
    fn ampliar_e_imagem_vazia() {
        assert_eq!(at(&cover_square(&RED, 1, 1, 3), 3, 2, 2), RED);
        assert_eq!(cover_square(&[], 0, 0, 2), vec![0; 16]);
    }

    #[test]
    fn pular_quadros_de_gif_comprido() {
        assert_eq!(keep_every(50, 100), 1);
        assert_eq!(keep_every(100, 100), 1);
        assert_eq!(keep_every(101, 100), 2);
        assert_eq!(keep_every(450, 100), 5);
    }

    #[test]
    fn relogio_anima_so_quando_toca() {
        let mut c = Clock::new(vec![100, 50, 200]);
        assert_eq!(c.due(), None);
        assert!(!c.tick(1000));
        c.play(1000);
        assert_eq!(c.due(), Some(1100));
        assert!(!c.tick(1099));
        assert!(c.tick(1100));
        assert_eq!((c.frame(), c.due()), (1, Some(1150)));
        assert!(c.tick(1150));
        assert_eq!((c.frame(), c.due()), (2, Some(1350)));
        // Play de novo não reinicia.
        c.play(1200);
        assert_eq!(c.due(), Some(1350));
        assert!(c.stop());
        assert_eq!((c.frame(), c.due()), (0, None));
        assert!(!c.stop());
    }

    #[test]
    fn relogio_atrasado_pula_sem_laco_longo() {
        let mut c = Clock::new(vec![100, 100]);
        c.play(0);
        assert!(c.tick(1_000_000_050));
        assert!(c.due().unwrap() > 1_000_000_050);
        assert!(c.due().unwrap() <= 1_000_000_150);
    }

    #[test]
    fn imagem_parada_nao_tem_relogio() {
        let mut c = Clock::new(vec![100]);
        c.play(0);
        assert!(!c.animates());
        assert_eq!(c.due(), None);
    }

    #[test]
    fn proximo_vencimento_entre_varios() {
        let mut a = Clock::new(vec![100, 100]);
        let mut b = Clock::new(vec![30, 30]);
        let still = Clock::new(vec![100, 100]);
        a.play(0);
        b.play(0);
        assert_eq!(next_due([&a, &b, &still].into_iter()), Some(30));
        assert_eq!(next_due([&still].into_iter()), None);
    }
}
