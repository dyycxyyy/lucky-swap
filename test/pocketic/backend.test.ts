/**
 * PocketIC backend lane: drives the app's real compiled canister.
 *
 * The frontend suite mocks the actor, so it passes unchanged against a backend
 * whose public methods are all `Debug.todo()` stubs. This file installs the
 * real `src/backend/dist/backend.wasm` into the platform's PocketIC replica and
 * calls the public API, which is the only coverage that can catch a stubbed or
 * trapping backend.
 *
 * Scope note: the canister reads the *mainnet* ICP ledger
 * (`ryjl3-tyaaa-aaaaa-aaaba-cai`) for `getPoolBalances`, `getWalletBalances`,
 * `swapIcpToLucky`, `swapLuckyToIcp`, and `sendIcp`. A local PocketIC replica
 * has no such ledger, so those methods are deliberately not called here; the
 * methods exercised below are the ones whose behavior is fully local to the
 * canister (token metadata, admin minting, treasury, Lucky transfers, and the
 * pure swap quote/validation paths).
 *
 * Imports are limited to `@dfinity/pic`, `vitest`, and the app's generated
 * declarations, because a lane file resolves bare specifiers from
 * `app/test/pocketic/` upward and only those are guaranteed reachable.
 */

import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
// Set only on a converted project: the last pre-EM revision, whose schema this
// app's migration chain replays from. Installing the current wasm onto an empty
// canister there traps IC0503 before any test runs.
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const E8S = 100_000_000n;
const LUCKY_FEE = 100_000n; // 0.001 Lucky
const WITHDRAW_STEP = 100n * E8S; // 100 Lucky

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

const admin = createIdentity("lucky-admin");
const alice = createIdentity("lucky-alice");
const bob = createIdentity("lucky-bob");

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  if (BASELINE_WASM === undefined) {
    ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
      idlFactory,
      wasm: BACKEND_WASM,
      sender: admin.getPrincipal(),
    }));
  } else {
    // `[baseline, current]`, the same install contract the hosted deploy uses
    // for a converted project. The upgrade replays the chain from the legacy
    // schema.
    const installed = await pic.setupCanister<_SERVICE>({
      idlFactory,
      wasm: BASELINE_WASM,
      sender: admin.getPrincipal(),
    });
    await pic.upgradeCanister({
      canisterId: installed.canisterId,
      wasm: BACKEND_WASM,
      arg: new Uint8Array(),
    });
    ({ actor, canisterId } = installed);
  }

  // Mirror the real sign-in flow: the platform calls `_initialize_access_control`
  // after a successful Internet Identity login, which registers the first caller
  // as admin. Without it, `AccessControl.isAdmin` traps "User is not registered"
  // for every caller, so the admin/role methods below cannot be exercised.
  actor.setIdentity(admin);
  await actor._initialize_access_control();
  // Register the other callers as ordinary users so non-admin paths return a
  // typed `NotAdmin` error instead of trapping.
  await actor.assignCallerUserRole(alice.getPrincipal(), { user: null });
  await actor.assignCallerUserRole(bob.getPrincipal(), { user: null });
});

afterAll(async () => {
  // `?.` because `beforeAll` may not have got that far. A failed
  // `PocketIc.create` otherwise stacks "Cannot read properties of undefined"
  // on top of the real error and buries the one line that explains the run.
  await pic?.tearDown();
});

