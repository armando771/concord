//! Linha de comando do helper.
//!
//!   concord-audio window <hwnd>    som do processo dono da janela (e filhos)
//!   concord-audio include <pid>    som do processo <pid> (e filhos)
//!   concord-audio exclude <pid>    som do sistema todo, menos <pid> (e filhos)

#[derive(Debug, PartialEq, Eq)]
pub enum Mode {
    Window(u64),
    Include(u32),
    Exclude(u32),
}

pub fn parse_args(args: &[String]) -> Result<Mode, String> {
    let usage = || "uso: concord-audio window <hwnd> | include <pid> | exclude <pid>".to_string();
    match args {
        [mode, value] => {
            let number = |v: &str| v.parse::<u64>().map_err(|_| format!("número inválido: {v}"));
            match mode.as_str() {
                "window" => match number(value)? {
                    0 => Err("hwnd não pode ser 0".to_string()),
                    hwnd => Ok(Mode::Window(hwnd)),
                },
                "include" | "exclude" => {
                    let pid = u32::try_from(number(value)?).map_err(|_| format!("pid inválido: {value}"))?;
                    if pid == 0 {
                        return Err("pid não pode ser 0".to_string());
                    }
                    Ok(if mode == "include" { Mode::Include(pid) } else { Mode::Exclude(pid) })
                }
                _ => Err(usage()),
            }
        }
        _ => Err(usage()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn janela_por_hwnd() {
        assert_eq!(parse_args(&args(&["window", "132456"])), Ok(Mode::Window(132456)));
    }

    #[test]
    fn incluir_e_excluir_processo() {
        assert_eq!(parse_args(&args(&["include", "4242"])), Ok(Mode::Include(4242)));
        assert_eq!(parse_args(&args(&["exclude", "77"])), Ok(Mode::Exclude(77)));
    }

    #[test]
    fn recusa_entradas_invalidas() {
        assert!(parse_args(&args(&[])).is_err());
        assert!(parse_args(&args(&["window"])).is_err());
        assert!(parse_args(&args(&["window", "0"])).is_err());
        assert!(parse_args(&args(&["include", "abc"])).is_err());
        assert!(parse_args(&args(&["include", "0"])).is_err());
        assert!(parse_args(&args(&["include", "99999999999"])).is_err());
        assert!(parse_args(&args(&["tocar", "1"])).is_err());
    }
}
