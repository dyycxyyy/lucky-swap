import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    balances : Map.Map<Principal, Nat>;
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>;
    poolState : { var totalSupply : Nat; var poolLucky : Nat; var treasuryLucky : Nat };
    icpLedgerPrincipal : Principal;
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    balances : Map.Map<Principal, Nat>;
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>;
    poolState : { var totalSupply : Nat; var poolLucky : Nat; var treasuryLucky : Nat };
    icpLedgerPrincipal : Principal;
    integrationPrincipals : Map.Map<Principal, Bool>;
    prizePools : Map.Map<Text, Nat>;
    movements : Map.Map<Text, {
      gameEventId : Text;
      source : {
        #ExcessSweep;
        #Crowdfunding;
        #PrizePoolTopUp;
        #BetDebit;
        #PrizePayout;
      };
      direction : { #In; #Out };
      amount : Nat;
      counterparty : Principal;
      timestamp : Nat;
    }>;
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      balances = old.balances;
      allowances = old.allowances;
      poolState = old.poolState;
      icpLedgerPrincipal = old.icpLedgerPrincipal;
      integrationPrincipals = Map.empty();
      prizePools = Map.empty();
      movements = Map.empty();
    };
  };
};
