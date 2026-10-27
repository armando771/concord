// Microbenchmark dos processadores de áudio (AudioWorklets) em Node, sem DOM:
// custo por quantum de 128 amostras a 48 kHz, em ns (média, p50, p95, p99).
//
//   node scripts/bench-dsp.mjs              # todos os cenários
//   node scripts/bench-dsp.mjs voz          # só os que têm "voz" no nome
//
// O voice mod roda em JS (sem módulo) e em WASM (com o concordDsp.wasm em
// processorOptions.dspModule, como no app); os outros worklets só têm JS.
//
// Os worklets de verdade (frontend/.../call/lib/*Worklet.ts) são empacotados
// com o esbuild do frontend e rodam com AudioWorkletProcessor/registerProcessor
// simulados, como nos testes. "% núcleo" = média × 375 quanta/s.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = path.join(ROOT, 'frontend/src/renderer/src/features/call/lib')
const require = createRequire(path.join(ROOT, 'frontend/package.json'))
const esbuild = require('esbuild')

const RATE = 48_000
const BLOCK = 128
const WARMUP = 5_000
const QUANTA = 40_000
const ROUNDS = 3
const WASM = path.join(LIB, 'concordDsp.wasm')

// ─── Carregar os módulos TS ────────────────────────────────────────────────

async function importTs(file) {
  const out = await esbuild.build({
    entryPoints: [path.join(LIB, file)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    loader: { '.wasm': 'binary' }
  })
  const code = out.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

/** Carrega um worklet com o ambiente do AudioWorklet simulado; devolve a classe registrada. */
async function loadWorklet(file) {
  let ctor = null
  globalThis.sampleRate = RATE
  globalThis.currentTime = 0
  globalThis.AudioWorkletProcessor = class {
    port = { onmessage: null, postMessage: () => {} }
  }
  globalThis.registerProcessor = (_name, c) => {
    ctor = c
  }
  await importTs(file)
  return ctor
}

// ─── Sinal de entrada ──────────────────────────────────────────────────────

/** ~2 s de "voz" sintética: harmônicos de 140 Hz com envelope de sílabas e ruído. */
function speechLike(seconds = 2) {
  const out = new Float32Array(Math.round(seconds * RATE))
  let seed = 12345
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const t = i / RATE
    const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)
    let v = 0
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * 140 * h * t) / h
    out[i] = 0.15 * env * v + 0.01 * (seed / 2 ** 32 - 0.5)
  }
  return out
}

const INPUT = speechLike()
const QUANTA_IN_INPUT = Math.floor(INPUT.length / BLOCK)

// ─── Medição ───────────────────────────────────────────────────────────────

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

/** Média por quantum medindo o lote inteiro (sem o custo do relógio a cada quantum). */
function batchMean(step) {
  const t0 = process.hrtime.bigint()
  for (let q = 0; q < QUANTA; q++) step(q)
  return Number(process.hrtime.bigint() - t0) / QUANTA
}

/**
 * Mede `step(q)` (um quantum): a média pelo lote (melhor de ROUNDS rodadas) e
 * os percentis cronometrando cada quantum (descontado o custo do relógio).
 */
function measure(step, overhead = 0) {
  for (let q = 0; q < WARMUP; q++) step(q)
  let mean = Infinity
  for (let r = 0; r < ROUNDS; r++) mean = Math.min(mean, batchMean(step))
  const times = new Float64Array(QUANTA)
  for (let q = 0; q < QUANTA; q++) {
    const t0 = process.hrtime.bigint()
    step(q)
    times[q] = Math.max(0, Number(process.hrtime.bigint() - t0) - overhead)
  }
  times.sort()
  return { mean, p50: percentile(times, 0.5), p95: percentile(times, 0.95), p99: percentile(times, 0.99) }
}

// ─── Cenários ──────────────────────────────────────────────────────────────

function inputBlock(q) {
  const start = (q % QUANTA_IN_INPUT) * BLOCK
  return INPUT.subarray(start, start + BLOCK)
}

/** Um processador de worklet com entrada mono e saída mono, como no grafo do microfone. */
function monoStep(processor) {
  const out = [[new Float32Array(BLOCK)]]
  return (q) => processor.process([[inputBlock(q)]], out)
}

