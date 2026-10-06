module {
  public type TreasuryError = {
    #NotAdmin;
    #InvalidAmount : Text;
    #InsufficientTreasury : { available : Nat; required : Nat };
    #TransferFailed : Text;
  };

  public type TreasuryResult = { #Ok : Nat; #Err : TreasuryError };
};
