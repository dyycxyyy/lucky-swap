/**
 * Shared view models and labels for the game-integration surface.
 *
 * The backend records every integration fund movement as a `Movement`. Pages
 * (funding, integration guide, treasury intake) render these through the same
 * label maps and helpers so the wording stays consistent across the app.
 */

import type { Movement, MovementDirection, MovementSource } from "@/backend";
import {
  MovementDirection as Direction,
  MovementSource as Source,
} from "@/backend";

/** Human-readable label for each movement source. */
export const MOVEMENT_SOURCE_LABELS: Record<MovementSource, string> = {
  [Source.ExcessSweep]: "Excess sweep",
  [Source.Crowdfunding]: "Crowdfunding",
  [Source.PrizePoolTopUp]: "Prize pool top-up",
  [Source.BetDebit]: "Bet debit",
  [Source.PrizePayout]: "Prize payout",
};

/** One-line explanation of what each movement source represents. */
export const MOVEMENT_SOURCE_DESCRIPTIONS: Record<MovementSource, string> = {
  [Source.ExcessSweep]: "Surplus game revenue swept into the treasury.",
  [Source.Crowdfunding]: "Community contributions routed into the treasury.",
  [Source.PrizePoolTopUp]: "Treasury funds moved into a prize pool.",
  [Source.BetDebit]: "A player stake debited from their wallet.",
  [Source.PrizePayout]: "A prize credited to a player wallet.",
};

/** Label for a movement direction. */
export const MOVEMENT_DIRECTION_LABELS: Record<MovementDirection, string> = {
  [Direction.In]: "In",
  [Direction.Out]: "Out",
};

/** The two treasury intake sources an admin can distinguish. */
export const TREASURY_INTAKE_SOURCES: MovementSource[] = [
  Source.ExcessSweep,
  Source.Crowdfunding,
];

/** True when the movement credits the treasury (excess sweep or crowdfunding). */
export function isTreasuryIntake(movement: Movement): boolean {
  return (
    movement.direction === Direction.In &&
    (movement.source === Source.ExcessSweep ||
      movement.source === Source.Crowdfunding)
  );
}

/** A movement enriched with display-ready labels for list rendering. */
export interface MovementView {
  movement: Movement;
  sourceLabel: string;
  sourceDescription: string;
  directionLabel: string;
  isInbound: boolean;
}

/** Map a raw backend movement into its display view model. */
export function toMovementView(movement: Movement): MovementView {
  return {
    movement,
    sourceLabel: MOVEMENT_SOURCE_LABELS[movement.source],
    sourceDescription: MOVEMENT_SOURCE_DESCRIPTIONS[movement.source],
    directionLabel: MOVEMENT_DIRECTION_LABELS[movement.direction],
    isInbound: movement.direction === Direction.In,
  };
}
