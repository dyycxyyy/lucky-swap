import Map "mo:core/Map";
import Principal "mo:core/Principal";
import LedgerTypes "../types/ledger";
import CommonTypes "../types/common";

module {
  // Lucky has 8 decimals. 0.001 Lucky = 100_000 e8s.
  public let FEE : Nat = 100_000;
  public let DECIMALS : Nat8 = 8;

  // The swap pool and the treasury are virtual accounts tracked in `poolState`
  // rather than entries in `balances`. This keeps their balances explicit and
  // avoids a self-referential principal.

  public func balanceOf(balances : Map.Map<Principal, Nat>, account : LedgerTypes.Account) : Nat {
    balances.get(account.owner) ?? 0;
  };

  // Credit a user's Lucky balance.
  public func credit(balances : Map.Map<Principal, Nat>, owner : Principal, amount : Nat) {
    let current = balances.get(owner) ?? 0;
    balances.add(owner, current + amount);
  };

  // Debit a user's Lucky balance. Caller must have checked sufficiency.
  public func debit(balances : Map.Map<Principal, Nat>, owner : Principal, amount : Nat) {
    let current = balances.get(owner) ?? 0;
    balances.add(owner, current - amount);
  };

  public func transfer(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    caller : Principal,
    args : LedgerTypes.TransferArgs,
  ) : LedgerTypes.TransferResult {
    let fee = args.fee ?? FEE;
    if (fee != FEE) {
      return #Err(#BadFee({ expected_fee = FEE }));
    };
    if (args.amount == 0) {
      return #Err(#GenericError({ error_code = 1; message = "Amount must be greater than zero" }));
    };
    let from = caller;
    let available = balances.get(from) ?? 0;
    let total = args.amount + fee;
    if (available < total) {
      return #Err(#InsufficientFunds({ balance = available }));
    };
    // Debit sender (amount + fee), credit recipient (amount), fee is credited to the treasury.
    debit(balances, from, total);
    credit(balances, args.to.owner, args.amount);
    poolState.treasuryLucky := poolState.treasuryLucky + fee;
    #Ok(0);
  };

  public func approve(
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>,
    caller : Principal,
    args : LedgerTypes.ApproveArgs,
  ) : LedgerTypes.ApproveResult {
    let fee = args.fee ?? FEE;
    if (fee != FEE) {
      return #Err(#BadFee({ expected_fee = FEE }));
    };
    let spenderAllowances = switch (allowances.get(caller)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Principal, Nat>();
        allowances.add(caller, m);
        m;
      };
    };
    switch (args.expected_allowance) {
      case (?expected) {
        let current = spenderAllowances.get(args.spender.owner) ?? 0;
        if (current != expected) {
          return #Err(#AllowanceChanged({ current_allowance = current }));
        };
      };
      case null {};
    };
    spenderAllowances.add(args.spender.owner, args.amount);
    #Ok(0);
  };

  public func allowance(
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>,
    args : LedgerTypes.AllowanceArgs,
  ) : LedgerTypes.Allowance {
    let value = switch (allowances.get(args.account.owner)) {
      case (?m) { m.get(args.spender.owner) ?? 0 };
      case null { 0 };
    };
    { allowance = value; expires_at = null };
  };

  public func transferFrom(
    balances : Map.Map<Principal, Nat>,
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>,
    poolState : CommonTypes.PoolState,
    caller : Principal,
    args : LedgerTypes.TransferFromArgs,
  ) : LedgerTypes.TransferFromResult {
    let fee = args.fee ?? FEE;
    if (fee != FEE) {
      return #Err(#BadFee({ expected_fee = FEE }));
    };
    if (args.amount == 0) {
      return #Err(#GenericError({ error_code = 1; message = "Amount must be greater than zero" }));
    };
    let owner = args.from.owner;
    let spenderAllowances = switch (allowances.get(owner)) {
      case (?m) { m };
      case null { return #Err(#InsufficientAllowance({ allowance = 0 })) };
    };
    let currentAllowance = spenderAllowances.get(caller) ?? 0;
    let total = args.amount + fee;
    if (currentAllowance < total) {
      return #Err(#InsufficientAllowance({ allowance = currentAllowance }));
    };
    let available = balances.get(owner) ?? 0;
    if (available < total) {
      return #Err(#InsufficientFunds({ balance = available }));
    };
    spenderAllowances.add(caller, currentAllowance - total);
    debit(balances, owner, total);
    credit(balances, args.to.owner, args.amount);
    poolState.treasuryLucky := poolState.treasuryLucky + fee;
    #Ok(0);
  };

  // Admin-only minting. Newly minted Lucky is credited to the swap pool, never
  // to a user. Returns the new total supply.
  public func mintToPool(poolState : CommonTypes.PoolState, amount : Nat) : Nat {
    poolState.totalSupply := poolState.totalSupply + amount;
    poolState.poolLucky := poolState.poolLucky + amount;
    poolState.totalSupply;
  };

  // Admin-only minting to an arbitrary account. Credits `to` and increases the
  // total supply. Caller must have validated `amount > 0`. Returns the new
  // total supply.
  public func mintTo(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    to : Principal,
    amount : Nat,
  ) : Nat {
    credit(balances, to, amount);
    poolState.totalSupply := poolState.totalSupply + amount;
    poolState.totalSupply;
  };

  // Admin-only burning from an arbitrary account. Debits `from` and decreases
  // the total supply. Caller must have validated `amount > 0` and that `from`
  // holds at least `amount`. Returns the new total supply.
  public func burnFrom(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    from : Principal,
    amount : Nat,
  ) : Nat {
    debit(balances, from, amount);
    poolState.totalSupply := poolState.totalSupply - amount;
    poolState.totalSupply;
  };
};
