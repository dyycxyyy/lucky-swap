# Design Brief

## Direction

Clover Fortune — a warm, trustworthy mobile-first crypto swap app built around a lucky-clover token, where money feels lucky, clear, and safe.

## Tone

Warm refined minimalism: deep clover green on warm off-white, generous whitespace, and confident high-contrast numerals — friendly finance without corporate coldness.

## Differentiation

A large clover-green gradient balance card anchors the main page, with a warm gold treasury accent and a vector clover mark used as a recurring lucky motif — the app reads as a playful token, not a bank.

## Color Palette

| Token      | OKLCH        | Role                                    |
| ---------- | ------------ | --------------------------------------- |
| background | 0.985 0.008 150 | Warm off-white app canvas           |
| foreground | 0.16 0.02 155   | Near-black text, high-contrast numbers |
| card       | 1.0 0.004 150   | Elevated white surfaces                 |
| primary    | 0.46 0.15 155   | Deep clover green — CTAs, active tab    |
| accent     | 0.72 0.15 80    | Warm gold — treasury, luck highlights   |
| muted      | 0.94 0.015 150  | Secondary surfaces, input fills         |
| success    | 0.55 0.16 150   | Confirmed transfers, positive deltas    |
| destructive| 0.55 0.22 25    | Errors, insufficient pool balance       |

## Typography

- Display: Space Grotesk — headings, balances, brand wordmark
- Body: Figtree — labels, paragraphs, buttons, tab bar
- Mono: Geist Mono — Principal IDs, addresses, precise amounts
- Scale: hero `text-4xl font-bold tracking-tight`, h2 `text-2xl font-bold tracking-tight`, label `text-xs font-semibold tracking-widest uppercase`, body `text-base`

## Elevation & Depth

Layered surfaces: white cards on warm canvas with `shadow-subtle`, elevated modals/hero with `shadow-elevated`, and a green `shadow-clover` glow reserved for the primary swap action.

## Structural Zones

| Zone    | Background            | Border       | Notes                                          |
| ------- | --------------------- | ------------ | ---------------------------------------------- |
| Header  | bg-card               | border-b     | Sticky app bar: vector mark + Lucky Swap       |
| Content | bg-background         | —            | Gradient hero card, then alternating muted/30  |
| Tab bar | bg-card/95 backdrop   | border-t     | Fixed bottom nav: Swap · Treasury · Wallet     |

## Spacing & Rhythm

Mobile-first: `px-4` gutters, `space-y-4` between cards, `space-y-6` between sections, dense `gap-2` inside balance rows; generous `py-5` card padding.

## Component Patterns

- Buttons: rounded-full pills; primary = clover green, accent = gold for treasury actions, full-width CTAs on mobile
- Cards: `rounded-2xl` white surfaces, `shadow-subtle`, `border-border/60`; hero uses `bg-gradient-primary` with white text
- Badges: rounded-full muted pills for token symbols; gold pill for treasury, green for pool

## Motion

- Entrance: `animate-fade-in` on cards (0.35s ease-out), staggered by list index
- Hover: `transition-smooth` lift + shadow on interactive cards, scale-95 on button press
- Decorative: `animate-pulse-soft` on live balance indicators, `animate-shimmer` on loading skeletons

## Constraints

- Mobile-first only; bottom tab bar is the primary navigation
- Numbers and balances always high-contrast, tabular-nums, mono for addresses
- Semantic tokens only — no raw hex, no arbitrary color classes
- English-language interface; the token logo is a **vector clover mark** (emoji 🍀 is deprecated)

## Signature Detail

The clover-green gradient hero card with a gold treasury chip and a floating vector clover watermark — turning a swap balance into a lucky, premium centerpiece.

## Logo Concepts

The emoji 🍀 is **deprecated** as the Lucky token logo. It is replaced by a selectable vector clover mark. All four concepts share one construction system so they read as one family.

### Shared Construction System

- **Grid**: 64×64 viewBox (`viewBox="0 0 64 64"`), 4-unit safe padding → live area 8–56.
- **Clover geometry**: four circles of `r=13` centered at (32,19), (45,32), (32,45), (19,32); union filled as one clover silhouette. Optional 2-unit negative-space notch between leaves via a rotated square at the center.
- **Wordmark**: "Lucky Swap" in Space Grotesk 600, `tracking-tight`; cap-height aligned to the mark's optical center.
- **Lockup**: icon 32px + 12px gap + wordmark, vertically centered; `aria-label="Lucky Swap"` on the wrapper.
- **Color rule (no raw hex)**: every mark paints with `currentColor` — `fill="currentColor"` on solid marks, `stroke="currentColor"` on outline/ring/arrow marks. Color is chosen by the parent's `text-*` token (`text-primary`, `text-accent`, `text-mark-gold`), never hard-coded, so marks adapt to light/dark automatically.
- **Stroke rule**: outline marks use `stroke-width` 2 (hair) / 3 (regular) / 4 (bold) viewBox units, `stroke-linecap="round"`, `stroke-linejoin="round"`. Pair with the `.mark-vector` utility (`vector-effect: non-scaling-stroke`) so weight stays optically constant at 16–24px.
- **Transparency**: marks are transparent-background SVG — no baked raster, no background rect. They sit on any surface and inherit the theme.
- **Draw-in**: the gold outline clover may use `.animate-mark-draw` (stroke traces itself over 1.4s) on first paint; honor `prefers-reduced-motion`.

