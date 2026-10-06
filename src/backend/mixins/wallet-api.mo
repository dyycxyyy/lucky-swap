import Map "mo:core/Map";
import Principal "mo:core/Principal";
import WalletTypes "../types/wallet";
import CommonTypes "../types/common";
import WalletLib "../lib/wallet";
import SwapLib "../lib/swap";

mixin (
  balances : Map.Map<Principal, Nat>,
  poolState : CommonTypes.PoolState,
  icpLedgerPrincipal : Principal,
) {
  public shared ({ caller }) func getWalletBalances() : async WalletTypes.WalletBalances {
    let icp = await SwapLib.safeIcpBalance(icpLedgerPrincipal, caller);
    { icp; lucky = balances.get(caller) ?? 0 };
  };

  public shared query ({ caller }) func getMyPrincipal() : async Principal {
    caller;
  };

  public shared ({ caller }) func sendIcp(to : Principal, amount : Nat) : async WalletTypes.SendResult {
    await WalletLib.sendIcp(icpLedgerPrincipal, caller, to, amount);
  };

  public shared ({ caller }) func sendLucky(to : Principal, amount : Nat) : async WalletTypes.SendResult {
    WalletLib.sendLucky(balances, poolState, caller, to, amount);
  };
};
