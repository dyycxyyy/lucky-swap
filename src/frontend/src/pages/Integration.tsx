import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useBackend";
import {
  useIntegrationMovements,
  useMyPrincipal,
  useTreasuryBalance,
  useTreasuryPrincipal,
} from "@/hooks/useBalances";
import { formatAmount, shortenPrincipal } from "@/lib/format";
import { toMovementView } from "@/lib/integration";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Coins,
  KeyRound,
  Repeat,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Documentation data                                                  */
/* ------------------------------------------------------------------ */

type Caller = "integration" | "admin" | "anyone";

type Endpoint = {
  name: string;
  signature: string;
  purpose: string;
  params: string;
  returns: string;
  caller: Caller;
};

const CALLER_LABELS: Record<Caller, string> = {
  integration: "Trusted integration principal",
  admin: "Admin only",
  anyone: "Anyone (read-only)",
};

const ENDPOINT_GROUPS: { id: string; title: string; endpoints: Endpoint[] }[] =
  [
    {
      id: "intake",
      title: "Treasury intake",
      endpoints: [
        {
          name: "submitExcessSweep",
          signature: "submitExcessSweep(amount, gameEventId)",
          purpose: "Sweep surplus game revenue into the treasury.",
          params: "amount: Nat (e8s) · gameEventId: Text",
          returns: "TreasuryIntakeResult",
          caller: "integration",
        },
        {
          name: "submitCrowdfunding",
          signature: "submitCrowdfunding(amount, gameEventId)",
          purpose: "Record a crowdfunding contribution into the treasury.",
          params: "amount: Nat (e8s) · gameEventId: Text",
          returns: "TreasuryIntakeResult",
          caller: "integration",
        },
      ],
    },
    {
      id: "pools",
      title: "Prize pools",
      endpoints: [
        {
          name: "topUpPrizePool",
          signature: "topUpPrizePool(prizePoolId, amount)",
          purpose: "Move treasury funds into a named prize pool.",
          params: "prizePoolId: Text · amount: Nat (e8s)",
          returns: "PrizePoolTopUpResult",
          caller: "admin",
        },
        {
          name: "getPrizePoolBalance",
          signature: "getPrizePoolBalance(prizePoolId)",
          purpose: "Read the current balance of a prize pool.",
          params: "prizePoolId: Text",
          returns: "Nat (query)",
          caller: "anyone",
        },
      ],
    },
    {
      id: "wallets",
      title: "Player wallets",
      endpoints: [
        {
          name: "debitBet",
          signature: "debitBet(user, amount, betId)",
          purpose: "Debit a player stake from their wallet.",
          params: "user: Principal · amount: Nat (e8s) · betId: Text",
          returns: "WalletMovementResult",
          caller: "integration",
        },
        {
          name: "creditPrize",
          signature: "creditPrize(user, amount, payoutEventId)",
          purpose: "Credit a prize payout to a player wallet.",
          params: "user: Principal · amount: Nat (e8s) · payoutEventId: Text",
          returns: "WalletMovementResult",
          caller: "integration",
        },
      ],
    },
    {
      id: "identity",
      title: "Identity & authorization",
      endpoints: [
        {
          name: "authorizeIntegrationPrincipal",
          signature: "authorizeIntegrationPrincipal(principal)",
          purpose: "Grant a game principal access to the integration methods.",
          params: "principal: Principal",
          returns: "() (no value)",
          caller: "admin",
        },
        {
          name: "revokeIntegrationPrincipal",
          signature: "revokeIntegrationPrincipal(principal)",
          purpose: "Remove a principal's integration access immediately.",
          params: "principal: Principal",
          returns: "() (no value)",
          caller: "admin",
        },
        {
          name: "isIntegrationPrincipal",
          signature: "isIntegrationPrincipal(principal)",
          purpose: "Check whether a principal is currently authorized.",
          params: "principal: Principal",
          returns: "Bool (query)",
          caller: "anyone",
        },
      ],
    },
    {
      id: "ledger",
      title: "Ledger queries",
      endpoints: [
        {
          name: "listMovements",
          signature: "listMovements()",
          purpose:
            "List every recorded integration movement for reconciliation.",
          params: "—",
          returns: "[Movement] (query)",
          caller: "anyone",
        },
        {
          name: "getMovement",
          signature: "getMovement(gameEventId)",
          purpose: "Look up a single movement by its idempotency key.",
          params: "gameEventId: Text",
          returns: "?Movement (query)",
          caller: "anyone",
        },
      ],
    },
  ];

