import Map "mo:core/Map";
import Principal "mo:core/Principal";
import TreasuryTypes "../types/treasury";
import CommonTypes "../types/common";

module {
  // Treasury withdrawals must be in multiples of 100 Lucky (100 * 10^8 e8s).
  public let WITHDRAW_STEP : Nat = 10_000_000_000;

  // The treasury's Lucky balance is the internal fee counter plus any Lucky
  // that arrived at the canister's own principal from external transfers.
  public func balanceOf(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    selfPrincipal : Principal,
  ) : Nat {
    poolState.treasuryLucky + (balances.get(selfPrincipal) ?? 0);
  };

  // Admin-only (enforced by the mixin). Sends `amount` Lucky to `to`, drawing
  // first from the internal fee counter and then from Lucky held at the
  // canister principal.
  public func withdraw(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    selfPrincipal : Principal,
    amount : Nat,
    to : Principal,
  ) : TreasuryTypes.TreasuryResult {
    if (amount == 0 or amount % WITHDRAW_STEP != 0) {
      return #Err(#InvalidAmount("Amount must be a positive multiple of 100 Lucky"));
    };
    let external = balances.get(selfPrincipal) ?? 0;
    let available = poolState.treasuryLucky + external;
    if (available < amount) {
      return #Err(#InsufficientTreasury({ available; required = amount }));
    };
    // Draw from the internal counter first, then from the canister principal.
    let fromCounter = if (poolState.treasuryLucky >= amount) { amount } else { poolState.treasuryLucky };
    let fromExternal = amount - fromCounter;
    poolState.treasuryLucky := poolState.treasuryLucky - fromCounter;
    if (fromExternal > 0) {
      balances.add(selfPrincipal, external - fromExternal);
    };
    let recipient = balances.get(to) ?? 0;
    balances.add(to, recipient + amount);
    #Ok(amount);
  };
};
