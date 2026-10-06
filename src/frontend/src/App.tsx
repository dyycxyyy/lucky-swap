import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useBackend";
import { useIsCallerAdmin } from "@/hooks/useBalances";
import IntegrationPage from "@/pages/Integration";
import SwapPage from "@/pages/Swap";
import TreasuryPage from "@/pages/Treasury";
import TreasuryFundingPage from "@/pages/TreasuryFunding";
import WalletPage from "@/pages/Wallet";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

function RootLayout() {
  const { isAuthenticated } = useAuth();
  const { data: isAdmin } = useIsCallerAdmin(isAuthenticated);

  return (
    <Layout isAdmin={!!isAdmin}>
      <Outlet />
    </Layout>
  );
}

/**
 * Guards an admin-only route. Non-admins (and signed-out visitors) are
 * redirected to the Swap page instead of rendering the admin shell.
 */
function AdminGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const { data: isAdmin, isLoading: isAdminLoading } =
    useIsCallerAdmin(isAuthenticated);

  if (isInitializing || (isAuthenticated && isAdminLoading)) {
    return null;
  }
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/swap" replace />;
  }
  return <>{children}</>;
}

const rootRoute = createRootRoute({ component: RootLayout });

const swapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/swap",
  component: SwapPage,
});

const treasuryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/treasury",
  component: () => (
    <AdminGuard>
      <TreasuryPage />
    </AdminGuard>
  ),
});

const treasuryFundingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/treasury/funding",
  component: () => (
    <AdminGuard>
      <TreasuryFundingPage />
    </AdminGuard>
  ),
});

const integrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/integration",
  component: IntegrationPage,
});

const walletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wallet",
  component: WalletPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SwapPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  swapRoute,
  treasuryRoute,
  treasuryFundingRoute,
  integrationRoute,
  walletRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </>
  );
}