async function voiceModScenarios() {
  const { voiceModParams, PRESET_ORDER, VOICE_MOD_PRESETS } = await importTs('voiceModPresets.ts')
  const Processor = await loadWorklet('voiceModWorklet.ts')
  return PRESET_ORDER.map((preset) => ({
    name: `voz/${preset}`,
    wasm: true,
    make: (dspModule) => {
      const p = voiceModParams({ preset, customized: false, ...VOICE_MOD_PRESETS[preset].values })
      const processor = new Processor({ processorOptions: { dspModule } })
      processor.port.onmessage({
        data: { ratio: p.pitchRatio, modHz: p.modHz, modDepth: p.modDepth, vibratoHz: p.vibratoHz, vibratoSemitones: p.vibratoSemitones }
      })
      return monoStep(processor)
    }
  }))
}

async function voiceActivityScenarios() {
  const { voiceActivityFor } = await importTs('voiceActivity.ts')
  const Processor = await loadWorklet('voiceActivityWorklet.ts')
  return [false, true].map((gate) => ({
    name: `fala/portão-${gate ? 'ligado' : 'desligado'}`,
    make: (dspModule) => {
      const processor = new Processor({ processorOptions: { dspModule } })
      processor.port.onmessage({ data: { config: voiceActivityFor(60), gate } })
      const step = monoStep(processor)
      return (q) => {
        globalThis.currentTime = (q * BLOCK) / RATE
        step(q)
      }
    }
  }))
}

async function screenScenarios() {
  const Processor = await loadWorklet('screenAudioWorklet.ts')
  return [
    {
      name: 'tela/pcm-estéreo',
      make: () => {
        const processor = new Processor()
        const chunk = new Float32Array(480 * 2).fill(0.1)
        const out = [[new Float32Array(BLOCK), new Float32Array(BLOCK)]]
        // O helper manda 10 ms (480 quadros) a cada ~3,75 quanta.
        return (q) => {
          if ((q * BLOCK) % 480 < BLOCK) processor.port.onmessage({ data: chunk.buffer })
          processor.process([], out)
        }
      }
    }
  ]
}

async function curveTimings() {
  const { reverbImpulse, driveCurve, softLimitCurve } = await importTs('voiceModCurves.ts')
  const time = (fn) => {
    const t0 = process.hrtime.bigint()
    fn()
    return Number(process.hrtime.bigint() - t0) / 1e6
  }
  return {
    'reverbImpulse (2,2 s)': time(() => reverbImpulse(RATE, { seconds: 2.2, preDelaySeconds: 0.03 })),
    'driveCurve (1025 pts)': time(() => driveCurve(3)),
    'softLimitCurve (1025 pts)': time(() => softLimitCurve(0.8, 2))
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function timerOverhead() {
  return measure(() => {}).p50
}

const ns = (v) => (v === undefined ? '—' : v.toFixed(0))

async function main() {
  const filter = process.argv[2] ?? ''
  const dspModule = existsSync(WASM) ? new WebAssembly.Module(readFileSync(WASM)) : null
  const scenarios = [...(await voiceModScenarios()), ...(await voiceActivityScenarios()), ...(await screenScenarios())]
  const overhead = timerOverhead()
  console.log(`Node ${process.version} · ${QUANTA} quanta; média pelo lote (melhor de ${ROUNDS}); percentis por quantum, descontado o relógio (~${overhead} ns)\n`)
  console.log('| Cenário | JS média ns | JS p95 ns | WASM média ns | WASM p95 ns | JS % núcleo | WASM % núcleo | ganho |')
  console.log('|---|---|---|---|---|---|---|---|')
  const results = {}
  for (const s of scenarios.filter((s) => s.name.includes(filter))) {
    const js = measure(s.make(null), overhead)
    const wasm = s.wasm && dspModule ? measure(s.make(dspModule), overhead) : undefined
    results[s.name] = { js, wasm }
    const core = (r) => (r ? ((r.mean * 375) / 1e7).toFixed(3) : '—')
    const gain = wasm ? `${(js.mean / wasm.mean).toFixed(1)}×` : '—'
    console.log(`| ${s.name} | ${ns(js.mean)} | ${ns(js.p95)} | ${ns(wasm?.mean)} | ${ns(wasm?.p95)} | ${core(js)} | ${core(wasm)} | ${gain} |`)
  }
  if (!filter) {
    console.log('\nUma vez por preset/microfone (ms):', await curveTimings())
  }
  if (process.env.BENCH_JSON) writeFileSync(process.env.BENCH_JSON, JSON.stringify(results, null, 2))
}

await main()
