/**
 * Unit tests for the integration view-model helpers.
 *
 * These are pure functions shared by the Funding, Integration, and Wallet
 * pages. They decide how a raw backend `Movement` is labelled and whether it
 * counts as treasury intake, so a regression here silently mislabels money.
 */

import { describe, expect, it } from "vitest";

import type { Movement } from "@/backend";
import { MovementDirection, MovementSource } from "@/backend";
import {
  MOVEMENT_DIRECTION_LABELS,
  MOVEMENT_SOURCE_DESCRIPTIONS,
  MOVEMENT_SOURCE_LABELS,
  TREASURY_INTAKE_SOURCES,
  isTreasuryIntake,
  toMovementView,
} from "@/lib/integration";
import { Principal } from "@icp-sdk/core/principal";

const COUNTERPARTY = Principal.fromText("aaaaa-aa");

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    gameEventId: "event-1",
    source: MovementSource.ExcessSweep,
    direction: MovementDirection.In,
    amount: 100_000_000n,
    counterparty: COUNTERPARTY,
    timestamp: 1_700_000_000_000_000_000n,
    ...overrides,
  };
}

describe("movement label maps", () => {
  it("labels every movement source", () => {
    expect(MOVEMENT_SOURCE_LABELS[MovementSource.ExcessSweep]).toBe(
      "Excess sweep",
    );
    expect(MOVEMENT_SOURCE_LABELS[MovementSource.Crowdfunding]).toBe(
      "Crowdfunding",
    );
    expect(MOVEMENT_SOURCE_LABELS[MovementSource.PrizePoolTopUp]).toBe(
      "Prize pool top-up",
    );
    expect(MOVEMENT_SOURCE_LABELS[MovementSource.BetDebit]).toBe("Bet debit");
    expect(MOVEMENT_SOURCE_LABELS[MovementSource.PrizePayout]).toBe(
      "Prize payout",
    );
  });

  it("describes every movement source", () => {
    for (const source of Object.values(MovementSource)) {
      expect(MOVEMENT_SOURCE_DESCRIPTIONS[source]).toBeTruthy();
    }
  });

  it("labels both directions", () => {
    expect(MOVEMENT_DIRECTION_LABELS[MovementDirection.In]).toBe("In");
    expect(MOVEMENT_DIRECTION_LABELS[MovementDirection.Out]).toBe("Out");
  });
});

describe("isTreasuryIntake", () => {
  it("accepts an inbound excess sweep", () => {
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.ExcessSweep,
          direction: MovementDirection.In,
        }),
      ),
    ).toBe(true);
  });

  it("accepts inbound crowdfunding", () => {
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.Crowdfunding,
          direction: MovementDirection.In,
        }),
      ),
    ).toBe(true);
  });

  it("rejects a prize-pool top-up even though it is a treasury movement", () => {
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.PrizePoolTopUp,
          direction: MovementDirection.Out,
        }),
      ),
    ).toBe(false);
  });

  it("rejects wallet movements", () => {
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.BetDebit,
          direction: MovementDirection.Out,
        }),
      ),
    ).toBe(false);
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.PrizePayout,
          direction: MovementDirection.In,
        }),
      ),
    ).toBe(false);
  });

  it("rejects an outbound movement even when the source is an intake source", () => {
    expect(
      isTreasuryIntake(
        movement({
          source: MovementSource.ExcessSweep,
          direction: MovementDirection.Out,
        }),
      ),
    ).toBe(false);
  });
});

describe("TREASURY_INTAKE_SOURCES", () => {
  it("lists exactly the two admin-distinguishable intake sources", () => {
    expect(TREASURY_INTAKE_SOURCES).toEqual([
      MovementSource.ExcessSweep,
      MovementSource.Crowdfunding,
    ]);
  });
});

describe("toMovementView", () => {
  it("enriches an inbound movement with labels and an inbound flag", () => {
    const view = toMovementView(
      movement({
        source: MovementSource.Crowdfunding,
        direction: MovementDirection.In,
      }),
    );

    expect(view.sourceLabel).toBe("Crowdfunding");
    expect(view.sourceDescription).toBe(
      "Community contributions routed into the treasury.",
    );
    expect(view.directionLabel).toBe("In");
    expect(view.isInbound).toBe(true);
    expect(view.movement.gameEventId).toBe("event-1");
  });

  it("marks an outbound movement as not inbound", () => {
    const view = toMovementView(
      movement({
        source: MovementSource.BetDebit,
        direction: MovementDirection.Out,
      }),
    );

    expect(view.directionLabel).toBe("Out");
    expect(view.isInbound).toBe(false);
  });
});
