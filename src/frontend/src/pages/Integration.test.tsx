/**
 * Integration guide page tests.
 *
 * The guide is the app's contract with the game side: it must list every
 * integration endpoint with its purpose, parameters, and return shape, and
 * explain how a caller is authorized and how idempotency keys work. The backend
 * actor is a typed local mock.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IntegrationPage from "@/pages/Integration";
import { createMockActor, harness, resetHarness } from "@/test/harness";
import { Principal } from "@icp-sdk/core/principal";

const TREASURY_PRINCIPAL = Principal.fromText("aaaaa-aa");

function renderIntegration() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntegrationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
});

describe("Integration guide page", () => {
  it("documents every integration endpoint with purpose, params, and returns", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      listMovements: vi.fn(async () => []),
    });

    renderIntegration();

    // Every endpoint the game must call is named on the page. Some names also
    // appear in the prose sections, so match at least one occurrence.
    for (const name of [
      "submitExcessSweep",
      "submitCrowdfunding",
      "topUpPrizePool",
      "getPrizePoolBalance",
      "debitBet",
      "creditPrize",
      "authorizeIntegrationPrincipal",
      "revokeIntegrationPrincipal",
      "isIntegrationPrincipal",
      "listMovements",
      "getMovement",
    ]) {
      expect((await screen.findAllByText(name)).length).toBeGreaterThan(0);
    }

    // Each endpoint card carries the three contract fields.
    const cards = screen.getAllByTestId("integration.endpoint_card");
    expect(cards.length).toBeGreaterThanOrEqual(11);
    for (const card of cards) {
      expect(card).toHaveTextContent("Signature");
      expect(card).toHaveTextContent("Parameters");
      expect(card).toHaveTextContent("Returns");
    }
  });

  it("explains how integration callers are authorized", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      listMovements: vi.fn(async () => []),
    });

    renderIntegration();

    expect(await screen.findByText("Getting authorized")).toBeInTheDocument();
    expect(
      screen.getByText(/Integration callers are trusted principals/),
    ).toBeInTheDocument();
    // Unauthorized callers are rejected with the documented error variant.
    expect(screen.getAllByText("NotAuthorized").length).toBeGreaterThan(0);
  });

  it("explains idempotency and the per-method event keys", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      listMovements: vi.fn(async () => []),
    });

    renderIntegration();

    expect(await screen.findByText("Idempotency")).toBeInTheDocument();
    expect(
      screen.getByText(/Repeating a call with the same id returns the/),
    ).toBeInTheDocument();
    // The wallet methods use their own key names.
    expect(screen.getByText("betId")).toBeInTheDocument();
    expect(screen.getByText("payoutEventId")).toBeInTheDocument();
  });

  it("shows the live treasury balance and an empty movements state", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 42n * 100_000_000n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      listMovements: vi.fn(async () => []),
    });

    renderIntegration();

    expect(
      await screen.findByTestId("integration.treasury.balance"),
    ).toHaveTextContent("42");
    expect(
      await screen.findByTestId("integration.movements.empty_state"),
    ).toHaveTextContent("No integration movements recorded yet.");
  });
});
