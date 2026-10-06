import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Gamepad2,
  Loader2,
  LogIn,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { MovementDirection, MovementSource, UserRole } from "@/backend";
import { CloverMark } from "@/components/CloverMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, useBackend } from "@/hooks/useBackend";
import {
  useCallerUserRole,
  useIntegrationMovements,
  useMyPrincipal,
  useWalletBalances,
} from "@/hooks/useBalances";
import { sendErrorMessage, unknownErrorMessage } from "@/lib/errors";
import {
  formatAmount,
  formatToken,
  parseAmount,
  shortenPrincipal,
} from "@/lib/format";
import { approveIcpSpender } from "@/lib/icpLedger";
import {
  MOVEMENT_DIRECTION_LABELS,
  MOVEMENT_SOURCE_LABELS,
} from "@/lib/integration";
import { loadConfig } from "@caffeineai/core-infrastructure";

type Token = "icp" | "lucky";

/** Convert a backend nanosecond timestamp into a readable local date-time. */
function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp / 1_000_000n));
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TOKENS: { value: Token; label: string }[] = [
  { value: "icp", label: "ICP" },
  { value: "lucky", label: "Lucky" },
];

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.admin]: "Admin",
  [UserRole.user]: "Member",
  [UserRole.guest]: "Guest",
};

