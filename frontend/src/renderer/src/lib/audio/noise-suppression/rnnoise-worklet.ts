// @ts-ignore
class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]
    const output = outputs[0]
    
    if (!input || input.length === 0 || !output || output.length === 0) {
      return true
    }

    const inputChannel = input[0]
    const outputChannel = output[0]
    
    if (!inputChannel || !outputChannel) {
      return true
    }

    for (let i = 0; i < inputChannel.length; i++) {
      const sample = inputChannel[i]
      const abs = Math.abs(sample)
      
      if (abs < 0.01) {
        outputChannel[i] = sample * 0.1
      } else if (abs < 0.05) {
        outputChannel[i] = sample * 0.6
      } else {
        outputChannel[i] = sample * 1.0
      }
      
      if (i > 0) {
        outputChannel[i] = outputChannel[i] * 0.95 + outputChannel[i - 1] * 0.05
      }
    }

    return true
  }
}

// @ts-ignore
registerProcessor('rnnoise-processor', RNNoiseProcessor)


