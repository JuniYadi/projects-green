// Money thresholds
export const MINIMUM_BALANCE_WARN_IDR = 10_000;
export const MINIMUM_BALANCE_BLOCK_IDR = 0;

// Resource billing granularity
export const MIN_CPU_MCPU = 100;
export const MIN_MEM_MB = 128;
export const CPU_STEP_MCPU = 100;
export const MEM_STEP_MB = 128;

// Storage cost rate per GB-month (IDR)
export const STORAGE_RATE_PER_GB_MONTH_IDR = 0.26;

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

// ─── Usage Ledger Categories ──────────────────────────────────────────────────

export const USAGE_CATEGORY_WHATSAPP_IN = "WHATSAPP_MESSAGE_IN";
export const USAGE_CATEGORY_WHATSAPP_OUT = "WHATSAPP_MESSAGE_OUT";
export const USAGE_CATEGORY_APP_HOSTING_CPU = "APP_HOSTING_CPU";
export const USAGE_CATEGORY_APP_HOSTING_MEM = "APP_HOSTING_MEM";
export const USAGE_CATEGORY_VPN_BANDWIDTH = "VPN_BANDWIDTH";
export const USAGE_CATEGORY_BALANCE_TOPUP = "BALANCE_TOPUP";

export const USAGE_CATEGORIES = [
  USAGE_CATEGORY_WHATSAPP_IN,
  USAGE_CATEGORY_WHATSAPP_OUT,
  USAGE_CATEGORY_APP_HOSTING_CPU,
  USAGE_CATEGORY_APP_HOSTING_MEM,
  USAGE_CATEGORY_VPN_BANDWIDTH,
  USAGE_CATEGORY_BALANCE_TOPUP,
] as const;

export type UsageCategory = (typeof USAGE_CATEGORIES)[number];
