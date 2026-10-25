/** Somente os totais do aplicativo; nenhum PID ou detalhe do sistema cruza o IPC. */
export interface AppMetrics {
  memoryMB: number | null
  cpuPercent: number | null
}
