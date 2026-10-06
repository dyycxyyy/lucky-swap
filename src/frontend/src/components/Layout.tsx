import { CloverMark } from "@/components/CloverMark";
import { useAuth } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Coins,
  Landmark,
  LogOut,
  Menu,
  Wallet,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type Tab = {
  to: "/swap" | "/treasury" | "/treasury/funding" | "/integration" | "/wallet";
  label: string;
  description: string;
  icon: typeof ArrowLeftRight;
  adminOnly?: boolean;
};

const TABS: Tab[] = [
  {
    to: "/swap",
    label: "Swap",
    description: "Exchange ICP and Lucky at the pool rate",
    icon: ArrowLeftRight,
  },
  {
    to: "/treasury",
    label: "Treasury",
    description: "Review the pool reserves and admin controls",
    icon: Landmark,
    adminOnly: true,
  },
  {
    to: "/treasury/funding",
    label: "Funding",
    description: "Authorize game callers and record treasury intake",
    icon: Coins,
    adminOnly: true,
  },
  {
    to: "/integration",
    label: "Integration",
    description: "How the game connects to the Lucky backend",
    icon: BookOpen,
  },
  {
    to: "/wallet",
    label: "Wallet",
    description: "Manage your balances and token approvals",
    icon: Wallet,
  },
];

export function Layout({
  children,
  isAdmin,
}: {
  children: ReactNode;
  isAdmin: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  // Close on Escape and lock background scroll while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-subtle backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-2 px-4">
          <Link
            to="/swap"
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            data-ocid="nav.brand_link"
          >
            <CloverMark size={24} className="text-mark-gold" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Lucky Swap
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            data-ocid="nav.menu_button"
            className="-mr-2 ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className="safe-bottom mx-auto w-full max-w-lg flex-1 px-4 pt-5">
        {children}
      </main>

      {/* Overlay: click to dismiss the drawer. */}
      <button
        type="button"
        aria-label="Close navigation menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={closeMenu}
        className={cn(
          "fixed inset-0 z-40 cursor-default bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Right slide-out drawer. The nav landmark stays mounted and in the
          accessibility tree so its data-ocid hooks and accessible name
          persist across open state; it slides off-screen when closed. */}
      <dialog
        open
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        data-ocid="nav.sheet"
        className={cn(
          "fixed inset-y-0 right-0 left-auto z-50 m-0 flex h-dvh max-h-none w-[86%] max-w-xs flex-col bg-sidebar p-0 text-sidebar-foreground shadow-elevated transition-transform duration-300 ease-out motion-reduce:transition-none",
          menuOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <CloverMark size={24} className="text-mark-gold" />
              Lucky Swap
            </p>
            <p className="mt-0.5 text-sm text-sidebar-foreground/70">
              Jump to any part of the app.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMenu}
            tabIndex={menuOpen ? 0 : -1}
            aria-label="Close navigation menu"
            data-ocid="nav.close_button"
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {visibleTabs.map((tab) => {
            const active =
              tab.to === "/swap"
                ? pathname === "/" || pathname.startsWith("/swap")
                : tab.to === "/treasury"
                  ? pathname === "/treasury"
                  : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                onClick={closeMenu}
                tabIndex={menuOpen ? 0 : -1}
                data-ocid={`nav.${tab.label.toLowerCase()}_tab`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-3 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "bg-sidebar-accent text-sidebar-accent-foreground group-hover:bg-sidebar-primary/15",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {tab.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-sidebar-foreground/60">
                    {tab.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        {isAuthenticated && (
          <div className="border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={() => {
                logout();
                closeMenu();
              }}
              tabIndex={menuOpen ? 0 : -1}
              data-ocid="nav.sign_out_button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-destructive/40"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
              >
                <LogOut className="size-5" />
              </span>
              Sign out
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
