import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import TreasuryTypes "../types/treasury";
import CommonTypes "../types/common";
import TreasuryLib "../lib/treasury";

mixin (
  balances : Map.Map<Principal, Nat>,
  poolState : CommonTypes.PoolState,
  accessControlState : AccessControl.AccessControlState,
  selfPrincipal : Principal,
) {
  public query func getTreasuryBalance() : async Nat {
    TreasuryLib.balanceOf(balances, poolState, selfPrincipal);
  };

  public query func getTreasuryPrincipal() : async Principal {
    selfPrincipal;
  };

  public shared ({ caller }) func withdrawTreasury(amount : Nat, to : Principal) : async TreasuryTypes.TreasuryResult {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return #Err(#NotAdmin);
    };
    TreasuryLib.withdraw(balances, poolState, selfPrincipal, amount, to);
  };
};
