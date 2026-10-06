import { createActor } from "@/backend";
import { CloverMark } from "@/components/CloverMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useBackend";
import {
  usePoolBalances,
  useTreasuryBalance,
  useWalletBalances,
} from "@/hooks/useBalances";
import { swapErrorMessage, unknownErrorMessage } from "@/lib/errors";
import { E8S, formatAmount, formatToken, parseAmount } from "@/lib/format";
import { approveIcpSpender } from "@/lib/icpLedger";
import { cn } from "@/lib/utils";
import {
  loadConfig,
  useActor,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  Check,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** Fixed rate: 1 ICP = 1000 Lucky. */
const LUCKY_PER_ICP = 1000n;
/** Lucky→ICP fee, in percent, paid in Lucky. */
const FEE_PERCENT = 3n;

const MIN_ICP = E8S / 10n; // 0.1 ICP
const ICP_STEP = E8S / 10n; // 0.1 ICP
const MAX_ICP = 10_000n * E8S;
const LUCKY_STEP = 1000n * E8S; // 1000 Lucky
const MAX_LUCKY = 10_000_000n * E8S;

type Direction = "icpToLucky" | "luckyToIcp";

const DIRECTIONS: { id: Direction; label: string; from: string; to: string }[] =
  [
    { id: "icpToLucky", label: "ICP → Lucky", from: "ICP", to: "Lucky" },
    { id: "luckyToIcp", label: "Lucky → ICP", from: "Lucky", to: "ICP" },
  ];

/** Compute the exact receive amount and fee for a parsed input. */
function computeQuote(direction: Direction, amount: bigint) {
  if (direction === "icpToLucky") {
    return { output: amount * LUCKY_PER_ICP, fee: 0n };
  }
  const fee = (amount * FEE_PERCENT) / 100n;
  const net = amount - fee;
  // 1000 Lucky = 1 ICP, so ICP value = net / 1000.
  return { output: net / LUCKY_PER_ICP, fee };
}

export default function SwapPage() {
  const { isAuthenticated } = useAuth();
  const { identity } = useInternetIdentity();
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();

  const { data: pool, isLoading: poolLoading } = usePoolBalances();
  const { data: treasury, isLoading: treasuryLoading } = useTreasuryBalance();
  const { data: wallet } = useWalletBalances(isAuthenticated);

  const [direction, setDirection] = useState<Direction>("icpToLucky");
  const [amountText, setAmountText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = DIRECTIONS.find((d) => d.id === direction) ?? DIRECTIONS[0];
  const parsed = useMemo(() => parseAmount(amountText), [amountText]);
  const quote = useMemo(
    () =>
      parsed !== null && parsed > 0n ? computeQuote(direction, parsed) : null,
    [direction, parsed],
  );

  const poolTarget =
    direction === "icpToLucky" ? (pool?.lucky ?? 0n) : (pool?.icp ?? 0n);
  const userSource =
    direction === "icpToLucky" ? (wallet?.icp ?? 0n) : (wallet?.lucky ?? 0n);

  const validation = useMemo((): string | null => {
    if (amountText.trim() === "") return null;
    if (parsed === null) return "Enter a valid amount.";
    if (parsed <= 0n) return "Amount must be greater than zero.";
    if (direction === "icpToLucky") {
      if (parsed < MIN_ICP) return "Minimum swap is 0.1 ICP.";
      if (parsed % ICP_STEP !== 0n)
        return "ICP amount must be a multiple of 0.1 ICP.";
      if (parsed > MAX_ICP) return "Maximum swap is 10,000 ICP.";
    } else {
      if (parsed % LUCKY_STEP !== 0n)
        return "Lucky amount must be a multiple of 1,000 Lucky.";
      if (parsed > MAX_LUCKY) return "Maximum swap is 10,000,000 Lucky.";
    }
    if (isAuthenticated && userSource < parsed)
      return `You only have ${formatToken(userSource, meta.from)} available.`;
    if (quote && quote.output > poolTarget)
      return `The pool only has ${formatToken(poolTarget, meta.to)} available. Try a smaller swap.`;
    return null;
  }, [
    amountText,
    parsed,
    direction,
    isAuthenticated,
    userSource,
    quote,
    poolTarget,
    meta.from,
    meta.to,
  ]);

  const canSubmit =
    isAuthenticated &&
    parsed !== null &&
    parsed > 0n &&
    validation === null &&
    !poolLoading;

  const mutation = useMutation({
    mutationFn: async (amount: bigint) => {
      if (!actor) throw new Error("Backend is not ready");
      if (direction === "icpToLucky") {
        // The backend pulls ICP via icrc2_transfer_from, so the caller must
        // first approve the backend canister as a spender on the ICP ledger.
        if (!identity) throw new Error("Sign in to swap ICP.");
        const config = await loadConfig();
        await approveIcpSpender(identity, config.backend_canister_id, amount);
      }
      const result =
        direction === "icpToLucky"
          ? await actor.swapIcpToLucky(amount)
          : await actor.swapLuckyToIcp(amount);
      if (result.__kind__ === "Err") throw result.Err;
      return result.Ok;
    },
    onSuccess: (receipt) => {
      toast.success(
        `Swapped ${formatToken(receipt.inputAmount, meta.from)} for ${formatToken(receipt.outputAmount, meta.to)}.`,
      );
      setAmountText("");
      setConfirming(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["poolBalances"] });
      void queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
      void queryClient.invalidateQueries({ queryKey: ["treasuryBalance"] });
    },
    onError: (err) => {
      const message =
        err && typeof err === "object" && "__kind__" in err
          ? swapErrorMessage(
              err as unknown as Parameters<typeof swapErrorMessage>[0],
            )
          : unknownErrorMessage(err);
      setError(message);
      setConfirming(false);
    },
  });

  function handleDirectionChange(next: Direction) {
    if (next === direction) return;
    setDirection(next);
    setAmountText("");
    setConfirming(false);
    setError(null);
  }

  function handleReview() {
    if (!canSubmit || parsed === null) return;
    setError(null);
    setConfirming(true);
  }

  function handleConfirm() {
    if (parsed === null) return;
    mutation.mutate(parsed);
  }

  const displayError = error ?? validation;

  return (
    <div className="animate-fade-in space-y-4" data-ocid="swap.page">
      {/* Hero: live pool + treasury balances */}
      <section
        aria-label="Swap pool balances"
        className="relative overflow-hidden rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-elevated"
        data-ocid="swap.pool_card"
      >
        <CloverMark
          size={112}
          className="pointer-events-none absolute -right-6 -top-8 select-none text-primary-foreground opacity-10"
        />
        <div className="relative flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold tracking-widest uppercase opacity-90">
            Swap Pool
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            <span
              aria-hidden
              className="size-1.5 animate-pulse-soft rounded-full bg-emerald-300"
            />
            Live
          </span>
        </div>

        <dl className="relative mt-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm opacity-80">Lucky liquidity</dt>
            <dd
              className="font-display text-2xl font-bold tabular-nums"
              data-ocid="swap.pool_lucky"
            >
              {poolLoading ? "—" : formatToken(pool?.lucky ?? 0n, "Lucky")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm opacity-80">ICP liquidity</dt>
            <dd
              className="font-display text-2xl font-bold tabular-nums"
              data-ocid="swap.pool_icp"
            >
              {poolLoading ? "—" : formatToken(pool?.icp ?? 0n, "ICP")}
            </dd>
          </div>
        </dl>

        <div className="relative mt-4 flex items-center justify-between rounded-xl bg-black/20 px-3.5 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-accent">
            <ShieldCheck className="size-4" aria-hidden />
            Treasury
          </span>
          <span
            className="font-display text-base font-bold tabular-nums text-accent"
            data-ocid="swap.treasury_balance"
          >
            {treasuryLoading ? "—" : formatToken(treasury ?? 0n, "Lucky")}
          </span>
        </div>
      </section>

      {/* Swap panel */}
      <section
        aria-label="Swap"
        className="rounded-2xl border border-border/60 bg-card p-5 shadow-subtle"
        data-ocid="swap.panel"
      >
        <div
          role="tablist"
          aria-label="Swap direction"
          className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        >
          {DIRECTIONS.map((d) => {
            const active = d.id === direction;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleDirectionChange(d.id)}
                data-ocid={`swap.direction.${d.id}`}
                className={cn(
                  "min-h-[40px] rounded-full px-3 text-sm font-semibold outline-none transition-smooth focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "bg-card text-foreground shadow-subtle"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="swap-amount"
              className="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
            >
              You pay ({meta.from})
            </label>
            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <span
                  className="text-xs text-muted-foreground"
                  data-ocid="swap.available_balance"
                >
                  Balance: {formatToken(userSource, meta.from)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAmountText(formatAmount(userSource));
                    setConfirming(false);
                    setError(null);
                  }}
                  disabled={userSource <= 0n}
                  data-ocid="swap.max_button"
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground outline-none transition-smooth hover:bg-secondary/80 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-input bg-muted/40 px-4 py-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <input
              id="swap-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setConfirming(false);
                setError(null);
              }}
              aria-invalid={displayError !== null}
              aria-describedby="swap-helper"
              data-ocid="swap.amount_input"
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
              {meta.from}
            </span>
          </div>
          <p
            id="swap-helper"
            className="mt-2 text-center text-sm text-muted-foreground"
          >
            1 ICP = 1000 Lucky
          </p>
        </div>

        {/* Live quote */}
        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">You receive</span>
            <span
              className="font-display text-lg font-bold tabular-nums text-foreground"
              data-ocid="swap.quote_output"
            >
              {quote ? formatToken(quote.output, meta.to) : `0 ${meta.to}`}
            </span>
          </div>
          {direction === "luckyToIcp" && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Fee (3%, paid in Lucky)
              </span>
              <span
                className="text-sm font-medium tabular-nums text-muted-foreground"
                data-ocid="swap.quote_fee"
              >
                {quote ? formatToken(quote.fee, "Lucky") : "0 Lucky"}
              </span>
            </div>
          )}
        </div>

        {/* Error / validation */}
        {displayError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            data-ocid="swap.error_state"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{displayError}</span>
          </p>
        )}

        {/* Confirmation step */}
        {confirming && quote && parsed !== null ? (
          <div
            className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
            data-ocid="swap.confirm_panel"
          >
            <p className="text-sm font-semibold text-foreground">
              Confirm your swap
            </p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">You pay</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatToken(parsed, meta.from)}
                </dd>
              </div>
              {direction === "luckyToIcp" && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Fee</dt>
                  <dd className="font-medium tabular-nums text-muted-foreground">
                    {formatToken(quote.fee, "Lucky")}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5">
                <dt className="font-semibold text-foreground">You receive</dt>
                <dd
                  className="font-display text-base font-bold tabular-nums text-primary"
                  data-ocid="swap.confirm_receive"
                >
                  {formatToken(quote.output, meta.to)}
                </dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-11 flex-1 rounded-full"
                onClick={() => setConfirming(false)}
                disabled={mutation.isPending}
                data-ocid="swap.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-full shadow-clover"
                onClick={handleConfirm}
                disabled={mutation.isPending}
                data-ocid="swap.confirm_button"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Swapping…
                  </>
                ) : (
                  <>
                    <Check className="size-4" aria-hidden />
                    Confirm swap
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className="mt-4 h-12 w-full rounded-full text-base shadow-clover"
            onClick={handleReview}
            disabled={!canSubmit}
            data-ocid="swap.submit_button"
          >
            <ArrowDownUp className="size-4" aria-hidden />
            {isAuthenticated ? "Review swap" : "Sign in to swap"}
          </Button>
        )}

        {!isAuthenticated && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Connect your wallet to swap ICP and Lucky.
          </p>
        )}
      </section>
    </div>
  );
}
