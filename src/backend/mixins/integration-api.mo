import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import IntegrationTypes "../types/integration";
import CommonTypes "../types/common";
import IntegrationLib "../lib/integration";

mixin (
  balances : Map.Map<Principal, Nat>,
  poolState : CommonTypes.PoolState,
  accessControlState : AccessControl.AccessControlState,
  integrationPrincipals : Map.Map<Principal, Bool>,
  prizePools : Map.Map<IntegrationTypes.PrizePoolId, Nat>,
  movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
  selfPrincipal : Principal,
) {
  // Monotonic per-call sequence for admin prize-pool top-ups, which carry no
  // caller-supplied event id. Transient: rebuilt on every (re)start, and the
  // timestamp in the generated id keeps ids unique across upgrades.
  transient let topUpCounter = { var value = 0 };

  // --- Integration identity management (admin only) ---

  public shared ({ caller }) func authorizeIntegrationPrincipal(principal : Principal) : async () {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return;
    };
    integrationPrincipals.add(principal, true);
  };

  public shared ({ caller }) func revokeIntegrationPrincipal(principal : Principal) : async () {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return;
    };
    integrationPrincipals.remove(principal);
  };

  public query func isIntegrationPrincipal(principal : Principal) : async Bool {
    integrationPrincipals.get(principal) ?? false;
  };

  // --- Treasury funding intake (trusted integration caller) ---

  public shared ({ caller }) func submitExcessSweep(
    amount : Nat,
    gameEventId : IntegrationTypes.GameEventId,
  ) : async IntegrationTypes.TreasuryIntakeResult {
    if (not isTrusted(caller)) {
      return #Err(#NotAuthorized);
    };
    IntegrationLib.intake(balances, poolState, movements, selfPrincipal, amount, gameEventId, #ExcessSweep);
  };

  public shared ({ caller }) func submitCrowdfunding(
    amount : Nat,
    gameEventId : IntegrationTypes.GameEventId,
  ) : async IntegrationTypes.TreasuryIntakeResult {
    if (not isTrusted(caller)) {
      return #Err(#NotAuthorized);
    };
    IntegrationLib.intake(balances, poolState, movements, selfPrincipal, amount, gameEventId, #Crowdfunding);
  };

  // --- Prize pool top-up (admin only) ---

  public shared ({ caller }) func topUpPrizePool(
    prizePoolId : IntegrationTypes.PrizePoolId,
    amount : Nat,
  ) : async IntegrationTypes.PrizePoolTopUpResult {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return #Err(#NotAdmin);
    };
    IntegrationLib.topUpPrizePool(balances, poolState, prizePools, movements, selfPrincipal, topUpCounter, prizePoolId, amount);
  };

  // --- Bet debit (trusted integration caller) ---

  public shared ({ caller }) func debitBet(
    user : Principal,
    amount : Nat,
    betId : IntegrationTypes.GameEventId,
  ) : async IntegrationTypes.WalletMovementResult {
    if (not isTrusted(caller)) {
      return #Err(#NotAuthorized);
    };
    IntegrationLib.debitBet(balances, poolState, prizePools, movements, user, amount, betId);
  };

  // --- Prize payout (trusted integration caller) ---

  public shared ({ caller }) func creditPrize(
    user : Principal,
    amount : Nat,
    payoutEventId : IntegrationTypes.GameEventId,
  ) : async IntegrationTypes.WalletMovementResult {
    if (not isTrusted(caller)) {
      return #Err(#NotAuthorized);
    };
    IntegrationLib.creditPrize(balances, movements, user, amount, payoutEventId);
  };

  // --- Queries ---

  public query func getPrizePoolBalance(prizePoolId : IntegrationTypes.PrizePoolId) : async Nat {
    prizePools.get(prizePoolId) ?? 0;
  };

  public query func listMovements() : async [IntegrationTypes.Movement] {
    movements.values().toArray();
  };

  public query func getMovement(gameEventId : IntegrationTypes.GameEventId) : async ?IntegrationTypes.Movement {
    movements.get(gameEventId);
  };

  // A trusted integration caller is a signed-in principal an admin authorized.
  func isTrusted(caller : Principal) : Bool {
    if (caller.isAnonymous()) {
      return false;
    };
    integrationPrincipals.get(caller) ?? false;
  };
};
