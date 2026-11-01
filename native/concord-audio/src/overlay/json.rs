//! JSON mínimo para o protocolo do overlay (uma mensagem por linha). Sem
//! crate nova: o protocolo é pequeno e fechado (ver docs/overlay-nativo.md).

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

/// Aninhamento máximo: a mensagem de estado tem 4 níveis; linha maliciosa não
/// estoura a pilha.
const MAX_DEPTH: usize = 16;

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(fields) => fields.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Json::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_arr(&self) -> Option<&[Json]> {
        match self {
            Json::Arr(items) => Some(items),
            _ => None,
        }
    }
}

pub fn parse(text: &str) -> Result<Json, String> {
    let mut p = Parser { s: text.as_bytes(), i: 0 };
    let value = p.value(0)?;
    p.ws();
    if p.i != p.s.len() {
        return Err(format!("sobra texto na posição {}", p.i));
    }
    Ok(value)
}

/// Texto → string JSON entre aspas.
pub fn quote(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

struct Parser<'a> {
    s: &'a [u8],
    i: usize,
}

impl Parser<'_> {
    fn ws(&mut self) {
        while self.i < self.s.len() && matches!(self.s[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }

    fn peek(&self) -> Option<u8> {
        self.s.get(self.i).copied()
    }

    fn eat(&mut self, c: u8) -> Result<(), String> {
        if self.peek() == Some(c) {
            self.i += 1;
            Ok(())
        } else {
            Err(format!("esperava '{}' na posição {}", c as char, self.i))
        }
    }

    fn literal(&mut self, word: &str, value: Json) -> Result<Json, String> {
        if self.s[self.i..].starts_with(word.as_bytes()) {
            self.i += word.len();
            Ok(value)
        } else {
            Err(format!("valor inválido na posição {}", self.i))
        }
    }

    fn value(&mut self, depth: usize) -> Result<Json, String> {
        if depth > MAX_DEPTH {
            return Err("JSON aninhado demais".into());
        }
        self.ws();
        match self.peek() {
            Some(b'{') => self.object(depth),
            Some(b'[') => self.array(depth),
            Some(b'"') => self.string().map(Json::Str),
            Some(b't') => self.literal("true", Json::Bool(true)),
            Some(b'f') => self.literal("false", Json::Bool(false)),
            Some(b'n') => self.literal("null", Json::Null),
            Some(c) if c == b'-' || c.is_ascii_digit() => self.number(),
            _ => Err(format!("valor inválido na posição {}", self.i)),
        }
    }

    fn object(&mut self, depth: usize) -> Result<Json, String> {
        self.eat(b'{')?;
        let mut fields = Vec::new();
        self.ws();
        if self.peek() == Some(b'}') {
            self.i += 1;
            return Ok(Json::Obj(fields));
        }
        loop {
            self.ws();
            let key = self.string()?;
            self.ws();
            self.eat(b':')?;
            let value = self.value(depth + 1)?;
            fields.push((key, value));
            self.ws();
            match self.peek() {
                Some(b',') => self.i += 1,
                Some(b'}') => {
                    self.i += 1;
                    return Ok(Json::Obj(fields));
                }
                _ => return Err(format!("esperava ',' ou '}}' na posição {}", self.i)),
            }
        }
    }

    fn array(&mut self, depth: usize) -> Result<Json, String> {
        self.eat(b'[')?;
        let mut items = Vec::new();
        self.ws();
        if self.peek() == Some(b']') {
            self.i += 1;
            return Ok(Json::Arr(items));
        }
        loop {
            items.push(self.value(depth + 1)?);
            self.ws();
            match self.peek() {
                Some(b',') => self.i += 1,
                Some(b']') => {
                    self.i += 1;
                    return Ok(Json::Arr(items));
                }
                _ => return Err(format!("esperava ',' ou ']' na posição {}", self.i)),
            }
        }
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.i;
        while let Some(c) = self.peek() {
            if c.is_ascii_digit() || matches!(c, b'-' | b'+' | b'.' | b'e' | b'E') {
                self.i += 1;
            } else {
                break;
            }
        }
        let text = std::str::from_utf8(&self.s[start..self.i]).unwrap_or("");
        text.parse::<f64>()
            .ok()
            .filter(|n| n.is_finite())
            .map(Json::Num)
            .ok_or_else(|| format!("número inválido na posição {start}"))
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let digits = self.s.get(self.i..self.i + 4).ok_or("\\u incompleto")?;
        let text = std::str::from_utf8(digits).map_err(|_| "\\u inválido")?;
        let code = u32::from_str_radix(text, 16).map_err(|_| format!("\\u inválido na posição {}", self.i))?;
        self.i += 4;
        Ok(code)
    }

    /// \uXXXX, juntando pares substitutos (emoji fora do BMP).
    fn unicode_escape(&mut self) -> Result<char, String> {
        let high = self.hex4()?;
        if (0xD800..0xDC00).contains(&high) && self.s[self.i..].starts_with(b"\\u") {
            self.i += 2;
            let low = self.hex4()?;
            if (0xDC00..0xE000).contains(&low) {
                let code = 0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00);
                return Ok(char::from_u32(code).unwrap_or('\u{FFFD}'));
            }
            return Ok('\u{FFFD}');
        }
        Ok(char::from_u32(high).unwrap_or('\u{FFFD}'))
    }

    fn string(&mut self) -> Result<String, String> {
        self.eat(b'"')?;
        let mut out = String::new();
        loop {
            let start = self.i;
            while let Some(c) = self.peek() {
                if c == b'"' || c == b'\\' || c < 0x20 {
                    break;
                }
                self.i += 1;
            }
            // O texto veio de &str: cortar em '"' ou '\\' (ASCII) mantém UTF-8 válido.
            out.push_str(std::str::from_utf8(&self.s[start..self.i]).map_err(|_| "UTF-8 inválido")?);
            match self.peek() {
                Some(b'"') => {
                    self.i += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.i += 1;
                    let c = self.peek().ok_or("string sem fim")?;
                    self.i += 1;
                    match c {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => out.push(self.unicode_escape()?),
                        _ => return Err(format!("escape inválido na posição {}", self.i - 1)),
                    }
                }
                _ => return Err("string sem fim".into()),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn objeto_com_tudo() {
        let v = parse(r#" {"a": 1.5, "b": [true, false, null], "c": {"d": "x"}, "e": -2e2} "#).unwrap();
        assert_eq!(v.get("a").and_then(Json::as_f64), Some(1.5));
        assert_eq!(v.get("b").and_then(Json::as_arr).map(|a| a.len()), Some(3));
        assert_eq!(v.get("c").and_then(|c| c.get("d")).and_then(Json::as_str), Some("x"));
        assert_eq!(v.get("e").and_then(Json::as_f64), Some(-200.0));
        assert_eq!(v.get("nada"), None);
    }

    #[test]
    fn strings_com_escape_acento_e_emoji() {
        let v = parse(r#""Jo\u00e3o \"o\" \\ \ud83d\ude00 ação/\n""#).unwrap();
        assert_eq!(v.as_str(), Some("João \"o\" \\ 😀 ação/\n"));
    }

    #[test]
    fn caminho_do_windows() {
        let v = parse(r#""C:\\Users\\Ana\\avatar.gif""#).unwrap();
        assert_eq!(v.as_str(), Some(r"C:\Users\Ana\avatar.gif"));
    }

    #[test]
    fn substituto_sozinho_vira_caractere_de_troca() {
        assert_eq!(parse(r#""\ud83d!""#).unwrap().as_str(), Some("\u{FFFD}!"));
    }

    #[test]
    fn recusa_lixo() {
        for bad in ["", "{", "[1,]", "{\"a\" 1}", "tru", "\"sem fim", "1 2", "{\"a\":1,}", "01x", "\"\\q\"", "nan"] {
            assert!(parse(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn recusa_aninhamento_demais() {
        let deep = "[".repeat(100) + &"]".repeat(100);
        assert!(parse(&deep).is_err());
    }

    #[test]
    fn quote_ida_e_volta() {
        let text = "a\"b\\c\nd\u{1}é😀";
        assert_eq!(parse(&quote(text)).unwrap().as_str(), Some(text));
    }
}
