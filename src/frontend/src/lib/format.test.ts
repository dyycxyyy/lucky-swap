import { describe, expect, it } from "vitest";

import {
  E8S,
  formatAmount,
  formatToken,
  parseAmount,
  shortenPrincipal,
} from "@/lib/format";

describe("parseAmount", () => {
  it("parses whole and fractional token amounts into e8s", () => {
    expect(parseAmount("1")).toBe(E8S);
    expect(parseAmount("0.1")).toBe(E8S / 10n);
    expect(parseAmount("1000")).toBe(1000n * E8S);
    expect(parseAmount("0.00000001")).toBe(1n);
    expect(parseAmount("1.5")).toBe(150_000_000n);
  });

  it("tolerates surrounding whitespace and thousands separators", () => {
    expect(parseAmount("  10  ")).toBe(10n * E8S);
    expect(parseAmount("1,000")).toBe(1000n * E8S);
  });

  it("returns null for invalid input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    // More than 8 decimal places is not representable in e8s.
    expect(parseAmount("0.000000001")).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formats e8s as a decimal string", () => {
    expect(formatAmount(E8S)).toBe("1");
    expect(formatAmount(150_000_000n)).toBe("1.5");
    expect(formatAmount(1000n * E8S)).toBe("1,000");
    expect(formatAmount(0n)).toBe("0");
  });

  it("respects maxFractionDigits", () => {
    expect(formatAmount(123_456_789n, { maxFractionDigits: 4 })).toBe("1.2345");
  });
});

describe("formatToken", () => {
  it("appends the token symbol", () => {
    expect(formatToken(E8S, "ICP")).toBe("1 ICP");
    expect(formatToken(30n * E8S, "Lucky")).toBe("30 Lucky");
  });
});

describe("shortenPrincipal", () => {
  it("shortens long principals and leaves short ones intact", () => {
    expect(shortenPrincipal("aaaaa-aa")).toBe("aaaaa-aa");
    expect(shortenPrincipal("ryjl3-tyaaa-aaaaa-aaaba-cai")).toBe("ryjl3-…-cai");
  });
});
