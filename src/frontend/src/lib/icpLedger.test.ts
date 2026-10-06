/**
 * Characterization: the shared ICP ledger approval helper.
 *
 * `approveIcpSpender` is the single seam both the Swap page and the Wallet send
 * flow use to let the backend pull ICP via `icrc2_transfer_from`. The new game
 * module must not change this contract, so these tests pin it directly rather
 * than only through the page journeys:
 *
 *   - the approval names the backend canister as the spender;
 *   - the approved amount is the send amount plus the ICP ledger fee, because
 *     the ledger charges that fee against the spender's allowance;
 *   - a ledger `Err` is surfaced as a readable thrown error, and a successful
 *     `Ok` resolves without throwing.
 *
 * The ICP ledger actor is a local fake; no network call is made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ICP_LEDGER_CANISTER_ID,
  ICP_LEDGER_FEE,
  approveErrorMessage,
  approveIcpSpender,
} from "@/lib/icpLedger";

// `vi.mock` is hoisted above the imports, so the fakes it closes over must be
// created with `vi.hoisted` rather than as ordinary top-level bindings. The
// approval argument is typed structurally here because a type declared at
// module scope is not in scope inside the hoisted callback.
const { approveMock, createActorMock } = vi.hoisted(() => {
  const approve = vi.fn(
    async (_args: {
      spender: {
        owner: { toText: () => string };
        subaccount: [] | [Uint8Array];
      };
      amount: bigint;
    }) => ({ Ok: 0n }),
  );
  const createActor = vi.fn(
    (_idl: unknown, _options: { canisterId: string }) => ({
      icrc2_approve: approve,
    }),
  );
  return { approveMock: approve, createActorMock: createActor };
});

vi.mock("@icp-sdk/core/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@icp-sdk/core/agent")>();
  return {
    ...actual,
    Actor: {
      ...actual.Actor,
      createActor: createActorMock,
    },
  };
});

const E8S = 100_000_000n;
const BACKEND_CANISTER_ID = "aaaaa-aa";
const IDENTITY = {} as Parameters<typeof approveIcpSpender>[0];

beforeEach(() => {
  approveMock.mockClear();
  createActorMock.mockClear();
  approveMock.mockResolvedValue({ Ok: 0n });
});

describe("approveIcpSpender", () => {
  it("approves the backend canister for the amount plus the ledger fee", async () => {
    await approveIcpSpender(IDENTITY, BACKEND_CANISTER_ID, 10n * E8S);

    expect(approveMock).toHaveBeenCalledTimes(1);
    const args = approveMock.mock.calls[0][0];
    // The ledger charges its transfer fee against the spender's allowance, so
    // the approval must cover amount + fee or the backend pull fails.
    expect(args.amount).toBe(10n * E8S + ICP_LEDGER_FEE);
    expect(args.spender.owner.toText()).toBe(BACKEND_CANISTER_ID);
    expect(args.spender.subaccount).toEqual([]);
  });

  it("targets the mainnet ICP ledger canister", async () => {
    await approveIcpSpender(IDENTITY, BACKEND_CANISTER_ID, 1n * E8S);

    expect(createActorMock).toHaveBeenCalledTimes(1);
    expect(createActorMock.mock.calls[0][1].canisterId).toBe(
      ICP_LEDGER_CANISTER_ID,
    );
  });

  it("resolves without throwing when the ledger approves", async () => {
    await expect(
      approveIcpSpender(IDENTITY, BACKEND_CANISTER_ID, 1n * E8S),
    ).resolves.toBeUndefined();
  });

  it("throws a readable error when the ledger rejects the approval", async () => {
    approveMock.mockResolvedValueOnce({
      Err: {
        __kind__: "InsufficientFunds",
        InsufficientFunds: { balance: 0n },
      },
    } as never);

    await expect(
      approveIcpSpender(IDENTITY, BACKEND_CANISTER_ID, 1n * E8S),
    ).rejects.toThrow("You do not have enough ICP to cover this transfer.");
  });
});

describe("approveErrorMessage", () => {
  it("maps known ledger error variants to user-facing messages", () => {
    expect(approveErrorMessage({ __kind__: "InsufficientFunds" })).toBe(
      "You do not have enough ICP to cover this transfer.",
    );
    expect(approveErrorMessage({ __kind__: "BadFee" })).toBe(
      "The ICP ledger rejected the approval fee. Please try again.",
    );
    expect(approveErrorMessage({ __kind__: "TemporarilyUnavailable" })).toBe(
      "The ICP ledger is temporarily unavailable. Please try again.",
    );
  });

  it("falls back to the unknown-error message for unrecognized values", () => {
    expect(approveErrorMessage(null)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
