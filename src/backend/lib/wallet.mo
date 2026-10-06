import Map "mo:core/Map";
import Principal "mo:core/Principal";
import WalletTypes "../types/wallet";
import CommonTypes "../types/common";

module {
  // Lucky transfer fee: 0.001 Lucky = 100_000 e8s.
  public let LUCKY_FEE : Nat = 100_000;

  // Minimal ICRC-2 interface for the real ICP ledger.
  type IcpAccount = { owner : Principal; subaccount : ?Blob };
  type IcpTransferFromArgs = {
    spender_subaccount : ?Blob;
    from : IcpAccount;
    to : IcpAccount;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };
  type IcpTransferFromError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #InsufficientAllowance : { allowance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };
  type IcpTransferFromResult = { #Ok : Nat; #Err : IcpTransferFromError };
  type IcpLedger = actor {
    icrc2_transfer_from : shared (IcpTransferFromArgs) -> async IcpTransferFromResult;
  };

  func icpLedger(p : Principal) : IcpLedger = actor (p.toText());

  func icpErrorText(e : IcpTransferFromError) : Text {
    switch (e) {
      case (#BadFee(_)) { "Bad fee" };
      case (#BadBurn(_)) { "Bad burn" };
      case (#InsufficientFunds(_)) { "Insufficient ICP funds" };
      case (#InsufficientAllowance(_)) { "ICP allowance too low — approve the transfer first" };
      case (#TooOld) { "Transaction too old" };
      case (#CreatedInFuture(_)) { "Created in future" };
      case (#Duplicate(_)) { "Duplicate transaction" };
      case (#TemporarilyUnavailable) { "ICP ledger temporarily unavailable" };
      case (#GenericError(_)) { "ICP ledger error" };
    };
  };

  // Send ICP from the caller to an external principal. The caller must have
  // approved this canister as an ICP spender (ICRC-2).
  public func sendIcp(
    icpLedgerPrincipal : Principal,
    caller : Principal,
    to : Principal,
    amount : Nat,
  ) : async WalletTypes.SendResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let ledger = icpLedger(icpLedgerPrincipal);
    let result = await ledger.icrc2_transfer_from({
      spender_subaccount = null;
      from = { owner = caller; subaccount = null };
      to = { owner = to; subaccount = null };
      amount;
      fee = null;
      memo = null;
      created_at_time = null;
    });
    switch (result) {
      case (#Ok(blockIndex)) { #Ok(blockIndex) };
      case (#Err(e)) { #Err(#TransferFailed(icpErrorText(e))) };
    };
  };

  // Send Lucky from the caller's internal balance to an external principal.
  // The sender pays the amount plus the 0.001 Lucky fee; the fee is credited
  // to the treasury.
  public func sendLucky(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    caller : Principal,
    to : Principal,
    amount : Nat,
  ) : WalletTypes.SendResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let available = balances.get(caller) ?? 0;
    let total = amount + LUCKY_FEE;
    if (available < total) {
      return #Err(#InsufficientFunds({ available; required = total }));
    };
    balances.add(caller, available - total);
    let recipient = balances.get(to) ?? 0;
    balances.add(to, recipient + amount);
    poolState.treasuryLucky := poolState.treasuryLucky + LUCKY_FEE;
    #Ok(0);
  };
};
