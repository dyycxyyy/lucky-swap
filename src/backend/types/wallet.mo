module {
  public type WalletBalances = { icp : Nat; lucky : Nat };

  public type SendError = {
    #InvalidAmount : Text;
    #InsufficientFunds : { available : Nat; required : Nat };
    #TransferFailed : Text;
  };

  public type SendResult = { #Ok : Nat; #Err : SendError };
};
