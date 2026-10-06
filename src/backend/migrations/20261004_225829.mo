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
    preferences : Map.Map<Principal, { logoId : Nat }>;
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      balances = old.balances;
      allowances = old.allowances;
      poolState = old.poolState;
      icpLedgerPrincipal = old.icpLedgerPrincipal;
      preferences = Map.empty();
    };
  };
};
