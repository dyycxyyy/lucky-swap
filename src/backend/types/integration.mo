import Principal "mo:core/Principal";

module {
  // A game event identifier. Every integration fund operation is idempotent on
  // this id: replaying the same id never moves funds twice.
  public type GameEventId = Text;

  // A prize pool identifier owned by the external game.
  public type PrizePoolId = Text;

  // Direction of an integration movement, from the app's point of view.
  //   #In  — funds enter the app (treasury intake, prize payout to a wallet)
  //   #Out — funds leave the app (prize pool top-up, bet debit)
  public type MovementDirection = { #In; #Out };

  // What kind of integration operation produced a movement.
  public type MovementSource = {
    #ExcessSweep; // game excess sweep into the treasury
    #Crowdfunding; // game crowdfunding proceeds into the treasury
    #PrizePoolTopUp; // admin treasury withdrawal into a game prize pool
    #BetDebit; // user wallet debited for a bet
    #PrizePayout; // prize credited to a user wallet
  };

  // A recorded integration fund movement, queryable for reconciliation.
  public type Movement = {
    gameEventId : GameEventId;
    source : MovementSource;
    direction : MovementDirection;
    amount : Nat; // Lucky e8s
    counterparty : Principal; // user wallet principal, or the canister principal for pool/treasury ops
    timestamp : Nat; // nanoseconds since the epoch
  };

  // Errors shared by the integration surface.
  public type IntegrationError = {
    #NotAuthorized; // caller is not an admin-authorized integration principal
    #NotAdmin; // caller is not an admin (admin-only management/top-up)
    #InvalidAmount : Text; // amount must be a positive value
    #InsufficientFunds : { available : Nat; required : Nat }; // user wallet lacks funds
    #InsufficientTreasury : { available : Nat; required : Nat }; // treasury lacks funds
    #UnknownPrizePool : PrizePoolId; // no such prize pool
    #TransferFailed : Text; // internal transfer could not complete
  };

  // Result of a treasury intake (excess sweep / crowdfunding).
  public type TreasuryIntakeResult = {
    #Ok : { treasuryBalance : Nat };
    #Err : IntegrationError;
  };

  // Result of an admin prize-pool top-up.
  public type PrizePoolTopUpResult = {
    #Ok : { treasuryBalance : Nat; poolBalance : Nat };
    #Err : IntegrationError;
  };

  // Result of a bet debit or a prize payout: the user's new wallet balance.
  public type WalletMovementResult = {
    #Ok : { walletBalance : Nat };
    #Err : IntegrationError;
  };
};
