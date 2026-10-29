import { spawn, type ChildProcess } from 'child_process'

// Windows, fonte reserva da música: um PowerShell que fica aberto lendo as
// sessões de mídia do sistema (SMTC) e escreve uma linha JSON a cada 2 s, no
// formato que smtcMedia.ts lê. Sem dependência nova: o WinRT vem do próprio
// Windows (docs/adr/0006-musica-em-atividade.md).

/**
 * O script. Encerra sozinho quando o processo do app some (`parentPid`), para
 * não sobrar PowerShell se o app fechar sem matar o filho.
 */
export const SMTC_SCRIPT = (parentPid: number): string => `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  [void]$task.Wait(5000)
  $task.Result
}
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) $managerType
while ($true) {
  if (-not (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue)) { exit 0 }
  $list = New-Object System.Collections.ArrayList
  foreach ($s in $manager.GetSessions()) {
    try {
      $p = Await ($s.TryGetMediaPropertiesAsync()) $propsType
      $t = $s.GetTimelineProperties()
      [void]$list.Add(@{
        app = $s.SourceAppUserModelId
        title = $p.Title
        artist = $p.Artist
        album = $p.AlbumTitle
        status = [int]$s.GetPlaybackInfo().PlaybackStatus
        position = [long]$t.Position.TotalMilliseconds
        duration = [long]($t.EndTime - $t.StartTime).TotalMilliseconds
        updated = [long]$t.LastUpdatedTime.ToUnixTimeMilliseconds()
      })
    } catch {}
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($list) -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Seconds 2
}
`

/** O -EncodedCommand do PowerShell é UTF-16LE em base64 (sem problema de aspas). */
export function encodePowerShell(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

export function spawnSmtcPowerShell(): ChildProcess {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    encodePowerShell(SMTC_SCRIPT(process.pid))
  ]
  return spawn('powershell', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
}
