/**
 * Treasury Funding page journeys.
 *
 * The backend actor is a typed local mock. The page is the admin surface for
 * the game integration: it shows the treasury balance, splits cumulative intake
 * by source, tops up prize pools, and manages trusted integration callers.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Movement } from "@/backend";
import { MovementDirection, MovementSource } from "@/backend";
import TreasuryFundingPage from "@/pages/TreasuryFunding";
import { createMockActor, harness, resetHarness } from "@/test/harness";
import { Principal } from "@icp-sdk/core/principal";

const E8S = 100_000_000n;
const TREASURY_PRINCIPAL = Principal.fromText("aaaaa-aa");
const GAME_PRINCIPAL = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    gameEventId: "event-1",
    source: MovementSource.ExcessSweep,
    direction: MovementDirection.In,
    amount: 50n * E8S,
    counterparty: TREASURY_PRINCIPAL,
    timestamp: 1_700_000_000_000_000_000n,
    ...overrides,
  };
}

function renderFunding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TreasuryFundingPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
});

describe("Treasury Funding page", () => {
  it("shows the treasury balance and principal", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 250n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      listMovements: vi.fn(async () => []),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;

    renderFunding();

    expect(await screen.findByTestId("funding.balance")).toHaveTextContent(
      "250",
    );
    expect(screen.getByTestId("funding.principal")).toHaveTextContent(
      "aaaaa-aa",
    );
  });

  it("splits cumulative intake into excess sweep and crowdfunding totals", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => [
        movement({
          gameEventId: "sweep-1",
          source: MovementSource.ExcessSweep,
          amount: 50n * E8S,
        }),
        movement({
          gameEventId: "sweep-2",
          source: MovementSource.ExcessSweep,
          amount: 25n * E8S,
        }),
        movement({
          gameEventId: "crowd-1",
          source: MovementSource.Crowdfunding,
          amount: 10n * E8S,
        }),
        // A prize-pool top-up is a treasury movement but not intake, so it must
        // not be counted in either intake bucket.
        movement({
          gameEventId: "topup-1",
          source: MovementSource.PrizePoolTopUp,
          direction: MovementDirection.Out,
          amount: 999n * E8S,
        }),
      ]),
    });
    harness.isAuthenticated = true;

    renderFunding();

    const sweep = await screen.findByTestId("funding.intake.excesssweep");
    expect(sweep).toHaveTextContent("Excess sweep");
    expect(sweep).toHaveTextContent("75");
    expect(sweep).toHaveTextContent("2 entries");

    const crowdfunding = screen.getByTestId("funding.intake.crowdfunding");
    expect(crowdfunding).toHaveTextContent("Crowdfunding");
    expect(crowdfunding).toHaveTextContent("10");
    expect(crowdfunding).toHaveTextContent("1 entry");

    // The grand total is the sum of the two intake sources only.
    expect(screen.getByTestId("funding.intake.total")).toHaveTextContent("85");
  });

  it("lists recent movements with source, direction, amount, and event id", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => [
        movement({
          gameEventId: "crowd-42",
          source: MovementSource.Crowdfunding,
          amount: 12n * E8S,
        }),
      ]),
    });
    harness.isAuthenticated = true;

    renderFunding();

    const row = await screen.findByTestId("funding.movements.row.1");
    expect(row).toHaveTextContent("Crowdfunding");
    expect(row).toHaveTextContent("In");
    expect(row).toHaveTextContent("+12");
    expect(row).toHaveTextContent("crowd-42");
  });

  it("shows an empty state when no movements are recorded", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
    });
    harness.isAuthenticated = true;

    renderFunding();

    expect(
      await screen.findByTestId("funding.movements.empty_state"),
    ).toHaveTextContent("No integration movements recorded yet.");
  });

  it("tops up a prize pool and reports the new pool and treasury balances", async () => {
    const topUpPrizePool = vi.fn(async () => ({
      __kind__: "Ok" as const,
      Ok: { poolBalance: 30n * E8S, treasuryBalance: 70n * E8S },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 100n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      getPrizePoolBalance: vi.fn(async () => 0n),
      topUpPrizePool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.pool.id_input"),
      "weekly-jackpot",
    );
    await user.type(screen.getByTestId("funding.pool.amount_input"), "30");
    await user.click(screen.getByTestId("funding.pool.submit_button"));

    await waitFor(() => {
      expect(topUpPrizePool).toHaveBeenCalledWith("weekly-jackpot", 30n * E8S);
    });
    expect(
      await screen.findByTestId("funding.pool.success_state"),
    ).toHaveTextContent("Pool now holds 30 Lucky. Treasury holds 70 Lucky.");
  });

  it("rejects a top-up larger than the treasury balance before calling the backend", async () => {
    const topUpPrizePool = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 10n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      getPrizePoolBalance: vi.fn(async () => 0n),
      topUpPrizePool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.pool.id_input"),
      "weekly-jackpot",
    );
    await user.type(screen.getByTestId("funding.pool.amount_input"), "50");
    await user.click(screen.getByTestId("funding.pool.submit_button"));

    expect(
      await screen.findByTestId("funding.pool.error_state"),
    ).toHaveTextContent("The treasury only holds 10 Lucky.");
    expect(topUpPrizePool).not.toHaveBeenCalled();
  });

  it("rejects a non-positive top-up amount before calling the backend", async () => {
    const topUpPrizePool = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 100n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      getPrizePoolBalance: vi.fn(async () => 0n),
      topUpPrizePool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.pool.id_input"),
      "weekly-jackpot",
    );
    await user.type(screen.getByTestId("funding.pool.amount_input"), "0");
    await user.click(screen.getByTestId("funding.pool.submit_button"));

    expect(
      await screen.findByTestId("funding.pool.error_state"),
    ).toHaveTextContent("Enter a positive Lucky amount.");
    expect(topUpPrizePool).not.toHaveBeenCalled();
  });

  it("surfaces the backend InsufficientTreasury error from a top-up", async () => {
    const topUpPrizePool = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: {
        __kind__: "InsufficientTreasury" as const,
        InsufficientTreasury: { available: 5n * E8S, required: 30n * E8S },
      },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 100n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      getPrizePoolBalance: vi.fn(async () => 0n),
      topUpPrizePool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.pool.id_input"),
      "weekly-jackpot",
    );
    await user.type(screen.getByTestId("funding.pool.amount_input"), "30");
    await user.click(screen.getByTestId("funding.pool.submit_button"));

    expect(
      await screen.findByTestId("funding.pool.error_state"),
    ).toHaveTextContent("The treasury only holds 5 Lucky, but 30 is required.");
  });

  it("authorizes an integration principal and confirms", async () => {
    const authorizeIntegrationPrincipal = vi.fn(async () => undefined);
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      authorizeIntegrationPrincipal,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.authorize.input"),
      GAME_PRINCIPAL.toText(),
    );
    await user.click(screen.getByTestId("funding.authorize.submit_button"));

    await waitFor(() => {
      expect(authorizeIntegrationPrincipal).toHaveBeenCalledWith(
        GAME_PRINCIPAL,
      );
    });
    expect(
      await screen.findByTestId("funding.authorize.success_state"),
    ).toHaveTextContent("as an integration caller.");
  });

  it("rejects an invalid principal in the authorize form", async () => {
    const authorizeIntegrationPrincipal = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      authorizeIntegrationPrincipal,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.authorize.input"),
      "not-a-principal",
    );
    await user.click(screen.getByTestId("funding.authorize.submit_button"));

    expect(
      await screen.findByTestId("funding.authorize.error_state"),
    ).toHaveTextContent("Enter a valid principal address.");
    expect(authorizeIntegrationPrincipal).not.toHaveBeenCalled();
  });

  it("revokes an integration principal and confirms", async () => {
    const revokeIntegrationPrincipal = vi.fn(async () => undefined);
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
      isIntegrationPrincipal: vi.fn(async () => true),
      revokeIntegrationPrincipal,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderFunding();

    await user.type(
      await screen.findByTestId("funding.revoke.input"),
      GAME_PRINCIPAL.toText(),
    );
    // The status line reflects the current authorization state.
    expect(
      await screen.findByTestId("funding.revoke.status"),
    ).toHaveTextContent("This principal is currently authorized.");
    await user.click(screen.getByTestId("funding.revoke.submit_button"));

    await waitFor(() => {
      expect(revokeIntegrationPrincipal).toHaveBeenCalledWith(GAME_PRINCIPAL);
    });
    expect(
      await screen.findByTestId("funding.revoke.success_state"),
    ).toHaveTextContent("Its calls are now rejected.");
  });

  it("shows the admin badge to an admin", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      listMovements: vi.fn(async () => []),
    });
    harness.isAuthenticated = true;

    renderFunding();

    expect(
      await screen.findByTestId("funding.admin_badge"),
    ).toBeInTheDocument();
  });
});
