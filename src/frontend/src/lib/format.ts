/**
 * Formatting and parsing helpers for ICP and Lucky amounts.
 * Both tokens use 8 decimals (e8s), so 1 token = 100_000_000 base units.
 */

export const E8S = 100_000_000n;
export const DECIMALS = 8;

/** Format a raw e8s bigint as a human-readable decimal string. */
export function formatAmount(
  amount: bigint,
  options: { maxFractionDigits?: number; minFractionDigits?: number } = {},
): string {
  const { maxFractionDigits = 8, minFractionDigits = 0 } = options;
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / E8S;
  const fraction = abs % E8S;

  let fractionStr = fraction.toString().padStart(DECIMALS, "0");
  if (maxFractionDigits < DECIMALS) {
    fractionStr = fractionStr.slice(0, maxFractionDigits);
  }
  fractionStr = fractionStr.replace(/0+$/, "");
  if (fractionStr.length < minFractionDigits) {
    fractionStr = fractionStr.padEnd(minFractionDigits, "0");
  }

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return fractionStr.length > 0
    ? `${sign}${wholeStr}.${fractionStr}`
    : `${sign}${wholeStr}`;
}

/** Format an e8s amount with a token symbol, e.g. "1,250.5 ICP". */
export function formatToken(
  amount: bigint,
  symbol: string,
  options?: { maxFractionDigits?: number },
): string {
  return `${formatAmount(amount, options)} ${symbol}`;
}

/**
 * Parse a user-entered decimal string into e8s base units.
 * Returns null when the input is not a valid non-negative decimal.
 */
export function parseAmount(input: string): bigint | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "" || !/^\d*\.?\d*$/.test(trimmed)) return null;
  const [wholePart = "", fractionPart = ""] = trimmed.split(".");
  if (wholePart === "" && fractionPart === "") return null;
  if (fractionPart.length > DECIMALS) return null;
  const whole = wholePart === "" ? 0n : BigInt(wholePart);
  const fraction =
    fractionPart === "" ? 0n : BigInt(fractionPart.padEnd(DECIMALS, "0"));
  return whole * E8S + fraction;
}

/** Shorten a principal string for compact display. */
export function shortenPrincipal(
  principal: string,
  lead = 6,
  tail = 4,
): string {
  if (principal.length <= lead + tail + 1) return principal;
  return `${principal.slice(0, lead)}…${principal.slice(-tail)}`;
}
