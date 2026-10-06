import Principal "mo:core/Principal";

module {
  public type TokenAmount = Nat;
  public type Timestamp = Nat;

  // Shared mutable state for the Lucky ledger, swap pool, and treasury.
  // `totalSupply` is the Lucky total supply, `poolLucky` is the swap pool's
  // Lucky balance, and `treasuryLucky` is the treasury's Lucky balance.
  public type PoolState = {
    var totalSupply : Nat;
    var poolLucky : Nat;
    var treasuryLucky : Nat;
  };

  // Minimal ICRC-1 account and ledger interface used to read the ICP ledger.
  public type IcpAccount = { owner : Principal; subaccount : ?Blob };
  public type IcpLedger = actor {
    icrc1_balance_of : shared query (IcpAccount) -> async Nat;
  };
};
