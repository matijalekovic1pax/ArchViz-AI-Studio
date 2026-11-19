# Visual Identity Reference — ArchViz AI Studio

> This document describes the complete visual identity of **ArchViz AI Studio**, an AI-powered architecture/visualization workspace. Use it as the single source of truth to build another app with the same look, feel, and personality.

---

## 1. Design Personality

- **Warm minimalism**: a near-white, warm-gray canvas with charcoal ink and a single champagne/bronze accent. Nothing is loud; hierarchy comes from neutrals.
- **Pro-tool density**: tiny type (9–12px is normal), uppercase micro-labels, monospace numeric readouts — it feels like a professional editor (Figma/Blender/DAW), not a marketing site.
- **Quiet luxury**: generous whitespace, hairline borders (`1px` at ~90% black at 8–10% opacity), subtle shadows, and one warm metallic accent used sparingly (active states, icons, brand marks).
- **Calm + confident**: pill-shaped primary actions, soft rounded corners (6–16px), no harsh saturated colors except semantic danger (red) and transient UI (amber toasts, timeline editor).
- **Light-first**: the entire product is light mode. Dark is reserved for media surfaces (video timeline, image overlays).

---

## 2. Color System

### 2.1 Neutrals (the backbone)

| Token | Hex | Usage |
|---|---|---|
| `background` | `#FAFAF8` | App canvas / page background. Also `<meta name="theme-color">`. |
| `background-secondary` | `#F5F5F3` | Panel bodies, bottom panel content, tab active background. |
| `background-tertiary` | `#EEEDE9` | Left workflow content panel background. |
| `surface-elevated` | `#FFFFFF` | Cards, top bar, modals, dropdowns, input fields. |
| `surface-sunken` | `#F0F0EC` | Inset wells, segmented control track, search fields, toggle track (off), nav rail hover. |
| `foreground` | `#1A1A1A` | Primary text, primary button fill, active pill. Nearly black with warm cast. |
| `foreground-secondary` | `#4A4A4A` | Body/label text. |
| `foreground-muted` | `#8A8A8A` | Micro-labels, icons, hints, placeholders. |
| `foreground-subtle` | `#B0B0B0` | Footer/disclaimer text. |
| `border` | `#E5E5E0` | Default hairline borders (cards, panels, inputs). |
| `border-subtle` | `#EFEFEA` | Internal dividers, accordion rows, table hairlines. |
| `border-strong` | `#D0D0C8` | Stronger dividers, toggle track (off), thumb borders. Also scrollbar thumb color. |

### 2.2 Accent (the signature)

| Token | Hex | Usage |
|---|---|---|
| `accent` | `#C9B99A` | Champagne/bronze. The brand accent — used *sparingly*: active nav rail marker, selection rings, hover icon tints, text links. |
| `accent-hover` | `#B8A687` | Deeper bronze for hover on accent surfaces. |
| `accent-muted` | `#E8E0D0` | Pale champagne: focus rings, selection backgrounds, small dots. |

**Accent rules of thumb:**
- Never use accent as a big filled button. Primary actions are **ink** (`#1A1A1A`) on paper.
- Accent appears as: a 4px vertical bar marking the active nav item, ring/border on selected items, hover text color on the generate button icon, checkmark badges, and small 4–6px dots.
- `selection:bg-accent selection:text-foreground` for text selection.

### 2.3 Semantic colors

| Meaning | Styling |
|---|---|
| Danger | `red-600` (`#dc2626`) fills, `text-red-600`, `hover:bg-red-50` on ghost items. |
| Warning toast | `amber-50/95` bg, `amber-200` border, `amber-900` text. |
| Error toast | `red-50/95` bg, `red-200` border, `red-900` text. |
| Video timeline editor | Dark editor: `#1e1e1e` background, `#252525` ruler, `#2a2a2a` tracks, `white/10` hairlines, `blue-500` video clips, `yellow-500` keyframes, `green-500` audio waveform, `red-500` playhead. |
| Overlays on imagery | `black/60`–`black/90` gradients and `backdrop-blur`. |

