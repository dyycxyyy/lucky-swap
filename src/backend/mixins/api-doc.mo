mixin () {
  public query func getApiDoc() : async Text {
    "# Lucky Backend API

Lucky is an ICRC-1/ICRC-2 token with a built-in fixed-rate swap pool and a
treasury. This document describes the public canister API.

## Token

- Name: `Lucky`
- Symbol: `Lucky`
- Decimals: `8` (all amounts are in e8s; `1 Lucky = 100_000_000` e8s)
- Logo: a `data:image/svg+xml` data URI of the gold-outline four-leaf clover
  (transparent background, `fill='none'`, gold stroke)
- Transfer fee: `0.001 Lucky` = `100_000` e8s
- Supply: unlimited (admin minting only)

## Authentication and identity

- The frontend signs users in with Internet Identity. The app pins an Internet
  Identity derivation origin, published at `/.well-known/ii-derivation-origin`
  when available. An agent already holding the user's Internet Identity
  authorization derives the correct per-app principal against that origin (for
  example `icp identity link web <name> --app <host>`). Such a delegation acts
  with the user's full authority in this app until it expires.
- The first caller to initialize access control becomes the admin; subsequent
  callers become regular users. Registration happens only when a caller signs in
  through the app's own frontend, so a principal that never did so is
  unregistered even when it belongs to the app's owner, and a signed-in caller
  derived against a different origin is a different principal than the one the
  frontend registered.
- Admin-only methods: `mintToPool`, `mintTo`, `burnFrom`, `withdrawTreasury`,
  `topUpPrizePool`, `authorizeIntegrationPrincipal`,
  `revokeIntegrationPrincipal`. An anonymous or non-admin caller receives
  `#Err(#NotAdmin)` (the two identity-management methods return `()` and
  silently do nothing for a non-admin).
- Integration methods `submitExcessSweep`, `submitCrowdfunding`, `debitBet`, and
  `creditPrize` require a signed-in caller that an admin has authorized as an
  integration principal. An anonymous or unauthorized caller receives
  `#Err(#NotAuthorized)` and no balance changes.
- All other methods are callable by any principal, including anonymous callers,
  unless noted.

## Units and encoding

- All token amounts are `Nat` in e8s (8 decimals).
- `Principal` values are standard IC principals.
- `Account` is `{ owner : Principal; subaccount : ?Blob }`.
- `created_at_time` / `expires_at` are `?Nat64` nanoseconds since the epoch.
- The ICP ledger is the mainnet ledger `ryjl3-tyaaa-aaaaa-aaaba-cai`.

## Ledger methods (ICRC-1 / ICRC-2)

- `icrc1_name() : Text` — returns `Lucky`.
- `icrc1_symbol() : Text` — returns `Lucky`.
- `icrc1_decimals() : Nat8` — returns `8`.
- `icrc1_fee() : Nat` — returns `100_000` e8s (0.001 Lucky).
- `icrc1_total_supply() : Nat` — current Lucky total supply in e8s.
- `icrc1_metadata() : [(Text, MetadataValue)]` — name, symbol, decimals, fee,
  and logo (a `data:image/svg+xml` data URI of the gold-outline four-leaf
  clover).
- `icrc1_balance_of(account) : Nat` — Lucky balance of an account in e8s.
- `icrc1_transfer(args) : TransferResult` — transfer Lucky from the caller. The
  sender pays `amount + fee`; the fee is credited to the treasury (total supply
  is unchanged). Returns `#Ok(0)` (no meaningful block index) or
  `#Err(TransferError)`.
- `icrc1_supported_standards() : [SupportedStandard]` — ICRC-1 and ICRC-2.
- `icrc2_approve(args) : ApproveResult` — set an allowance for a spender. No fee
  is charged; `args.fee`, when supplied, must equal `100_000` or the call fails
  with `#BadFee`. Returns `#Ok(0)`.
- `icrc2_allowance(args) : Allowance` — read the current allowance. Allowances
  never expire, so `expires_at` is always `null`.
- `icrc2_transfer_from(args) : TransferFromResult` — spend an allowance to
  transfer Lucky from another account. The spender pays the fee on top of the
  amount; the fee is credited to the treasury. Returns `#Ok(0)`.
- `mintToPool(amount : Nat) : MintResult` — **admin only**. Mints `amount` new
  Lucky directly into the swap pool (never to a user) and increases total
  supply. Returns `#Ok(newTotalSupply)` or `#Err(#NotAdmin | #InvalidAmount)`.
- `mintTo(to : Principal, amount : Nat) : MintResult` — **admin only**. Mints
  `amount` new Lucky directly into the balance of the arbitrary principal `to`
  and increases total supply by the same amount. `amount` is in e8s and must be
  greater than zero. Returns `#Ok(newTotalSupply)` or
  `#Err(#NotAdmin | #InvalidAmount)`. This is not idempotent: a retried call
  mints again.
- `burnFrom(from : Principal, amount : Nat) : BurnResult` — **admin only**.
  Burns `amount` Lucky from the balance of the arbitrary principal `from` and
  decreases total supply by the same amount. `amount` is in e8s and must be
  greater than zero. Rejected with `#Err(#InsufficientBalance({ balance }))`
  when `from` holds less than `amount`. Returns `#Ok(newTotalSupply)` or
  `#Err(#NotAdmin | #InvalidAmount | #InsufficientBalance)`. This is not
  idempotent: a retried call burns again.

## Swap pool

Fixed rate: `1 ICP = 1000 Lucky` in both directions. The pool's Lucky balance is
tracked in canister state; its ICP balance is the canister's own ICP ledger
account.

- `getPoolBalances() : PoolBalances` — update call returning
  `{ lucky : Nat; icp : Nat }` in e8s. The ICP value is read live from the ICP
  ledger; if the ledger is unreachable the ICP value degrades to `0` instead of
  trapping.
- `getSwapQuote(direction, amount) : SwapQuote` — pure quote. `direction` is
  `#IcpToLucky` or `#LuckyToIcp`; `amount` is in e8s of the input token.
  Returns `{ direction; inputAmount; outputAmount; feeLucky }`.
- `swapIcpToLucky(icpAmount : Nat) : SwapResult` — swap ICP for Lucky.
  - Minimum `0.1 ICP` (`10_000_000` e8s).
  - Must be a positive multiple of `0.1 ICP`.
  - Maximum `10,000 ICP` (`1_000_000_000_000` e8s) per swap.
  - No fee. The user receives `icpAmount * 1000` Lucky.
  - The caller must have approved this canister as an ICP spender (ICRC-2); the
    canister pulls the ICP into its own account.
  - Blocked with `#InsufficientPoolLucky` when the pool lacks Lucky.
- `swapLuckyToIcp(luckyAmount : Nat) : SwapResult` — swap Lucky for ICP.
  - Must be a positive multiple of `1000 Lucky` (`100_000_000_000` e8s).
  - Maximum `10,000,000 Lucky` (`1_000_000_000_000_000` e8s) per swap.
  - A `3%` fee is charged in Lucky and credited to the treasury; the user
    receives `97%` of the ICP value.
  - Blocked with `#InsufficientUserLucky` when the caller lacks Lucky, or
    `#InsufficientPoolIcp` when the pool lacks ICP.
- `SwapResult` is `#Ok(SwapReceipt)` or `#Err(SwapError)`. `SwapReceipt` is
  `{ direction; inputAmount; outputAmount; feeLucky }`.

## Treasury

The treasury holds the 3% Lucky swap fee and all Lucky transfer fees. Its
balance is the internal fee counter plus any Lucky sent to the canister's own
principal from external transfers.

- `getTreasuryBalance() : Nat` — treasury Lucky balance in e8s.
- `getTreasuryPrincipal() : Principal` — the canister's principal, which is the
  real address that can receive external Lucky transfers and send Lucky out.
- `withdrawTreasury(amount : Nat, to : Principal) : TreasuryResult` —
  **admin only**. Sends `amount` Lucky to `to`. `amount` must be a positive
  multiple of `100 Lucky` (`10_000_000_000` e8s). Draws first from the internal
  fee counter, then from Lucky held at the canister principal. Returns
  `#Ok(amount)` or `#Err(#NotAdmin | #InvalidAmount | #InsufficientTreasury)`.

## Wallet

- `getWalletBalances() : WalletBalances` — update call returning
  `{ icp : Nat; lucky : Nat }` in e8s for the caller. The ICP value is read live
  from the ICP ledger; if the ledger is unreachable the ICP value degrades to
  `0` instead of trapping.
- `getMyPrincipal() : Principal` — the caller's principal, the address that can
  receive external transfers.
- `sendIcp(to : Principal, amount : Nat) : SendResult` — send ICP from the
  caller to an external principal. The caller must have approved this canister
  as an ICP spender (ICRC-2). Returns `#Ok(blockIndex)` or `#Err(SendError)`.
- `sendLucky(to : Principal, amount : Nat) : SendResult` — send Lucky from the
  caller's internal balance to an external principal. The sender pays
  `amount + 0.001 Lucky`; the fee is credited to the treasury. Returns `#Ok(0)`
  or `#Err(SendError)`.

## Game integration

The external game never reads or writes balances directly. Every fund movement
between the game and this app goes through the integration surface below, which
records a queryable movement for each operation. Integration callers are trusted
principals an admin authorizes; unauthorized calls are rejected.

- `authorizeIntegrationPrincipal(principal : Principal) : ()` — **admin only**.
  Grants `principal` the trusted integration role.
- `revokeIntegrationPrincipal(principal : Principal) : ()` — **admin only**.
  Revokes the trusted integration role.
- `isIntegrationPrincipal(principal : Principal) : Bool` — whether `principal`
  is a trusted integration caller.
- `submitExcessSweep(amount : Nat, gameEventId : Text) : TreasuryIntakeResult` —
  trusted integration caller. Credits `amount` e8s of game excess sweep into the
  treasury. `amount` must be greater than zero. Idempotent on `gameEventId`.
- `submitCrowdfunding(amount : Nat, gameEventId : Text) : TreasuryIntakeResult` —
  trusted integration caller. Credits `amount` e8s of crowdfunding proceeds into
  the treasury. `amount` must be greater than zero. Idempotent on `gameEventId`.
- `topUpPrizePool(prizePoolId : Text, amount : Nat) : PrizePoolTopUpResult` —
  **admin only**. Moves `amount` e8s from the treasury into the named game prize
  pool. Rejected with `#InsufficientTreasury` when the treasury lacks funds.
  Not keyed for idempotency: each call is a distinct movement.
- `debitBet(user : Principal, amount : Nat, betId : Text) : WalletMovementResult`
  — trusted integration caller. Debits `amount` e8s from `user`'s Lucky wallet
  and credits the default game prize pool. Rejected with `#InsufficientFunds`
  when the wallet lacks funds. Idempotent on `betId`.
- `creditPrize(user : Principal, amount : Nat, payoutEventId : Text) : WalletMovementResult`
  — trusted integration caller. Credits `amount` e8s of prize payout into
  `user`'s Lucky wallet. Idempotent on `payoutEventId`.
- `getPrizePoolBalance(prizePoolId : Text) : Nat` — recorded prize pool balance
  in e8s (`0` when unknown).
- `listMovements() : [Movement]` — all recorded integration movements.
- `getMovement(gameEventId : Text) : ?Movement` — the movement for an id, or
  `null`.

`Movement` is `{ gameEventId; source; direction; amount; counterparty;
timestamp }`. `source` is `#ExcessSweep | #Crowdfunding | #PrizePoolTopUp |
#BetDebit | #PrizePayout`; `direction` is `#In` (funds enter the app) or `#Out`
(funds leave the app); `amount` is in e8s; `counterparty` is the user wallet
principal, or the canister principal for treasury/pool operations; `timestamp`
is nanoseconds since the epoch.

`IntegrationError` is `#NotAuthorized | #NotAdmin | #InvalidAmount(Text) |
#InsufficientFunds({ available; required }) | #InsufficientTreasury({ available;
required }) | #UnknownPrizePool(Text) | #TransferFailed(Text)`.

## Data queries (OQL)

The canister exposes its persisted, queryable state through the Object Query
Layer. Both methods are `query` calls and are authorized per table:

- `schema() : Text` — JSON description of the queryable entities and their
  fields.
- `execute(query : Text) : Text` — run a JSON query against those entities and
  return JSON rows.

Queryable entities (all `controllerOnly`, i.e. readable by the platform
controller / Data Intelligence agent, not by end users):

- `balance` — one row per Lucky holder: `owner` (Principal), `amount` (e8s).
- `allowance` — one row per ICRC-2 allowance: `owner`, `spender` (Principals),
  `amount` (e8s).
- `poolState` — a single row (id `pool`) with `totalSupply`, `poolLucky`,
  and `treasuryLucky` (all e8s).
- `movement` — one row per recorded integration fund movement: `gameEventId`
  (Text), `source` (Text: `ExcessSweep`, `Crowdfunding`, `PrizePoolTopUp`,
  `BetDebit`, or `PrizePayout`), `direction` (Text: `In` or `Out`), `amount`
  (e8s), `counterparty` (Principal), and `timestamp` (nanoseconds since the
  epoch).
- `prizePool` — one row per game prize pool: `prizePoolId` (Text) and `balance`
  (e8s).

## Lifecycle, polling, and retry safety

- `getPoolBalances` and `getWalletBalances` are **update calls** (they await the
  ICP ledger, which a plain query cannot do). They are safe to call repeatedly
  and never trap on an unreachable ledger — the ICP value degrades to `0`. Poll
  them to keep displayed balances fresh.
- Swap and send methods are update calls. They are **not idempotent**: a retried
  call performs the operation again. Do not automatically retry a swap or send
  after a timeout; re-read balances first.
- Integration methods `submitExcessSweep`, `submitCrowdfunding`, `debitBet`, and
  `creditPrize` are **idempotent** on their game event id: replaying the same id
  returns the recorded outcome without moving funds again. `topUpPrizePool` is
  not keyed for idempotency.
- `swapLuckyToIcp` reserves the user's Lucky and the pool's Lucky before the ICP
  outcall and rolls back on failure, so a failed swap leaves balances unchanged.
- `swapIcpToLucky` reserves the pool's Lucky before pulling ICP and rolls back
  on failure.

## Errors and gotchas

- The pool and treasury are virtual accounts tracked in canister state, not
  entries in the balances map. `mintToPool` credits the pool directly.
- Lucky held at the canister's own principal is counted toward the treasury
  balance, so external Lucky transfers to the canister increase the treasury.
- `icrc1_transfer`, `icrc2_transfer_from`, and `sendLucky` credit their fee to
  the treasury; total supply is unchanged by transfer fees.
- The ICP ledger is mainnet `ryjl3-tyaaa-aaaaa-aaaba-cai`; ICP swaps and sends
  require an ICRC-2 approval to this canister first.
- Amounts are always e8s. A UI showing `1.5 Lucky` must send `150_000_000`.
";
  };
};
