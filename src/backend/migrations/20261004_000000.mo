import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  public type OldActor = {};

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    balances : Map.Map<Principal, Nat>;
    allowances : Map.Map<Principal, Map.Map<Principal, Nat>>;
    poolState : { var totalSupply : Nat; var poolLucky : Nat; var treasuryLucky : Nat };
    icpLedgerPrincipal : Principal;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      balances = Map.empty();
      allowances = Map.empty();
      poolState = { var totalSupply = 0; var poolLucky = 0; var treasuryLucky = 0 };
      icpLedgerPrincipal = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    };
  };
};
