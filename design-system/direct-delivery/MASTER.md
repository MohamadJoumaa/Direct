# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Direct Delivery
**Generated:** 2026-08-29 13:11:00
**Category:** Delivery / Mobility (Uber-style monochrome)

---

## Global Rules

### Color Palette

Uber-inspired monochrome. Light mode is white/grey with black primary buttons; dark mode is near-black with white primary buttons. The brand blue (from the Direct logo) is used ONLY as a small accent: links, active nav states, focus rings, map markers. Never as a background fill for sections or buttons.

**Light mode (`:root`)**

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary (buttons) | `#0a0a0a` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#f3f3f3` | `--color-secondary` |
| On Secondary | `#0a0a0a` | `--color-on-secondary` |
| Accent (hover tint) | `#f3f3f3` | `--color-accent` |
| Brand blue (accent only) | `#2563eb` | `--color-brand` |
| Light gold (decorative only) | `#d4af37` | `--color-gold` |
| Gold soft tint | `#f7f0da` | `--color-gold-soft` |
| Background | `#ffffff` | `--color-background` |
| Foreground | `#0a0a0a` | `--color-foreground` |
| Card | `#ffffff` | `--color-card` |
| Muted | `#f6f6f6` | `--color-muted` |
| Muted Foreground | `#575757` | `--color-muted-foreground` |
| Border | `#e5e5e5` | `--color-border` |
| Destructive | `#dc2626` | `--color-destructive` |
| Ring | `#0a0a0a` | `--color-ring` |

**Dark mode (`.dark`)**

| Role | Hex |
|------|-----|
| Background | `#0a0a0a` |
| Card / surfaces | `#141414` |
| Primary (buttons) | `#ffffff` (black text) |
| Secondary / muted | `#1f1f1f` / `#262626` |
| Border | `#2a2a2a` |
| Muted Foreground | `#a3a3a3` |
| Brand blue accent | `#4d82f3` (brighter for contrast) |

**Color Notes:** Shades of white and black only for surfaces. Functional UI (buttons, nav, states) uses white, black, and blue shades only. Light gold is a decorative side effect exclusively: thin accent lines, logo glow, a chart highlight — never section backgrounds, buttons, or text blocks. Dark mode gold: `#e3c65b` / tint `#2a2410`.

### Typography

- **Heading Font:** Plus Jakarta Sans (loaded via `next/font`, weights 400-800)
- **Body Font:** Plus Jakarta Sans
- **Mood:** minimal, clean, swiss, functional, neutral, professional (Uber Move stand-in)
- Headlines: very large, bold, tight tracking (`tracking-tight`), black on white.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #4338CA;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #475569;
  border: 2px solid #475569;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0F172A;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #475569;
  outline: none;
  box-shadow: 0 0 0 3px #47556920;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Hero + Testimonials + CTA

- **Conversion Strategy:** Social proof before CTA. Use a concise set of verified testimonials with photo, name, and role. CTA after social proof. Provide previous/next and pause controls; stop rotation on focus, hover, and reduced motion; announce slide position. Previous/next buttons and keyboard controls must expose every slide without dragging.
- **CTA Placement:** Hero (sticky) + Post-testimonials
- **Section Order:** Hero > Problem statement > Solution overview > Testimonials carousel > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive decoration
- ❌ Pure white backgrounds

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