### Concept 1 — Outline Clover (default, gold stroke 金色描边)

- **Geometry**: the same four-circle clover union, but rendered as a **stroked outline** (`fill="none"`, `stroke-width=3`) with a 2-unit center notch cut by a rotated square. Transparent background — only the gold line defines the shape.
- **Colors**: stroke `text-mark-gold` (light `0.68 0.15 78`, dark `0.78 0.15 84`). On `bg-accent` surfaces use `text-accent-foreground`.
- **Usage**: default app icon, header + drawer brand mark, favicon, wallet token icon. Legible down to 16px because the stroke is a single continuous path.
- **Why it works**: a transparent, theme-aware gold line scales crisply and never fights the surface behind it — the user's concept realized as vector, not raster.

### Concept 2 — Clover Mark (solid)

- **Geometry**: four-circle union clover, solid `fill="currentColor"`, no ring, no stroke.
- **Colors**: light `text-primary` (0.46 0.15 155); dark `text-primary` (0.7 0.16 155). On `bg-primary` surfaces use `text-primary-foreground`.
- **Usage**: alternate default, dense UI where a filled shape reads faster than a line. Best at 24px and below.

### Concept 3 — Coin Clover

- **Geometry**: clover (scaled 0.62, centered) inside two concentric circles `r=27` and `r=22`, both stroked 3 units; a small 4-point spark at the top of the ring.
- **Colors**: clover `text-primary`; rings `text-mark-gold`. Clover may invert to `text-accent-foreground` on gold-filled coins.
- **Usage**: treasury/rewards surfaces, swap confirmation, Lucky token chip. Minimum 32px — ring detail blurs below that.

### Concept 4 — Swap Arrows

- **Geometry**: clover (scaled 0.58, centered) wrapped by two 150° arc arrows on `r=26`; each arrow head is a 7-unit chevron; 6-unit gap between the two arcs.
- **Colors**: clover `text-primary`; arcs `text-primary` with the leading arrowhead in `text-mark-gold`.
- **Usage**: the swap page hero watermark, loading/processing states, the swap CTA. Signals ICP↔Lucky exchange. Minimum 28px.

### Concept 5 — Fortune Seal

- **Geometry**: scalloped medallion — 24-lobe outer ring at `r=28`, inner ring `r=23`, centered clover (scaled 0.5); circular text on `r=20` path: "LUCKY SWAP" top arc, "FORTUNE" bottom arc, Space Grotesk 600, 5px, `letter-spacing: 1.5`.
- **Colors**: outer ring `text-primary`; inner ring `text-mark-gold`; clover `text-primary`; circular text `text-mark-gold`.
- **Usage**: collectible/badge contexts only — rewards modal, "lucky streak" achievement, about page. Never the primary app icon; never below 48px.

### Small-Size & Contrast Guidance

- **16px**: Outline Clover or solid Clover Mark only — single-path marks survive; ring/seal marks turn to mush.
- **24px**: Outline Clover, Clover Mark, Swap Arrows.
- **32px+**: all except Fortune Seal.
- **48px+**: Fortune Seal.
- **Light surfaces**: gold stroke `0.68 0.15 78` clears AA against warm off-white; never place a gold mark on a gold field — add a ring or container.
- **Dark surfaces**: gold lifts to `0.78 0.15 84`; green stays `0.7 0.16 155`. Never a green mark on a green field without a ring.
- **Contrast rule**: a mark must keep ≥3:1 against its surface (large-graphic minimum). When unsure, wrap it in a `bg-card` chip.

### Usage Rules

- **Selection**: `/logo` route lets the user pick one concept; the choice persists and drives header, drawer, wallet token icon, and swap watermark. Default = Concept 1 (Outline Clover).
- **Clear space**: keep padding ≥ 0.25× mark height on all sides; never place a mark inside a busy photo.
- **Do not**: stretch, rotate, recolor with raw hex, add drop shadows, or substitute the emoji 🍀 in brand positions.
- **Sizes**: icon 16/24/32/48; lockup wordmark 16–20px. Fortune Seal 48px+ only.

## Logo Preview

- Preview: `.platform/design/preview-1791154640786.jpg` — five concepts on light + dark backgrounds at 64px and 16px.
- Reference render: `src/frontend/public/assets/generated/lucky-swap-logo-concepts.dim_1536x1024.png` (design reference only — not a production asset).
