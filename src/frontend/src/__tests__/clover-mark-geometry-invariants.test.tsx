/**
 * Characterization: the CloverMark geometry *frame* that must survive the
 * planned re-trace of the clover path.
 *
 * The accepted request intentionally changes the mark's geometry: `CLOVER_PATH`
 * is re-traced from four looped petals into four heart-shaped leaves, and
 * `STEM_PATH` is removed. Neither the exact path string nor the presence of a
 * stem is frozen here — those are the intentionally changing behavior.
 *
 * What is pinned is the surrounding frame the re-trace must not disturb:
 *
 *   - the mark keeps the shared 64x64 viewBox grid, so every surface's size
 *     prop still maps to the same drawing;
 *   - the outline group keeps its 3-unit stroke width and the `.mark-vector`
 *     utility, so stroke weight stays optically constant at 16-24px;
 *   - the mark stays a single transparent-background outline group with no
 *     filled shape and no background rect;
 *   - the `--mark-stroke-*` viewBox-unit tokens remain defined for the grid.
 *
 * The backend actor is a typed local mock; the router is the app's real router.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

beforeEach(() => {
  resetHarness();
  window.history.pushState({}, "", "/");
});

describe("CloverMark geometry frame", () => {
  it("keeps the shared 64x64 viewBox grid", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
  });

  it("keeps the outline group's 3-unit stroke width and round joins", () => {
    const { container } = render(<CloverMark />);

    const outline = container.querySelector("svg g");
    expect(outline).not.toBeNull();
    // The re-trace may change the path data, but the stroke weight and the
    // shared utility that keeps it optically constant must not change.
    expect(outline?.getAttribute("stroke-width")).toBe("3");
    expect(outline?.classList.contains("mark-vector")).toBe(true);
  });

  it("stays a single transparent-background outline with no filled shape", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    // Exactly one drawing group: the mark is one traced silhouette, not a
    // stack of layered or filled shapes.
    expect(svg?.querySelectorAll("g")).toHaveLength(1);
    expect(svg?.querySelector("rect")).toBeNull();
    expect(svg?.querySelector('[fill]:not([fill="none"])')).toBeNull();
  });

  it("keeps the viewBox-unit stroke tokens defined for the 64x64 grid", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

    expect(css).toMatch(/--mark-stroke-hair:\s*2/);
    expect(css).toMatch(/--mark-stroke-regular:\s*3/);
    expect(css).toMatch(/--mark-stroke-bold:\s*4/);
  });
});

describe("Geometry frame on the rendered surfaces", () => {
  it("keeps the header and drawer marks on the shared grid", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    const headerMark = brand.querySelector("svg");
    expect(headerMark).toHaveAttribute("viewBox", "0 0 64 64");
    expect(headerMark?.querySelector("g")?.getAttribute("stroke-width")).toBe(
      "3",
    );

    const sheet = await screen.findByTestId("nav.sheet");
    const drawerMark = sheet.querySelector("svg");
    expect(drawerMark).toHaveAttribute("viewBox", "0 0 64 64");
    expect(drawerMark?.querySelector("g")?.getAttribute("stroke-width")).toBe(
      "3",
    );
  });

  it("keeps the Swap watermark on the shared grid at 112px", async () => {
    mockActor();

    renderApp();

    const poolCard = await screen.findByTestId("swap.pool_card");
    const watermark = poolCard.querySelector('svg[aria-hidden="true"]');
    expect(watermark).toHaveAttribute("viewBox", "0 0 64 64");
    expect(watermark).toHaveAttribute("width", "112");
    expect(watermark?.querySelector("g")?.getAttribute("stroke-width")).toBe(
      "3",
    );
  });
});