it("exposes the Lucky ICRC-1 token metadata", async () => {
  await expect(actor.icrc1_name()).resolves.toBe("Lucky");
  await expect(actor.icrc1_symbol()).resolves.toBe("Lucky");
  await expect(actor.icrc1_decimals()).resolves.toBe(8);
  await expect(actor.icrc1_fee()).resolves.toBe(LUCKY_FEE);

  const metadata = await actor.icrc1_metadata();
  const byName = new Map(metadata.map(([key, value]) => [key, value]));
  expect(byName.get("icrc1:name")).toEqual({ Text: "Lucky" });
  expect(byName.get("icrc1:symbol")).toEqual({ Text: "Lucky" });
  expect(byName.get("icrc1:decimals")).toEqual({ Nat: 8n });
  expect(byName.get("icrc1:fee")).toEqual({ Nat: LUCKY_FEE });
  // The accepted change replaces the emoji logo with a transparent-background,
  // gold-outline four-leaf clover so external wallets and block explorers render
  // the brand mark. Pin the observable shape: a data-URI SVG whose drawing group
  // is unfilled and stroked in gold, and which is no longer the emoji.
  const logo = byName.get("icrc1:logo");
  expect(logo).toMatchObject({ Text: expect.any(String) });
  const logoText = (logo as { Text: string }).Text;
  expect(logoText).not.toContain("🍀");
  expect(logoText).toMatch(/^data:image\/svg\+xml/);
  expect(logoText).toContain("<svg");
  // Transparent background: the drawing group is explicitly unfilled.
  expect(logoText).toMatch(/fill=['"]none['"]/);
  // Gold outline: the stroke is the brand gold, URL-encoded in the data URI.
  expect(logoText).toMatch(/stroke=['"](?:%23D4AF37|#D4AF37)['"]/i);

  // The on-chain mark is the same re-traced clover as the app: four
  // heart-shaped leaves, each a closed subpath starting at the center (32, 32),
  // and no stem. A stem would show up as a fifth subpath or an `M` that does
  // not start at the center.
  const logoPath = /d='([^']+)'/.exec(logoText)?.[1];
  expect(logoPath).toBeDefined();
  const leaves = (logoPath ?? "")
    .split("Z")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  expect(leaves).toHaveLength(4);
  for (const leaf of leaves) {
    expect(leaf.startsWith("M32 32")).toBe(true);
  }
  expect((logoPath ?? "").match(/M/g) ?? []).toHaveLength(4);
  expect((logoPath ?? "").match(/Z/g) ?? []).toHaveLength(4);

  const standards = await actor.icrc1_supported_standards();
  expect(standards.map((s) => s.name)).toEqual(["ICRC-1", "ICRC-2"]);
});

it("describes the SVG clover logo in the API doc", async () => {
  const doc = await actor.getApiDoc();
  // The doc must describe the logo as the SVG clover rather than the old emoji.
  expect(doc).toContain("data:image/svg+xml");
  expect(doc).toMatch(/gold-outline four-leaf clover/i);
  expect(doc).not.toContain("🍀");
});

it("starts with an empty pool and treasury", async () => {
  await expect(actor.getTreasuryBalance()).resolves.toBe(0n);
  await expect(actor.icrc1_total_supply()).resolves.toBe(0n);
  await expect(actor.getSwapQuote({ IcpToLucky: null }, 1n * E8S)).resolves.toEqual({
    direction: { IcpToLucky: null },
    inputAmount: 1n * E8S,
    outputAmount: 1000n * E8S,
    feeLucky: 0n,
  });
});

it("quotes the fixed 1 ICP = 1000 Lucky rate in both directions", async () => {
  const icpToLucky = await actor.getSwapQuote({ IcpToLucky: null }, 1n * E8S);
  expect(icpToLucky.outputAmount).toBe(1000n * E8S);
  expect(icpToLucky.feeLucky).toBe(0n);

  // 1000 Lucky -> 3% fee (30 Lucky) -> 970 Lucky net -> 0.97 ICP.
  const luckyToIcp = await actor.getSwapQuote({ LuckyToIcp: null }, 1000n * E8S);
  expect(luckyToIcp.feeLucky).toBe(30n * E8S);
  expect(luckyToIcp.outputAmount).toBe(97n * E8S / 100n);
});

it("rejects ICP -> Lucky amounts that are not a positive multiple of 0.1 ICP", async () => {
  actor.setIdentity(alice);
  // 0.11 ICP is not a multiple of 0.1 ICP.
  const notMultiple = await actor.swapIcpToLucky(11n * E8S / 100n);
  expect(notMultiple).toEqual({
    Err: { InvalidAmount: "Amount must be a multiple of 0.1 ICP" },
  });

  // 0.05 ICP is below the 0.1 ICP minimum.
  const belowMin = await actor.swapIcpToLucky(5n * E8S / 100n);
  expect(belowMin).toEqual({
    Err: { InvalidAmount: "Minimum swap is 0.1 ICP" },
  });
});

it("rejects Lucky -> ICP amounts that are not a positive multiple of 1000 Lucky", async () => {
  actor.setIdentity(alice);
  const notMultiple = await actor.swapLuckyToIcp(1500n * E8S);
  expect(notMultiple).toEqual({
    Err: { InvalidAmount: "Amount must be a positive multiple of 1000 Lucky" },
  });
});

it("blocks a Lucky -> ICP swap when the caller lacks Lucky", async () => {
  actor.setIdentity(alice);
  const result = await actor.swapLuckyToIcp(1000n * E8S);
  expect(result).toEqual({
    Err: { InsufficientUserLucky: { available: 0n, required: 1000n * E8S } },
  });
});

it("lets only the admin mint, and credits the pool rather than a user", async () => {
  // A non-admin caller is rejected.
  actor.setIdentity(alice);
  await expect(actor.mintToPool(1000n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });

  // The admin mints into the pool.
  actor.setIdentity(admin);
  await expect(actor.mintToPool(1000n * E8S)).resolves.toEqual({
    Ok: 1000n * E8S,
  });
  // The minted amount is reflected in total supply. `getPoolBalances` is a
  // composite query that reads the mainnet ICP ledger, which does not exist on
  // a local replica, so the pool's Lucky balance is not directly observable
  // here; supply plus the zero user balance below is the local evidence that
  // minting credited the pool and not a user.
  await expect(actor.icrc1_total_supply()).resolves.toBe(1000n * E8S);
  await expect(
    actor.icrc1_balance_of({ owner: alice.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(0n);
});

it("rejects a zero mint amount", async () => {
  actor.setIdentity(admin);
  await expect(actor.mintToPool(0n)).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
});

it("rejects a zero-amount Lucky send", async () => {
  actor.setIdentity(alice);
  await expect(actor.sendLucky(bob.getPrincipal(), 0n)).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
});

it("blocks a Lucky send when the caller lacks funds, including the 0.001 Lucky fee", async () => {
  // No user can be funded on a local replica: `mintToPool` credits the pool's
  // virtual balance, not a user's, and the only path that credits a user
  // (`swapIcpToLucky`) needs the mainnet ICP ledger. So the happy-path transfer
  // is not locally exercisable; the sufficiency check is, and it proves the fee
  // is added to the required amount.
  actor.setIdentity(bob);
  const result = await actor.sendLucky(alice.getPrincipal(), 1_000_000n * E8S);
  expect(result).toEqual({
    Err: {
      InsufficientFunds: {
        available: 0n,
        required: 1_000_000n * E8S + LUCKY_FEE,
      },
    },
  });
});

it("leaves the treasury unchanged when a Lucky -> ICP swap is rejected for insufficient user funds", async () => {
  // The 3% fee is only credited once a swap passes its user-balance check. No
  // user can be funded on a local replica (see the send test above), so the
  // swap is rejected before any treasury mutation; this guards that ordering.
  actor.setIdentity(admin);
  await actor.mintToPool(10_000n * E8S);

  const treasuryBefore = await actor.getTreasuryBalance();

  actor.setIdentity(alice);
  await expect(actor.swapLuckyToIcp(1000n * E8S)).resolves.toEqual({
    Err: { InsufficientUserLucky: { available: 0n, required: 1000n * E8S } },
  });

  await expect(actor.getTreasuryBalance()).resolves.toBe(treasuryBefore);
});

it("lets only the admin withdraw from the treasury, in multiples of 100 Lucky", async () => {
  // Non-admin is rejected before any amount validation.
  actor.setIdentity(alice);
  await expect(
    actor.withdrawTreasury(WITHDRAW_STEP, bob.getPrincipal()),
  ).resolves.toEqual({ Err: { NotAdmin: null } });

  actor.setIdentity(admin);
  // Not a multiple of 100 Lucky.
  await expect(
    actor.withdrawTreasury(150n * E8S, bob.getPrincipal()),
  ).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be a positive multiple of 100 Lucky" },
  });

  // Zero is rejected.
  await expect(
    actor.withdrawTreasury(0n, bob.getPrincipal()),
  ).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be a positive multiple of 100 Lucky" },
  });
});

it("reports the caller's principal and admin status per caller", async () => {
  actor.setIdentity(admin);
  await expect(actor.isCallerAdmin()).resolves.toBe(true);
  await expect(actor.getMyPrincipal()).resolves.toEqual(admin.getPrincipal());

  actor.setIdentity(alice);
  await expect(actor.isCallerAdmin()).resolves.toBe(false);
  await expect(actor.getMyPrincipal()).resolves.toEqual(alice.getPrincipal());
});

it("lets only the admin mint to an arbitrary principal, increasing balance and supply", async () => {
  // A non-admin caller is rejected and no balance is credited.
  actor.setIdentity(alice);
  await expect(actor.mintTo(bob.getPrincipal(), 250n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });
  await expect(
    actor.icrc1_balance_of({ owner: bob.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(0n);

  // The admin mints to bob; bob's balance and the total supply both increase.
  actor.setIdentity(admin);
  const supplyBefore = await actor.icrc1_total_supply();
  await expect(actor.mintTo(bob.getPrincipal(), 250n * E8S)).resolves.toEqual({
    Ok: supplyBefore + 250n * E8S,
  });
  await expect(
    actor.icrc1_balance_of({ owner: bob.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(250n * E8S);
  await expect(actor.icrc1_total_supply()).resolves.toBe(
    supplyBefore + 250n * E8S,
  );
});

it("rejects a zero mint-to-address amount", async () => {
  actor.setIdentity(admin);
  await expect(actor.mintTo(bob.getPrincipal(), 0n)).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
});

it("lets only the admin burn from an arbitrary principal, decreasing balance and supply", async () => {
  // Fund bob through the real mint path so the burn has a balance to draw on.
  // The lane shares one canister across tests, so read the balance rather than
  // assuming a starting value.
  actor.setIdentity(admin);
  await actor.mintTo(bob.getPrincipal(), 300n * E8S);
  const balanceBefore = await actor.icrc1_balance_of({
    owner: bob.getPrincipal(),
    subaccount: [],
  });
  const supplyBefore = await actor.icrc1_total_supply();

  // A non-admin caller is rejected and the balance is untouched.
  actor.setIdentity(alice);
  await expect(actor.burnFrom(bob.getPrincipal(), 100n * E8S)).resolves.toEqual(
    { Err: { NotAdmin: null } },
  );
  await expect(
    actor.icrc1_balance_of({ owner: bob.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(balanceBefore);

  // The admin burns; bob's balance and the total supply both decrease.
  actor.setIdentity(admin);
  await expect(actor.burnFrom(bob.getPrincipal(), 100n * E8S)).resolves.toEqual(
    { Ok: supplyBefore - 100n * E8S },
  );
  await expect(
    actor.icrc1_balance_of({ owner: bob.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(balanceBefore - 100n * E8S);
  await expect(actor.icrc1_total_supply()).resolves.toBe(
    supplyBefore - 100n * E8S,
  );
});

it("rejects burning more than the source balance with the available balance", async () => {
  actor.setIdentity(admin);
  // bob holds 200 Lucky at this point (funded by the burn test above). Burning
  // more than that is rejected with the source's current balance.
  const balance = await actor.icrc1_balance_of({
    owner: bob.getPrincipal(),
    subaccount: [],
  });
  await expect(
    actor.burnFrom(bob.getPrincipal(), balance + 1n),
  ).resolves.toEqual({
    Err: { InsufficientBalance: { balance } },
  });
  // The failed burn left the balance and supply unchanged.
  await expect(
    actor.icrc1_balance_of({ owner: bob.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(balance);
});

it("rejects a zero burn amount", async () => {
  actor.setIdentity(admin);
  await expect(actor.burnFrom(bob.getPrincipal(), 0n)).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
});

it("rejects an anonymous caller from admin-only methods", async () => {
  // A freshly created actor calls as the anonymous principal until an identity
  // is set. `pic` is optional only so `afterAll` can tear down a partial setup.
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  await expect(guest.mintToPool(1n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });
  await expect(
    guest.withdrawTreasury(WITHDRAW_STEP, bob.getPrincipal()),
  ).resolves.toEqual({ Err: { NotAdmin: null } });
  await expect(guest.mintTo(bob.getPrincipal(), 1n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });
  await expect(guest.burnFrom(bob.getPrincipal(), 1n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });
});

// --- Game integration surface ---------------------------------------------
//
// The game never reads or writes balances directly: every fund movement goes
// through these methods, which are idempotent on a game event id and record a
// queryable movement. Unlike the swap/send paths, the integration methods move
// Lucky between the canister's own maps, so the whole happy path is exercisable
// on a local replica. `getWalletBalances`/`getPoolBalances` read the mainnet ICP
// ledger and are deliberately not called; Lucky balances are read with
// `icrc1_balance_of` and the treasury with `getTreasuryBalance`.

const game = createIdentity("lucky-game");
const carol = createIdentity("lucky-carol");

it("lets only the admin authorize and revoke an integration principal", async () => {
  // A non-admin cannot authorize anyone.
  actor.setIdentity(alice);
  await actor.authorizeIntegrationPrincipal(game.getPrincipal());
  await expect(
    actor.isIntegrationPrincipal(game.getPrincipal()),
  ).resolves.toBe(false);

  // The admin authorizes the game principal.
  actor.setIdentity(admin);
  await actor.authorizeIntegrationPrincipal(game.getPrincipal());
  await expect(
    actor.isIntegrationPrincipal(game.getPrincipal()),
  ).resolves.toBe(true);

  // A non-admin cannot revoke either.
  actor.setIdentity(alice);
  await actor.revokeIntegrationPrincipal(game.getPrincipal());
  await expect(
    actor.isIntegrationPrincipal(game.getPrincipal()),
  ).resolves.toBe(true);

  // The admin revokes it, and the game is no longer trusted.
  actor.setIdentity(admin);
  await actor.revokeIntegrationPrincipal(game.getPrincipal());
  await expect(
    actor.isIntegrationPrincipal(game.getPrincipal()),
  ).resolves.toBe(false);

  // Re-authorize for the fund-movement tests below.
  await actor.authorizeIntegrationPrincipal(game.getPrincipal());
});

it("rejects an unauthorized caller from every integration fund method", async () => {
  // `carol` is a signed-in user but was never authorized as an integration
  // principal, so every fund method is refused and no balance moves.
  actor.setIdentity(carol);
  const treasuryBefore = await actor.getTreasuryBalance();
  const carolBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });

  await expect(actor.submitExcessSweep(10n * E8S, "unauth-sweep")).resolves.toEqual(
    { Err: { NotAuthorized: null } },
  );
  await expect(
    actor.submitCrowdfunding(10n * E8S, "unauth-crowd"),
  ).resolves.toEqual({ Err: { NotAuthorized: null } });
  await expect(
    actor.debitBet(carol.getPrincipal(), 10n * E8S, "unauth-bet"),
  ).resolves.toEqual({ Err: { NotAuthorized: null } });
  await expect(
    actor.creditPrize(carol.getPrincipal(), 10n * E8S, "unauth-prize"),
  ).resolves.toEqual({ Err: { NotAuthorized: null } });

  await expect(actor.getTreasuryBalance()).resolves.toBe(treasuryBefore);
  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(carolBefore);
});

it("credits the treasury for an excess sweep and records a queryable movement", async () => {
  actor.setIdentity(game);
  const before = await actor.getTreasuryBalance();

  const result = await actor.submitExcessSweep(25n * E8S, "sweep-1");
  expect(result).toEqual({ Ok: { treasuryBalance: before + 25n * E8S } });
  await expect(actor.getTreasuryBalance()).resolves.toBe(before + 25n * E8S);

  const movement = await actor.getMovement("sweep-1");
  expect(movement).toHaveLength(1);
  expect(movement[0]).toMatchObject({
    gameEventId: "sweep-1",
    source: { ExcessSweep: null },
    direction: { In: null },
    amount: 25n * E8S,
  });
  expect(movement[0].timestamp).toBeGreaterThan(0n);
});

it("credits the treasury for crowdfunding and distinguishes the source", async () => {
  actor.setIdentity(game);
  const before = await actor.getTreasuryBalance();

  const result = await actor.submitCrowdfunding(40n * E8S, "crowd-1");
  expect(result).toEqual({ Ok: { treasuryBalance: before + 40n * E8S } });

  const movement = await actor.getMovement("crowd-1");
  expect(movement).toHaveLength(1);
  expect(movement[0]).toMatchObject({
    gameEventId: "crowd-1",
    source: { Crowdfunding: null },
    direction: { In: null },
    amount: 40n * E8S,
  });
});

it("rejects a non-positive intake amount without moving the treasury", async () => {
  actor.setIdentity(game);
  const before = await actor.getTreasuryBalance();

  await expect(actor.submitExcessSweep(0n, "sweep-zero")).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
  await expect(actor.submitCrowdfunding(0n, "crowd-zero")).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });

  await expect(actor.getTreasuryBalance()).resolves.toBe(before);
  await expect(actor.getMovement("sweep-zero")).resolves.toEqual([]);
  await expect(actor.getMovement("crowd-zero")).resolves.toEqual([]);
});

it("only credits the treasury once when an intake event id is replayed", async () => {
  actor.setIdentity(game);
  const before = await actor.getTreasuryBalance();

  const first = await actor.submitExcessSweep(15n * E8S, "sweep-idem");
  expect(first).toEqual({ Ok: { treasuryBalance: before + 15n * E8S } });

  // Replaying the same game event id is a no-op: the treasury is unchanged and
  // the movement is not duplicated.
  const replay = await actor.submitExcessSweep(15n * E8S, "sweep-idem");
  expect(replay).toEqual({ Ok: { treasuryBalance: before + 15n * E8S } });
  await expect(actor.getTreasuryBalance()).resolves.toBe(before + 15n * E8S);

  const movements = await actor.listMovements();
  expect(
    movements.filter((m) => m.gameEventId === "sweep-idem"),
  ).toHaveLength(1);
});

it("lets only the admin top up a prize pool from the treasury", async () => {
  // A non-admin is rejected before any amount validation.
  actor.setIdentity(alice);
  await expect(actor.topUpPrizePool("pool-a", 10n * E8S)).resolves.toEqual({
    Err: { NotAdmin: null },
  });
  await expect(actor.getPrizePoolBalance("pool-a")).resolves.toBe(0n);
});

it("rejects a top-up that exceeds the treasury balance, leaving it unchanged", async () => {
  actor.setIdentity(admin);
  const treasuryBefore = await actor.getTreasuryBalance();
  const poolBefore = await actor.getPrizePoolBalance("pool-over");

  await expect(
    actor.topUpPrizePool("pool-over", treasuryBefore + 1n * E8S),
  ).resolves.toEqual({
    Err: {
      InsufficientTreasury: {
        available: treasuryBefore,
        required: treasuryBefore + 1n * E8S,
      },
    },
  });

  await expect(actor.getTreasuryBalance()).resolves.toBe(treasuryBefore);
  await expect(actor.getPrizePoolBalance("pool-over")).resolves.toBe(poolBefore);
});

it("moves treasury funds into a prize pool and records an outbound movement", async () => {
  actor.setIdentity(admin);
  const treasuryBefore = await actor.getTreasuryBalance();
  const poolBefore = await actor.getPrizePoolBalance("pool-a");

  const result = await actor.topUpPrizePool("pool-a", 30n * E8S);
  expect(result).toEqual({
    Ok: {
      treasuryBalance: treasuryBefore - 30n * E8S,
      poolBalance: poolBefore + 30n * E8S,
    },
  });
  await expect(actor.getTreasuryBalance()).resolves.toBe(
    treasuryBefore - 30n * E8S,
  );
  await expect(actor.getPrizePoolBalance("pool-a")).resolves.toBe(
    poolBefore + 30n * E8S,
  );

  const movements = await actor.listMovements();
  const topUps = movements.filter((m) => m.source.PrizePoolTopUp !== undefined);
  expect(topUps.length).toBeGreaterThan(0);
  const latest = topUps[topUps.length - 1];
  expect(latest).toMatchObject({
    source: { PrizePoolTopUp: null },
    direction: { Out: null },
    amount: 30n * E8S,
  });
});

it("debits a funded user's wallet for a bet and credits the default prize pool", async () => {
  // Fund carol through the real admin mint path so the debit has a balance.
  actor.setIdentity(admin);
  await actor.mintTo(carol.getPrincipal(), 100n * E8S);
  const walletBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });
  const poolBefore = await actor.getPrizePoolBalance("default");

  actor.setIdentity(game);
  const result = await actor.debitBet(carol.getPrincipal(), 20n * E8S, "bet-1");
  expect(result).toEqual({ Ok: { walletBalance: walletBefore - 20n * E8S } });
  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore - 20n * E8S);
  await expect(actor.getPrizePoolBalance("default")).resolves.toBe(
    poolBefore + 20n * E8S,
  );

  const movement = await actor.getMovement("bet-1");
  expect(movement).toHaveLength(1);
  expect(movement[0]).toMatchObject({
    gameEventId: "bet-1",
    source: { BetDebit: null },
    direction: { Out: null },
    amount: 20n * E8S,
    counterparty: carol.getPrincipal(),
  });
});

it("rejects a bet debit when the wallet lacks funds, leaving it unchanged", async () => {
  actor.setIdentity(admin);
  const poor = createIdentity("lucky-poor");
  const walletBefore = await actor.icrc1_balance_of({
    owner: poor.getPrincipal(),
    subaccount: [],
  });

  actor.setIdentity(game);
  await expect(
    actor.debitBet(poor.getPrincipal(), 5n * E8S, "bet-poor"),
  ).resolves.toEqual({
    Err: { InsufficientFunds: { available: walletBefore, required: 5n * E8S } },
  });

  await expect(
    actor.icrc1_balance_of({ owner: poor.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore);
  await expect(actor.getMovement("bet-poor")).resolves.toEqual([]);
});

it("only debits a bet once when the bet id is replayed", async () => {
  actor.setIdentity(admin);
  await actor.mintTo(carol.getPrincipal(), 50n * E8S);
  const walletBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });

  actor.setIdentity(game);
  const first = await actor.debitBet(carol.getPrincipal(), 10n * E8S, "bet-idem");
  expect(first).toEqual({ Ok: { walletBalance: walletBefore - 10n * E8S } });

  const replay = await actor.debitBet(carol.getPrincipal(), 10n * E8S, "bet-idem");
  expect(replay).toEqual({ Ok: { walletBalance: walletBefore - 10n * E8S } });
  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore - 10n * E8S);

  const movements = await actor.listMovements();
  expect(movements.filter((m) => m.gameEventId === "bet-idem")).toHaveLength(1);
});

it("credits a prize payout to the winner's wallet and records an inbound movement", async () => {
  actor.setIdentity(admin);
  const walletBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });

  actor.setIdentity(game);
  const result = await actor.creditPrize(
    carol.getPrincipal(),
    75n * E8S,
    "prize-1",
  );
  expect(result).toEqual({ Ok: { walletBalance: walletBefore + 75n * E8S } });
  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore + 75n * E8S);

  const movement = await actor.getMovement("prize-1");
  expect(movement).toHaveLength(1);
  expect(movement[0]).toMatchObject({
    gameEventId: "prize-1",
    source: { PrizePayout: null },
    direction: { In: null },
    amount: 75n * E8S,
    counterparty: carol.getPrincipal(),
  });
});

it("only credits a prize once when the payout event id is replayed", async () => {
  actor.setIdentity(admin);
  const walletBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });

  actor.setIdentity(game);
  const first = await actor.creditPrize(carol.getPrincipal(), 5n * E8S, "prize-idem");
  expect(first).toEqual({ Ok: { walletBalance: walletBefore + 5n * E8S } });

  const replay = await actor.creditPrize(
    carol.getPrincipal(),
    5n * E8S,
    "prize-idem",
  );
  expect(replay).toEqual({ Ok: { walletBalance: walletBefore + 5n * E8S } });
  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore + 5n * E8S);

  const movements = await actor.listMovements();
  expect(movements.filter((m) => m.gameEventId === "prize-idem")).toHaveLength(1);
});

it("rejects a non-positive bet or prize amount without moving funds", async () => {
  actor.setIdentity(admin);
  const walletBefore = await actor.icrc1_balance_of({
    owner: carol.getPrincipal(),
    subaccount: [],
  });

  actor.setIdentity(game);
  await expect(
    actor.debitBet(carol.getPrincipal(), 0n, "bet-zero"),
  ).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });
  await expect(
    actor.creditPrize(carol.getPrincipal(), 0n, "prize-zero"),
  ).resolves.toEqual({
    Err: { InvalidAmount: "Amount must be greater than zero" },
  });

  await expect(
    actor.icrc1_balance_of({ owner: carol.getPrincipal(), subaccount: [] }),
  ).resolves.toBe(walletBefore);
  await expect(actor.getMovement("bet-zero")).resolves.toEqual([]);
  await expect(actor.getMovement("prize-zero")).resolves.toEqual([]);
});

it("lists every recorded movement for reconciliation", async () => {
  actor.setIdentity(game);
  const movements = await actor.listMovements();
  const ids = movements.map((m) => m.gameEventId);
  // The movements recorded above are all present and queryable.
  for (const id of [
    "sweep-1",
    "crowd-1",
    "sweep-idem",
    "bet-1",
    "bet-idem",
    "prize-1",
    "prize-idem",
  ]) {
    expect(ids).toContain(id);
  }
  // Every movement carries the fields reconciliation needs.
  for (const movement of movements) {
    expect(typeof movement.gameEventId).toBe("string");
    expect(movement.amount).toBeGreaterThan(0n);
    expect(movement.timestamp).toBeGreaterThan(0n);
    expect(movement.counterparty).toBeDefined();
  }
});
