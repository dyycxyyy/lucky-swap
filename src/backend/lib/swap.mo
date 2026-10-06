import Map "mo:core/Map";
import Principal "mo:core/Principal";
import SwapTypes "../types/swap";
import CommonTypes "../types/common";

module {
  // Fixed rate: 1 ICP = 1000 Lucky. Both tokens use 8 decimals.
  // 1 ICP = 100_000_000 e8s; 1000 Lucky = 100_000_000_000 e8s.
  public let LUCKY_PER_ICP : Nat = 1000;

  // ICP -> Lucky bounds (in ICP e8s).
  public let MIN_ICP : Nat = 10_000_000; // 0.1 ICP
  public let ICP_STEP : Nat = 10_000_000; // 0.1 ICP
  public let MAX_ICP : Nat = 1_000_000_000_000; // 10,000 ICP

  // Lucky -> ICP bounds (in Lucky e8s).
  public let LUCKY_STEP : Nat = 100_000_000_000; // 1000 Lucky
  public let MAX_LUCKY : Nat = 1_000_000_000_000_000; // 10,000,000 Lucky
  public let FEE_BPS : Nat = 300; // 3%
  public let BPS_DENOM : Nat = 10_000;

  // Minimal ICRC-1/ICRC-2 interface for the real ICP ledger.
  type IcpAccount = { owner : Principal; subaccount : ?Blob };
  type IcpTransferArgs = {
    from_subaccount : ?Blob;
    to : IcpAccount;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };
  type IcpTransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };
  type IcpTransferResult = { #Ok : Nat; #Err : IcpTransferError };
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
    icrc1_balance_of : shared query (IcpAccount) -> async Nat;
    icrc1_transfer : shared (IcpTransferArgs) -> async IcpTransferResult;
    icrc2_transfer_from : shared (IcpTransferFromArgs) -> async IcpTransferFromResult;
  };

  // Query-only view of the ledger, used by composite query endpoints so they can
  // await the balance read (a composite query may only call query functions).
  type IcpLedgerQuery = actor {
    icrc1_balance_of : shared query (IcpAccount) -> async Nat;
  };

  func icpLedgerQuery(p : Principal) : IcpLedgerQuery = actor (p.toText());

  func icpLedger(p : Principal) : IcpLedger = actor (p.toText());

  // Read the ICP ledger balance of `owner`, treating an unreachable ledger as 0
  // instead of trapping. On a local replica the mainnet ICP ledger canister does
  // not exist, so the inter-canister call rejects with IC0406; catching it keeps
  // balance queries (and the rest of their payload) working.
  public func safeIcpBalance(icpLedgerPrincipal : Principal, owner : Principal) : async Nat {
    let ledger = icpLedgerQuery(icpLedgerPrincipal);
    try {
      await ledger.icrc1_balance_of({ owner; subaccount = null });
    } catch (_) {
      0;
    };
  };

  func icpTransferErrorText(e : IcpTransferError) : Text {
    switch (e) {
      case (#BadFee(_)) { "Bad fee" };
      case (#BadBurn(_)) { "Bad burn" };
      case (#InsufficientFunds(_)) { "Insufficient ICP funds" };
      case (#TooOld) { "Transaction too old" };
      case (#CreatedInFuture(_)) { "Created in future" };
      case (#Duplicate(_)) { "Duplicate transaction" };
      case (#TemporarilyUnavailable) { "ICP ledger temporarily unavailable" };
      case (#GenericError(_)) { "ICP ledger error" };
    };
  };

  func icpTransferFromErrorText(e : IcpTransferFromError) : Text {
    switch (e) {
      case (#BadFee(_)) { "Bad fee" };
      case (#BadBurn(_)) { "Bad burn" };
      case (#InsufficientFunds(_)) { "Insufficient ICP funds" };
      case (#InsufficientAllowance(_)) { "ICP allowance too low — approve the swap first" };
      case (#TooOld) { "Transaction too old" };
      case (#CreatedInFuture(_)) { "Created in future" };
      case (#Duplicate(_)) { "Duplicate transaction" };
      case (#TemporarilyUnavailable) { "ICP ledger temporarily unavailable" };
      case (#GenericError(_)) { "ICP ledger error" };
    };
  };

  // Pure quote. `amount` is in e8s of the input token.
  public func quote(direction : SwapTypes.SwapDirection, amount : Nat) : SwapTypes.SwapQuote {
    switch (direction) {
      case (#IcpToLucky) {
        {
          direction;
          inputAmount = amount;
          outputAmount = amount * LUCKY_PER_ICP;
          feeLucky = 0;
        };
      };
      case (#LuckyToIcp) {
        let feeLucky = (amount * FEE_BPS) / BPS_DENOM;
        let netLucky = amount - feeLucky;
        {
          direction;
          inputAmount = amount;
          outputAmount = netLucky / LUCKY_PER_ICP;
          feeLucky;
        };
      };
    };
  };

  // ICP -> Lucky. The user must have approved this canister as an ICP spender
  // (ICRC-2). The canister pulls the ICP into its own account and pays Lucky
  // from the swap pool.
  public func swapIcpToLucky(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    icpLedgerPrincipal : Principal,
    selfPrincipal : Principal,
    caller : Principal,
    icpAmount : Nat,
  ) : async SwapTypes.SwapResult {
    if (icpAmount < MIN_ICP) {
      return #Err(#InvalidAmount("Minimum swap is 0.1 ICP"));
    };
    if (icpAmount % ICP_STEP != 0) {
      return #Err(#InvalidAmount("Amount must be a multiple of 0.1 ICP"));
    };
    if (icpAmount > MAX_ICP) {
      return #Err(#InvalidAmount("Maximum swap is 10,000 ICP"));
    };
    let luckyOut = icpAmount * LUCKY_PER_ICP;
    if (poolState.poolLucky < luckyOut) {
      return #Err(#InsufficientPoolLucky({ available = poolState.poolLucky; required = luckyOut }));
    };
    // Reserve the pool's Lucky before the outcall so a concurrent swap cannot
    // spend it twice; roll back if the ICP pull fails.
    poolState.poolLucky := poolState.poolLucky - luckyOut;
    let ledger = icpLedger(icpLedgerPrincipal);
    let transferResult = await ledger.icrc2_transfer_from({
      spender_subaccount = null;
      from = { owner = caller; subaccount = null };
      to = { owner = selfPrincipal; subaccount = null };
      amount = icpAmount;
      fee = null;
      memo = null;
      created_at_time = null;
    });
    switch (transferResult) {
      case (#Err(e)) {
        poolState.poolLucky := poolState.poolLucky + luckyOut;
        return #Err(#IcpTransferFailed(icpTransferFromErrorText(e)));
      };
      case (#Ok(_)) {};
    };
    // Pay Lucky from the pool to the user.
    let current = balances.get(caller) ?? 0;
    balances.add(caller, current + luckyOut);
    #Ok({
      direction = #IcpToLucky;
      inputAmount = icpAmount;
      outputAmount = luckyOut;
      feeLucky = 0;
    });
  };

  // Lucky -> ICP. 3% fee in Lucky goes to the treasury, the remaining 97% of
  // the Lucky value is added to the pool, and the user receives 97% of the ICP
  // value from the pool.
  public func swapLuckyToIcp(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    icpLedgerPrincipal : Principal,
    selfPrincipal : Principal,
    caller : Principal,
    luckyAmount : Nat,
  ) : async SwapTypes.SwapResult {
    if (luckyAmount == 0 or luckyAmount % LUCKY_STEP != 0) {
      return #Err(#InvalidAmount("Amount must be a positive multiple of 1000 Lucky"));
    };
    if (luckyAmount > MAX_LUCKY) {
      return #Err(#InvalidAmount("Maximum swap is 10,000,000 Lucky"));
    };
    let available = balances.get(caller) ?? 0;
    if (available < luckyAmount) {
      return #Err(#InsufficientUserLucky({ available; required = luckyAmount }));
    };
    let feeLucky = (luckyAmount * FEE_BPS) / BPS_DENOM;
    let netLucky = luckyAmount - feeLucky;
    let icpOut = netLucky / LUCKY_PER_ICP;
    // Reserve the user's Lucky before any outcall so it cannot be spent twice;
    // roll back if the pool lacks ICP or the ICP transfer fails.
    balances.add(caller, available - luckyAmount);
    poolState.poolLucky := poolState.poolLucky + netLucky;
    poolState.treasuryLucky := poolState.treasuryLucky + feeLucky;
    let rollback = func() {
      balances.add(caller, (balances.get(caller) ?? 0) + luckyAmount);
      poolState.poolLucky := poolState.poolLucky - netLucky;
      poolState.treasuryLucky := poolState.treasuryLucky - feeLucky;
    };
    // The pool must hold enough ICP to pay the user.
    let ledger = icpLedger(icpLedgerPrincipal);
    let poolIcp = await ledger.icrc1_balance_of({ owner = selfPrincipal; subaccount = null });
    if (poolIcp < icpOut) {
      rollback();
      return #Err(#InsufficientPoolIcp({ available = poolIcp; required = icpOut }));
    };
    // Pay ICP from the canister to the user.
    let transferResult = await ledger.icrc1_transfer({
      from_subaccount = null;
      to = { owner = caller; subaccount = null };
      amount = icpOut;
      fee = null;
      memo = null;
      created_at_time = null;
    });
    switch (transferResult) {
      case (#Err(e)) {
        rollback();
        return #Err(#IcpTransferFailed(icpTransferErrorText(e)));
      };
      case (#Ok(_)) {};
    };
    #Ok({
      direction = #LuckyToIcp;
      inputAmount = luckyAmount;
      outputAmount = icpOut;
      feeLucky;
    });
  };
};
