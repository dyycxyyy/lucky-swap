/**
 * Cover: the gold-outline clover contract on every brand-mark surface.
 *
 * The accepted request fixes the brand mark to a single transparent-background,
 * gold-outline four-leaf clover and requires it to look the same in the header
 * brand link, the drawer brand area, the Wallet Lucky token icon, and the Swap
 * watermark. These tests pin the observable surface contract that the existing
 * component-level tests do not:
 *
 *   - each surface mark is the outline clover: a `g.mark-vector` group with
 *     `fill="none"` and `stroke="currentColor"`, and no filled shape;
 *   - the header, drawer, and Wallet marks carry the theme-aware
 *     `text-mark-gold` color utility, so the stroke is gold in both themes;
 *   - the Swap watermark is the 112px decorative mark, aria-hidden and
 *     non-interactive;
 *   - the `--mark-gold` token is overridden for the dark theme, so the stroke
 *     stays gold rather than muddy on the dark canvas.
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

/** Assert an element is the transparent-background gold-outline clover. */
function expectOutlineClover(svg: Element | null) {
  expect(svg).not.toBeNull();
  const outline = svg?.querySelector("g.mark-vector");
  expect(outline).not.toBeNull();
  expect(outline?.getAttribute("fill")).toBe("none");
  expect(outline?.getAttribute("stroke")).toBe("currentColor");
  // Nothing is filled: the mark is traced, not painted.
  expect(svg?.querySelector('[fill]:not([fill="none"])')).toBeNull();
  expect(svg?.querySelector("rect")).toBeNull();
}

beforeEach(() => {
  resetHarness();
  window.history.pushState({}, "", "/");
});

describe("Gold-outline mark surfaces", () => {
  it("renders the header brand mark as a gold-outline clover", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    const mark = brand.querySelector("svg");
    expectOutlineClover(mark);
    // The mark inherits the theme-aware gold stroke token.
    expect(mark?.classList.contains("text-mark-gold")).toBe(true);
  });

  it("renders the drawer brand mark as a gold-outline clover", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const sheet = await screen.findByTestId("nav.sheet");
    const mark = sheet.querySelector("svg");
    expectOutlineClover(mark);
    expect(mark?.classList.contains("text-mark-gold")).toBe(true);
  });

  it("renders the Wallet Lucky token icon as a gold-outline clover", async () => {
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

    const luckyOption = await screen.findByRole("option", { name: /Lucky/ });
    const mark = luckyOption.querySelector("svg");
    expectOutlineClover(mark);
    expect(mark?.classList.contains("text-mark-gold")).toBe(true);
  });

  it("renders the Swap watermark as the 112px decorative gold-outline clover", async () => {
    mockActor();

    renderApp();

    const poolCard = await screen.findByTestId("swap.pool_card");
    const watermark = poolCard.querySelector('svg[aria-hidden="true"]');
    expectOutlineClover(watermark);
    // The watermark is the large hero mark, scaled to 112px.
    expect(watermark).toHaveAttribute("width", "112");
    expect(watermark).toHaveAttribute("height", "112");
    // Decorative: no role, no title, and no interactive descendants.
    expect(watermark).not.toHaveAttribute("role");
    expect(watermark?.querySelector("title")).toBeNull();
    expect(watermark?.querySelector("button, a, input")).toBeNull();
  });
});

describe("Theme-aware gold token", () => {
  it("overrides --mark-gold for the dark theme so the stroke stays gold", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

    // The light theme defines the token...
    expect(css).toMatch(/--mark-gold:\s*[\d.]+\s+[\d.]+\s+[\d.]+/);
    // ...and the dark theme overrides it, so the outline is not the same
    // low-lightness gold that would read as muddy brown on the dark canvas.
    const darkBlock = /\.dark\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    expect(darkBlock).toMatch(/--mark-gold:\s*[\d.]+\s+[\d.]+\s+[\d.]+/);
  });
});
