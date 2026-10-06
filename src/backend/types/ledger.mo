import Principal "mo:core/Principal";

module {
  public type Account = { owner : Principal; subaccount : ?Blob };

  public type TransferArgs = {
    from_subaccount : ?Blob;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferResult = { #Ok : Nat; #Err : TransferError };

  public type ApproveArgs = {
    from_subaccount : ?Blob;
    spender : Account;
    amount : Nat;
    expected_allowance : ?Nat;
    expires_at : ?Nat64;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type ApproveError = {
    #BadFee : { expected_fee : Nat };
    #InsufficientFunds : { balance : Nat };
    #AllowanceChanged : { current_allowance : Nat };
    #Expired : { ledger_time : Nat64 };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type ApproveResult = { #Ok : Nat; #Err : ApproveError };

  public type AllowanceArgs = { account : Account; spender : Account };

  public type Allowance = { allowance : Nat; expires_at : ?Nat64 };

  public type TransferFromArgs = {
    spender_subaccount : ?Blob;
    from : Account;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferFromError = {
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

  public type TransferFromResult = { #Ok : Nat; #Err : TransferFromError };

  public type SupportedStandard = { name : Text; url : Text };

  public type MetadataValue = {
    #Nat : Nat;
    #Int : Int;
    #Text : Text;
    #Blob : Blob;
  };

  public type MintError = { #NotAdmin; #InvalidAmount : Text };

  public type MintResult = { #Ok : Nat; #Err : MintError };

  // Admin-only burn errors. `#InsufficientBalance` carries the source account's
  // current balance so the caller can report the shortfall.
  public type BurnError = {
    #NotAdmin;
    #InvalidAmount : Text;
    #InsufficientBalance : { balance : Nat };
  };

  public type BurnResult = { #Ok : Nat; #Err : BurnError };
};
