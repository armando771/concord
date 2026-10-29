//! Ícones de mudo/ensurdecido: os mesmos caminhos SVG do app
//! (frontend/src/renderer/src/shared/ui/icons.tsx, viewBox 24×24), lidos
//! aqui para virar geometria do Direct2D.

/// MicOffIcon.
pub const MIC_OFF: &str = "M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z";
/// HeadsetOffIcon (o traço do corte vai à parte: linha de 3.5,2.5 a 21.5,20.5, 2.4 de largura).
pub const HEADSET: &str = "M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z";
pub const HEADSET_SLASH: ((f32, f32), (f32, f32), f32) = ((3.5, 2.5), (21.5, 20.5), 2.4);

/// EyeIcon (sem arcos, que o leitor não lê): contorno + íris (sentido contrário, vira
/// furo no winding) + pupila. Mesmo desenho de shared/ui/icons/actions.tsx.
pub const EYE: &str = "M12 5C6.6 5 3.1 9.3 2 12c1.1 2.7 4.6 7 10 7s8.9-4.3 10-7c-1.1-2.7-4.6-7-10-7zM12 8c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z";

/// Segmento em coordenadas absolutas.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Seg {
    Move(f32, f32),
    Line(f32, f32),
    Cubic(f32, f32, f32, f32, f32, f32),
    Close,
}

struct Reader<'a> {
    s: &'a [u8],
    i: usize,
}

impl Reader<'_> {
    fn skip(&mut self) {
        while self.i < self.s.len() && matches!(self.s[self.i], b' ' | b',' | b'\n' | b'\t' | b'\r') {
            self.i += 1;
        }
    }

    fn command(&mut self) -> Option<u8> {
        self.skip();
        let c = *self.s.get(self.i)?;
        if c.is_ascii_alphabetic() {
            self.i += 1;
            Some(c)
        } else {
            None
        }
    }

    fn has_number(&mut self) -> bool {
        self.skip();
        matches!(self.s.get(self.i), Some(c) if c.is_ascii_digit() || matches!(c, b'-' | b'+' | b'.'))
    }

    /// Número no estilo do SVG: "1.5-.3.2" são três números.
    fn number(&mut self) -> Result<f32, String> {
        self.skip();
        let start = self.i;
        if matches!(self.s.get(self.i), Some(b'-' | b'+')) {
            self.i += 1;
        }
        let mut dot = false;
        while let Some(&c) = self.s.get(self.i) {
            if c.is_ascii_digit() {
                self.i += 1;
            } else if c == b'.' && !dot {
                dot = true;
                self.i += 1;
            } else {
                break;
            }
        }
        if matches!(self.s.get(self.i), Some(b'e' | b'E')) {
            self.i += 1;
            if matches!(self.s.get(self.i), Some(b'-' | b'+')) {
                self.i += 1;
            }
            while matches!(self.s.get(self.i), Some(c) if c.is_ascii_digit()) {
                self.i += 1;
            }
        }
        std::str::from_utf8(&self.s[start..self.i])
            .ok()
            .and_then(|t| t.parse::<f32>().ok())
            .ok_or_else(|| format!("número inválido na posição {start}"))
    }
}

