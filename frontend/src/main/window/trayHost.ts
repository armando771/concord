import { execFile } from 'child_process'
import { trayHostRegistered } from './windowPolicy'

// No Linux o Electron desenha a bandeja por StatusNotifierItem (D-Bus): quem
// mostra o ícone é o painel (Waybar, KDE, extensão do GNOME…), que registra um
// "host" no org.kde.StatusNotifierWatcher. Sem host o Tray é criado sem erro e
// sem ícone — nem isDestroyed() nem exceção avisam. Então perguntamos ao D-Bus.

type Run = (cmd: string, args: string[]) => Promise<string>

const WATCHER = 'org.kde.StatusNotifierWatcher'
const PATH = '/StatusNotifierWatcher'
const PROPERTY = 'IsStatusNotifierHostRegistered'

/** Mesma pergunta nas três ferramentas comuns (a primeira que existir responde). */
const QUERIES: Array<{ cmd: string; args: string[] }> = [
  {
    cmd: 'dbus-send',
    args: [
      '--session',
      '--print-reply',
      `--dest=${WATCHER}`,
      PATH,
      'org.freedesktop.DBus.Properties.Get',
      `string:${WATCHER}`,
      `string:${PROPERTY}`
    ]
  },
  {
    cmd: 'gdbus',
    args: [
      'call',
      '--session',
      '--dest',
      WATCHER,
      '--object-path',
      PATH,
      '--method',
      'org.freedesktop.DBus.Properties.Get',
      WATCHER,
      PROPERTY
    ]
  },
  { cmd: 'busctl', args: ['--user', 'get-property', WATCHER, PATH, WATCHER, PROPERTY] }
]

const run: Run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 1500, windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  })

/**
 * Há um host de bandeja no barramento da sessão agora? Sem nenhuma ferramenta
 * D-Bus para perguntar, responde false: na dúvida, fechar a janela fecha o app.
 */
export async function probeTrayHost(exec: Run = run): Promise<boolean> {
  for (const { cmd, args } of QUERIES) {
    try {
      return trayHostRegistered(await exec(cmd, args))
    } catch (error) {
      // Ferramenta ausente: tenta a próxima. Qualquer outro erro (serviço sem
      // dono, tempo esgotado) é "não há host".
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
    }
  }
  return false
}
