/**
 * Wallet page journeys.
 *
 * The backend actor is a typed local mock. The page shows balances and a
 * copyable principal, and sends tokens to an external principal.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Movement } from "@/backend";
import { MovementDirection, MovementSource, UserRole } from "@/backend";
import WalletPage from "@/pages/Wallet";
import { createMockActor, harness, resetHarness } from "@/test/harness";
import { Principal } from "@icp-sdk/core/principal";

// The Wallet ICP send approves the backend canister as an ICP spender before
// calling `sendIcp`. Mock the ICP ledger actor so that path can run locally and
// so the approval arguments and ordering can be asserted.
interface ApproveArgs {
  amount: bigint;
  spender: { owner: { toText: () => string } };
}
const approveMock = vi.fn(async (_args: ApproveArgs) => ({ Ok: 0n }));
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
/** ICP ledger transfer fee, in e8s, charged against the spender's allowance. */
const ICP_LEDGER_FEE = 10_000n;
const MY_PRINCIPAL = Principal.fromText("aaaaa-aa");
const RECIPIENT = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
/** The backend canister id returned by the mocked `loadConfig`. */
const BACKEND_CANISTER_ID = "aaaaa-aa";

function renderWallet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WalletPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
  approveMock.mockClear();
});

describe("Wallet page", () => {
  it("shows the user's ICP and Lucky balances and a copyable principal", async () => {
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({
        icp: 2n * E8S,
        lucky: 1500n * E8S,
      })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
    });
    harness.isAuthenticated = true;

    renderWallet();

    expect(await screen.findByTestId("wallet.icp_balance")).toHaveTextContent(
      "2",
    );
    expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent(
      "1,500",
    );
    expect(screen.getByTestId("wallet.principal_text")).toHaveTextContent(
      "aaaaa-aa",
    );
    expect(screen.getByTestId("wallet.copy_button")).toBeEnabled();
  });

  it("copies the principal address to the clipboard", async () => {
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
    });
    harness.isAuthenticated = true;

    // `userEvent.setup()` always installs its own `navigator.clipboard` stub,
    // replacing any stub defined beforehand. Spy on the installed stub so the
    // component's `navigator.clipboard.writeText` call is observed.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderWallet();

    // The copy button is disabled until the principal query resolves.
    await waitFor(() => {
      expect(screen.getByTestId("wallet.copy_button")).toBeEnabled();
    });
    await user.click(screen.getByTestId("wallet.copy_button"));

    expect(writeText).toHaveBeenCalledWith("aaaaa-aa");
    expect(await screen.findByTestId("wallet.copy_success")).toHaveTextContent(
      "Address copied to clipboard.",
    );
  });

  it("sends Lucky to an external principal and shows a success message", async () => {
    const sendLucky = vi.fn(async () => ({ __kind__: "Ok" as const, Ok: 0n }));
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 100n * E8S })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      sendLucky,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderWallet();

    // Switch the token selector from the default ICP to Lucky.
    await user.click(await screen.findByTestId("wallet.token_select"));
    await user.click(await screen.findByRole("option", { name: /Lucky/ }));

    await user.type(
      screen.getByTestId("wallet.recipient_input"),
      RECIPIENT.toText(),
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "10");
    await user.click(screen.getByTestId("wallet.send_button"));

    await waitFor(() => {
      expect(sendLucky).toHaveBeenCalledWith(RECIPIENT, 10n * E8S);
    });
    expect(await screen.findByTestId("wallet.success_state")).toHaveTextContent(
      "Sent 10 Lucky to",
    );
  });

  // Accepted behavior: the ICP send approves the backend canister as an ICP
  // spender for amount + fee before calling `sendIcp`, then reports success.
  it("approves the backend spender for amount + fee before sending ICP", async () => {
    const sendIcp = vi.fn(async () => ({ __kind__: "Ok" as const, Ok: 0n }));
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 100n * E8S, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      sendIcp,
    });
    harness.isAuthenticated = true;
    harness.identity = {
      getPrincipal: () => ({ toText: () => "aaaaa-aa" }),
    };

    const user = userEvent.setup();
    renderWallet();

    // ICP is the default token, so no selector interaction is needed.
    await user.type(
      await screen.findByTestId("wallet.recipient_input"),
      RECIPIENT.toText(),
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "10");
    await user.click(screen.getByTestId("wallet.send_button"));

    await waitFor(() => {
      expect(sendIcp).toHaveBeenCalledWith(RECIPIENT, 10n * E8S);
    });

    // The approval covers the send amount plus the 10_000 e8s ledger fee and
    // names the backend canister as the spender.
    expect(approveMock).toHaveBeenCalledTimes(1);
    const approvalArgs = approveMock.mock.calls[0][0];
    expect(approvalArgs.amount).toBe(10n * E8S + ICP_LEDGER_FEE);
    expect(approvalArgs.spender.owner.toText()).toBe(BACKEND_CANISTER_ID);

    // The approval must complete before the backend pull is attempted.
    const approvalOrder = approveMock.mock.invocationCallOrder[0];
    const sendOrder = sendIcp.mock.invocationCallOrder[0];
    expect(approvalOrder).toBeLessThan(sendOrder);

    expect(await screen.findByTestId("wallet.success_state")).toHaveTextContent(
      "Sent 10 ICP to",
    );
  });

  // Accepted behavior: the approval is specific to the ICP path. A Lucky send
  // must not touch the ICP ledger at all.
  it("does not approve an ICP spender when sending Lucky", async () => {
    const sendLucky = vi.fn(async () => ({ __kind__: "Ok" as const, Ok: 0n }));
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 100n * E8S })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      sendLucky,
    });
    harness.isAuthenticated = true;
    harness.identity = {
      getPrincipal: () => ({ toText: () => "aaaaa-aa" }),
    };

    const user = userEvent.setup();
    renderWallet();

    await user.click(await screen.findByTestId("wallet.token_select"));
    await user.click(await screen.findByRole("option", { name: /Lucky/ }));
    await user.type(
      screen.getByTestId("wallet.recipient_input"),
      RECIPIENT.toText(),
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "10");
    await user.click(screen.getByTestId("wallet.send_button"));

    await waitFor(() => {
      expect(sendLucky).toHaveBeenCalledWith(RECIPIENT, 10n * E8S);
    });
    expect(approveMock).not.toHaveBeenCalled();
  });

  // Characterization: a backend send failure still surfaces as an error and
  // does not show a success message.
  it("surfaces a backend send error", async () => {
    const sendIcp = vi.fn(async () => ({
      __kind__: "Err" as const,
      Err: {
        __kind__: "InsufficientFunds" as const,
        InsufficientFunds: { available: 1n * E8S, required: 10n * E8S },
      },
    }));
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 1n * E8S, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      sendIcp,
    });
    harness.isAuthenticated = true;
    harness.identity = {
      getPrincipal: () => ({ toText: () => "aaaaa-aa" }),
    };

    const user = userEvent.setup();
    renderWallet();

    await user.type(
      await screen.findByTestId("wallet.recipient_input"),
      RECIPIENT.toText(),
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "10");
    await user.click(screen.getByTestId("wallet.send_button"));

    expect(await screen.findByTestId("wallet.error_state")).toHaveTextContent(
      "You only have 1 available.",
    );
    expect(
      screen.queryByTestId("wallet.success_state"),
    ).not.toBeInTheDocument();
  });

  // Characterization: client-side validation rejects a zero amount before any
  // backend call is made.
  it("rejects a zero amount without calling the backend", async () => {
    const sendIcp = vi.fn(async () => ({ __kind__: "Ok" as const, Ok: 0n }));
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 100n * E8S, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      sendIcp,
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderWallet();

    await user.type(
      await screen.findByTestId("wallet.recipient_input"),
      RECIPIENT.toText(),
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "0");
    await user.click(screen.getByTestId("wallet.send_button"));

    expect(await screen.findByTestId("wallet.error_state")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(sendIcp).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipient principal", async () => {
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 100n * E8S })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderWallet();

    await user.type(
      await screen.findByTestId("wallet.recipient_input"),
      "not-a-principal",
    );
    await user.type(screen.getByTestId("wallet.amount_input"), "10");
    await user.click(screen.getByTestId("wallet.send_button"));

    expect(await screen.findByTestId("wallet.error_state")).toHaveTextContent(
      "That is not a valid Principal address.",
    );
  });

  it("shows a sign-in prompt when signed out", async () => {
    harness.isAuthenticated = false;

    renderWallet();

    expect(
      await screen.findByTestId("wallet.sign_in_button"),
    ).toHaveTextContent("Sign in with Internet Identity");
  });

  it("lets the signed-out card text wrap to the card width instead of collapsing", async () => {
    harness.isAuthenticated = false;

    renderWallet();

    const card = await screen.findByTestId("wallet.signed_out_card");
    const title = screen.getByText("Sign in to view your wallet");
    const description = screen.getByText(
      /Connect with Internet Identity to see your ICP and Lucky balances/,
    );

    // The card itself must not center its flex children, which collapsed the
    // description into a one-word-per-line column at narrow widths.
    expect(card).not.toHaveClass("items-center");

    // The description is allowed to use the full card width and balance its
    // line breaks rather than wrapping at a single word.
    expect(description).toHaveClass("max-w-prose");
    expect(description).toHaveClass("text-balance");

    // The title and description are both present and readable.
    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  // --- Game activity: prize payouts credited by the integration ------------

  function gameMovement(overrides: Partial<Movement> = {}): Movement {
    return {
      gameEventId: "event-1",
      source: MovementSource.PrizePayout,
      direction: MovementDirection.In,
      amount: 12n * E8S,
      counterparty: MY_PRINCIPAL,
      timestamp: 1_700_000_000_000_000_000n,
      ...overrides,
    };
  }

  it("shows prize payouts credited to the user's wallet", async () => {
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 12n * E8S })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      listMovements: vi.fn(async () => [
        gameMovement({
          gameEventId: "payout-1001",
          source: MovementSource.PrizePayout,
          direction: MovementDirection.In,
          amount: 12n * E8S,
        }),
      ]),
    });
    harness.isAuthenticated = true;

    renderWallet();

    const item = await screen.findByTestId("wallet.game_activity.item.1");
    expect(item).toHaveTextContent("Prize payout");
    expect(item).toHaveTextContent("payout-1001");
    expect(item).toHaveTextContent("+12");
    expect(screen.getByTestId("wallet.total_prizes")).toHaveTextContent("12");
  });

  it("ignores other users' movements and non-game sources", async () => {
    const other = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      listMovements: vi.fn(async () => [
        // Another user's payout must not appear in this wallet.
        gameMovement({
          gameEventId: "other-payout",
          counterparty: other,
          amount: 99n * E8S,
        }),
        // A treasury intake is not wallet game activity.
        gameMovement({
          gameEventId: "sweep-1",
          source: MovementSource.ExcessSweep,
          counterparty: MY_PRINCIPAL,
          amount: 50n * E8S,
        }),
      ]),
    });
    harness.isAuthenticated = true;

    renderWallet();

    expect(
      await screen.findByTestId("wallet.game_activity.empty_state"),
    ).toHaveTextContent("No game activity yet");
    expect(screen.queryByTestId("wallet.game_activity.item.1")).toBeNull();
  });

  it("shows an empty game-activity state when the user has no movements", async () => {
    harness.actor = createMockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => MY_PRINCIPAL),
      getCallerUserRole: vi.fn(async () => UserRole.user),
      listMovements: vi.fn(async () => []),
    });
    harness.isAuthenticated = true;

    renderWallet();

    expect(
      await screen.findByTestId("wallet.game_activity.empty_state"),
    ).toHaveTextContent("No game activity yet");
  });
});