export default function WalletPage() {
  const { isAuthenticated, isInitializing, isLoggingIn, login, identity } =
    useAuth();
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const balances = useWalletBalances(isAuthenticated);
  const principal = useMyPrincipal(isAuthenticated);
  const role = useCallerUserRole(isAuthenticated);
  const movements = useIntegrationMovements(isAuthenticated);

  const [token, setToken] = useState<Token>("icp");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async (input: {
      token: Token;
      to: Principal;
      amount: bigint;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      if (input.token === "icp") {
        // The backend pulls ICP via icrc2_transfer_from, so the caller must
        // first approve the backend canister as a spender on the ICP ledger.
        if (!identity) throw new Error("Sign in to send ICP.");
        const config = await loadConfig();
        await approveIcpSpender(
          identity,
          config.backend_canister_id,
          input.amount,
        );
      }
      const result =
        input.token === "icp"
          ? await actor.sendIcp(input.to, input.amount)
          : await actor.sendLucky(input.to, input.amount);
      if (result.__kind__ === "Err") {
        throw new Error(sendErrorMessage(result.Err));
      }
      return result.Ok;
    },
    onSuccess: (_sent, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
      const symbol = variables.token === "icp" ? "ICP" : "Lucky";
      setSuccess(
        `Sent ${formatAmount(variables.amount)} ${symbol} to ${shortenPrincipal(variables.to.toText())}.`,
      );
      setRecipient("");
      setAmount("");
      setFormError(null);
    },
    onError: (error) => {
      setSuccess(null);
      setFormError(unknownErrorMessage(error));
    },
  });

  const myPrincipalText = principal.data?.toText() ?? "";

  async function handleCopy() {
    if (!myPrincipalText) return;
    try {
      await navigator.clipboard.writeText(myPrincipalText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError("Could not copy the address. Select and copy it manually.");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setFormError(null);

    const trimmedRecipient = recipient.trim();
    if (trimmedRecipient === "") {
      setFormError("Enter the recipient's Principal address.");
      return;
    }

    let to: Principal;
    try {
      to = Principal.fromText(trimmedRecipient);
    } catch {
      setFormError("That is not a valid Principal address.");
      return;
    }

    const parsed = parseAmount(amount);
    if (parsed === null) {
      setFormError("Enter a valid amount with up to 8 decimal places.");
      return;
    }
    if (parsed <= 0n) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    sendMutation.mutate({ token, to, amount: parsed });
  }

  if (isInitializing) {
    return (
      <div className="animate-fade-in space-y-4" data-ocid="wallet.page">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="animate-fade-in" data-ocid="wallet.page">
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <Card className="mt-4 text-center" data-ocid="wallet.signed_out_card">
          <CardHeader className="items-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Wallet className="size-6" aria-hidden />
            </div>
            <CardTitle className="font-display text-lg">
              Sign in to view your wallet
            </CardTitle>
            <CardDescription className="max-w-prose text-balance">
              Connect with Internet Identity to see your ICP and Lucky balances,
              your address, and send tokens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              size="lg"
              className="w-full rounded-full"
              onClick={() => login()}
              disabled={isLoggingIn}
              data-ocid="wallet.sign_in_button"
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <LogIn aria-hidden />
              )}
              {isLoggingIn ? "Signing in…" : "Sign in with Internet Identity"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const icpBalance = balances.data?.icp ?? 0n;
  const luckyBalance = balances.data?.lucky ?? 0n;
  const roleLabel = role.data ? ROLE_LABEL[role.data] : "Member";

  const myPrincipal = principal.data;
  const gameActivity = (movements.data ?? [])
    .filter(
      (movement) =>
        myPrincipal !== undefined &&
        movement.counterparty.toText() === myPrincipal.toText() &&
        (movement.source === MovementSource.BetDebit ||
          movement.source === MovementSource.PrizePayout),
    )
    .sort((a, b) => Number(b.timestamp - a.timestamp));

  const totalBets = gameActivity
    .filter((movement) => movement.source === MovementSource.BetDebit)
    .reduce((sum, movement) => sum + movement.amount, 0n);
  const totalPrizes = gameActivity
    .filter((movement) => movement.source === MovementSource.PrizePayout)
    .reduce((sum, movement) => sum + movement.amount, 0n);
  const netActivity = totalPrizes - totalBets;

  return (
    <div className="animate-fade-in space-y-5" data-ocid="wallet.page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
          data-ocid="wallet.role_badge"
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          {roleLabel}
        </span>
      </div>

      {/* Balances */}
      <Card
        className="gap-0 overflow-hidden border-none bg-gradient-primary py-0 text-primary-foreground shadow-elevated"
        data-ocid="wallet.balances_card"
      >
        <CardContent className="space-y-4 px-5 py-5">
          <p className="text-sm font-medium text-primary-foreground/80">
            Your balances
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary-foreground/10 px-3 py-3">
              <p className="text-xs text-primary-foreground/75">ICP</p>
              {balances.isLoading ? (
                <Skeleton className="mt-1 h-7 w-20 bg-primary-foreground/20" />
              ) : (
                <p
                  className="tabular-nums font-display text-xl font-bold"
                  data-ocid="wallet.icp_balance"
                >
                  {formatAmount(icpBalance, { maxFractionDigits: 4 })}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-primary-foreground/10 px-3 py-3">
              <p className="text-xs text-primary-foreground/75">Lucky</p>
              {balances.isLoading ? (
                <Skeleton className="mt-1 h-7 w-20 bg-primary-foreground/20" />
              ) : (
                <p
                  className="tabular-nums font-display text-xl font-bold"
                  data-ocid="wallet.lucky_balance"
                >
                  {formatAmount(luckyBalance, { maxFractionDigits: 4 })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receive address */}
      <Card data-ocid="wallet.address_card">
        <CardHeader>
          <CardTitle className="font-display text-base">Your address</CardTitle>
          <CardDescription>
            Share this Principal to receive ICP or Lucky from another wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {principal.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs text-foreground"
                data-ocid="wallet.principal_text"
              >
                {myPrincipalText || "Unavailable"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={handleCopy}
                disabled={!myPrincipalText}
                aria-label={copied ? "Address copied" : "Copy address"}
                data-ocid="wallet.copy_button"
              >
                {copied ? (
                  <Check className="text-primary" aria-hidden />
                ) : (
                  <Copy aria-hidden />
                )}
              </Button>
            </div>
          )}
          {copied ? (
            <p
              className="mt-2 text-xs font-medium text-primary"
              data-ocid="wallet.copy_success"
            >
              Address copied to clipboard.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Send form */}
      <Card data-ocid="wallet.send_card">
        <CardHeader>
          <CardTitle className="font-display text-base">Send tokens</CardTitle>
          <CardDescription>
            Transfer ICP or Lucky to an external Principal address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="wallet-token">Token</Label>
              <Select
                value={token}
                onValueChange={(value) => {
                  setToken(value as Token);
                  setSuccess(null);
                  setFormError(null);
                }}
              >
                <SelectTrigger
                  id="wallet-token"
                  className="w-full"
                  data-ocid="wallet.token_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === "lucky" ? (
                        <CloverMark size={16} className="text-mark-gold" />
                      ) : (
                        <span aria-hidden>◎</span>
                      )}
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-recipient">Recipient address</Label>
              <Input
                id="wallet-recipient"
                value={recipient}
                onChange={(event) => {
                  setRecipient(event.target.value);
                  setSuccess(null);
                  setFormError(null);
                }}
                placeholder="Principal (e.g. aaaaa-aa…)"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-sm"
                data-ocid="wallet.recipient_input"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wallet-amount">Amount</Label>
                <span className="text-xs text-muted-foreground">
                  Balance:{" "}
                  {formatAmount(token === "icp" ? icpBalance : luckyBalance, {
                    maxFractionDigits: 4,
                  })}{" "}
                  {token === "icp" ? "ICP" : "Lucky"}
                </span>
              </div>
              <Input
                id="wallet-amount"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setSuccess(null);
                  setFormError(null);
                }}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                className="tabular-nums"
                data-ocid="wallet.amount_input"
              />
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-ocid="wallet.error_state"
              >
                {formError}
              </p>
            ) : null}

            {success ? (
              <output
                className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary"
                data-ocid="wallet.success_state"
              >
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                {success}
              </output>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={sendMutation.isPending}
              data-ocid="wallet.send_button"
            >
              {sendMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              {sendMutation.isPending ? "Sending…" : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Game activity */}
      <Card data-ocid="wallet.game_activity_card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Gamepad2 className="size-4 text-primary" aria-hidden />
            Game activity
          </CardTitle>
          <CardDescription>
            Your bets and prize payouts recorded by the game integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-3">
              <p className="text-xs text-muted-foreground">Total bets</p>
              {movements.isLoading ? (
                <Skeleton className="mt-1 h-6 w-20" />
              ) : (
                <p
                  className="tabular-nums font-display text-lg font-bold text-foreground"
                  data-ocid="wallet.total_bets"
                >
                  {formatToken(totalBets, "Lucky", { maxFractionDigits: 4 })}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-3">
              <p className="text-xs text-muted-foreground">Total prizes</p>
              {movements.isLoading ? (
                <Skeleton className="mt-1 h-6 w-20" />
              ) : (
                <p
                  className="tabular-nums font-display text-lg font-bold text-primary"
                  data-ocid="wallet.total_prizes"
                >
                  {formatToken(totalPrizes, "Lucky", { maxFractionDigits: 4 })}
                </p>
              )}
            </div>
          </div>

          {!movements.isLoading && gameActivity.length > 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-ocid="wallet.net_activity"
            >
              Net from game activity:{" "}
              <span
                className={
                  netActivity >= 0n
                    ? "font-medium text-primary"
                    : "font-medium text-destructive"
                }
              >
                {netActivity >= 0n ? "+" : "−"}
                {formatToken(
                  netActivity >= 0n ? netActivity : -netActivity,
                  "Lucky",
                  { maxFractionDigits: 4 },
                )}
              </span>
            </p>
          ) : null}

          {movements.isLoading ? (
            <div
              className="space-y-2"
              data-ocid="wallet.game_activity.loading_state"
            >
              {Array.from(
                { length: 3 },
                (_, i) => `activity-skeleton-${i}`,
              ).map((id) => (
                <Skeleton key={id} className="h-14 w-full" />
              ))}
            </div>
          ) : movements.isError ? (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="wallet.game_activity.error_state"
            >
              Could not load your game activity. It refreshes automatically.
            </p>
          ) : gameActivity.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-border px-4 py-6 text-center"
              data-ocid="wallet.game_activity.empty_state"
            >
              <p className="text-sm font-medium text-foreground">
                No game activity yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your bets and prize payouts will appear here once you play.
              </p>
            </div>
          ) : (
            <ul
              className="divide-y divide-border"
              data-ocid="wallet.game_activity_list"
            >
              {gameActivity.map((movement, index) => {
                const isInbound = movement.direction === MovementDirection.In;
                return (
                  <li
                    key={movement.gameEventId}
                    className="flex items-center justify-between gap-3 py-3"
                    data-ocid={`wallet.game_activity.item.${index + 1}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {MOVEMENT_SOURCE_LABELS[movement.source]}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {movement.gameEventId}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTimestamp(movement.timestamp)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={
                          isInbound
                            ? "font-mono text-sm font-semibold tabular-nums text-primary"
                            : "font-mono text-sm font-semibold tabular-nums text-destructive"
                        }
                      >
                        {isInbound ? "+" : "−"}
                        {formatAmount(movement.amount, {
                          maxFractionDigits: 4,
                        })}
                      </p>
                      <Badge
                        variant="secondary"
                        className="mt-0.5 text-[10px] uppercase tracking-wider"
                      >
                        {MOVEMENT_DIRECTION_LABELS[movement.direction]}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
