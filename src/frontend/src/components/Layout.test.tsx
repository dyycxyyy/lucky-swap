/**
 * Navigation-shell tests for the right slide-out drawer.
 *
 * These protect the navigation contract of the drawer redesign: the header
 * hamburger sits at the top-right and opens the drawer, the drawer slides in
 * from the right edge, it lists every visible nav item with an icon, name, and
 * one-line description, the admin-only Treasury rule holds, selecting an item
 * navigates and closes the drawer, and the drawer dismisses on Escape or an
 * overlay click. The header brand link and the "Primary" navigation landmark
 * are preserved, and the header no longer carries the exchange-rate badge.
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

describe("Navigation shell", () => {
  it("keeps the header brand link and returns to the Swap home page", async () => {
    mockActor();
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    // The brand link lives in the header regardless of the nav chrome.
    const brand = await screen.findByTestId("nav.brand_link");
    expect(brand).toBeInTheDocument();

    await user.click(brand);

    expect(await screen.findByTestId("swap.page")).toBeInTheDocument();
  });

  it("opens the drawer from the header hamburger button", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    const menuButton = await screen.findByTestId("nav.menu_button");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByTestId("nav.sheet")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  });

  it("anchors the header hamburger to the top-right of the header", async () => {
    mockActor();

    renderApp();

    const menuButton = await screen.findByTestId("nav.menu_button");
    // The hamburger is pushed to the right edge of the header row, on the same
    // side as the drawer, rather than sitting next to the brand on the left.
    expect(menuButton.className).toContain("ml-auto");
  });

  it("slides the drawer in from the right edge", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    const sheet = await screen.findByTestId("nav.sheet");
    // Closed: the drawer is anchored to the right and translated off-screen to
    // the right, so it is hidden past the right edge.
    expect(sheet.className).toContain("right-0");
    expect(sheet.className).toContain("translate-x-full");
    expect(sheet.className).not.toContain("translate-x-0");

    await user.click(screen.getByTestId("nav.menu_button"));

    // Open: the drawer slides to its resting position at the right edge.
    await waitFor(() => {
      expect(screen.getByTestId("nav.sheet").className).toContain(
        "translate-x-0",
      );
    });
    expect(screen.getByTestId("nav.sheet").className).not.toContain(
      "translate-x-full",
    );
  });

  it("does not show the exchange-rate badge in the header", async () => {
    mockActor();

    renderApp();

    // The header is the shell around the page; the rate note lives only under
    // the Swap amount input, not in the header chrome.
    const header = (await screen.findByTestId("nav.menu_button")).closest(
      "header",
    );
    expect(header).not.toBeNull();
    expect(header).not.toHaveTextContent("1 ICP = 1000 Lucky");
  });

  it("lists each visible nav item with an icon, name, and description", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const swap = await screen.findByTestId("nav.swap_tab");
    expect(swap).toHaveTextContent("Swap");
    expect(swap).toHaveTextContent("Exchange ICP and Lucky at the pool rate");
    // The item renders an icon alongside the text.
    expect(swap.querySelector("svg")).not.toBeNull();

    const wallet = screen.getByTestId("nav.wallet_tab");
    expect(wallet).toHaveTextContent("Wallet");
    expect(wallet).toHaveTextContent(
      "Manage your balances and token approvals",
    );
    expect(wallet.querySelector("svg")).not.toBeNull();
  });

  it("hides the Treasury nav item from a signed-out visitor", async () => {
    mockActor();
    harness.isAuthenticated = false;

    renderApp();

    expect(await screen.findByTestId("nav.swap_tab")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.treasury_tab")).toBeNull();
  });

  it("hides the Treasury nav item from a signed-in non-admin", async () => {
    mockActor({ isCallerAdmin: vi.fn(async () => false) });
    harness.isAuthenticated = true;

    renderApp();

    expect(await screen.findByTestId("nav.swap_tab")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.treasury_tab")).toBeNull();
  });

  it("shows the Treasury nav item to an admin", async () => {
    mockActor({ isCallerAdmin: vi.fn(async () => true) });
    harness.isAuthenticated = true;

    renderApp();

    expect(await screen.findByTestId("nav.treasury_tab")).toBeInTheDocument();
  });

  it("renders the Treasury item with an icon, name, and description for an admin", async () => {
    mockActor({ isCallerAdmin: vi.fn(async () => true) });
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const treasury = await screen.findByTestId("nav.treasury_tab");
    expect(treasury).toHaveTextContent("Treasury");
    expect(treasury).toHaveTextContent(
      "Review the pool reserves and admin controls",
    );
    expect(treasury.querySelector("svg")).not.toBeNull();
  });

  it("navigates to the Wallet route through the Wallet nav item and closes the drawer", async () => {
    mockActor();
    harness.isAuthenticated = false;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));
    await user.click(await screen.findByTestId("nav.wallet_tab"));

    expect(await screen.findByTestId("wallet.page")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/wallet");
    });
    await waitFor(() => {
      expect(screen.getByTestId("nav.menu_button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  it("navigates to the Swap route through the Swap nav item and closes the drawer", async () => {
    mockActor();
    harness.isAuthenticated = false;
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));
    await user.click(await screen.findByTestId("nav.swap_tab"));

    expect(await screen.findByTestId("swap.page")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/swap");
    });
    await waitFor(() => {
      expect(screen.getByTestId("nav.menu_button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  it("marks the nav item for the current route as the active page", async () => {
    mockActor();
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    expect(await screen.findByTestId("nav.wallet_tab")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("nav.swap_tab")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("closes the drawer on Escape", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    const menuButton = await screen.findByTestId("nav.menu_button");
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("closes the drawer when the overlay is clicked", async () => {
    mockActor();

    const user = userEvent.setup();
    renderApp();

    const menuButton = await screen.findByTestId("nav.menu_button");
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // The overlay is the full-screen dismiss button outside the drawer; the
    // drawer's own close button shares the accessible name, so pick the one
    // that is not the drawer's `nav.close_button`.
    const overlay = screen
      .getAllByRole("button", { name: "Close navigation menu" })
      .find(
        (button) => button.getAttribute("data-ocid") !== "nav.close_button",
      );
    expect(overlay).toBeDefined();
    await user.click(overlay as HTMLElement);

    await waitFor(() => {
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("hides the Sign out item from a signed-out visitor", async () => {
    mockActor();
    harness.isAuthenticated = false;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    expect(await screen.findByTestId("nav.swap_tab")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.sign_out_button")).toBeNull();
  });

  it("shows a Sign out item at the bottom of the drawer when signed in", async () => {
    mockActor();
    harness.isAuthenticated = true;

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));

    const signOut = await screen.findByTestId("nav.sign_out_button");
    expect(signOut).toHaveTextContent("Sign out");

    // It sits after the nav landmark (i.e. below the nav items) and is
    // separated from them by a divider.
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      nav.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const footer = signOut.closest("div");
    expect(footer?.className).toContain("border-t");
  });

  it("signs out from the drawer and stays on the current page", async () => {
    mockActor();
    harness.isAuthenticated = true;
    window.history.pushState({}, "", "/wallet");

    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByTestId("nav.menu_button"));
    await user.click(await screen.findByTestId("nav.sign_out_button"));

    // The existing logout() is invoked...
    expect(harness.logout).toHaveBeenCalledTimes(1);
    // ...the drawer closes...
    await waitFor(() => {
      expect(screen.getByTestId("nav.menu_button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
    // ...and the user is not redirected away from the current route.
    expect(window.location.pathname).toBe("/wallet");
    expect(await screen.findByTestId("wallet.page")).toBeInTheDocument();
  });

  it("does not render a fixed bottom tab navigation bar", async () => {
    mockActor();

    renderApp();

    // The old chrome was a fixed bottom bar; the drawer replaces it. The nav
    // landmark only exists inside the drawer, which is closed by default.
    expect(await screen.findByTestId("nav.menu_button")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  });
});

describe("Navigation layout geometry", () => {
  it("neutralizes native dialog defaults while anchoring the drawer to the right edge", async () => {
    mockActor();

    renderApp();

    const sheet = await screen.findByTestId("nav.sheet");
    // The drawer is a native <dialog open>; its UA defaults (centered, auto
    // margins, intrinsic max-height) must be overridden so it pins to the right
    // edge and fills the viewport height instead of floating in the middle.
    expect(sheet.className).toContain("right-0");
    expect(sheet.className).toContain("left-auto");
    expect(sheet.className).toContain("m-0");
    expect(sheet.className).toContain("max-h-none");
    expect(sheet.className).toContain("max-w-xs");
    expect(sheet.className).toContain("h-dvh");
  });

  it("keeps the header brand and hamburger on one row without overlap", async () => {
    mockActor();

    renderApp();

    const brand = await screen.findByTestId("nav.brand_link");
    const menuButton = screen.getByTestId("nav.menu_button");

    // Both controls live in the same header row.
    const header = menuButton.closest("header");
    expect(header).not.toBeNull();
    expect(header?.contains(brand)).toBe(true);

    // The hamburger is pushed to the right edge of that row, so it cannot
    // overlap the brand on the left.
    expect(menuButton.className).toContain("ml-auto");
    expect(menuButton.className).toContain("shrink-0");
  });

  it("keeps the main content column centered with deterministic bottom padding", async () => {
    mockActor();

    const { container } = renderApp();

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    // Centered, width-capped column beneath the sticky header.
    expect(main?.className).toContain("mx-auto");
    expect(main?.className).toContain("max-w-lg");
    // The safe-area inset is folded into the .safe-bottom utility's own calc(),
    // so main must not also carry a competing pb-* padding class.
    expect(main?.className).toContain("safe-bottom");
    expect(main?.className).not.toMatch(/\bpb-\d/);
  });

  it("does not shift or misalign the main content when the drawer opens and closes", async () => {
    mockActor();

    const user = userEvent.setup();
    const { container } = renderApp();

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    const closedClassName = main?.className;

    await user.click(await screen.findByTestId("nav.menu_button"));
    await waitFor(() => {
      expect(screen.getByTestId("nav.sheet").className).toContain(
        "translate-x-0",
      );
    });
    // Opening the drawer must not mutate the main column's layout classes.
    expect(container.querySelector("main")?.className).toBe(closedClassName);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.getByTestId("nav.menu_button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
    // Closing it leaves the main column exactly as it started.
    expect(container.querySelector("main")?.className).toBe(closedClassName);
  });
});
