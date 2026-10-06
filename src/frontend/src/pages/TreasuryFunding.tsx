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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useBackend";
import {
  useAuthorizeIntegrationPrincipal,
  useIntegrationMovements,
  useIsCallerAdmin,
  useIsIntegrationPrincipal,
  usePrizePoolBalance,
  useRevokeIntegrationPrincipal,
  useTopUpPrizePool,
  useTreasuryBalance,
  useTreasuryPrincipal,
} from "@/hooks/useBalances";
import { integrationErrorMessage, unknownErrorMessage } from "@/lib/errors";
import {
  formatAmount,
  formatToken,
  parseAmount,
  shortenPrincipal,
} from "@/lib/format";
import {
  MOVEMENT_SOURCE_LABELS,
  TREASURY_INTAKE_SOURCES,
  isTreasuryIntake,
  toMovementView,
} from "@/lib/integration";
import { Principal } from "@icp-sdk/core/principal";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  HandCoins,
  KeyRound,
  Landmark,
  ShieldCheck,
  Trophy,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const LUCKY = "Lucky";

function parsePrincipal(value: string): Principal | null {
  try {
    return Principal.fromText(value.trim());
  } catch {
    return null;
  }
}

/** Convert a nanosecond backend timestamp into a compact local string. */
function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp / 1_000_000n));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Treasury overview                                                   */
/* ------------------------------------------------------------------ */

