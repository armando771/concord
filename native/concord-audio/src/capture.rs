//! Captura via WASAPI *process loopback* (Windows 10 2004+), como no exemplo
//! ApplicationLoopback da Microsoft: o áudio de um processo (e filhos), ou de
//! tudo menos ele, sai em stdout como PCM float32 48 kHz estéreo intercalado.

use std::io::Write;
use std::mem::ManuallyDrop;

use windows::core::{implement, Interface, Result, HRESULT, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND, WAIT_OBJECT_0};
use windows::Win32::Media::Audio::{
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Impl,
    IAudioCaptureClient, IAudioClient, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
    AUDCLNT_STREAMFLAGS_LOOPBACK,
    AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_PARAMS_0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::StructuredStorage::{
    PROPVARIANT, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
};
use windows::Win32::System::Com::{CoInitializeEx, IAgileObject, BLOB, COINIT_MULTITHREADED};
use windows::Win32::System::Threading::{CreateEventW, SetEvent, WaitForSingleObject};
use windows::Win32::System::Variant::VT_BLOB;
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

use crate::args::Mode;

pub const SAMPLE_RATE: u32 = 48_000;
pub const CHANNELS: u16 = 2;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
/// Buffer interno do WASAPI (unidades de 100 ns): 20 ms.
const BUFFER_DURATION: i64 = 200_000;

#[implement(IActivateAudioInterfaceCompletionHandler, IAgileObject)]
struct Activation {
    done: HANDLE,
}

// Marcador: o handler pode ser chamado de qualquer thread (exigido pela API).
impl windows::Win32::System::Com::IAgileObject_Impl for Activation_Impl {}

impl IActivateAudioInterfaceCompletionHandler_Impl for Activation_Impl {
    fn ActivateCompleted(
        &self,
        _operation: windows::core::Ref<'_, IActivateAudioInterfaceAsyncOperation>,
    ) -> Result<()> {
        unsafe { SetEvent(self.done) }
    }
}

fn target(mode: &Mode) -> Result<(u32, bool)> {
    Ok(match *mode {
        Mode::Window(hwnd) => {
            let mut pid = 0u32;
            unsafe { GetWindowThreadProcessId(HWND(hwnd as *mut _), Some(&mut pid)) };
            if pid == 0 {
                return Err(windows::core::Error::new(HRESULT(-1), "janela não encontrada"));
            }
            (pid, true)
        }
        Mode::Include(pid) => (pid, true),
        Mode::Exclude(pid) => (pid, false),
    })
}

unsafe fn activate(pid: u32, include: bool) -> Result<IAudioClient> {
    let mut params = AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: pid,
                ProcessLoopbackMode: if include {
                    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
                } else {
                    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE
                },
            },
        },
    };
    let prop = PROPVARIANT {
        Anonymous: PROPVARIANT_0 {
            Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                vt: VT_BLOB,
                Anonymous: PROPVARIANT_0_0_0 {
                    blob: BLOB {
                        cbSize: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                        pBlobData: &mut params as *mut _ as *mut u8,
                    },
                },
                ..Default::default()
            }),
        },
    };

    let done = CreateEventW(None, false, false, PCWSTR::null())?;
    let handler: IActivateAudioInterfaceCompletionHandler = Activation { done }.into();
    let operation = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        &IAudioClient::IID,
        Some(&prop),
        &handler,
    )?;
    WaitForSingleObject(done, u32::MAX);
    let _ = CloseHandle(done);

    let mut result = HRESULT(0);
    let mut activated = None;
    operation.GetActivateResult(&mut result, &mut activated)?;
    result.ok()?;
    activated
        .ok_or_else(|| windows::core::Error::new(HRESULT(-1), "sem interface de áudio"))?
        .cast()
}

/// Erro com a etapa que falhou, para o log do Concord dizer exatamente onde.
fn step<T>(name: &str, result: Result<T>) -> std::result::Result<T, String> {
    result.map_err(|err| format!("{name}: {err} (0x{:08X})", err.code().0 as u32))
}

/// Captura até stdout fechar (o Concord parou o compartilhamento).
pub fn run(mode: &Mode) -> std::result::Result<(), String> {
    unsafe {
        step("CoInitializeEx", CoInitializeEx(None, COINIT_MULTITHREADED).ok())?;
        let (pid, include) = step("janela → processo", target(mode))?;
        eprintln!("pid {pid} ({})", if include { "incluir" } else { "excluir" });
        let client = step("ActivateAudioInterfaceAsync", activate(pid, include))?;

        let block_align = CHANNELS * 4;
        let format = WAVEFORMATEX {
            wFormatTag: WAVE_FORMAT_IEEE_FLOAT,
            nChannels: CHANNELS,
            nSamplesPerSec: SAMPLE_RATE,
            nAvgBytesPerSec: SAMPLE_RATE * block_align as u32,
            nBlockAlign: block_align,
            wBitsPerSample: 32,
            cbSize: 0,
        };
        step("IAudioClient::Initialize", client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            // Mesmas flags do exemplo ApplicationLoopback da Microsoft.
            AUDCLNT_STREAMFLAGS_LOOPBACK
                | AUDCLNT_STREAMFLAGS_EVENTCALLBACK
                | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
            BUFFER_DURATION,
            0,
            &format,
            None,
        ))?;
        let ready = step("CreateEventW", CreateEventW(None, false, false, PCWSTR::null()))?;
        step("SetEventHandle", client.SetEventHandle(ready))?;
        let capture: IAudioCaptureClient = step("GetService", client.GetService())?;
        step("Start", client.Start())?;

        // O processo pai lê esta linha para saber que a captura começou.
        eprintln!("ready");

        let mut out = std::io::stdout().lock();
        let mut silence: Vec<u8> = Vec::new();
        loop {
            // Sem som o evento não dispara: o timeout só mantém o laço vivo.
            if WaitForSingleObject(ready, 200) != WAIT_OBJECT_0 {
                continue;
            }
            loop {
                let frames_available = step("GetNextPacketSize", capture.GetNextPacketSize())?;
                if frames_available == 0 {
                    break;
                }
                let mut data = std::ptr::null_mut();
                let mut frames = 0u32;
                let mut flags = 0u32;
                step("GetBuffer", capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None))?;
                let bytes = frames as usize * block_align as usize;
                let chunk: &[u8] = if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {
                    silence.resize(bytes, 0);
                    &silence
                } else {
                    std::slice::from_raw_parts(data, bytes)
                };
                let written = out.write_all(chunk);
                step("ReleaseBuffer", capture.ReleaseBuffer(frames))?;
                if written.is_err() {
                    // stdout fechado: o Concord parou o compartilhamento.
                    let _ = client.Stop();
                    return Ok(());
                }
            }
            if out.flush().is_err() {
                let _ = client.Stop();
                return Ok(());
            }
        }
    }
}