---

## 3. Typography

### 3.1 Fonts (loaded from Google Fonts in `index.html`)

| Role | Family | Weights loaded |
|---|---|---|
| UI + headings | **Inter** | 400, 500, 600 (the app mostly uses 500/600/700 rendered from these) |
| Numeric readouts, prompts, code | **JetBrains Mono** | 400, 500 |

- Body root: `font-family: 'Inter', sans-serif`, with `antialiased` on `<body>`.
- Stack: `Inter, system-ui, sans-serif` / `JetBrains Mono, Consolas, monospace`.

### 3.2 Type scale & conventions (critical to the look)

| Element | Spec |
|---|---|
| App title (top bar) | `text-sm font-bold` (14px), leading-tight |
| App subtitle (top bar) | `text-[10px] text-foreground-muted` |
| Section headers (left panel) | `text-[10px] font-bold uppercase tracking-widest text-foreground-muted` |
| Accordion triggers | `text-xs font-medium uppercase tracking-wider text-foreground-muted` (hover → foreground) |
| Panel section labels | `text-xs font-bold uppercase tracking-wider text-foreground-muted` |
| Field labels | `text-xs font-medium text-foreground` (right panel) / `text-xs font-medium text-foreground-secondary` (left panel) |
| Numeric values | `text-[10px] font-mono text-foreground-muted` (tabular via `tabular-nums` where possible) |
| Body / helper text | `text-xs` or `text-[10px] leading-relaxed text-foreground-muted` |
| Cards (selectable) | Title `text-xs font-bold`; description `text-[10px] leading-relaxed text-foreground-muted` |
| Generate button label | `text-sm font-bold tracking-wide` |

**Golden rule:** uppercase + tracking-wider micro-labels in `foreground-muted` are the signature "pro tool" element. Use them for every section title, tab, badge, and button label that is 10px or smaller.

---

## 4. Shape, Radius, Shadow, Spacing

### 4.1 Border radius

| Size | Where |
|---|---|
| `rounded-md` (6px) | Buttons, chips, inputs, small wells |
| `rounded-lg` (8px) | Cards, dropdowns, selects, style thumbnails, logo tile |
| `rounded-xl` (12px) | Top-level cards, dialogs, modals, toasts |
| `rounded-2xl` (16px) | Modal panels, canvas floating cards |
| `rounded-full` | Generate button, cancel button, avatar, toggle pill, icon buttons in top bar, active-check badges |

### 4.2 Shadows

| Token | Value | Where |
|---|---|---|
| `shadow-subtle` | `0 1px 2px rgba(0,0,0,0.04)` | Nav rail, small cards, selected segmented option |
| `shadow-sm` (default) | default | Check badges, active tool buttons |
| `shadow-md` | default | Logo tile |
| `shadow-lg` | default | Generate button, hover |
| `shadow-elevated` | `0 8px 32px rgba(0,0,0,0.12)` | Dropdowns, modals' menus, cancel button, canvas floating toolbars |
| `shadow-2xl` | default | Modal dialogs |
| `shadow-inner` | default | Sun-position widget well |
| `shadow-[0_0_12px_rgba(250,204,21,0.8)]` | glow | Light-source handle in sun widget |

### 4.3 Spacing & layout metrics

| Metric | Value |
|---|---|
| Left nav rail | `w-14` (56px), expands to 200px on hover (`group hover:w-[200px]`) |
| Left workflow panel | 280px (`spacing.sidebar`), user-resizable |
| Right settings panel | 320px (`spacing.panel`) |
| Collapsed left panel | `w-10` with vertical-rl label |
| Top bar | `h-16` on desktop, `px-6`, `border-b border-border`, `shadow-sm` |
| Bottom panel | 220px expanded, 40px collapsed; tab strip `h-9`/`h-10` |
| Panel padding | `p-5` (left), `p-5` (right), section gaps `space-y-6` (right) / `space-y-4` (left) |
| Hairline dividers | `h-px bg-border-subtle`, vertical `w-px h-3 bg-border` or `h-6 bg-border-strong` |

