module {
  public type SwapDirection = { #IcpToLucky; #LuckyToIcp };

  public type PoolBalances = { lucky : Nat; icp : Nat };

  public type SwapQuote = {
    direction : SwapDirection;
    inputAmount : Nat;
    outputAmount : Nat;
    feeLucky : Nat;
  };

  public type SwapError = {
    #InvalidAmount : Text;
    #InsufficientPoolLucky : { available : Nat; required : Nat };
    #InsufficientPoolIcp : { available : Nat; required : Nat };
    #InsufficientUserLucky : { available : Nat; required : Nat };
    #InsufficientUserIcp : { available : Nat; required : Nat };
    #IcpTransferFailed : Text;
    #LuckyTransferFailed : Text;
  };

  public type SwapReceipt = {
    direction : SwapDirection;
    inputAmount : Nat;
    outputAmount : Nat;
    feeLucky : Nat;
  };

  public type SwapResult = { #Ok : SwapReceipt; #Err : SwapError };
};
