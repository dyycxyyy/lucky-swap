/**
 * Shared test state and helpers for the frontend suite.
 *
 * The module mock itself is registered in `src/test/setup.ts` (a setup file
 * runs before test modules are imported, so the mock applies to every suite).
 * This module only holds the mutable state that mock reads, plus a typed actor
 * factory.
 */

import type { backendInterface } from "@/backend";
import { vi } from "vitest";

export type MockActor = {
  [K in keyof backendInterface]: ReturnType<typeof vi.fn>;
};

/** Build a mock actor whose methods are all `vi.fn()`s. */
export function createMockActor(
  overrides: Partial<Record<keyof backendInterface, unknown>> = {},
): MockActor {
  const actor = {} as MockActor;
  const keys: (keyof backendInterface)[] = [
    "assignCallerUserRole",
    "authorizeIntegrationPrincipal",
    "burnFrom",
    "creditPrize",
    "debitBet",
    "execute",
    "getApiDoc",
    "getCallerUserRole",
    "getMovement",
    "getMyPrincipal",
    "getPoolBalances",
    "getPrizePoolBalance",
    "getSwapQuote",
    "getTreasuryBalance",
    "getTreasuryPrincipal",
    "getWalletBalances",
    "icrc1_balance_of",
    "icrc1_decimals",
    "icrc1_fee",
    "icrc1_metadata",
    "icrc1_name",
    "icrc1_supported_standards",
    "icrc1_symbol",
    "icrc1_total_supply",
    "icrc1_transfer",
    "icrc2_allowance",
    "icrc2_approve",
    "icrc2_transfer_from",
    "isCallerAdmin",
    "isIntegrationPrincipal",
    "listMovements",
    "mintTo",
    "mintToPool",
    "revokeIntegrationPrincipal",
    "schema",
    "sendIcp",
    "sendLucky",
    "submitCrowdfunding",
    "submitExcessSweep",
    "swapIcpToLucky",
    "swapLuckyToIcp",
    "topUpPrizePool",
    "withdrawTreasury",
  ];
  for (const key of keys) {
    actor[key] = vi.fn();
  }
  for (const [key, value] of Object.entries(overrides)) {
    (actor as Record<string, unknown>)[key] = value;
  }
  return actor;
}

export interface HarnessState {
  actor: MockActor | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoggingIn: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  identity: { getPrincipal: () => { toText: () => string } } | undefined;
}

export const harness: HarnessState = {
  actor: null,
  isAuthenticated: false,
  isInitializing: false,
  isLoggingIn: false,
  login: vi.fn(),
  logout: vi.fn(),
  identity: undefined,
};

/** Reset the harness to a signed-out, actor-less state. */
export function resetHarness() {
  harness.actor = null;
  harness.isAuthenticated = false;
  harness.isInitializing = false;
  harness.isLoggingIn = false;
  harness.login = vi.fn();
  harness.logout = vi.fn();
  harness.identity = undefined;
}
