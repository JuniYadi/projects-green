// Money thresholds
export const MINIMUM_BALANCE_WARN_IDR = 10_000;
export const MINIMUM_BALANCE_BLOCK_IDR = 0;

// Resource billing granularity
export const MIN_CPU_MCPU = 100;
export const MIN_MEM_MB = 128;
export const CPU_STEP_MCPU = 100;
export const MEM_STEP_MB = 128;

// Rounding helpers
export function roundCpu(mcpu: number): number {
  return Math.max(
    Math.ceil(mcpu / CPU_STEP_MCPU) * CPU_STEP_MCPU,
    MIN_CPU_MCPU,
  );
}

export function roundMem(memMb: number): number {
  return Math.max(Math.ceil(memMb / MEM_STEP_MB) * MEM_STEP_MB, MIN_MEM_MB);
}
