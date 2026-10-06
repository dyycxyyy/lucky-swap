import { describe, expect, it } from "vitest";

import type {
  IntegrationError,
  SendError,
  SwapError,
  TreasuryError,
} from "@/backend";
import {
  integrationErrorMessage,
  sendErrorMessage,
  swapErrorMessage,
  treasuryErrorMessage,
  unknownErrorMessage,
} from "@/lib/errors";

describe("swapErrorMessage", () => {
  it("renders the available pool balance for insufficient pool errors", () => {
    const error: SwapError = {
      __kind__: "InsufficientPoolLucky",
      InsufficientPoolLucky: {
        available: 500n * 100_000_000n,
        required: 1000n * 100_000_000n,
      },
    };
    expect(swapErrorMessage(error)).toBe(
      "The pool only has 500 Lucky available. Try a smaller swap.",
    );
  });

  it("passes through backend InvalidAmount text", () => {
    const error: SwapError = {
      __kind__: "InvalidAmount",
      InvalidAmount: "Minimum swap is 0.1 ICP",
    };
    expect(swapErrorMessage(error)).toBe("Minimum swap is 0.1 ICP");
  });

  it("renders the user's available balance for insufficient user errors", () => {
    const error: SwapError = {
      __kind__: "InsufficientUserIcp",
      InsufficientUserIcp: { available: 0n, required: 100_000_000n },
    };
    expect(swapErrorMessage(error)).toBe(
      "You only have 0 ICP. Add funds or lower the amount.",
    );
  });
});

describe("sendErrorMessage", () => {
  it("renders the available balance for insufficient funds", () => {
    const error: SendError = {
      __kind__: "InsufficientFunds",
      InsufficientFunds: {
        available: 10n * 100_000_000n,
        required: 20n * 100_000_000n,
      },
    };
    expect(sendErrorMessage(error)).toBe(
      "You only have 10 available. Lower the amount and try again.",
    );
  });
});

describe("treasuryErrorMessage", () => {
  it("renders the not-admin message", () => {
    const error: TreasuryError = { __kind__: "NotAdmin", NotAdmin: null };
    expect(treasuryErrorMessage(error)).toBe(
      "Only the treasury admin can perform this action.",
    );
  });

  it("passes through InvalidAmount text", () => {
    const error: TreasuryError = {
      __kind__: "InvalidAmount",
      InvalidAmount: "Amount must be a positive multiple of 100 Lucky",
    };
    expect(treasuryErrorMessage(error)).toBe(
      "Amount must be a positive multiple of 100 Lucky",
    );
  });
});

describe("integrationErrorMessage", () => {
  it("explains an unauthorized integration caller", () => {
    const error: IntegrationError = {
      __kind__: "NotAuthorized",
      NotAuthorized: null,
    };
    expect(integrationErrorMessage(error)).toBe(
      "This principal is not an authorized integration caller. Ask an admin to authorize it first.",
    );
  });

  it("explains a non-admin caller", () => {
    const error: IntegrationError = { __kind__: "NotAdmin", NotAdmin: null };
    expect(integrationErrorMessage(error)).toBe(
      "Only the treasury admin can perform this action.",
    );
  });

  it("passes through the backend InvalidAmount text", () => {
    const error: IntegrationError = {
      __kind__: "InvalidAmount",
      InvalidAmount: "Amount must be greater than zero",
    };
    expect(integrationErrorMessage(error)).toBe(
      "Amount must be greater than zero",
    );
  });

  it("renders available and required for insufficient wallet funds", () => {
    const error: IntegrationError = {
      __kind__: "InsufficientFunds",
      InsufficientFunds: {
        available: 5n * 100_000_000n,
        required: 10n * 100_000_000n,
      },
    };
    expect(integrationErrorMessage(error)).toBe(
      "The wallet only holds 5 Lucky, but 10 is required.",
    );
  });

  it("renders available and required for an insufficient treasury", () => {
    const error: IntegrationError = {
      __kind__: "InsufficientTreasury",
      InsufficientTreasury: { available: 0n, required: 100n * 100_000_000n },
    };
    expect(integrationErrorMessage(error)).toBe(
      "The treasury only holds 0 Lucky, but 100 is required.",
    );
  });

  it("names the unknown prize pool", () => {
    const error: IntegrationError = {
      __kind__: "UnknownPrizePool",
      UnknownPrizePool: "weekly-jackpot",
    };
    expect(integrationErrorMessage(error)).toBe(
      'No prize pool exists with the id "weekly-jackpot".',
    );
  });

  it("surfaces a transfer failure reason", () => {
    const error: IntegrationError = {
      __kind__: "TransferFailed",
      TransferFailed: "ledger unreachable",
    };
    expect(integrationErrorMessage(error)).toBe(
      "The transfer could not be completed: ledger unreachable",
    );
  });
});

describe("unknownErrorMessage", () => {
  it("extracts a message from an Error", () => {
    expect(unknownErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back for unrecognized values", () => {
    expect(unknownErrorMessage(null)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
