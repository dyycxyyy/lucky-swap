/**
 * Treasury page journeys.
 *
 * The backend actor is a typed local mock. The page renders admin-only actions
 * for admins and a locked state for non-admins, and validates withdrawal
 * amounts before calling the backend.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TreasuryPage from "@/pages/Treasury";
import { createMockActor, harness, resetHarness } from "@/test/harness";
import { Principal } from "@icp-sdk/core/principal";

const E8S = 100_000_000n;
const TREASURY_PRINCIPAL = Principal.fromText("aaaaa-aa");
const DESTINATION = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");

function renderTreasury() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TreasuryPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
});

describe("Treasury page", () => {
  it("shows the live treasury balance and principal", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 250n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;

    renderTreasury();

    expect(await screen.findByTestId("treasury.balance")).toHaveTextContent(
      "250",
    );
    expect(screen.getByTestId("treasury.principal")).toHaveTextContent(
      "aaaaa-aa",
    );
  });

  it("shows admin actions to the admin", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;

    renderTreasury();

    expect(
      await screen.findByTestId("treasury.admin_badge"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("treasury.withdraw.submit_button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("treasury.mint.submit_button"),
    ).toBeInTheDocument();
  });

  it("hides admin actions from non-admins", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => false),
    });
    harness.isAuthenticated = true;

    renderTreasury();

    expect(
      await screen.findByTestId("treasury.non_admin_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("treasury.withdraw.submit_button")).toBeNull();
    expect(screen.queryByTestId("treasury.mint.submit_button")).toBeNull();
  });

  it("rejects a withdrawal that is not a multiple of 100 Lucky", async () => {
    const withdrawTreasury = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 1000n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      withdrawTreasury,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(
      await screen.findByTestId("treasury.withdraw.input"),
      "150",
    );
    await user.type(
      screen.getByTestId("treasury.withdraw.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.withdraw.submit_button"));

    expect(
      await screen.findByTestId("treasury.withdraw.error_state"),
    ).toHaveTextContent("Withdrawals must be a multiple of 100 Lucky.");
    expect(withdrawTreasury).not.toHaveBeenCalled();
  });

  it("submits a valid 100 Lucky withdrawal", async () => {
    const withdrawTreasury = vi.fn(async () => ({
      __kind__: "Ok" as const,
      Ok: 100n * E8S,
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 1000n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      withdrawTreasury,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(
      await screen.findByTestId("treasury.withdraw.input"),
      "100",
    );
    await user.type(
      screen.getByTestId("treasury.withdraw.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.withdraw.submit_button"));

    await waitFor(() => {
      expect(withdrawTreasury).toHaveBeenCalledWith(100n * E8S, DESTINATION);
    });
    expect(
      await screen.findByTestId("treasury.withdraw.success_state"),
    ).toHaveTextContent("Sent 100 Lucky to");
  });

  it("mints Lucky into the pool and confirms", async () => {
    const mintToPool = vi.fn(async () => ({
      __kind__: "Ok" as const,
      Ok: 1000n * E8S,
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintToPool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint.input"), "1000");
    await user.click(screen.getByTestId("treasury.mint.submit_button"));

    await waitFor(() => {
      expect(mintToPool).toHaveBeenCalledWith(1000n * E8S);
    });
    expect(
      await screen.findByTestId("treasury.mint.success_state"),
    ).toHaveTextContent("Minted 1,000 Lucky into the swap pool.");
  });

  // --- Characterization: existing admin mint/withdraw error paths ---------
  // The request adds new admin mint/burn actions that reuse the existing admin
  // permission check. These pin the current error handling those actions must
  // not regress.

  it("rejects a non-positive mint amount before calling the backend", async () => {
    const mintToPool = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintToPool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint.input"), "0");
    await user.click(screen.getByTestId("treasury.mint.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint.error_state"),
    ).toHaveTextContent("Enter a positive Lucky amount.");
    expect(mintToPool).not.toHaveBeenCalled();
  });

  it("surfaces the backend NotAdmin error from minting", async () => {
    const mintToPool = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: { __kind__: "NotAdmin" as const, NotAdmin: null },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintToPool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint.input"), "1000");
    await user.click(screen.getByTestId("treasury.mint.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint.error_state"),
    ).toHaveTextContent("Only the admin can mint Lucky.");
  });

  it("surfaces the backend InvalidAmount text from minting", async () => {
    const mintToPool = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: {
        __kind__: "InvalidAmount" as const,
        InvalidAmount: "Amount must be greater than zero",
      },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintToPool,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint.input"), "1000");
    await user.click(screen.getByTestId("treasury.mint.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint.error_state"),
    ).toHaveTextContent("Amount must be greater than zero");
  });

  it("rejects an invalid withdrawal destination principal before calling the backend", async () => {
    const withdrawTreasury = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 1000n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      withdrawTreasury,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(
      await screen.findByTestId("treasury.withdraw.input"),
      "100",
    );
    await user.type(
      screen.getByTestId("treasury.withdraw.destination_input"),
      "not-a-principal",
    );
    await user.click(screen.getByTestId("treasury.withdraw.submit_button"));

    expect(
      await screen.findByTestId("treasury.withdraw.error_state"),
    ).toHaveTextContent("Enter a valid principal address.");
    expect(withdrawTreasury).not.toHaveBeenCalled();
  });

  it("surfaces the backend NotAdmin error from withdrawing", async () => {
    const withdrawTreasury = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: { __kind__: "NotAdmin" as const, NotAdmin: null },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 1000n * E8S),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      withdrawTreasury,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(
      await screen.findByTestId("treasury.withdraw.input"),
      "100",
    );
    await user.type(
      screen.getByTestId("treasury.withdraw.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.withdraw.submit_button"));

    expect(
      await screen.findByTestId("treasury.withdraw.error_state"),
    ).toHaveTextContent("Only the treasury admin can perform this action.");
  });

  // --- New admin mint-to-address / burn-from-address actions --------------

  it("shows the mint-to-address and burn-from-address forms to the admin", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;

    renderTreasury();

    expect(
      await screen.findByTestId("treasury.mint_to.submit_button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("treasury.burn.submit_button"),
    ).toBeInTheDocument();
  });

  it("hides the mint-to-address and burn-from-address forms from non-admins", async () => {
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => false),
    });
    harness.isAuthenticated = true;

    renderTreasury();

    expect(
      await screen.findByTestId("treasury.non_admin_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("treasury.mint_to.submit_button")).toBeNull();
    expect(screen.queryByTestId("treasury.burn.submit_button")).toBeNull();
  });

  it("mints Lucky to an arbitrary principal and confirms", async () => {
    const mintTo = vi.fn(async () => ({
      __kind__: "Ok" as const,
      Ok: 500n * E8S,
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintTo,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint_to.input"), "500");
    await user.type(
      screen.getByTestId("treasury.mint_to.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.mint_to.submit_button"));

    await waitFor(() => {
      expect(mintTo).toHaveBeenCalledWith(DESTINATION, 500n * E8S);
    });
    expect(
      await screen.findByTestId("treasury.mint_to.success_state"),
    ).toHaveTextContent("Minted 500 Lucky to");
  });

  it("rejects a non-positive mint-to-address amount before calling the backend", async () => {
    const mintTo = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintTo,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint_to.input"), "0");
    await user.type(
      screen.getByTestId("treasury.mint_to.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.mint_to.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint_to.error_state"),
    ).toHaveTextContent("Enter a positive Lucky amount.");
    expect(mintTo).not.toHaveBeenCalled();
  });

  it("rejects an invalid mint-to-address destination before calling the backend", async () => {
    const mintTo = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintTo,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint_to.input"), "500");
    await user.type(
      screen.getByTestId("treasury.mint_to.destination_input"),
      "not-a-principal",
    );
    await user.click(screen.getByTestId("treasury.mint_to.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint_to.error_state"),
    ).toHaveTextContent("Enter a valid principal address.");
    expect(mintTo).not.toHaveBeenCalled();
  });

  it("surfaces the backend NotAdmin error from minting to an address", async () => {
    const mintTo = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: { __kind__: "NotAdmin" as const, NotAdmin: null },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      mintTo,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.mint_to.input"), "500");
    await user.type(
      screen.getByTestId("treasury.mint_to.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.mint_to.submit_button"));

    expect(
      await screen.findByTestId("treasury.mint_to.error_state"),
    ).toHaveTextContent("Only the admin can mint Lucky.");
  });

  it("burns Lucky from an arbitrary principal and confirms", async () => {
    const burnFrom = vi.fn(async () => ({
      __kind__: "Ok" as const,
      Ok: 100n * E8S,
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      burnFrom,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.burn.input"), "100");
    await user.type(
      screen.getByTestId("treasury.burn.source_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.burn.submit_button"));

    await waitFor(() => {
      expect(burnFrom).toHaveBeenCalledWith(DESTINATION, 100n * E8S);
    });
    expect(
      await screen.findByTestId("treasury.burn.success_state"),
    ).toHaveTextContent("Burned 100 Lucky from");
  });

  it("surfaces the backend InsufficientBalance error from burning", async () => {
    const burnFrom = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: {
        __kind__: "InsufficientBalance" as const,
        InsufficientBalance: { balance: 40n * E8S },
      },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      burnFrom,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.burn.input"), "100");
    await user.type(
      screen.getByTestId("treasury.burn.source_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.burn.submit_button"));

    expect(
      await screen.findByTestId("treasury.burn.error_state"),
    ).toHaveTextContent(
      "That address only holds 40 Lucky. Lower the amount and try again.",
    );
  });

  it("rejects a non-positive burn amount before calling the backend", async () => {
    const burnFrom = vi.fn();
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      burnFrom,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(await screen.findByTestId("treasury.burn.input"), "0");
    await user.type(
      screen.getByTestId("treasury.burn.source_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.burn.submit_button"));

    expect(
      await screen.findByTestId("treasury.burn.error_state"),
    ).toHaveTextContent("Enter a positive Lucky amount.");
    expect(burnFrom).not.toHaveBeenCalled();
  });

  it("surfaces the backend InsufficientTreasury error from withdrawing", async () => {
    const withdrawTreasury = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: {
        __kind__: "InsufficientTreasury" as const,
        InsufficientTreasury: { available: 0n, required: 100n * E8S },
      },
    }));
    harness.actor = createMockActor({
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => TREASURY_PRINCIPAL),
      isCallerAdmin: vi.fn(async () => true),
      withdrawTreasury,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderTreasury();

    await user.type(
      await screen.findByTestId("treasury.withdraw.input"),
      "100",
    );
    await user.type(
      screen.getByTestId("treasury.withdraw.destination_input"),
      DESTINATION.toText(),
    );
    await user.click(screen.getByTestId("treasury.withdraw.submit_button"));

    expect(
      await screen.findByTestId("treasury.withdraw.error_state"),
    ).toHaveTextContent(
      "The treasury only holds 0 Lucky. Lower the amount and try again.",
    );
  });
});
