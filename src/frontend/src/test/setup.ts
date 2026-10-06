import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Generated components use `data-ocid` as their stable test hook.
configure({ testIdAttribute: "data-ocid" });

// jsdom lacks the pointer-capture and scroll APIs Radix UI primitives call when
// opening a Select. Stub them so the real components can be driven in tests.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement `window.matchMedia`, which sonner's Toaster calls
// in an effect. Without it, rendering the app shell throws before any assertion.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Replace the platform actor/identity hooks with a typed local mock. Registering
// the mock in a setup file (which runs before test modules are imported) makes
// it apply to every suite. The factory reads mutable state from `./harness` at
// call time, so each test can swap in its own actor and auth state.
vi.mock("@caffeineai/core-infrastructure", async () => {
  const { harness } = await import("./harness");
  return {
    loadConfig: async () => ({
      backend_canister_id: "aaaaa-aa",
      project_id: "test",
      ii_canister_id: "aaaaa-aa",
    }),
    useActor: () => ({ actor: harness.actor, isFetching: false }),
    useInternetIdentity: () => ({
      identity: harness.identity,
      login: harness.login,
      clear: harness.logout,
      loginStatus: harness.isAuthenticated ? "success" : "idle",
      isInitializing: harness.isInitializing,
      isLoggingIn: harness.isLoggingIn,
      isLoginError: false,
      isAuthenticated: harness.isAuthenticated,
      loginError: undefined,
    }),
  };
});

afterEach(() => {
  cleanup();
});
