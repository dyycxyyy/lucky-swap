/**
 * App shell journeys: default route, left-drawer navigation, and the admin-only
 * Treasury guard.
 *
 * The backend actor is a typed local mock. The router is the app's real router,
 * so these are integration tests over the actual route tree.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { createMockActor, harness, resetHarness } from "@/test/harness";
import { Principal } from "@icp-sdk/core/principal";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetHarness();
  window.history.pushState({}, "", "/");
});

describe("App shell", () => {
  it("loads the Swap page on the default route without a blank screen", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
    });

    renderApp();

    expect(await screen.findByTestId("swap.page")).toBeInTheDocument();
    expect(screen.getByTestId("swap.pool_card")).toBeInTheDocument();
  });

  it("opens the drawer from the header hamburger and lists Swap and Wallet", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    expect(await screen.findByTestId("nav.swap_tab")).toBeInTheDocument();
    expect(screen.getByTestId("nav.wallet_tab")).toBeInTheDocument();
    // Non-admins do not see the Treasury item.
    expect(screen.queryByTestId("nav.treasury_tab")).toBeNull();
  });

  it("navigates to the Wallet page from the drawer and closes it", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
    });
    harness.isAuthenticated = false;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));
    await user.click(await screen.findByTestId("nav.wallet_tab"));

    expect(await screen.findByTestId("wallet.page")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("nav.menu_button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  it("shows the Treasury item to an admin in the drawer", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    expect(await screen.findByTestId("nav.treasury_tab")).toBeInTheDocument();
  });

  it("keeps the drawer navigation usable on a mobile viewport", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    window.dispatchEvent(new Event("resize"));

    try {
      harness.actor = createMockActor({
        getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
        getTreasuryBalance: vi.fn(async () => 0n),
      });

      const user = userEvent.setup();
      renderApp();

      await user.click(await screen.findByTestId("nav.menu_button"));

      const nav = await screen.findByRole("navigation", { name: "Primary" });
      expect(nav).toBeInTheDocument();
      expect(screen.getByTestId("nav.swap_tab")).toBeInTheDocument();
      expect(screen.getByTestId("nav.wallet_tab")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalWidth,
      });
      window.dispatchEvent(new Event("resize"));
    }
  });

  it("redirects a non-admin away from the Treasury route", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      isCallerAdmin: vi.fn(async () => false),
    });
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/treasury");

    renderApp();

    // The guard redirects to /swap, so the Swap page renders instead.
    await waitFor(() => {
      expect(screen.getByTestId("swap.page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("treasury.page")).toBeNull();
  });

  it("renders the Integration guide on its public route", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => Principal.fromText("aaaaa-aa")),
      listMovements: vi.fn(async () => []),
    });
    window.history.pushState({}, "", "/integration");

    renderApp();
    // The app router is a module singleton whose history listener attaches on
    // mount; notify it of the deep link after render so the public Integration
    // route matches instead of the location left over from an earlier test.
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(await screen.findByTestId("integration.page")).toBeInTheDocument();
  });

  it("renders the Funding page for an admin on /treasury/funding", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getTreasuryPrincipal: vi.fn(async () => Principal.fromText("aaaaa-aa")),
      listMovements: vi.fn(async () => []),
      isCallerAdmin: vi.fn(async () => true),
    });
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/treasury/funding");

    renderApp();

    expect(await screen.findByTestId("funding.page")).toBeInTheDocument();
  });

  it("redirects a non-admin away from the Funding route", async () => {
    harness.actor = createMockActor({
      getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getTreasuryBalance: vi.fn(async () => 0n),
      isCallerAdmin: vi.fn(async () => false),
    });
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/treasury/funding");

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("swap.page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("funding.page")).toBeNull();
  });
});
