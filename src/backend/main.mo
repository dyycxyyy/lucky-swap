import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import Expose "mo:caffeineai-oql/Expose";
import NatValue "mo:caffeineai-oql/NatValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import TextValue "mo:caffeineai-oql/TextValue";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

import CommonTypes "types/common";
import IntegrationTypes "types/integration";
import LedgerApi "mixins/ledger-api";
import SwapApi "mixins/swap-api";
import TreasuryApi "mixins/treasury-api";
import WalletApi "mixins/wallet-api";
import IntegrationApi "mixins/integration-api";
import ApiDocMixin "mixins/api-doc";

actor self {
  let accessControlState : AccessControl.AccessControlState;
  let balances : Map.Map<Principal, Nat>;
  let allowances : Map.Map<Principal, Map.Map<Principal, Nat>>;
  let poolState : CommonTypes.PoolState;
  let icpLedgerPrincipal : Principal;
  let integrationPrincipals : Map.Map<Principal, Bool>;
  let prizePools : Map.Map<IntegrationTypes.PrizePoolId, Nat>;
  let movements : Map.Map<IntegrationTypes.GameEventId, IntegrationTypes.Movement>;

  transient let selfPrincipal = Principal.fromActor(self);

  // Flatten the nested allowances map into (owner, spender, amount) rows so the
  // owner and spender keys become queryable columns.
  func allowanceRows() : Iter.Iter<(Principal, Principal, Nat)> {
    allowances.entries().flatMap(
      func((owner, spenders)) {
        spenders.entries().map(func((spender, amount)) = (owner, spender, amount));
      }
    );
  };

  include MixinAuthorization(accessControlState, null);
  include LedgerApi(balances, allowances, poolState, accessControlState);
  include SwapApi(balances, poolState, icpLedgerPrincipal, selfPrincipal);
  include TreasuryApi(balances, poolState, accessControlState, selfPrincipal);
  include WalletApi(balances, poolState, icpLedgerPrincipal);
  include IntegrationApi(balances, poolState, accessControlState, integrationPrincipals, prizePools, movements, selfPrincipal);
  include ApiDocMixin();
  include Expose({
    entities = [
      // Lucky balances: owner principal is the map key, promoted to a column.
      OQL.Entity.manual<(Principal, Nat)>("balance", func () = balances.entries(), "Balance", "owner")
        .sample((selfPrincipal, 0))
        .payload("owner", func((owner, _)) = owner)
        .payload("amount", func((_, amount)) = amount)
        .controllerOnly()
        .build(),
      // ICRC-2 allowances: nested map flattened into owner/spender/amount rows.
      OQL.Entity.manual<(Principal, Principal, Nat)>("allowance", allowanceRows, "Allowance", "owner")
        .sample((selfPrincipal, selfPrincipal, 0))
        .payload("owner", func((owner, _, _)) = owner)
        .payload("spender", func((_, spender, _)) = spender)
        .payload("amount", func((_, _, amount)) = amount)
        .controllerOnly()
        .build(),
      // Single-row pool/treasury state table.
      OQL.Entity.manual<CommonTypes.PoolState>("poolState", func () = [poolState].values(), "PoolState", "id")
        .sample({ var totalSupply = 0; var poolLucky = 0; var treasuryLucky = 0 })
        .payload("id", func(_state) = "pool")
        .payload("totalSupply", func(s) = s.totalSupply)
        .payload("poolLucky", func(s) = s.poolLucky)
        .payload("treasuryLucky", func(s) = s.treasuryLucky)
        .controllerOnly()
        .build(),
      // Integration movement ledger: one row per recorded fund movement. The
      // game event id is the map key, promoted to a column.
      OQL.Entity.manual<(IntegrationTypes.GameEventId, IntegrationTypes.Movement)>(
        "movement",
        func () = movements.entries(),
        "Movement",
        "gameEventId",
      )
        .sample(("", {
          gameEventId = "";
          source = #ExcessSweep;
          direction = #In;
          amount = 0;
          counterparty = selfPrincipal;
          timestamp = 0;
        }))
        .payload("gameEventId", func((id, _)) = id)
        .payload("source", func((_, m)) = switch (m.source) {
          case (#ExcessSweep) "ExcessSweep";
          case (#Crowdfunding) "Crowdfunding";
          case (#PrizePoolTopUp) "PrizePoolTopUp";
          case (#BetDebit) "BetDebit";
          case (#PrizePayout) "PrizePayout";
        })
        .payload("direction", func((_, m)) = switch (m.direction) {
          case (#In) "In";
          case (#Out) "Out";
        })
        .payload("amount", func((_, m)) = m.amount)
        .payload("counterparty", func((_, m)) = m.counterparty)
        .payload("timestamp", func((_, m)) = m.timestamp)
        .controllerOnly()
        .build(),
      // Prize pool balances: one row per game prize pool. The pool id is the
      // map key, promoted to a column.
      OQL.Entity.manual<(IntegrationTypes.PrizePoolId, Nat)>(
        "prizePool",
        func () = prizePools.entries(),
        "PrizePool",
        "prizePoolId",
      )
        .sample(("", 0))
        .payload("prizePoolId", func((id, _)) = id)
        .payload("balance", func((_, balance)) = balance)
        .controllerOnly()
        .build(),
    ];
  });
};
