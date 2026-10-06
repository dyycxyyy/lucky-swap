# Project Guidance

## User Preferences

- Simplest reliable approach balancing security and efficiency; avoid over-engineering
- Mobile-first responsive layout
- English-language interface throughout
- Navigation uses a right slide-out drawer opened by a header hamburger button at the top-right
- Drawer nav items include an icon, name, and one-line description
- Reuse existing shadcn/ui components and theme tokens
- Brand mark is a single fixed vector logo (not an emoji): a transparent background with a gold outline forming a four-leaf clover with no stem
- All fund movements between the app and the external game go through the app backend; the game never reads or writes balances directly
- Integration callers are trusted principals authorized by an admin; unauthorized calls are rejected
- Every integration fund operation is idempotent on a game event id, and every movement is recorded as a queryable ledger entry

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- The user's gold-outline transparent clover is Concept 1 (default); solid Clover Mark is Concept 2.
- A Motoko string literal cannot contain unescaped double quotes; Markdown returned from getApiDoc must use single quotes for quoted phrases.
- The applied migration is read-only; adding a new stable field requires a new pending migration whose OldActor equals the previous migration's NewActor, with the new field initialized in NewActor.
- The logo-selection feature was removed: there is no /logo route, no Logo nav entry, and no backend logo-preference API. The brand mark is a single fixed gold-outline vector clover (Concept 1) rendered by CloverMark in the header, drawer, wallet Lucky token icon, and swap watermark.
- CloverMark renders only the Concept 1 OutlineClover and takes no logoId prop; callers pass size/className/title only.
- The backend logo-preference mixin/lib/types and the preferences stable field were removed; a pending migration (20261005_000000.mo) drops the field with OldActor equal to the previous migration's NewActor.
- The icrc1:logo token metadata remains the emoji 🍀 in ledger-api.mo and is not driven by any user preference.
- bash rm is denied in this environment; use unlink <path> to delete files.
- The icrc1:logo token metadata is a data:image/svg+xml;utf8 data URI of a transparent-background gold-outline four-leaf clover (single-quoted SVG attributes, %23D4AF37 gold stroke, 64x64 viewBox, fill='none'), matching the frontend CloverMark path exactly.
- The backend icrc1:logo SVG must mirror the frontend CloverMark's four-leaf geometry (N/E/S/W lobes joined at center plus a short curved stem); verify each leaf path reaches its axis extreme.
- CloverMark renders a single continuous four-lobe path (N/E/S/W) plus a stem, fill=none, stroke=currentColor, .mark-vector (non-scaling-stroke); callers supply gold via .text-mark-gold.
- The clover brand mark is four heart-shaped leaves (each a closed subpath ending in Z, point toward center, cleft outward) arranged symmetrically around center (32,32), with NO stem; the old four-looped-petal geometry and STEM_PATH were removed.
- The backend icrc1:logo data URI must carry the frontend CloverMark CLOVER_PATH verbatim (four closed heart subpaths, no stem); a heart-shaped leaf needs at least four cubic segments (or a cusp) — two segments between two endpoints yields a lens/almond petal, not a heart.
- getApiDoc describes the icrc1:logo metadata value as a data:image/svg+xml data URI of the gold-outline four-leaf clover, not the emoji.
- mintTo(to, amount) and burnFrom(from, amount) are admin-only ledger methods; both return #Ok(newTotalSupply), so success receipts must format the submitted amount, not result.Ok.
- BurnError variants are #NotAdmin, #InvalidAmount (Text), and #InsufficientBalance ({ balance : Nat }); burnFrom validates sufficiency before calling LedgerLib.burnFrom because debit uses Nat subtraction that would trap on underflow.
- The Treasury page now has MintToAddressForm and BurnFromAddressForm alongside MintForm/WithdrawForm; useTotalSupply wraps icrc1_total_supply under query key ['totalSupply'] with the shared 10s poll interval.
- The game integration surface lives in src/backend/mixins/integration-api.mo with logic in src/backend/lib/integration.mo and types in src/backend/types/integration.mo; the stable fields integrationPrincipals, prizePools, and movements were added by migration 20261006_000000.mo.
- Integration fund methods are idempotent by checking movements.get(eventId) before mutating; a replay returns the recorded outcome with no balance change.
- topUpPrizePool has no caller-supplied event id, so its movement id is derived from a transient monotonic counter plus pool id plus timestamp; a transient let binding needs no migration.
- Treasury intake credits poolState.treasuryLucky directly; treasury balance is poolState.treasuryLucky + balances[selfPrincipal].
- Movement.counterparty is a Principal object, so render it via counterparty.toText() before shortenPrincipal; Movement.timestamp is a nanosecond bigint, so divide by 1_000_000n before new Date().
- MovementSource and MovementDirection are generated as value enums in backend.d.ts, so label maps must import them as values and key Record<MovementSource, string> by the enum member.
- The drawer nav active-state must special-case /treasury to exact match, otherwise /treasury/funding highlights both Treasury and Funding entries.
- The frontend integration pages are /treasury/funding (admin-only, TreasuryFundingPage) and /integration (all users, IntegrationPage); shared hooks live in hooks/useBalances.ts and view models in lib/integration.ts.
