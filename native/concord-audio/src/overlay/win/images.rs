//! Avatares pelo WIC (PNG, JPEG, WebP, GIF animado), numa thread própria: um
//! GIF grande não trava a janela. Os quadros soltos do WIC são montados e
//! reduzidos pelo gif.rs (puro).

use std::sync::mpsc::{Receiver, Sender};

use windows::core::{w, GUID, HSTRING, PCWSTR};
use windows::Win32::Foundation::GENERIC_READ;
use windows::Win32::Graphics::Imaging::{
    CLSID_WICImagingFactory, GUID_ContainerFormatGif, GUID_WICPixelFormat32bppPBGRA, IWICBitmapFrameDecode,
    IWICImagingFactory, IWICMetadataQueryReader, IWICPalette, WICBitmapDitherTypeNone, WICBitmapPaletteTypeMedianCut,
    WICDecodeMetadataCacheOnDemand,
};
use windows::Win32::System::Com::StructuredStorage::{PropVariantClear, PROPVARIANT};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
use windows::Win32::System::Variant::{VT_UI1, VT_UI2, VT_UI4};

use crate::overlay::gif::{cover_square, delay_ms, keep_every, Composer, Decoded, Disposal, FrameInfo, AVATAR_PX, MAX_FRAMES};

/// Pedido → resposta da thread de imagens. `notify` acorda a janela.
pub fn spawn_loader(requests: Receiver<String>, results: Sender<(String, Result<Decoded, String>)>, notify: impl Fn() + Send + 'static) {
    std::thread::spawn(move || {
        if let Err(err) = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.ok() {
            eprintln!("overlay: COM indisponível na thread de imagens: {err}");
            return;
        }
        let factory: Option<IWICImagingFactory> =
            unsafe { CoCreateInstance(&CLSID_WICImagingFactory, None::<&windows::core::IUnknown>, CLSCTX_INPROC_SERVER) }.ok();
        for path in requests {
            let result = match &factory {
                Some(f) => decode(f, &path),
                None => Err("WIC indisponível".to_string()),
            };
            if results.send((path, result)).is_err() {
                return;
            }
            notify();
        }
    });
}

fn step<T>(name: &str, result: windows::core::Result<T>) -> Result<T, String> {
    result.map_err(|err| format!("{name}: {err}"))
}

/// Número de um metadado do GIF (UI1/UI2/UI4); ausente = None.
fn meta_u32(reader: &IWICMetadataQueryReader, name: PCWSTR) -> Option<u32> {
    unsafe {
        let mut value = PROPVARIANT::default();
        reader.GetMetadataByName(name, &mut value).ok()?;
        let inner = &value.Anonymous.Anonymous;
        let out = match inner.vt {
            VT_UI1 => Some(inner.Anonymous.bVal as u32),
            VT_UI2 => Some(inner.Anonymous.uiVal as u32),
            VT_UI4 => Some(inner.Anonymous.ulVal),
            _ => None,
        };
        let _ = PropVariantClear(&mut value);
        out
    }
}

/// Quadro → pixels BGRA pré-multiplicados do tamanho dele.
fn frame_pixels(factory: &IWICImagingFactory, frame: &IWICBitmapFrameDecode) -> Result<(u32, u32, Vec<u8>), String> {
    unsafe {
        let converter = step("CreateFormatConverter", factory.CreateFormatConverter())?;
        step(
            "Initialize",
            converter.Initialize(frame, &GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, None::<&IWICPalette>, 0.0, WICBitmapPaletteTypeMedianCut),
        )?;
        let (mut w, mut h) = (0u32, 0u32);
        step("GetSize", converter.GetSize(&mut w, &mut h))?;
        if w == 0 || h == 0 || w > 4096 || h > 4096 {
            return Err(format!("tamanho fora do esperado: {w}×{h}"));
        }
        let mut pixels = vec![0u8; (w * h * 4) as usize];
        step("CopyPixels", converter.CopyPixels(std::ptr::null(), w * 4, &mut pixels))?;
        Ok((w, h, pixels))
    }
}

fn decode(factory: &IWICImagingFactory, path: &str) -> Result<Decoded, String> {
    unsafe {
        let decoder = step(
            "CreateDecoderFromFilename",
            factory.CreateDecoderFromFilename(&HSTRING::from(path), None, GENERIC_READ, WICDecodeMetadataCacheOnDemand),
        )?;
        let count = step("GetFrameCount", decoder.GetFrameCount())?;
        if count == 0 {
            return Err("imagem sem quadros".into());
        }
        let format: GUID = decoder.GetContainerFormat().unwrap_or_default();
        if format != GUID_ContainerFormatGif || count == 1 {
            let frame = step("GetFrame", decoder.GetFrame(0))?;
            let (w, h, pixels) = frame_pixels(factory, &frame)?;
            return Ok(Decoded { side: AVATAR_PX, frames: vec![cover_square(&pixels, w, h, AVATAR_PX)], delays: vec![0] });
        }

        // GIF animado: monta cada quadro na tela lógica (com o descarte do anterior).
        let screen = decoder.GetMetadataQueryReader().ok();
        let first = step("GetFrame", decoder.GetFrame(0))?;
        let (fw, fh, _) = frame_pixels(factory, &first)?;
        let width = screen.as_ref().and_then(|r| meta_u32(r, w!("/logscrdesc/Width"))).filter(|v| (1..=4096).contains(v)).unwrap_or(fw);
        let height = screen.as_ref().and_then(|r| meta_u32(r, w!("/logscrdesc/Height"))).filter(|v| (1..=4096).contains(v)).unwrap_or(fh);
        let mut composer = Composer::new(width, height);
        let every = keep_every(count as usize, MAX_FRAMES);
        let mut frames = Vec::new();
        let mut delays = Vec::new();
        for index in 0..count {
            let frame = step("GetFrame", decoder.GetFrame(index))?;
            let (w, h, pixels) = frame_pixels(factory, &frame)?;
            let meta = frame.GetMetadataQueryReader().ok();
            let get = |name: PCWSTR| meta.as_ref().and_then(|r| meta_u32(r, name));
            let info = FrameInfo {
                left: get(w!("/imgdesc/Left")).unwrap_or(0),
                top: get(w!("/imgdesc/Top")).unwrap_or(0),
                width: w,
                height: h,
                disposal: Disposal::from_code(get(w!("/grctlext/Disposal")).unwrap_or(0) as u8),
            };
            let delay = delay_ms(get(w!("/grctlext/Delay")).unwrap_or(0));
            let canvas = composer.add(info, &pixels);
            // Quadro guardado leva o tempo dos que foram pulados depois dele.
            if index as usize % every == 0 {
                frames.push(cover_square(canvas, width, height, AVATAR_PX));
                delays.push(delay);
            } else if let Some(last) = delays.last_mut() {
                *last += delay;
            }
        }
        Ok(Decoded { side: AVATAR_PX, frames, delays })
    }
}
