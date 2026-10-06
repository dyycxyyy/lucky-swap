/**
 * Characterization: the CloverMark component contract that must survive the
 * deferred mark work (stroke-draw animation and multiple gold-outline
 * variants).
 *
 * The accepted request intentionally changes two things about the mark:
 *
 *   - the `icrc1:logo` token metadata value (emoji -> data-URI SVG), and
 *   - the exact CloverMark path geometry, which may be refined to match the
 *     reference clover shape.
 *
 * Neither of those is frozen here. What is pinned is the surrounding contract
 * the animation/variants work must not break:
 *
 *   - the mark is a transparent-background vector: the outline group paints
 *     with `currentColor` and carries no baked fill or background;
 *   - the outline group uses the shared `.mark-vector` utility, which keeps
 *     stroke weight optically constant via `vector-effect: non-scaling-stroke`;
 *   - the mark is decorative (aria-hidden, no role) when no title is given and
 *     becomes a labelled `img` when a title is given;
 *   - the `--mark-gold` token and its `.text-mark-gold` utility remain the
 *     theme-aware color source every mark surface relies on.
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

describe("CloverMark vector contract", () => {
  it("renders a transparent-background outline that paints with currentColor", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // The outline group is the element that carries the drawing. It must not
    // bake a fill or a background: the mark is a transparent-background
    // outline, so the leaves are traced rather than filled.
    const outline = svg?.querySelector("g");
    expect(outline).not.toBeNull();
    expect(outline?.getAttribute("fill")).toBe("none");
    expect(outline?.getAttribute("stroke")).toBe("currentColor");

    // The mark itself must not paint a background rect or a filled shape.
    expect(svg?.querySelector("rect")).toBeNull();
    expect(svg?.querySelector('[fill]:not([fill="none"])')).toBeNull();
  });

  it("keeps the outline on the shared non-scaling-stroke utility", () => {
    const { container } = render(<CloverMark />);

    // `.mark-vector` is what keeps a 2-3px stroke optically constant when the
    // mark is scaled to 16-24px; the animation/variants work must keep using
    // it rather than inlining a raw stroke width.
    const outline = container.querySelector("svg g");
    expect(outline?.classList.contains("mark-vector")).toBe(true);
  });

  it("stays decorative when no title is given", () => {
    const { container } = render(<CloverMark />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg?.querySelector("title")).toBeNull();
  });

  it("becomes a labelled image when a title is given", () => {
    render(<CloverMark title="Lucky clover" />);

    const img = screen.getByRole("img", { name: "Lucky clover" });
    expect(img).not.toHaveAttribute("aria-hidden");
    expect(img.querySelector("title")).toHaveTextContent("Lucky clover");
  });

  it("honours the size prop on the rendered square", () => {
    const { container } = render(<CloverMark size={40} />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "40");
    expect(svg).toHaveAttribute("height", "40");
  });
});

describe("Mark color token", () => {
  it("keeps the theme-aware --mark-gold token and its text utility", async () => {
    // The token is the single color source for every mark surface. Read the
    // real stylesheet rather than a fixture so a regression is visible.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

    // Defined for the light theme and overridden for dark.
    expect(css).toMatch(/--mark-gold:\s*[\d.]+\s+[\d.]+\s+[\d.]+/);
    expect(css).toMatch(
      /\.text-mark-gold\s*\{[^}]*color:\s*oklch\(var\(--mark-gold\)\)/,
    );
    // The non-scaling-stroke utility the outline group depends on.
    expect(css).toMatch(
      /\.mark-vector\s*\{[^}]*vector-effect:\s*non-scaling-stroke/,
    );
  });
});

describe("Mark surfaces stay wired to the fixed mark", () => {
  it("renders the clover in the header and drawer brand marks", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    const headerMark = brand.querySelector("svg");
    expect(headerMark).not.toBeNull();
    expect(headerMark?.querySelector("g.mark-vector")).not.toBeNull();

    // The drawer brand header carries the same fixed mark.
    const sheet = await screen.findByTestId("nav.sheet");
    expect(sheet.querySelector("svg g.mark-vector")).not.toBeNull();
  });
});
