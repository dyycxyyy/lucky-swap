/**
 * Cover: route-tree and brand-mark invariants after the logo-selection feature
 * was removed.
 *
 * The accepted request deletes the `/logo` picker route and fixes the brand
 * mark to a single vector clover. These tests pin the surrounding contract:
 *
 *   - the existing Swap and Wallet routes still render when deep-linked by URL,
 *     not only when reached through the drawer;
 *   - the removed `/logo` route no longer resolves to a picker page;
 *   - the header and drawer brand marks stay decorative (aria-hidden) and
 *     contain no interactive controls, so the fixed artwork cannot turn the
 *     mark into a focusable or clickable element;
 *   - the Wallet token selector still offers both ICP and Lucky.
 *
 * The backend actor is a typed local mock; the router is the app's real router.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { createMockActor, harness, resetHarness } from "@/test/harness";

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

function mockActor(overrides: Parameters<typeof createMockActor>[0] = {}) {
  harness.actor = createMockActor({
    getPoolBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
    getTreasuryBalance: vi.fn(async () => 0n),
    ...overrides,
  });
}

beforeEach(() => {
  resetHarness();
  window.history.pushState({}, "", "/");
});

describe("Route tree integrity", () => {
  it("renders the Swap page when deep-linked to /swap", async () => {
    mockActor();
    window.history.pushState({}, "", "/swap");

    renderApp();

    expect(await screen.findByTestId("swap.page")).toBeInTheDocument();
  });

  it("renders the Wallet page when deep-linked to /wallet", async () => {
    mockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => null),
      getCallerUserRole: vi.fn(async () => "user"),
    });
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/wallet");

    renderApp();

    expect(await screen.findByTestId("wallet.page")).toBeInTheDocument();
  });

  it("keeps the app shell mounted on an unknown path instead of a blank screen", async () => {
    mockActor();
    window.history.pushState({}, "", "/not-a-real-route");

    renderApp();

    // The header chrome is part of the root layout and must render regardless
    // of which child route matches, so an unmatched path cannot blank the app.
    expect(await screen.findByTestId("nav.brand_link")).toBeInTheDocument();
    expect(screen.getByTestId("nav.menu_button")).toBeInTheDocument();
  });

  it("no longer resolves the removed /logo route to a picker page", async () => {
    mockActor();
    window.history.pushState({}, "", "/logo");

    renderApp();

    // The picker page and its concept cards are gone; the shell still mounts.
    expect(await screen.findByTestId("nav.brand_link")).toBeInTheDocument();
    expect(screen.queryByTestId("logo.page")).toBeNull();
    expect(screen.queryByTestId("logo.item.1")).toBeNull();
  });
});

describe("Decorative brand marks", () => {
  it("keeps the header brand mark decorative and non-interactive", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    // The mark is the aria-hidden element inside the brand link; it must not
    // itself contain a control that could steal focus or intercept clicks.
    const mark = brand.querySelector('[aria-hidden="true"]');
    expect(mark).not.toBeNull();
    expect(
      mark?.querySelector("button, a, input, select, textarea"),
    ).toBeNull();
    // The wordmark and the link target remain intact alongside the mark.
    expect(brand).toHaveTextContent("Lucky Swap");
  });

  it("keeps the drawer brand mark decorative and non-interactive", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const sheet = await screen.findByTestId("nav.sheet");
    const mark = sheet.querySelector('[aria-hidden="true"]');
    expect(mark).not.toBeNull();
    expect(
      mark?.querySelector("button, a, input, select, textarea"),
    ).toBeNull();
    expect(sheet).toHaveTextContent("Lucky Swap");
  });
});

describe("Wallet token selector contract", () => {
  it("still offers both ICP and Lucky", async () => {
    mockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => null),
      getCallerUserRole: vi.fn(async () => "user"),
    });
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("wallet.token_select"));

    expect(
      await screen.findByRole("option", { name: /ICP/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Lucky/ })).toBeInTheDocument();
  });
});