---

## 5. Iconography

- **Library:** [lucide-react](https://lucide.dev) — always. Stroke icons, never filled (except decorative fills like play buttons).
- **Default size:** 14–16px for toolbar actions, 12px inside micro-buttons, 18–20px for the generate button and nav rail, 24px for empty states.
- **Default stroke:** `strokeWidth={1.5}` in the nav rail; default (2) elsewhere.
- **Tint:** `text-foreground-muted` at rest → `text-foreground` (or `text-accent`) on hover.
- Section headers in the right panel pair a 12px lucide icon (e.g. `Sun`, `Wind`, `User`, `Trees`, `Car`) tinted `text-accent` with a bold label.

---

## 6. Component Style Guide

### 6.1 Primary action — the Generate button (hero element)

- **Shape:** pill, `rounded-full`, `min-w-[176px]`, `px-8 py-2.5`.
- **Rest:** `bg-foreground text-background shadow-lg`, with a **hover shine**: `bg-gradient-to-r from-transparent via-white/10 to-transparent` that sweeps left→right on hover (via `group-hover:translate-x-[100%]`, 1000ms).
- **Hover:** `hover:scale-105` + `hover:shadow-xl` + `hover:border-accent/50`. Active: `active:scale-95`.
- **Disabled:** `bg-surface-sunken text-foreground-muted cursor-not-allowed`.
- **Generating:** icon spins, `Loader2 animate-spin`; label + `tabular-nums` mono percentage; a `bg-accent/25` progress fill animates width; a red **Cancel** pill emerges beside it (`animate-cancel-emerge`, `bg-red-600 text-white` with pulsing dot).

### 6.2 Buttons

| Variant | Classes (essence) |
|---|---|
| Primary (small) | `bg-foreground text-background hover:bg-foreground/90 rounded-md` |
| Ghost / menu row | `text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-lg` |
| Icon button (top bar) | `h-9 w-9 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors` |
| Toolbar icon (top bar left) | `p-1.5 rounded-md text-foreground-secondary hover:text-foreground hover:bg-surface-elevated`; disabled = `opacity-40 cursor-not-allowed` |
| Pill chip | `rounded-full bg-surface-sunken px-2.5 py-1.5 text-[10px] font-semibold hover:bg-surface-elevated` |
| Outline micro-button (bottom panel) | `px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider`, border `border-border`, text muted; active variant `border-accent text-accent bg-accent/10` |
| Danger ghost | `hover:bg-red-50 hover:text-red-600` |

**Selected-state pattern (segmented/pills/options):** selected = `bg-foreground text-background shadow-sm` (the "ink pill"); unselected = `text-foreground-secondary hover:text-foreground hover:bg-surface-elevated`.

### 6.3 Inputs & selects

- **Text/number inputs:** `bg-surface-sunken border border-border rounded px-2 text-xs`, focus = `focus:border-accent outline-none`. Number inputs are `w-16 h-7 text-right`.
- **Search inputs:** `bg-surface-sunken border-transparent rounded-md focus:bg-surface-elevated focus:border-accent` with a 12px magnifier icon absolutely positioned left.
- **Selects:** `w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2`.
- **Textareas (prompt editor):** transparent bg, `font-mono text-sm`, no outline; floating copy/revert buttons appear on group hover, `bg-surface-elevated border border-border rounded shadow-sm`.

### 6.4 Sliders (Radix `@radix-ui/react-slider`)

- Track: `h-[4px] bg-border rounded-full`; filled range: `bg-foreground`.
- Thumb: `w-4 h-4 bg-surface-elevated border border-border-strong rounded-full hover:bg-surface-sunken focus:ring-2 focus:ring-accent-muted active:scale-95 transition-transform`.
- Label row: label left (`text-xs`), value right in `font-mono text-foreground-muted`.
- **Color-temperature slider:** a gradient strip (`#ff6b35 → #ffd4a3 → #fff → #9dc4ff`) with a transparent range input overlay and a black marker line.

### 6.5 Toggles (Radix switch)

- Track: `w-[36px] h-[20px] rounded-full`; on = `bg-foreground`, off = `bg-border-strong`; 200ms ease-in-out.
- Thumb: `w-[16px] h-[16px] bg-white rounded-full shadow-sm`, slides 16px.
- Row pattern: label left, switch right, `justify-between py-1`.

### 6.6 Segmented control

- Container: `flex bg-surface-sunken p-1 rounded-md`.
- Option: `flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200`; active = `bg-surface-elevated text-foreground shadow-subtle`; inactive = `text-foreground-muted hover:text-foreground-secondary`.

### 6.7 Accordion (Radix)

- Rows divided by `border-b border-border-subtle`; trigger = uppercase tracking micro-label with a 16px `ChevronDown` that rotates 180° on open.
- Animation: `slide-down 220ms ease-out` / `slide-up 180ms ease-in`.
- Section content rows often live in `bg-surface-elevated border border-border rounded p-2` wells with a bold label + icon + toggle.

### 6.8 Cards

| Card type | Spec |
|---|---|
| Selectable option (right panel) | `p-3 rounded-lg border transition-all mb-2`; selected = `bg-foreground text-background border-foreground shadow-sm`; unselected = `bg-surface-elevated border-border hover:border-foreground-muted` |
| Style thumbnail | `h-14 rounded-md overflow-hidden border` with `object-cover` image, dark gradient overlay (`from-black/80 via-black/40 to-transparent`), white bold 10px label; selected = `border-foreground ring-2 ring-foreground shadow-md scale-[1.02]` with a check badge |
| Mood chip (atmosphere) | `py-2 px-1 text-[10px] font-bold border rounded`; selected = `bg-surface-sunken border-foreground/50` |
| Empty state | centered 24px muted icon at `opacity-20` + `text-xs` message |
| History thumb | `aspect-video rounded-lg border`; hover reveals `bg-gradient-to-t from-black/80` caption bar with time + mode |

### 6.9 Dropdown menus

- Panel: `rounded-xl border border-border bg-surface-elevated p-2 shadow-elevated z-50`, `w-56`/`w-72`, anchored with `mt-2`.
- Header block: `px-2 pb-2 pt-1` with `text-[10px] font-bold uppercase tracking-wider text-foreground-muted`.
- Items: `flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold`, 14px lucide icon; hover = `hover:bg-surface-sunken hover:text-foreground`.
- Selected item (e.g. language/model): `bg-foreground text-background`.
- Dividers: `my-2 h-px bg-border-subtle`.
- All dropdowns close on outside click and Escape.

### 6.10 Modals

- Overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm` (50–70% black depending on context).
- Panel: `bg-background rounded-2xl border border-border shadow-2xl` (smaller dialogs `rounded-xl`), scale-in entrance.
- Header: `h-10/h-11 px-4 border-b border-border bg-surface-elevated` with `text-xs font-bold tracking-tight` title + X button; body `p-4 space-y-4`.
- Footer: `h-7` (light hint bar) or `h-12 px-4` with actions, `bg-surface-sunken border-t border-border`.
- Footer hint chips: small bordered rounded squares with a key label ("↵ Select", "Esc Cancel") — `text-[9px] text-foreground-muted`.

### 6.11 Toasts / app alerts

- Position: `fixed top-20 left-1/2 -translate-x-1/2 z-[120] w-[92vw] max-w-xl`.
- Card: `rounded-xl border shadow-lg backdrop-blur bg-surface-elevated/95`, icon left (16px), bold title + normal message, X dismiss; auto-dismiss after 8s.

### 6.12 Nav rail (feature switcher)

- `w-14` white column with `shadow-subtle`, icons at `text-foreground-muted` (strokeWidth 1.5); active item = `bg-surface-sunken text-foreground` plus a 4px accent bar (`w-1 h-5 bg-accent rounded-r-full`) on the left edge.
- Hover expands to 200px revealing labels (`transition-all duration-300 ease-out`).

### 6.13 Tabs (bottom panel)

- Strip: `h-10 bg-surface-elevated border-b border-border-subtle`; tabs = `px-4 uppercase tracking-wider text-[10px]` with 14px icon; active = `bg-background-secondary text-foreground`, separated by `border-r border-border-subtle`.

---

## 7. Motion & Micro-interactions

### 7.1 Keyframes (from `tailwind.config.cjs`)

| Animation | Spec | Used for |
|---|---|---|
| `slide-down` | height 0→auto + fade, **220ms ease-out** | Accordion open |
| `slide-up` | height auto→0 + fade, **180ms ease-in** | Accordion close |
| `cancel-emerge` | `translateX(-14px) scale(0.7)` → overshoot `scale(1.06)` → settle, **520ms** `cubic-bezier(0.18, 0.9, 0.22, 1.1)` | Cancel button popping in next to Generate |
| `retry-notice-drop` | drop from `translateY(-10px) scale(0.96)` with overshoot, **420ms** `cubic-bezier(0.18, 0.9, 0.22, 1.08)` | Notices |
| `liquid-blob` / `liquid-bridge` | blob sliding + stretching trail, **520ms** `cubic-bezier(0.2, 0.9, 0.2, 1)` | Cancel button "liquid" connection effect |

Also used app-wide (define these in your Tailwind config — see Gotchas): `fade-in` (opacity, ~150–200ms) for dropdowns/toasts/overlays, and `scale-in` (~120ms, slight scale-up) for modals and check badges.

### 7.2 Interaction rules

- Every interactive element has `transition-colors` (or `transition-all` where size/shadow moves too), typically `duration-200`.
- Hover micro-scale on thumbnails: `hover:scale-[1.01]`/`hover:scale-105` (image `group-hover:scale-105 duration-500`).
- Press feedback: `active:scale-95` on buttons, `active:scale-95` on slider thumbs.
- Image hover zoom: `transition-transform duration-500 group-hover:scale-105` (700ms in the style browser).
- Chevrons rotate 180° on open (`transition-transform`, `rotate-180`).
- Panel collapse/expand: `transition-all duration-300` (bottom panel) / `duration-300 ease-out` (nav rail).
- Shine sweep on the generate button (see 6.1) — the signature delight detail.
- Content appears with `animate-fade-in` when toggled (e.g. accordion sections, panel sections).

---

## 8. Glassmorphism & Overlays

The canvas area (image viewport) is where glass appears — floating toolbars over imagery:

- `bg-surface-elevated/90`–`/95` + `backdrop-blur-xl` + `border border-white/70` + `ring-1 ring-black/5` + `shadow-elevated` (floating cards, toolbar buttons, compare panel).
- On-video controls: `bg-black/30–80` + `backdrop-blur-sm/md` + `border-white/20`.
- Caption bars over images: `bg-gradient-to-t from-black/80 to-transparent`.
- Overlay modals: `bg-black/60 backdrop-blur-sm` full-screen scrim.

---

## 9. Scrollbars, Selection, Misc

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D0D0C8; border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: #8A8A8A; }
```

- Text selection: `selection:bg-accent selection:text-foreground`.
- `body`: `bg-background text-foreground antialiased overflow-hidden`, `font-sans`.
- App chrome z-index stack: nav rail/top bar `z-30–40`, dropdowns `z-50`, modals `z-50–60`, admin/feedback `z-90–98`, toasts `z-[120]`.

---

## 10. Logo / Favicon

- **Mark:** a 64×64 rounded-square (`rx=16`) in `#1A1A1A` containing:
  - a champagne diagonal line `#C9B99A` over a paper diagonal line `#FAFAF8` (double-stroke "slash"),
  - a champagne 5-pointed star (`#C9B99A` with `#FAFAF8` core) in the top right,
  - 6 small dots (r1.3–2.3) in `#C9B99A`, `#E8E0D0`, `#B8A687` scattered like a constellation.
- **In-app tile:** `w-8 h-8 bg-foreground rounded-lg shadow-md` with bold `AV` initials in `text-surface-elevated text-sm`.
- Star = the "sparkles" motif; mirror it with the `Sparkles` lucide icon in your UI.

---

## 11. Implementation Cheatsheet

### 11.1 Tailwind theme to copy (exact)

```js
// tailwind.config
theme: { extend: {
  colors: {
    background: { DEFAULT: '#FAFAF8', secondary: '#F5F5F3', tertiary: '#EEEDE9' },
    foreground: { DEFAULT: '#1A1A1A', secondary: '#4A4A4A', muted: '#8A8A8A', subtle: '#B0B0B0' },
    border: { DEFAULT: '#E5E5E0', subtle: '#EFEFEA', strong: '#D0D0C8' },
    accent: { DEFAULT: '#C9B99A', hover: '#B8A687', muted: '#E8E0D0' },
    surface: { elevated: '#FFFFFF', sunken: '#F0F0EC' },
  },
  fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'Consolas', 'monospace'] },
  spacing: { sidebar: '280px', panel: '320px' },
  boxShadow: { subtle: '0 1px 2px rgba(0,0,0,0.04)', elevated: '0 8px 32px rgba(0,0,0,0.12)' },
  keyframes: { /* slide-down, slide-up, cancel-emerge, retry-notice-drop, liquid-blob, liquid-bridge — see §7.1 */ },
  animation: { /* mapped 1:1 with the keyframes */ },
}}
```

Plus the standalone keyframes/animation utilities you must define yourself:

```css
@keyframes fade-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
.animate-fade-in  { animation: fade-in 180ms ease-out }
.animate-scale-in { animation: scale-in 140ms cubic-bezier(0.18, 0.9, 0.22, 1.1) }
```

### 11.2 Recurring class recipes

- Section header: `text-[10px] font-bold uppercase tracking-widest text-foreground-muted`
- Ink pill (selected/primary): `bg-foreground text-background shadow-sm`
- Card: `bg-surface-elevated border border-border rounded-lg`
- Ghost hover: `hover:bg-surface-sunken hover:text-foreground transition-colors`
- Hairline divider: `h-px bg-border-subtle` / vertical: `w-px bg-border-strong`

---

## 12. Gotchas for the new app

1. `animate-fade-in`, `animate-scale-in`, `custom-scrollbar`, `no-scrollbar`, `shadow-soft`, and `shadow-inner-subtle` are **referenced but not defined** in this codebase's Tailwind config or CSS. If you want them to actually render, define them (see §11.1 and the scrollbar CSS in §9).
2. Inter is loaded with weights 400/500/600 only — bold (`font-bold`) renders from 600 unless you add 700. Consider loading 400/500/600/700.
3. The **hero interaction** is the generate button's hover shine sweep + scale spring (`hover:scale-105 active:scale-95`). Keep it in any new app for the same "feel".
4. Preserve the muted-then-ink selected pattern everywhere (segmented controls, dropdown options, pills, tabs) — it is the most consistent identity signal in the app.
5. Keep everything light-first; reserve dark surfaces for media editors/overlays only.
6. All icons via lucide-react with 1.5–2 stroke width; never mix in another icon set.
