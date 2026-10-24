import { useNoiseSuppressionStore } from '../../../store/noiseSuppressionStore'

let audioContext: AudioContext | null = null
let workletNode: AudioWorkletNode | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let destination: MediaStreamAudioDestinationNode | null = null

export async function createProcessedAudioStream(input: MediaStream): Promise<MediaStream> {
  const enabled = useNoiseSuppressionStore.getState().enabled
  
  if (!enabled) {
    return input
  }

  try {
    // Clean up previous
    if (audioContext) {
      await audioContext.close()
    }

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000
    })

    const workletUrl = new URL('./rnnoise-worklet.ts', import.meta.url)
    await audioContext.audioWorklet.addModule(workletUrl)

    sourceNode = audioContext.createMediaStreamSource(input)
    workletNode = new AudioWorkletNode(audioContext, 'rnnoise-processor')
    destination = audioContext.createMediaStreamDestination()

    sourceNode.connect(workletNode)
    workletNode.connect(destination)

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    return destination.stream
  } catch (error) {
    console.error('[RNNoise] Failed to initialize, falling back to raw stream:', error)
    return input
  }
}

export function destroyProcessedAudio(): void {
  if (workletNode) {
    workletNode.disconnect()
    workletNode = null
  }
  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
  }
  if (destination) {
    destination.disconnect()
    destination = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
}
