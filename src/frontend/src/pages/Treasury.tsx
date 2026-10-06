import { createActor } from "@/backend";
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
import { useAuth } from "@/hooks/useBackend";
import {
  useIsCallerAdmin,
  useTotalSupply,
  useTreasuryBalance,
  useTreasuryPrincipal,
} from "@/hooks/useBalances";
import {
  burnErrorMessage,
  mintErrorMessage,
  treasuryErrorMessage,
  unknownErrorMessage,
} from "@/lib/errors";
import { formatAmount, parseAmount, shortenPrincipal } from "@/lib/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Flame,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const WITHDRAW_MULTIPLE = 100n * 100_000_000n; // 100 Lucky in e8s

function useWithdrawTreasury() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, to }: { amount: bigint; to: Principal }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.withdrawTreasury(amount, to);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["treasuryBalance"] });
    },
  });
}

function useMintToPool() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.mintToPool(amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["poolBalances"] });
    },
  });
}

function useMintToAddress() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, to }: { amount: bigint; to: Principal }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.mintTo(to, amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["totalSupply"] });
      void queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
    },
  });
}

function useBurnFromAddress() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      from,
    }: {
      amount: bigint;
      from: Principal;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.burnFrom(from, amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["totalSupply"] });
      void queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
    },
  });
}

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
            <CardDescription>Lucky held by the treasury</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <Skeleton
            className="h-10 w-40"
            data-ocid="treasury.balance.loading_state"
          />
        ) : isError ? (
          <p
            className="text-sm text-destructive"
            data-ocid="treasury.balance.error_state"
          >
            Could not load the treasury balance. It refreshes automatically.
          </p>
        ) : (
          <p
            className="font-display text-3xl font-bold tabular-nums text-foreground"
            data-ocid="treasury.balance"
          >
            {formatAmount(balance ?? 0n)}
            <span className="ml-2 text-base font-medium text-muted-foreground">
              Lucky
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TreasuryPrincipalCard() {
  const { data: principal, isLoading } = useTreasuryPrincipal();
  const [copied, setCopied] = useState(false);

  const principalText = principal?.toText() ?? "";

  async function handleCopy() {
    if (!principalText) return;
    try {
      await navigator.clipboard.writeText(principalText);
      setCopied(true);
      toast.success("Treasury principal copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Treasury address</CardTitle>
        <CardDescription>
          Send Lucky to this principal to fund the treasury.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton
            className="h-11 w-full"
            data-ocid="treasury.principal.loading_state"
          />
        ) : principalText ? (
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs text-foreground"
              title={principalText}
              data-ocid="treasury.principal"
            >
              {shortenPrincipal(principalText, 10, 8)}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy treasury principal"
              data-ocid="treasury.copy_button"
            >
              {copied ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="treasury.principal.error_state"
          >
            The treasury principal is unavailable right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TotalSupplyCard() {
  const { data: supply, isLoading, isError } = useTotalSupply();

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <Sparkles className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Total supply</CardTitle>
            <CardDescription>All Lucky in circulation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton
            className="h-8 w-36"
            data-ocid="treasury.supply.loading_state"
          />
        ) : isError ? (
          <p
            className="text-sm text-destructive"
            data-ocid="treasury.supply.error_state"
          >
            Could not load the total supply. It refreshes automatically.
          </p>
        ) : (
          <p
            className="font-display text-2xl font-bold tabular-nums text-foreground"
            data-ocid="treasury.supply"
          >
            {formatAmount(supply ?? 0n)}
            <span className="ml-2 text-base font-medium text-muted-foreground">
              Lucky
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const withdraw = useWithdrawTreasury();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a positive Lucky amount.");
      return;
    }
    if (parsed % WITHDRAW_MULTIPLE !== 0n) {
      setError("Withdrawals must be a multiple of 100 Lucky.");
      return;
    }

    let to: Principal;
    try {
      to = Principal.fromText(destination.trim());
    } catch {
      setError("Enter a valid principal address.");
      return;
    }

    const capturedAmount = amount;
    const capturedDestination = destination;
    setAmount("");
    setDestination("");

    withdraw.mutate(
      { amount: parsed, to },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Sent ${formatAmount(result.Ok)} Lucky to ${shortenPrincipal(to.toText())}.`,
            );
            toast.success("Treasury withdrawal sent");
          } else {
            setError(treasuryErrorMessage(result.Err));
          }
        },
        onError: (err) => {
          setError(unknownErrorMessage(err));
          setAmount((current) => (current === "" ? capturedAmount : current));
          setDestination((current) =>
            current === "" ? capturedDestination : current,
          );
        },
      },
    );
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Withdraw Lucky</CardTitle>
        <CardDescription>
          Send Lucky from the treasury to an external principal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount (Lucky)</Label>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={withdraw.isPending}
              data-ocid="treasury.withdraw.input"
            />
            <p className="text-xs text-muted-foreground">
              Must be a positive multiple of 100 Lucky.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="withdraw-destination">Destination principal</Label>
            <Input
              id="withdraw-destination"
              placeholder="aaaaa-aa"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={withdraw.isPending}
              className="font-mono text-xs"
              data-ocid="treasury.withdraw.destination_input"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="treasury.withdraw.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="treasury.withdraw.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              withdraw.isPending ||
              amount.trim() === "" ||
              destination.trim() === ""
            }
            data-ocid="treasury.withdraw.submit_button"
          >
            {withdraw.isPending ? "Sending…" : "Withdraw Lucky"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MintForm() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mint = useMintToPool();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a positive Lucky amount.");
      return;
    }

    const capturedAmount = amount;
    setAmount("");

    mint.mutate(parsed, {
      onSuccess: (result) => {
        if (result.__kind__ === "Ok") {
          setSuccess(
            `Minted ${formatAmount(parsed)} Lucky into the swap pool.`,
          );
          toast.success("Lucky minted into the pool");
        } else {
          setError(mintErrorMessage(result.Err));
        }
      },
      onError: (err) => {
        setError(unknownErrorMessage(err));
        setAmount((current) => (current === "" ? capturedAmount : current));
      },
    });
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Mint Lucky</CardTitle>
        <CardDescription>
          Newly minted Lucky is credited to the swap pool, never to a user.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mint-amount">Amount (Lucky)</Label>
            <Input
              id="mint-amount"
              inputMode="decimal"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={mint.isPending}
              data-ocid="treasury.mint.input"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="treasury.mint.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="treasury.mint.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={mint.isPending || amount.trim() === ""}
            data-ocid="treasury.mint.submit_button"
          >
            {mint.isPending ? "Minting…" : "Mint to pool"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MintToAddressForm() {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mint = useMintToAddress();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a positive Lucky amount.");
      return;
    }

    let to: Principal;
    try {
      to = Principal.fromText(destination.trim());
    } catch {
      setError("Enter a valid principal address.");
      return;
    }

    const capturedAmount = amount;
    const capturedDestination = destination;
    setAmount("");
    setDestination("");

    mint.mutate(
      { amount: parsed, to },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Minted ${formatAmount(parsed)} Lucky to ${shortenPrincipal(to.toText())}.`,
            );
            toast.success("Lucky minted to address");
          } else {
            setError(mintErrorMessage(result.Err));
          }
        },
        onError: (err) => {
          setError(unknownErrorMessage(err));
          setAmount((current) => (current === "" ? capturedAmount : current));
          setDestination((current) =>
            current === "" ? capturedDestination : current,
          );
        },
      },
    );
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <Sparkles className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Mint to address</CardTitle>
            <CardDescription>
              Credit newly minted Lucky directly to a principal.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mint-to-amount">Amount (Lucky)</Label>
            <Input
              id="mint-to-amount"
              inputMode="decimal"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={mint.isPending}
              data-ocid="treasury.mint_to.input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mint-to-destination">Destination principal</Label>
            <Input
              id="mint-to-destination"
              placeholder="aaaaa-aa"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={mint.isPending}
              className="font-mono text-xs"
              data-ocid="treasury.mint_to.destination_input"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="treasury.mint_to.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="treasury.mint_to.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={
              mint.isPending ||
              amount.trim() === "" ||
              destination.trim() === ""
            }
            data-ocid="treasury.mint_to.submit_button"
          >
            {mint.isPending ? "Minting…" : "Mint to address"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BurnFromAddressForm() {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const burn = useBurnFromAddress();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a positive Lucky amount.");
      return;
    }

    let from: Principal;
    try {
      from = Principal.fromText(source.trim());
    } catch {
      setError("Enter a valid principal address.");
      return;
    }

    const capturedAmount = amount;
    const capturedSource = source;
    setAmount("");
    setSource("");

    burn.mutate(
      { amount: parsed, from },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Burned ${formatAmount(parsed)} Lucky from ${shortenPrincipal(from.toText())}.`,
            );
            toast.success("Lucky burned from address");
          } else {
            setError(burnErrorMessage(result.Err));
          }
        },
        onError: (err) => {
          setError(unknownErrorMessage(err));
          setAmount((current) => (current === "" ? capturedAmount : current));
          setSource((current) => (current === "" ? capturedSource : current));
        },
      },
    );
  }

  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-destructive/15 text-destructive"
          >
            <Flame className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Burn from address</CardTitle>
            <CardDescription>
              Remove Lucky from a principal and reduce total supply.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="burn-amount">Amount (Lucky)</Label>
            <Input
              id="burn-amount"
              inputMode="decimal"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={burn.isPending}
              data-ocid="treasury.burn.input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="burn-source">Source principal</Label>
            <Input
              id="burn-source"
              placeholder="aaaaa-aa"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={burn.isPending}
              className="font-mono text-xs"
              data-ocid="treasury.burn.source_input"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="treasury.burn.error_state"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
              data-ocid="treasury.burn.success_state"
            >
              {success}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="destructive"
            className="w-full"
            disabled={
              burn.isPending || amount.trim() === "" || source.trim() === ""
            }
            data-ocid="treasury.burn.submit_button"
          >
            {burn.isPending ? "Burning…" : "Burn from address"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NonAdminState() {
  return (
    <Card
      className="border-dashed shadow-none"
      data-ocid="treasury.non_admin_state"
    >
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Lock className="size-6" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">
            Admin access required
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Treasury withdrawals and minting are restricted to the treasury
            admin. You can still view the treasury balance and address above.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TreasuryPage() {
  const { isAuthenticated } = useAuth();
  const { data: isAdmin, isLoading: isAdminLoading } =
    useIsCallerAdmin(isAuthenticated);

  return (
    <div className="animate-fade-in space-y-5" data-ocid="treasury.page">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Treasury
          </h1>
          {isAdmin ? (
            <Badge
              variant="secondary"
              className="gap-1 border-accent/40 bg-accent/15 text-accent-foreground"
              data-ocid="treasury.admin_badge"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Admin
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Manage the Lucky treasury and mint into the swap pool.
        </p>
      </header>

      <TreasuryBalanceCard />
      <TotalSupplyCard />
      <TreasuryPrincipalCard />

      {isAdminLoading ? (
        <Skeleton
          className="h-40 w-full"
          data-ocid="treasury.actions.loading_state"
        />
      ) : isAdmin ? (
        <div className="space-y-5">
          <WithdrawForm />
          <MintForm />
          <MintToAddressForm />
          <BurnFromAddressForm />
        </div>
      ) : (
        <NonAdminState />
      )}
    </div>
  );
}
