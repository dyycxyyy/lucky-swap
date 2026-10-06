/**
 * Cover: the fixed single-vector clover brand mark across its surfaces.
 *
 * The accepted request removes the logo-selection feature and fixes the brand
 * mark to one vector clover (Concept 1, gold outline) everywhere. These tests
 * pin the observable contract:
 *
 *   - the header brand link carries the "Lucky Swap" wordmark, renders the
 *     clover SVG, and navigates to the Swap home page;
 *   - the drawer brand header carries the wordmark and the clover SVG;
 *   - the Swap hero watermark renders the clover and stays decorative
 *     (aria-hidden, non-interactive) so it cannot intercept clicks or pollute
 *     the accessibility tree;
 *   - the Wallet token selector still offers the Lucky token with the clover
 *     icon.
 *
 * The backend actor is a typed local mock; the router is the app's real router.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("Brand mark surfaces", () => {
  it("renders the fixed clover mark and wordmark in the header brand link", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    expect(brand).toHaveTextContent("Lucky Swap");
    // The fixed vector clover is the only mark; no picker or alternate artwork.
    const mark = brand.querySelector("svg");
    expect(mark).not.toBeNull();
    expect(mark?.querySelector("path")).not.toBeNull();
  });

  it("renders the fixed clover mark and wordmark in the drawer brand header", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const sheet = await screen.findByTestId("nav.sheet");
    expect(sheet).toHaveTextContent("Lucky Swap");
    expect(sheet.querySelector("svg")).not.toBeNull();
  });

  it("keeps the header brand link pointing at the Swap home page", async () => {
    mockActor();
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    await user.click(brand);

    expect(await screen.findByTestId("swap.page")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/swap");
    });
  });

  it("keeps the Swap hero watermark decorative and non-interactive", async () => {
    mockActor();

    renderApp();

    const poolCard = await screen.findByTestId("swap.pool_card");
    // The watermark is the decorative aria-hidden clover SVG inside the hero
    // card; it must not become a focusable or clickable control.
    const watermark = poolCard.querySelector('svg[aria-hidden="true"]');
    expect(watermark).not.toBeNull();
    expect(watermark?.querySelector("path")).not.toBeNull();
    expect(watermark?.querySelector("button, a, input")).toBeNull();
    // The hero's real content is still present alongside the watermark.
    expect(screen.getByTestId("swap.pool_lucky")).toBeInTheDocument();
    expect(screen.getByTestId("swap.pool_icp")).toBeInTheDocument();
  });

  it("keeps the Lucky token available in the Wallet token selector", async () => {
    mockActor({
      getWalletBalances: vi.fn(async () => ({ icp: 0n, lucky: 0n })),
      getMyPrincipal: vi.fn(async () => null),
      getCallerUserRole: vi.fn(async () => "user"),
    });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderApp();
    window.history.pushState({}, "", "/wallet");

    await user.click(await screen.findByTestId("nav.menu_button"));
    await user.click(await screen.findByTestId("nav.wallet_tab"));

    await user.click(await screen.findByTestId("wallet.token_select"));

    const luckyOption = await screen.findByRole("option", { name: /Lucky/ });
    expect(luckyOption).toBeInTheDocument();
    // The Lucky token carries the fixed clover icon.
    expect(luckyOption.querySelector("svg")).not.toBeNull();
  });
});