const ERROR_VARIANTS: { name: string; meaning: string }[] = [
  {
    name: "NotAuthorized",
    meaning:
      "The caller's principal is not an authorized integration principal. Ask an admin to authorize it.",
  },
  {
    name: "NotAdmin",
    meaning: "The caller is not the treasury admin for an admin-only method.",
  },
  {
    name: "InvalidAmount",
    meaning:
      "The amount failed validation (for example zero, or a malformed value). The message explains why.",
  },
  {
    name: "InsufficientFunds",
    meaning:
      "The player wallet holds less than the requested amount. Carries available and required.",
  },
  {
    name: "InsufficientTreasury",
    meaning:
      "The treasury holds less than the requested amount. Carries available and required.",
  },
  {
    name: "UnknownPrizePool",
    meaning: "No prize pool exists with the supplied prize pool id.",
  },
  {
    name: "TransferFailed",
    meaning:
      "The underlying token transfer could not be completed. The message carries the reason.",
  },
];

const WORKED_EXAMPLE: { step: string; detail: string }[] = [
  {
    step: "Game sweeps excess revenue",
    detail:
      "The game calls submitExcessSweep(50_00000000, 'round-42-sweep'). The treasury is credited 50 Lucky and a Movement is recorded.",
  },
  {
    step: "Admin tops up a prize pool",
    detail:
      "An admin calls topUpPrizePool('weekly-jackpot', 30_00000000). The treasury is debited and the pool is credited 30 Lucky.",
  },
  {
    step: "Game debits a bet",
    detail:
      "The game calls debitBet(player, 5_00000000, 'bet-1001'). The player's wallet is debited 5 Lucky.",
  },
  {
    step: "Game credits a prize",
    detail:
      "The game calls creditPrize(player, 12_00000000, 'payout-1001'). The player's wallet is credited 12 Lucky.",
  },
];

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function CallerBadge({ caller }: { caller: Caller }) {
  if (caller === "admin") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 border-accent/40 bg-accent/15 text-accent-foreground"
      >
        <ShieldCheck className="size-3" aria-hidden />
        Admin
      </Badge>
    );
  }
  if (caller === "integration") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 border-primary/40 bg-primary/15 text-primary"
      >
        <KeyRound className="size-3" aria-hidden />
        Integration
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Read-only
    </Badge>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 font-display text-lg font-semibold"
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      {children}
    </h2>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <Card className="shadow-subtle" data-ocid="integration.endpoint_card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-mono text-sm">{endpoint.name}</CardTitle>
          <CallerBadge caller={endpoint.caller} />
        </div>
        <CardDescription>{endpoint.purpose}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Signature
          </p>
          <code className="block overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {endpoint.signature}
          </code>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Parameters
            </dt>
            <dd className="mt-0.5 text-foreground">{endpoint.params}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Returns
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-foreground">
              {endpoint.returns}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Caller: {CALLER_LABELS[endpoint.caller]}
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Live values                                                         */
/* ------------------------------------------------------------------ */

