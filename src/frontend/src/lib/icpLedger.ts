/**
 * Shared ICRC-2 approval helper for the mainnet ICP ledger.
 *
 * The backend pulls ICP with `icrc2_transfer_from`, so the caller must first
 * approve the backend canister as a spender on the ICP ledger. Both the Swap
 * page and the Wallet send flow reuse this module so the constants, IDL, and
 * error mapping stay in one place.
 */

import { unknownErrorMessage } from "@/lib/errors";
import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import type { Identity } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";

/** Mainnet ICP ledger canister. */
export const ICP_LEDGER_CANISTER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
/** Mainnet IC gateway host. */
export const IC_MAINNET_HOST = "https://icp-api.io";
/**
 * ICP ledger transfer fee, in e8s. `icrc2_transfer_from` charges this fee
 * against the spender's allowance, so the approval must cover amount + fee.
 */
export const ICP_LEDGER_FEE = 10_000n;

/**
 * Minimal ICRC-2 interface for the mainnet ICP ledger. The backend pulls ICP
 * with `icrc2_transfer_from`, so the caller must first approve the backend
 * canister as a spender on this ledger.
 */
const icpLedgerIdl: IDL.InterfaceFactory = () => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const ApproveArgs = IDL.Record({
    from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    spender: Account,
    amount: IDL.Nat,
    expected_allowance: IDL.Opt(IDL.Nat),
    expires_at: IDL.Opt(IDL.Nat64),
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
  });
  const ApproveError = IDL.Variant({
    GenericError: IDL.Record({ message: IDL.Text, error_code: IDL.Nat }),
    TemporarilyUnavailable: IDL.Null,
    Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
    BadFee: IDL.Record({ expected_fee: IDL.Nat }),
    AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
    CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
    TooOld: IDL.Null,
    Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
    InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  });
  const ApproveResult = IDL.Variant({ Ok: IDL.Nat, Err: ApproveError });
  return IDL.Service({
    icrc2_approve: IDL.Func([ApproveArgs], [ApproveResult], []),
  });
};

interface IcpLedgerActor {
  icrc2_approve(args: {
    from_subaccount: [] | [Uint8Array];
    spender: { owner: Principal; subaccount: [] | [Uint8Array] };
    amount: bigint;
    expected_allowance: [] | [bigint];
    expires_at: [] | [bigint];
    fee: [] | [bigint];
    memo: [] | [Uint8Array];
    created_at_time: [] | [bigint];
  }): Promise<
    | { Ok: bigint }
    | {
        Err: {
          __kind__: string;
          [key: string]: unknown;
        };
      }
  >;
}

/** Human-readable message for an ICP ledger approval failure. */
export function approveErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "__kind__" in error) {
    const kind = (error as { __kind__: string }).__kind__;
    if (kind === "InsufficientFunds") {
      return "You do not have enough ICP to cover this transfer.";
    }
    if (kind === "BadFee") {
      return "The ICP ledger rejected the approval fee. Please try again.";
    }
    if (kind === "TemporarilyUnavailable") {
      return "The ICP ledger is temporarily unavailable. Please try again.";
    }
  }
  return unknownErrorMessage(error);
}

/**
 * Approve the backend canister as an ICP spender for `amount + ICP_LEDGER_FEE`.
 * Throws a readable error when the ledger rejects the approval.
 */
export async function approveIcpSpender(
  identity: Identity,
  backendCanisterId: string,
  amount: bigint,
): Promise<void> {
  const spender = Principal.fromText(backendCanisterId);
  const agent = HttpAgent.createSync({ identity, host: IC_MAINNET_HOST });
  const ledger = Actor.createActor<IcpLedgerActor>(icpLedgerIdl, {
    agent,
    canisterId: ICP_LEDGER_CANISTER_ID,
  });
  const approval = await ledger.icrc2_approve({
    from_subaccount: [],
    spender: { owner: spender, subaccount: [] },
    // The ledger charges its transfer fee against the spender's allowance,
    // so approve amount + fee to cover the full pull.
    amount: amount + ICP_LEDGER_FEE,
    expected_allowance: [],
    expires_at: [],
    fee: [],
    memo: [],
    created_at_time: [],
  });
  if ("Err" in approval) {
    throw new Error(approveErrorMessage(approval.Err));
  }
}
