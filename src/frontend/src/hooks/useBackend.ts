/**
 * Backend actor access and Internet Identity sign-in.
 *
 * `useActor(createActor)` is called at hook top level and re-exported so pages
 * and query hooks share one actor instance. Sign-in state comes from the
 * platform `useInternetIdentity` hook — never a hardcoded identity provider.
 */

import { createActor } from "@/backend";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";

export function useBackend() {
  const { actor, isFetching } = useActor(createActor);
  return { actor, isFetching };
}

export function useAuth() {
  const {
    identity,
    login,
    clear,
    loginStatus,
    isInitializing,
    isLoggingIn,
    isLoginError,
    isAuthenticated,
    loginError,
  } = useInternetIdentity();

  return {
    identity,
    login,
    logout: clear,
    loginStatus,
    isInitializing,
    isLoggingIn,
    isLoginError,
    isAuthenticated,
    loginError,
  };
}
