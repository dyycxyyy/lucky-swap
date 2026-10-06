/**
 * Cover: the re-traced clover mark is four heart-shaped leaves with no stem,
 * and the backend `icrc1:logo` metadata mirrors that exact geometry.
 *
 * The accepted request re-traces `CLOVER_PATH` from four looped petals into
 * four heart-shaped leaves — each a closed subpath, point toward the center,
 * cleft outward — and deletes `STEM_PATH`. The duplicated SVG in
 * `ledger-api.mo` is updated to the same geometry with the stem removed.
 *
 * These tests pin the observable geometry the re-trace must produce:
 *
 *   - the mark is exactly four closed subpaths, each starting at the center
 *     (32, 32), so the leaves point inward and there is no stem;
 *   - the leaves are arranged symmetrically around the center: the drawing's
 *     bounds are mirrored about (32, 32) on both axes;
 *   - the outline contract is unchanged: `fill="none"`, `stroke="currentColor"`,
 *     `stroke-width="3"`, `.mark-vector`, and the 64x64 viewBox;
 *   - the header, drawer, Wallet Lucky token icon, and Swap watermark all render
 *     the updated four-leaf mark;
 *   - the backend `icrc1:logo` SVG path data is byte-for-byte the frontend
 *     mark's path, so the on-chain metadata renders the same clover.
 *
 * The backend actor is a typed local mock; the router is the app's real router.
 * The backend mirror check reads the real Motoko source, and the PocketIC lane
 * exercises the compiled canister's `icrc1_metadata` at runtime.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { CloverMark } from "@/components/CloverMark";
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

/** Split a path `d` into its closed subpaths, each normalized to end in `Z`. */
function closedSubpaths(d: string): string[] {
  return d
    .split("Z")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment}Z`);
}

/** Every absolute coordinate pair in a path made only of `M`/`C` commands. */
function coordinates(d: string): Array<[number, number]> {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    pairs.push([numbers[i], numbers[i + 1]]);
  }
  return pairs;
}

function bounds(d: string) {
  const points = coordinates(d);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Assert a path is four heart-shaped leaves pointing at the center, no stem. */
function expectFourHeartLeaves(d: string) {
  const leaves = closedSubpaths(d);
  // Four leaves, each its own closed outline.
  expect(leaves).toHaveLength(4);
  // Every leaf starts at the center (32, 32): the point of each heart faces in.
  for (const leaf of leaves) {
    expect(leaf.startsWith("M32 32")).toBe(true);
  }
  // No stem: there is no fifth subpath and no `M` other than the four leaves.
  expect(d.match(/M/g) ?? []).toHaveLength(4);
  expect(d.match(/Z/g) ?? []).toHaveLength(4);

  // Symmetric around the center on both axes: the mark is balanced, not a
  // lopsided cluster with a stem hanging off one side.
  const { minX, maxX, minY, maxY } = bounds(d);
  expect(minX + maxX).toBe(64);
  expect(minY + maxY).toBe(64);
  expect(minX).toBeLessThan(32);
  expect(maxX).toBeGreaterThan(32);
  expect(minY).toBeLessThan(32);
  expect(maxY).toBeGreaterThan(32);
}

/** The rendered clover path from a surface's SVG. */
function markPath(svg: Element | null): string {
  const path = svg?.querySelector("path");
  expect(path).not.toBeNull();
  return path?.getAttribute("d") ?? "";
}

beforeEach(() => {
  resetHarness();
  window.history.pushState({}, "", "/");
});

describe("CloverMark heart-leaf geometry", () => {
  it("draws four heart-shaped leaves pointing at the center with no stem", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    expectFourHeartLeaves(markPath(svg));
  });

  it("keeps the outline contract: unfilled, currentColor, 3-unit stroke, 64x64", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 64 64");

    const outline = svg?.querySelector("g");
    expect(outline).not.toBeNull();
    expect(outline?.getAttribute("fill")).toBe("none");
    expect(outline?.getAttribute("stroke")).toBe("currentColor");
    expect(outline?.getAttribute("stroke-width")).toBe("3");
    expect(outline?.classList.contains("mark-vector")).toBe(true);
  });
});

describe("Heart-leaf mark on every surface", () => {
  it("renders the four-leaf mark in the header and drawer", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    expectFourHeartLeaves(markPath(brand.querySelector("svg")));

    await user.click(await screen.findByTestId("nav.menu_button"));
    const sheet = await screen.findByTestId("nav.sheet");
    expectFourHeartLeaves(markPath(sheet.querySelector("svg")));
  });

  it("renders the four-leaf mark as the Wallet Lucky token icon", async () => {
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
    expectFourHeartLeaves(markPath(luckyOption.querySelector("svg")));
  });

  it("renders the four-leaf mark as the Swap watermark", async () => {
    mockActor();

    renderApp();

    const poolCard = await screen.findByTestId("swap.pool_card");
    const watermark = poolCard.querySelector('svg[aria-hidden="true"]');
    expectFourHeartLeaves(markPath(watermark));
  });
});

describe("Backend icrc1:logo mirrors the frontend mark", () => {
  it("uses the same four-leaf, no-stem path data as CloverMark", () => {
    const { container } = render(<CloverMark />);
    const frontendPath = markPath(container.querySelector("svg"));

    // Read the real Motoko source so a divergence between the on-chain logo and
    // the app's mark is visible here, not only in a wallet.
    const ledgerApi = readFileSync(
      join(process.cwd(), "..", "backend", "mixins", "ledger-api.mo"),
      "utf8",
    );
    const logoPath = /d='([^']+)'/.exec(ledgerApi)?.[1];
    expect(logoPath).toBeDefined();

    // The on-chain SVG is the same clover: four heart leaves, no stem.
    expectFourHeartLeaves(logoPath ?? "");
    // And it is byte-for-byte the frontend geometry (whitespace-insensitive).
    const normalize = (value: string) => value.replace(/\s+/g, "");
    expect(normalize(logoPath ?? "")).toBe(normalize(frontendPath));
  });
});
