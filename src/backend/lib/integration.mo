import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import IntegrationTypes "../types/integration";
import CommonTypes "../types/common";
import LedgerLib "ledger";
import TreasuryLib "treasury";

module {
  // Bets are credited to this well-known prize pool unless the game names one.
  public let DEFAULT_PRIZE_POOL : IntegrationTypes.PrizePoolId = "default";

  // The treasury's Lucky balance, consistent with the rest of the app.
  public func treasuryBalance(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    selfPrincipal : Principal,
  ) : Nat {
    TreasuryLib.balanceOf(balances, poolState, selfPrincipal);
  };

  // Record a movement and return it. Callers must have checked idempotency.
  public func record(
    movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
    gameEventId : IntegrationTypes.GameEventId,
    source : IntegrationTypes.MovementSource,
    direction : IntegrationTypes.MovementDirection,
    amount : Nat,
    counterparty : Principal,
  ) : IntegrationTypes.Movement {
    let movement : IntegrationTypes.Movement = {
      gameEventId;
      source;
      direction;
      amount;
      counterparty;
      timestamp = Int.abs(Time.now());
    };
    movements.add(gameEventId, movement);
    movement;
  };

  // Credit the treasury by `amount` (internal fee counter) and record the
  // movement. Used by excess sweep and crowdfunding intake.
  public func intake(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
    selfPrincipal : Principal,
    amount : Nat,
    gameEventId : IntegrationTypes.GameEventId,
    source : IntegrationTypes.MovementSource,
  ) : IntegrationTypes.TreasuryIntakeResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    switch (movements.get(gameEventId)) {
      case (?_) {
        return #Ok({ treasuryBalance = treasuryBalance(balances, poolState, selfPrincipal) });
      };
      case null {};
    };
    poolState.treasuryLucky := poolState.treasuryLucky + amount;
    ignore record(movements, gameEventId, source, #In, amount, selfPrincipal);
    #Ok({ treasuryBalance = treasuryBalance(balances, poolState, selfPrincipal) });
  };

  // Move `amount` from the treasury into a game prize pool.
  public func topUpPrizePool(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    prizePools : Map.Map<IntegrationTypes.PrizePoolId, Nat>,
    movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
    selfPrincipal : Principal,
    topUpCounter : { var value : Nat },
    prizePoolId : IntegrationTypes.PrizePoolId,
    amount : Nat,
  ) : IntegrationTypes.PrizePoolTopUpResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let available = treasuryBalance(balances, poolState, selfPrincipal);
    if (available < amount) {
      return #Err(#InsufficientTreasury({ available; required = amount }));
    };
    // Draw from the internal counter first, then from Lucky held at the
    // canister principal, mirroring TreasuryLib.withdraw.
    let external = balances.get(selfPrincipal) ?? 0;
    let fromCounter = if (poolState.treasuryLucky >= amount) { amount } else { poolState.treasuryLucky };
    let fromExternal = amount - fromCounter;
    poolState.treasuryLucky := poolState.treasuryLucky - fromCounter;
    if (fromExternal > 0) {
      balances.add(selfPrincipal, external - fromExternal);
    };
    let poolBalance = (prizePools.get(prizePoolId) ?? 0) + amount;
    prizePools.add(prizePoolId, poolBalance);
    // topUpPrizePool carries no game event id, so it is not keyed for
    // idempotency; each admin call is a distinct movement. The movement id must
    // be unique per call so two top-ups of the same amount to the same pool
    // never overwrite each other in the ledger. A monotonic per-call counter
    // combined with the pool id and the call timestamp guarantees uniqueness.
    let seq = topUpCounter.value;
    topUpCounter.value := seq + 1;
    let eventId = "topup:" # prizePoolId # ":" # seq.toText() # ":" # Int.abs(Time.now()).toText();
    ignore record(movements, eventId, #PrizePoolTopUp, #Out, amount, selfPrincipal);
    #Ok({
      treasuryBalance = treasuryBalance(balances, poolState, selfPrincipal);
      poolBalance;
    });
  };

  // Debit a user's Lucky wallet for a bet and credit the game prize pool.
  public func debitBet(
    balances : Map.Map<Principal, Nat>,
    poolState : CommonTypes.PoolState,
    prizePools : Map.Map<IntegrationTypes.PrizePoolId, Nat>,
    movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
    user : Principal,
    amount : Nat,
    betId : IntegrationTypes.GameEventId,
  ) : IntegrationTypes.WalletMovementResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    switch (movements.get(betId)) {
      case (?_) {
        return #Ok({ walletBalance = balances.get(user) ?? 0 });
      };
      case null {};
    };
    let available = balances.get(user) ?? 0;
    if (available < amount) {
      return #Err(#InsufficientFunds({ available; required = amount }));
    };
    LedgerLib.debit(balances, user, amount);
    let poolBalance = (prizePools.get(DEFAULT_PRIZE_POOL) ?? 0) + amount;
    prizePools.add(DEFAULT_PRIZE_POOL, poolBalance);
    ignore record(movements, betId, #BetDebit, #Out, amount, user);
    #Ok({ walletBalance = balances.get(user) ?? 0 });
  };

  // Credit a prize payout into a user's Lucky wallet.
  public func creditPrize(
    balances : Map.Map<Principal, Nat>,
    movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>,
    user : Principal,
    amount : Nat,
    payoutEventId : IntegrationTypes.GameEventId,
  ) : IntegrationTypes.WalletMovementResult {
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    switch (movements.get(payoutEventId)) {
      case (?_) {
        return #Ok({ walletBalance = balances.get(user) ?? 0 });
      };
      case null {};
    };
    LedgerLib.credit(balances, user, amount);
    ignore record(movements, payoutEventId, #PrizePayout, #In, amount, user);
    #Ok({ walletBalance = balances.get(user) ?? 0 });
  };
};
