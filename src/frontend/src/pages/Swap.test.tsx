/**
 * Swap page journeys.
 *
 * The backend actor is a typed local mock; no network calls are made. The ICP
 * ledger actor used by the ICP -> Lucky approval path is also mocked, so the
 * full review -> confirm -> success flow runs against local fakes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SwapDirection } from "@/backend";
import SwapPage from "@/pages/Swap";
import { createMockActor, harness, resetHarness } from "@/test/harness";

const approveMock = vi.fn(async (_args: { amount: bigint }) => ({ Ok: 0n }));
vi.mock("@icp-sdk/core/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@icp-sdk/core/agent")>();
  return {
    ...actual,
    Actor: {
      ...actual.Actor,
      createActor: vi.fn(() => ({ icrc2_approve: approveMock })),
    },
  };
});

const E8S = 100_000_000n;

function renderSwap() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SwapPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
  approveMock.mockClear();
});

describe("Swap page", () => {
  it("shows live pool and treasury balances", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 5n * E8S,
        lucky: 5000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 30n * E8S),
    });

    renderSwap();

    await waitFor(() => {
      expect(screen.getByTestId("swap.pool_lucky")).toHaveTextContent(
        "5,000 Lucky",
      );
    });
    expect(screen.getByTestId("swap.pool_icp")).toHaveTextContent("5 ICP");
    expect(screen.getByTestId("swap.treasury_balance")).toHaveTextContent(
      "30 Lucky",
    );
  });

  it("quotes 1 ICP as 1000 Lucky and completes the swap", async () => {
    const swapIcpToLucky = vi.fn(async (amount: bigint) => ({
      __kind__: "Ok" as const,
      Ok: {
        direction: SwapDirection.IcpToLucky,
        inputAmount: amount,
        outputAmount: amount * 1000n,
        feeLucky: 0n,
      },
    }));
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
      swapIcpToLucky,
    });
    harness.isAuthenticated = true;
    harness.identity = {
      getPrincipal: () => ({ toText: () => "aaaaa-aa" }),
    };

    const user = userEvent.setup();
    renderSwap();

    const input = await screen.findByTestId("swap.amount_input");
    await user.type(input, "1");

    // Live quote shows 1000 Lucky before submitting.
    expect(screen.getByTestId("swap.quote_output")).toHaveTextContent(
      "1,000 Lucky",
    );

    await user.click(screen.getByTestId("swap.submit_button"));
    await user.click(await screen.findByTestId("swap.confirm_button"));

    await waitFor(() => {
      expect(swapIcpToLucky).toHaveBeenCalledWith(1n * E8S);
    });
    // The ICP ledger approval is requested before the backend pull, and it
    // covers the swap amount plus the 10_000 e8s ledger fee.
    expect(approveMock).toHaveBeenCalledTimes(1);
    const approvalArgs = approveMock.mock.calls[0][0];
    expect(approvalArgs.amount).toBe(1n * E8S + 10_000n);
    const approvalOrder = approveMock.mock.invocationCallOrder[0];
    const swapOrder = swapIcpToLucky.mock.invocationCallOrder[0];
    expect(approvalOrder).toBeLessThan(swapOrder);
  });

  it("rejects 0.11 ICP as not a multiple of 0.1 ICP", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.type(await screen.findByTestId("swap.amount_input"), "0.11");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "ICP amount must be a multiple of 0.1 ICP.",
    );
    expect(screen.getByTestId("swap.submit_button")).toBeDisabled();
  });

  it("rejects 0.05 ICP as below the 0.1 minimum", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.type(await screen.findByTestId("swap.amount_input"), "0.05");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "Minimum swap is 0.1 ICP.",
    );
  });

  it("quotes 1000 Lucky as 0.97 ICP with a 30 Lucky fee", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 5000n * E8S })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.click(await screen.findByTestId("swap.direction.luckyToIcp"));
    await user.type(screen.getByTestId("swap.amount_input"), "1000");

    expect(screen.getByTestId("swap.quote_output")).toHaveTextContent(
      "0.97 ICP",
    );
    expect(screen.getByTestId("swap.quote_fee")).toHaveTextContent("30 Lucky");
  });

  it("completes a 1000 Lucky -> ICP swap and clears the form", async () => {
    const swapLuckyToIcp = vi.fn(async (amount: bigint) => ({
      __kind__: "Ok" as const,
      Ok: {
        direction: SwapDirection.LuckyToIcp,
        inputAmount: amount,
        outputAmount: (97n * E8S) / 100n,
        feeLucky: 30n * E8S,
      },
    }));
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 5000n * E8S })),
      swapLuckyToIcp,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.click(await screen.findByTestId("swap.direction.luckyToIcp"));
    await user.type(screen.getByTestId("swap.amount_input"), "1000");
    await user.click(screen.getByTestId("swap.submit_button"));
    await user.click(await screen.findByTestId("swap.confirm_button"));

    await waitFor(() => {
      expect(swapLuckyToIcp).toHaveBeenCalledWith(1000n * E8S);
    });
    // A successful swap resets the amount field.
    await waitFor(() => {
      expect(screen.getByTestId("swap.amount_input")).toHaveValue("");
    });
  });

  it("blocks a Lucky -> ICP swap when the pool lacks ICP", async () => {
    harness.actor = createMockActor({
      // Pool holds only 0.5 ICP, so a 1000 Lucky -> 0.97 ICP swap is blocked.
      getPoolBalances: vi.fn(async () => ({ icp: E8S / 2n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 5000n * E8S })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.click(await screen.findByTestId("swap.direction.luckyToIcp"));
    await user.type(screen.getByTestId("swap.amount_input"), "1000");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "The pool only has 0.5 ICP available. Try a smaller swap.",
    );
    expect(screen.getByTestId("swap.submit_button")).toBeDisabled();
  });

  it("rejects 1500 Lucky as not a multiple of 1000", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 5000n * E8S })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.click(await screen.findByTestId("swap.direction.luckyToIcp"));
    await user.type(screen.getByTestId("swap.amount_input"), "1500");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "Lucky amount must be a multiple of 1,000 Lucky.",
    );
  });

  it("blocks a swap when the pool lacks the target token", async () => {
    harness.actor = createMockActor({
      // Pool holds only 100 Lucky, so a 1 ICP -> 1000 Lucky swap is blocked.
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 100n * E8S })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.type(await screen.findByTestId("swap.amount_input"), "1");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "The pool only has 100 Lucky available. Try a smaller swap.",
    );
    expect(screen.getByTestId("swap.submit_button")).toBeDisabled();
  });

  it("prompts signed-out visitors to sign in", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
    });
    harness.isAuthenticated = false;

    renderSwap();

    expect(await screen.findByTestId("swap.submit_button")).toHaveTextContent(
      "Sign in to swap",
    );
  });

  // Characterization: the pay-coin label row and amount field are the stable
  // anchors the inline balance / Max button will be added to. These assert the
  // surrounding behavior that must not change.
  it("labels the amount field with the selected pay coin", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    // Default direction pays ICP.
    expect(await screen.findByText("You pay (ICP)")).toBeInTheDocument();

    await user.click(screen.getByTestId("swap.direction.luckyToIcp"));
    expect(screen.getByText("You pay (Lucky)")).toBeInTheDocument();
  });

  // Characterization: the exchange-rate note under the amount input is an
  // accepted behavior that must survive the header/drawer redesign. It is
  // wired to the input via aria-describedby and rendered after the field.
  it("keeps the exchange-rate note under the amount input", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
    });
    harness.isAuthenticated = false;

    renderSwap();

    const input = await screen.findByTestId("swap.amount_input");
    const note = document.getElementById("swap-helper");
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent("1 ICP = 1000 Lucky");
    // The note is the input's accessible description...
    expect(input).toHaveAttribute("aria-describedby", "swap-helper");
    // ...and it renders after the input, i.e. underneath it.
    expect(
      input.compareDocumentPosition(note as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps typed input in the amount field and quotes from it", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    const input = await screen.findByTestId("swap.amount_input");
    await user.type(input, "2");

    expect(input).toHaveValue("2");
    expect(screen.getByTestId("swap.quote_output")).toHaveTextContent(
      "2,000 Lucky",
    );
  });

  it("clears the amount when the swap direction changes", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 10n * E8S,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 10n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    const input = await screen.findByTestId("swap.amount_input");
    await user.type(input, "1");
    expect(input).toHaveValue("1");

    await user.click(screen.getByTestId("swap.direction.luckyToIcp"));
    expect(screen.getByTestId("swap.amount_input")).toHaveValue("");
  });

  it("still blocks an amount above the wallet balance", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 1n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await user.type(await screen.findByTestId("swap.amount_input"), "5");

    expect(await screen.findByTestId("swap.error_state")).toHaveTextContent(
      "You only have 1 ICP available.",
    );
    expect(screen.getByTestId("swap.submit_button")).toBeDisabled();
  });

  // New behavior: inline available balance + Max button in the "You pay" row.
  it("shows the selected pay coin balance and fills it with Max", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 0n,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 12n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    // Default direction pays ICP, so the ICP balance is shown once loaded.
    await waitFor(() => {
      expect(screen.getByTestId("swap.available_balance")).toHaveTextContent(
        "Balance: 12 ICP",
      );
    });

    await user.click(screen.getByTestId("swap.max_button"));

    expect(screen.getByTestId("swap.amount_input")).toHaveValue("12");
    // Max fills a valid amount, so the quote reflects it.
    expect(screen.getByTestId("swap.quote_output")).toHaveTextContent(
      "12,000 Lucky",
    );
  });

  it("updates the balance and Max value when the swap direction changes", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({
        icp: 10n * E8S,
        lucky: 1_000_000n * E8S,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({
        icp: 12n * E8S,
        lucky: 5000n * E8S,
      })),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderSwap();

    await waitFor(() => {
      expect(screen.getByTestId("swap.available_balance")).toHaveTextContent(
        "Balance: 12 ICP",
      );
    });

    await user.click(screen.getByTestId("swap.direction.luckyToIcp"));

    // The displayed balance follows the newly selected pay coin.
    await waitFor(() => {
      expect(screen.getByTestId("swap.available_balance")).toHaveTextContent(
        "Balance: 5,000 Lucky",
      );
    });

    await user.click(screen.getByTestId("swap.max_button"));

    // Max fills the Lucky balance, not the stale ICP one.
    expect(screen.getByTestId("swap.amount_input")).toHaveValue("5,000");
  });

  it("hides the balance and Max button when signed out", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getWalletBalances: vi.fn(async () => ({ icp: 12n * E8S, lucky: 0n })),
    });
    harness.isAuthenticated = false;

    renderSwap();

    // Wait for the page to settle, then assert neither control is present.
    expect(await screen.findByTestId("swap.amount_input")).toBeInTheDocument();
    expect(
      screen.queryByTestId("swap.available_balance"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("swap.max_button")).not.toBeInTheDocument();
  });
});
