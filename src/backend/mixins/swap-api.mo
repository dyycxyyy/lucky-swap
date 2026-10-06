import Map "mo:core/Map";
import Principal "mo:core/Principal";
import SwapTypes "../types/swap";
import CommonTypes "../types/common";
import SwapLib "../lib/swap";

mixin (
  balances : Map.Map<Principal, Nat>,
  poolState : CommonTypes.PoolState,
  icpLedgerPrincipal : Principal,
  selfPrincipal : Principal,
) {
  public shared func getPoolBalances() : async SwapTypes.PoolBalances {
    let icp = await SwapLib.safeIcpBalance(icpLedgerPrincipal, selfPrincipal);
    { lucky = poolState.poolLucky; icp };
  };

  public query func getSwapQuote(direction : SwapTypes.SwapDirection, amount : Nat) : async SwapTypes.SwapQuote {
    SwapLib.quote(direction, amount);
  };

  public shared ({ caller }) func swapIcpToLucky(icpAmount : Nat) : async SwapTypes.SwapResult {
    await SwapLib.swapIcpToLucky(balances, poolState, icpLedgerPrincipal, selfPrincipal, caller, icpAmount);
  };

  public shared ({ caller }) func swapLuckyToIcp(luckyAmount : Nat) : async SwapTypes.SwapResult {
    await SwapLib.swapLuckyToIcp(balances, poolState, icpLedgerPrincipal, selfPrincipal, caller, luckyAmount);
  };
};