/// Lê um caminho com M L H V C S Z (maiúsculo = absoluto, minúsculo = relativo).
pub fn parse_path(d: &str) -> Result<Vec<Seg>, String> {
    let mut r = Reader { s: d.as_bytes(), i: 0 };
    let mut out = Vec::new();
    let (mut x, mut y) = (0f32, 0f32);
    let (mut sx, mut sy) = (0f32, 0f32);
    // Segundo ponto de controle da última curva (para o S).
    let mut last_ctrl: Option<(f32, f32)> = None;
    let mut cmd = r.command().ok_or("caminho sem comando")?;
    loop {
        let rel = cmd.is_ascii_lowercase();
        let (ox, oy) = if rel { (x, y) } else { (0.0, 0.0) };
        match cmd.to_ascii_uppercase() {
            b'M' => {
                x = ox + r.number()?;
                y = oy + r.number()?;
                sx = x;
                sy = y;
                out.push(Seg::Move(x, y));
                last_ctrl = None;
                // Pares depois do M são L implícitos.
                cmd = if rel { b'l' } else { b'L' };
                if r.has_number() {
                    continue;
                }
            }
            b'L' => {
                x = ox + r.number()?;
                y = oy + r.number()?;
                out.push(Seg::Line(x, y));
                last_ctrl = None;
            }
            b'H' => {
                x = ox + r.number()?;
                out.push(Seg::Line(x, y));
                last_ctrl = None;
            }
            b'V' => {
                y = oy + r.number()?;
                out.push(Seg::Line(x, y));
                last_ctrl = None;
            }
            b'C' => {
                let (x1, y1) = (ox + r.number()?, oy + r.number()?);
                let (x2, y2) = (ox + r.number()?, oy + r.number()?);
                x = ox + r.number()?;
                y = oy + r.number()?;
                out.push(Seg::Cubic(x1, y1, x2, y2, x, y));
                last_ctrl = Some((x2, y2));
            }
            b'S' => {
                let (x1, y1) = match last_ctrl {
                    Some((cx, cy)) => (2.0 * x - cx, 2.0 * y - cy),
                    None => (x, y),
                };
                let (x2, y2) = (ox + r.number()?, oy + r.number()?);
                x = ox + r.number()?;
                y = oy + r.number()?;
                out.push(Seg::Cubic(x1, y1, x2, y2, x, y));
                last_ctrl = Some((x2, y2));
            }
            b'Z' => {
                out.push(Seg::Close);
                x = sx;
                y = sy;
                last_ctrl = None;
            }
            other => return Err(format!("comando {} não suportado", other as char)),
        }
        if cmd.to_ascii_uppercase() != b'Z' && r.has_number() {
            continue;
        }
        match r.command() {
            Some(next) => cmd = next,
            None => {
                r.skip();
                return if r.i == r.s.len() { Ok(out) } else { Err(format!("lixo na posição {}", r.i)) };
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn absoluto_e_relativo() {
        let segs = parse_path("M1 2h3v4l-1-1L0 0z").unwrap();
        assert_eq!(
            segs,
            vec![Seg::Move(1.0, 2.0), Seg::Line(4.0, 2.0), Seg::Line(4.0, 6.0), Seg::Line(3.0, 5.0), Seg::Line(0.0, 0.0), Seg::Close]
        );
    }

    #[test]
    fn numeros_colados() {
        let segs = parse_path("M0 0c0 .74-.16 1.43-.43 2.05").unwrap();
        assert_eq!(segs[1], Seg::Cubic(0.0, 0.74, -0.16, 1.43, -0.43, 2.05));
    }

    #[test]
    fn curva_s_reflete_o_controle() {
        let segs = parse_path("M0 0C1 1 2 1 3 0S5 -1 6 0").unwrap();
        assert_eq!(segs[2], Seg::Cubic(4.0, -1.0, 5.0, -1.0, 6.0, 0.0));
        // S sem C antes: o primeiro controle é o ponto atual.
        let segs = parse_path("M1 1s2 2 3 3").unwrap();
        assert_eq!(segs[1], Seg::Cubic(1.0, 1.0, 3.0, 3.0, 4.0, 4.0));
    }

    #[test]
    fn pares_depois_do_m_sao_linhas_e_z_volta_ao_inicio() {
        let segs = parse_path("m1 1 2 0zl1 1").unwrap();
        assert_eq!(segs, vec![Seg::Move(1.0, 1.0), Seg::Line(3.0, 1.0), Seg::Close, Seg::Line(2.0, 2.0)]);
    }

    #[test]
    fn icones_do_app_leem_inteiros() {
        let mic = parse_path(MIC_OFF).unwrap();
        assert_eq!(mic.iter().filter(|s| matches!(s, Seg::Move(..))).count(), 3);
        assert_eq!(mic.last(), Some(&Seg::Close));
        let headset = parse_path(HEADSET).unwrap();
        assert_eq!(headset.first(), Some(&Seg::Move(12.0, 1.0)));
        // Todos os pontos dentro do viewBox 24×24.
        for seg in mic.iter().chain(&headset) {
            if let Seg::Line(x, y) | Seg::Move(x, y) | Seg::Cubic(_, _, _, _, x, y) = *seg {
                assert!((-0.01..=24.01).contains(&x) && (-0.01..=24.01).contains(&y), "{seg:?}");
            }
        }
    }

    #[test]
    fn olho_le_inteiro_e_cabe_no_viewbox() {
        let eye = parse_path(EYE).unwrap();
        assert_eq!(eye.iter().filter(|s| matches!(s, Seg::Move(..))).count(), 3);
        for seg in &eye {
            if let Seg::Line(x, y) | Seg::Move(x, y) | Seg::Cubic(_, _, _, _, x, y) = *seg {
                assert!((0.0..=24.0).contains(&x) && (0.0..=24.0).contains(&y), "{seg:?}");
            }
        }
    }

    #[test]
    fn recusa_o_que_nao_entende() {
        assert!(parse_path("").is_err());
        assert!(parse_path("M0 0A1 1 0 0 1 2 2").is_err());
        assert!(parse_path("M0").is_err());
        assert!(parse_path("M0 0 L").is_err());
    }
}
