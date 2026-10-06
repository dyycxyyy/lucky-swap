/**
 * React Query hooks for pool, treasury, wallet, and caller-role data.
 * All amounts are e8s bigints. Queries poll so balances stay live.
 */

import type { GameEventId, PrizePoolId } from "@/backend";
import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const POLL_INTERVAL = 10_000;

export function usePoolBalances() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["poolBalances"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getPoolBalances();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTreasuryBalance() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["treasuryBalance"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getTreasuryBalance();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTreasuryPrincipal() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["treasuryPrincipal"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getTreasuryPrincipal();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTotalSupply() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["totalSupply"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.icrc1_total_supply();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useWalletBalances(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["walletBalances"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getWalletBalances();
    },
    enabled: enabled && !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useMyPrincipal(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["myPrincipal"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getMyPrincipal();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

export function useIsCallerAdmin(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["isCallerAdmin"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.isCallerAdmin();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

export function useCallerUserRole(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["callerUserRole"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getCallerUserRole();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/* ------------------------------------------------------------------ */
/* Integration surface                                                 */
/* ------------------------------------------------------------------ */

/** Every recorded integration movement, newest first. */
export function useIntegrationMovements(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["integrationMovements"],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.listMovements();
    },
    enabled: enabled && !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Balance of a single prize pool, keyed by pool id. */
export function usePrizePoolBalance(prizePoolId: PrizePoolId, enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["prizePoolBalance", prizePoolId],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getPrizePoolBalance(prizePoolId);
    },
    enabled: enabled && !!actor && !isFetching,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Whether a principal is currently an authorized integration caller. */
export function useIsIntegrationPrincipal(
  principal: Principal | null,
  enabled = true,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["isIntegrationPrincipal", principal?.toText() ?? null],
    queryFn: async () => {
      if (!actor || !principal) throw new Error("Backend is not ready");
      return actor.isIntegrationPrincipal(principal);
    },
    enabled: enabled && !!actor && !isFetching && !!principal,
  });
}

function useInvalidateIntegration() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["integrationMovements"] });
    void queryClient.invalidateQueries({ queryKey: ["treasuryBalance"] });
    void queryClient.invalidateQueries({ queryKey: ["poolBalances"] });
    void queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
    void queryClient.invalidateQueries({ queryKey: ["totalSupply"] });
  };
}

export function useAuthorizeIntegrationPrincipal() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.authorizeIntegrationPrincipal(principal);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRevokeIntegrationPrincipal() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.revokeIntegrationPrincipal(principal);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSubmitExcessSweep() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async ({
      amount,
      gameEventId,
    }: {
      amount: bigint;
      gameEventId: GameEventId;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.submitExcessSweep(amount, gameEventId);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSubmitCrowdfunding() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async ({
      amount,
      gameEventId,
    }: {
      amount: bigint;
      gameEventId: GameEventId;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.submitCrowdfunding(amount, gameEventId);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useTopUpPrizePool() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async ({
      prizePoolId,
      amount,
    }: {
      prizePoolId: PrizePoolId;
      amount: bigint;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.topUpPrizePool(prizePoolId, amount);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDebitBet() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async ({
      user,
      amount,
      betId,
    }: {
      user: Principal;
      amount: bigint;
      betId: GameEventId;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.debitBet(user, amount, betId);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useCreditPrize() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateIntegration();
  return useMutation({
    mutationFn: async ({
      user,
      amount,
      payoutEventId,
    }: {
      user: Principal;
      amount: bigint;
      payoutEventId: GameEventId;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.creditPrize(user, amount, payoutEventId);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}