function LiveSnapshot() {
  const { isAuthenticated } = useAuth();
  const { data: treasuryBalance, isLoading: balanceLoading } =
    useTreasuryBalance();
  const { data: treasuryPrincipal } = useTreasuryPrincipal();
  const { data: myPrincipal } = useMyPrincipal(isAuthenticated);
  const { data: movements, isLoading: movementsLoading } =
    useIntegrationMovements();
  const recent = (movements ?? []).slice(0, 5);
  const principalText = myPrincipal?.toText() ?? "";

  return (
    <Card className="shadow-subtle" data-ocid="integration.live_card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Live snapshot</CardTitle>
        <CardDescription>
          Current treasury state and the latest recorded movements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Treasury balance
            </p>
            {balanceLoading ? (
              <Skeleton
                className="mt-1 h-7 w-28"
                data-ocid="integration.treasury.loading_state"
              />
            ) : (
              <p
                className="mt-1 font-display text-xl font-bold tabular-nums text-foreground"
                data-ocid="integration.treasury.balance"
              >
                {formatAmount(treasuryBalance ?? 0n)}
                <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                  Lucky
                </span>
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Treasury principal
            </p>
            <code
              className="mt-1 block truncate font-mono text-xs text-foreground"
              title={treasuryPrincipal?.toText() ?? ""}
              data-ocid="integration.treasury.principal"
            >
              {treasuryPrincipal
                ? shortenPrincipal(treasuryPrincipal.toText(), 10, 6)
                : "—"}
            </code>
          </div>
        </div>

        {principalText ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your principal
            </p>
            <code
              className="mt-0.5 block truncate font-mono text-xs text-foreground"
              title={principalText}
              data-ocid="integration.my_principal"
            >
              {shortenPrincipal(principalText, 12, 8)}
            </code>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent movements
          </p>
          {movementsLoading ? (
            <Skeleton
              className="mt-2 h-24 w-full"
              data-ocid="integration.movements.loading_state"
            />
          ) : recent.length === 0 ? (
            <p
              className="mt-2 text-sm text-muted-foreground"
              data-ocid="integration.movements.empty_state"
            >
              No integration movements recorded yet.
            </p>
          ) : (
            <ul
              className="mt-1 divide-y divide-border"
              data-ocid="integration.movements_list"
            >
              {recent.map((movement, index) => {
                const view = toMovementView(movement);
                return (
                  <li
                    key={movement.gameEventId}
                    className="flex items-center justify-between gap-3 py-2.5"
                    data-ocid={`integration.movements.item.${index + 1}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {view.sourceLabel}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {movement.gameEventId}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={
                          view.isInbound
                            ? "font-mono text-sm font-semibold tabular-nums text-primary"
                            : "font-mono text-sm font-semibold tabular-nums text-destructive"
                        }
                      >
                        {view.isInbound ? "+" : "−"}
                        {formatAmount(movement.amount)}
                      </p>
                      <Badge
                        variant="secondary"
                        className="mt-0.5 text-[10px] uppercase tracking-wider"
                      >
                        {view.directionLabel}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function IntegrationPage() {
  return (
    <div className="animate-fade-in space-y-5" data-ocid="integration.page">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <BookOpen className="size-5" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Integration guide
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Everything the game needs to move funds through the Lucky backend.
        </p>
      </header>

      {/* Integration model */}
      <Card className="border-primary/30 shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <Coins className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">How integration works</CardTitle>
              <CardDescription>
                The backend is the single source of truth.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The game never reads or writes balances directly. Every fund
            movement goes through the backend methods below, and the backend
            keeps the single source of truth for the treasury, prize pools, and
            player wallets.
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                The game submits an intent (sweep, bet, payout) and the backend
                applies it atomically.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                Every applied movement is recorded as a queryable ledger entry
                with its source, direction, amount, counterparty, and time.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                The game reconciles by reading the ledger, never by tracking
                balances on its own.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Identity */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <KeyRound className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Getting authorized</CardTitle>
              <CardDescription>
                Integration callers are trusted principals.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              An admin authorizes the game's principal with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                authorizeIntegrationPrincipal
              </code>{" "}
              on the Funding page.
            </li>
            <li>
              The game signs its calls with that principal. Unauthorized
              principals are rejected with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                NotAuthorized
              </code>
              .
            </li>
            <li>
              An admin can revoke access at any time with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                revokeIntegrationPrincipal
              </code>
              .
            </li>
            <li>
              Use{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                isIntegrationPrincipal
              </code>{" "}
              to check whether a principal is currently authorized.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Idempotency */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"
            >
              <Repeat className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Idempotency</CardTitle>
              <CardDescription>
                Every write is keyed by a game event id.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Pass a stable, unique{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              gameEventId
            </code>{" "}
            with every write. Repeating a call with the same id returns the
            original movement instead of moving funds twice, so retries are
            safe.
          </p>
          <p>
            The wallet methods use the same idea with their own key:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              betId
            </code>{" "}
            for{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              debitBet
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              payoutEventId
            </code>{" "}
            for{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              creditPrize
            </code>
            .
          </p>
          <p>
            Use{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              getMovement(gameEventId)
            </code>{" "}
            to confirm whether an event was already applied.
          </p>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <section className="space-y-3" aria-labelledby="integration-endpoints">
        <SectionHeading id="integration-endpoints" icon={BookOpen}>
          Endpoints
        </SectionHeading>
        {ENDPOINT_GROUPS.map((group) => (
          <div key={group.id} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h3>
            <div
              className="space-y-3"
              data-ocid={`integration.endpoint_list.${group.id}`}
            >
              {group.endpoints.map((endpoint) => (
                <EndpointCard key={endpoint.name} endpoint={endpoint} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Units */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"
            >
              <Coins className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Units</CardTitle>
              <CardDescription>All amounts are Lucky e8s.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every amount is an integer count of Lucky base units (e8s) with 8
            decimals. One whole Lucky is{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              100_000_000
            </code>{" "}
            e8s.
          </p>
          <p>
            Send integers only. For example, 12.5 Lucky is{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              1_250_000_000
            </code>{" "}
            e8s.
          </p>
        </CardContent>
      </Card>

      {/* Errors */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-destructive/15 text-destructive"
            >
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Error variants</CardTitle>
              <CardDescription>
                Every write returns Ok or Err(IntegrationError).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            {ERROR_VARIANTS.map((variant) => (
              <div key={variant.name} className="py-2.5">
                <dt className="font-mono text-xs font-semibold text-foreground">
                  {variant.name}
                </dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  {variant.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Worked example */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <Trophy className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Worked example</CardTitle>
              <CardDescription>
                A full round from sweep to payout.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {WORKED_EXAMPLE.map((item, index) => (
              <li key={item.step} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {item.step}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <LiveSnapshot />

      <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
        <Wallet className="size-3.5 shrink-0" aria-hidden />
        Admin actions live on the Funding page; this guide is read-only.
      </p>
    </div>
  );
}