function TreasuryBalanceCard() {
  const { data: balance, isLoading, isError } = useTreasuryBalance();

  return (
    <Card className="overflow-hidden border-accent/40 shadow-subtle">
      <CardHeader className="bg-gradient-to-br from-accent/15 to-transparent pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"
          >
            <Landmark className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Treasury balance</CardTitle>
            <CardDescription>
              Lucky available to fund prize pools
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <Skeleton
            className="h-10 w-40"
            data-ocid="funding.balance.loading_state"
          />
        ) : isError ? (
          <p
            className="text-sm text-destructive"
            data-ocid="funding.balance.error_state"
          >
            Could not load the treasury balance. It refreshes automatically.
          </p>
        ) : (
          <p
            className="font-display text-3xl font-bold tabular-nums text-foreground"
            data-ocid="funding.balance"
          >
            {formatAmount(balance ?? 0n)}
            <span className="ml-2 text-base font-medium text-muted-foreground">
              {LUCKY}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TreasuryPrincipalCard() {
  const { data: principal, isLoading } = useTreasuryPrincipal();
  const principalText = principal?.toText() ?? "";

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Treasury principal</CardTitle>
        <CardDescription>
          The on-chain account that holds the treasury funds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton
            className="h-11 w-full"
            data-ocid="funding.principal.loading_state"
          />
        ) : principalText ? (
          <code
            className="block truncate rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs text-foreground"
            title={principalText}
            data-ocid="funding.principal"
          >
            {shortenPrincipal(principalText, 10, 8)}
          </code>
        ) : (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="funding.principal.error_state"
          >
            The treasury principal is unavailable right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Treasury intake breakdown                                           */
/* ------------------------------------------------------------------ */

function IntakeBreakdown() {
  const { data: movements, isLoading, isError } = useIntegrationMovements();

  const intake = (movements ?? []).filter(isTreasuryIntake);
  const totals = TREASURY_INTAKE_SOURCES.map((source) => {
    const entries = intake.filter((m) => m.source === source);
    return {
      source,
      total: entries.reduce((sum, m) => sum + m.amount, 0n),
      count: entries.length,
    };
  });
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0n);

  return (
    <Card className="shadow-subtle" data-ocid="funding.intake_card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"
          >
            <Coins className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Treasury intake</CardTitle>
            <CardDescription>
              Cumulative contributions, split by source.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton
            className="h-24 w-full"
            data-ocid="funding.intake.loading_state"
          />
        ) : isError ? (
          <p
            className="text-sm text-destructive"
            data-ocid="funding.intake.error_state"
          >
            Could not load the intake breakdown. It refreshes automatically.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {totals.map(({ source, total, count }) => (
                <div
                  key={source}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                  data-ocid={`funding.intake.${source.toLowerCase()}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {MOVEMENT_SOURCE_LABELS[source]}
                  </p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums text-foreground">
                    {formatAmount(total)}
                    <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                      {LUCKY}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {count} {count === 1 ? "entry" : "entries"}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold text-foreground">
                Total intake
              </span>
              <span
                className="font-display text-lg font-bold tabular-nums text-foreground"
                data-ocid="funding.intake.total"
              >
                {formatAmount(grandTotal)}
                <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                  {LUCKY}
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Prize pool top-up                                                   */
/* ------------------------------------------------------------------ */

function TopUpPrizePoolForm() {
  const [poolId, setPoolId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const topUp = useTopUpPrizePool();
  const { data: treasuryBalance } = useTreasuryBalance();

  const trimmedPoolId = poolId.trim();
  const { data: poolBalance, isLoading: isPoolLoading } = usePrizePoolBalance(
    trimmedPoolId,
    trimmedPoolId !== "",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a positive Lucky amount.");
      return;
    }
    if (trimmedPoolId === "") {
      setError("Enter a prize pool id.");
      return;
    }
    if (treasuryBalance !== undefined && parsed > treasuryBalance) {
      setError(
        `The treasury only holds ${formatAmount(treasuryBalance)} Lucky. Lower the amount and try again.`,
      );
      return;
    }

    const capturedPool = poolId;
    const capturedAmount = amount;
    setPoolId("");
    setAmount("");

    topUp.mutate(
      { prizePoolId: trimmedPoolId, amount: parsed },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Pool now holds ${formatAmount(result.Ok.poolBalance)} Lucky. Treasury holds ${formatAmount(result.Ok.treasuryBalance)} Lucky.`,
            );
            toast.success("Prize pool topped up");
          } else {
            setError(integrationErrorMessage(result.Err));
          }
        },
        onError: (err) => {
          setError(unknownErrorMessage(err));
          setPoolId((current) => (current === "" ? capturedPool : current));
          setAmount((current) => (current === "" ? capturedAmount : current));
        },
      },
    );
  }

  return (
    <Card className="shadow-subtle" data-ocid="funding.pool_card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"
          >
            <Trophy className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Top up a prize pool</CardTitle>
            <CardDescription>
              Move treasury funds into a named prize pool.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pool-id">Prize pool id</Label>
            <Input
              id="pool-id"
              placeholder="weekly-jackpot"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              disabled={topUp.isPending}
              className="font-mono text-xs"
              data-ocid="funding.pool.id_input"
            />
            {trimmedPoolId !== "" ? (
              <p
                className="text-xs text-muted-foreground"
                data-ocid="funding.pool.balance"
              >
                {isPoolLoading
                  ? "Loading pool balance…"
                  : `Current balance: ${formatToken(poolBalance ?? 0n, LUCKY)}`}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pool-amount">Amount (Lucky)</Label>
            <Input
              id="pool-amount"
              inputMode="decimal"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={topUp.isPending}
              data-ocid="funding.pool.amount_input"
            />
            {treasuryBalance !== undefined ? (
              <p className="text-xs text-muted-foreground">
                Available in treasury: {formatToken(treasuryBalance, LUCKY)}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="funding.pool.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="funding.pool.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              topUp.isPending || trimmedPoolId === "" || amount.trim() === ""
            }
            data-ocid="funding.pool.submit_button"
          >
            {topUp.isPending ? "Topping up…" : "Top up prize pool"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Integration principal management                                    */
/* ------------------------------------------------------------------ */

function AuthorizeForm() {
  const [principalText, setPrincipalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const authorize = useAuthorizeIntegrationPrincipal();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const principal = parsePrincipal(principalText);
    if (!principal) {
      setError("Enter a valid principal address.");
      return;
    }

    const captured = principalText;
    setPrincipalText("");

    authorize.mutate(principal, {
      onSuccess: () => {
        setSuccess(
          `Authorized ${shortenPrincipal(principal.toText())} as an integration caller.`,
        );
        toast.success("Integration principal authorized");
      },
      onError: (err) => {
        setError(unknownErrorMessage(err));
        setPrincipalText((current) => (current === "" ? captured : current));
      },
    });
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <UserPlus className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Authorize a caller</CardTitle>
            <CardDescription>
              Grant a game principal access to the integration methods.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authorize-principal">Game principal</Label>
            <Input
              id="authorize-principal"
              placeholder="aaaaa-aa"
              value={principalText}
              onChange={(e) => setPrincipalText(e.target.value)}
              disabled={authorize.isPending}
              className="font-mono text-xs"
              data-ocid="funding.authorize.input"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="funding.authorize.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="funding.authorize.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={authorize.isPending || principalText.trim() === ""}
            data-ocid="funding.authorize.submit_button"
          >
            {authorize.isPending ? "Authorizing…" : "Authorize caller"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RevokeForm() {
  const [principalText, setPrincipalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const revoke = useRevokeIntegrationPrincipal();

  const parsed = parsePrincipal(principalText);
  const { data: isAuthorized, isFetching: isChecking } =
    useIsIntegrationPrincipal(parsed);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const principal = parsePrincipal(principalText);
    if (!principal) {
      setError("Enter a valid principal address.");
      return;
    }

    const captured = principalText;
    setPrincipalText("");

    revoke.mutate(principal, {
      onSuccess: () => {
        setSuccess(
          `Revoked ${shortenPrincipal(principal.toText())}. Its calls are now rejected.`,
        );
        toast.success("Integration principal revoked");
      },
      onError: (err) => {
        setError(unknownErrorMessage(err));
        setPrincipalText((current) => (current === "" ? captured : current));
      },
    });
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-destructive/15 text-destructive"
          >
            <UserMinus className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Revoke a caller</CardTitle>
            <CardDescription>
              Remove a principal's integration access immediately.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="revoke-principal">Game principal</Label>
            <Input
              id="revoke-principal"
              placeholder="aaaaa-aa"
              value={principalText}
              onChange={(e) => setPrincipalText(e.target.value)}
              disabled={revoke.isPending}
              className="font-mono text-xs"
              data-ocid="funding.revoke.input"
            />
            {parsed ? (
              <p
                className="text-xs text-muted-foreground"
                data-ocid="funding.revoke.status"
              >
                {isChecking
                  ? "Checking authorization…"
                  : isAuthorized
                    ? "This principal is currently authorized."
                    : "This principal is not authorized."}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="funding.revoke.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="funding.revoke.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="destructive"
            className="w-full"
            disabled={revoke.isPending || principalText.trim() === ""}
            data-ocid="funding.revoke.submit_button"
          >
            {revoke.isPending ? "Revoking…" : "Revoke caller"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Recent movements                                                    */
/* ------------------------------------------------------------------ */

function RecentMovements() {
  const { data: movements, isLoading, isError } = useIntegrationMovements();
  const recent = (movements ?? []).slice(0, 10);

  return (
    <Card className="shadow-subtle" data-ocid="funding.movements_card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent movements</CardTitle>
        <CardDescription>
          The latest recorded integration ledger entries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton
            className="h-32 w-full"
            data-ocid="funding.movements.loading_state"
          />
        ) : isError ? (
          <p
            className="text-sm text-destructive"
            data-ocid="funding.movements.error_state"
          >
            Could not load movements. They refresh automatically.
          </p>
        ) : recent.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="funding.movements.empty_state"
          >
            No integration movements recorded yet.
          </p>
        ) : (
          <Table data-ocid="funding.movements_table">
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Counterparty
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Game event
                </TableHead>
                <TableHead className="hidden lg:table-cell text-right">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((movement, index) => {
                const view = toMovementView(movement);
                return (
                  <TableRow
                    key={`${movement.gameEventId}-${index}`}
                    data-ocid={`funding.movements.row.${index + 1}`}
                  >
                    <TableCell className="font-medium">
                      {view.sourceLabel}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] uppercase tracking-wider"
                      >
                        {view.isInbound ? (
                          <ArrowDownLeft className="size-3" aria-hidden />
                        ) : (
                          <ArrowUpRight className="size-3" aria-hidden />
                        )}
                        {view.directionLabel}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        view.isInbound
                          ? "text-right font-mono tabular-nums text-primary"
                          : "text-right font-mono tabular-nums text-destructive"
                      }
                    >
                      {view.isInbound ? "+" : "−"}
                      {formatAmount(movement.amount)}
                    </TableCell>
                    <TableCell
                      className="hidden font-mono text-xs text-muted-foreground sm:table-cell"
                      title={movement.counterparty.toText()}
                    >
                      {shortenPrincipal(movement.counterparty.toText())}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {movement.gameEventId}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                      {formatTimestamp(movement.timestamp)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TreasuryFundingPage() {
  const { isAuthenticated } = useAuth();
  const { data: isAdmin } = useIsCallerAdmin(isAuthenticated);

  return (
    <div className="animate-fade-in space-y-5" data-ocid="funding.page">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Treasury funding
          </h1>
          {isAdmin ? (
            <Badge
              variant="secondary"
              className="gap-1 border-accent/40 bg-accent/15 text-accent-foreground"
              data-ocid="funding.admin_badge"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Admin
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Fund prize pools and manage trusted game callers.
        </p>
      </header>

      <TreasuryBalanceCard />
      <TreasuryPrincipalCard />

      <IntakeBreakdown />

      <section className="space-y-3" aria-labelledby="funding-pools">
        <h2
          id="funding-pools"
          className="flex items-center gap-2 font-display text-lg font-semibold"
        >
          <Trophy className="size-5 text-muted-foreground" aria-hidden />
          Prize pools
        </h2>
        <TopUpPrizePoolForm />
      </section>

      <section className="space-y-3" aria-labelledby="funding-callers">
        <h2
          id="funding-callers"
          className="flex items-center gap-2 font-display text-lg font-semibold"
        >
          <KeyRound className="size-5 text-muted-foreground" aria-hidden />
          Integration callers
        </h2>
        <AuthorizeForm />
        <RevokeForm />
      </section>

      <RecentMovements />
    </div>
  );
}
