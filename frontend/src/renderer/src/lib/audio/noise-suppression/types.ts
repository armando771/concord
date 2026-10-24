export interface NoiseSuppressionProcessor {
  createProcessedStream(input: MediaStream): Promise<MediaStream>
  destroy(): void
}
