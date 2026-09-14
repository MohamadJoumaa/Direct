# Direct Delivery — mobile (Phase 2)

Expo app for iOS and Android. All four roles — client, business, driver, admin —
in one binary, sharing every domain rule with the website.

```bash
npm install                # from the repo root
npm run mobile             # expo start (scan the QR with Expo Go / a dev build)
npm run mobile:ios         # iOS simulator (macOS only)
npm run mobile:android     # Android emulator / device
npm run mobile:web         # browser preview — see "Web preview" below
npm run typecheck:mobile   # tsc --noEmit
```

Copy `.env.example` to `.env.local` first. Every `EXPO_PUBLIC_*` value is inlined
into the JS bundle, so **none of them may be a secret** — the Whish channel and
secret stay on the web deployment and are reached through `EXPO_PUBLIC_WEB_URL`.

Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript.

---

## What is shared, and what is not

The domain lives in workspace packages, imported by both clients:

| Package | Holds |
|---|---|
| `@direct/shared` | Pricing, urgent ×3, subscription, capacity, dispatch ring, route sequencing, Whish unlock rules, Beirut work-day |
| `@direct/core` | The application state: types, seed, migrations, and every mutation as a pure function. Also place naming and the driver route builder |
| `@direct/i18n` | The `en` / `ar` dictionaries and the pure string helpers |

**Never fork a rule into this app.** If mobile needs domain logic the website
already has, move it into one of those packages and let both import it. A fare,
a freeze, or a payment gate that differs between the two clients is a bug.

What is app-specific: the React Native UI, navigation, the AsyncStorage store
provider, native location and maps, and the Expo Whish client.

---

## Layout

```
app/                      Expo Router routes (file = route)
  _layout.tsx             fonts, providers, splash, public stack
  index.tsx               landing (redirects to /home when signed in)
  login.tsx  register.tsx
  (app)/_layout.tsx       auth gate; detail screens push over the tabs
  (app)/(tabs)/           role-aware tab bar
  (app)/orders/[id].tsx   one order, seen from whichever side is looking
  (app)/admin/…           warehouses, businesses, documents, settings, reports
src/components/           UI kit (ui/), map panels, header, order card
src/screens/              the three role homes, used by the home tab
src/lib/                  store, auth, i18n, maps, route distance, Whish, location task
src/theme/                design tokens + theme provider
```

Route groups (`(app)`, `(tabs)`) add **no path segment**: `(app)/(tabs)/new.tsx`
is `/new`. Always link with the plain path. The signed-in home is `/home`, not
`/`, because `/` is the public landing and two files cannot claim one path.

---

## How it differs from the website, on purpose

- **One tab bar per role** instead of a nav row. Four to five destinations; the
  admin's long tail lives behind **More**.
- **Bottom sheets, not centred dialogs.** The bottom of a phone is the only
  region reachable one-handed.
- **A primary action is pinned below the scroll area** (`Screen`'s `footer`), so
  "Place order" or "Picked up" is always under the thumb.
- **Map-centre pin** for choosing a place, rather than tapping a small target.
- **Turn-by-turn is handed to Apple/Google Maps**, the app the driver already
  trusts, which keeps working when Direct is in the background.
- **Background location** while a driver is online (`expo-location` +
  `expo-task-manager`, Android foreground service). The task runs outside React
  and mutates the same stored state through the pure `updateLocation`.

---

## Payment — the binding contract

Read [`packages/shared/src/payment-rules.md`](../../packages/shared/src/payment-rules.md).
It governs this app exactly as it governs the website.

Drivers pay via **merchant collect**. `apps/mobile/src/lib/whish.ts` calls the
deployed Next.js routes (`/api/whish/create`, `/api/whish/status`) at
`EXPO_PUBLIC_WEB_URL` — there is no second collect surface and no secret here.

- [x] Unlock **only** when the status re-check by `externalId` returns paid
      **and** `isWhishCollectPaid(status)` is true — exact `"success"`.
- [x] Opening the pay URL, closing the browser, a redirect, a callback, or a
      deep-link parameter unlocks nothing.
- [x] Amounts capped at `WHISH_MAX_AMOUNT_USD`.
- [x] With the channel/secret unset the create route answers
      `{configured: false}` and the UI falls back to **"I already paid"**, which
      logs a pending transaction for an admin to confirm in Admin → Budget.
- [x] The company Whish number is contact only, never payment proof.
- [x] Percentage drivers: `dueNow` blocks work, `accruingToday` never does;
      `isDriverPaymentBlockingWork` is the single gate, re-evaluated on every
      claim and go-online. No cron.

---

## Maps

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is optional.

- **iOS** falls back to Apple Maps and always renders.
- **Android** is Google-only; with no key `mapsAvailable()` is false and the
  panels degrade to a labelled list of the same points, the way the website's
  offline placeholder does.
- Distances use the Distance Matrix REST API with a 45s cache, falling back to
  haversine on any failure — same behaviour as `apps/web/src/lib/route-distance.ts`.
- Place labels come from `locationLabel` in `@direct/core`, which **never returns
  raw coordinates**.

---

## Language and RTL

EN/AR from `@direct/i18n`; adding a key means adding it to both dictionaries.

Switching to Arabic calls `I18nManager.forceRTL` and then relaunches through
`expo-updates`. React Native only mirrors layout after a restart, so the relaunch
is not optional — without it the app would show Arabic strings in a
left-to-right layout. Use logical styles (`marginStart`, `paddingEnd`,
`textAlign: "left"`) everywhere; they flip for free.

---

## Web preview

`npm run mobile:web` runs the app in a browser. **The browser is not a target** —
iOS and Android are — but it makes design and copy review fast without a device.
Two accommodations exist for it, both inert on native:

- `src/shims/react-native-maps.web.tsx`, aliased in `metro.config.js`, because
  `react-native-maps` ships no web build.
- `applyDirection` sets `document.documentElement.dir`, because
  `react-native-web` does not honour `I18nManager` for layout.

---

## Monorepo notes

`metro.config.js` keeps hierarchical resolution **on** (packages such as
`react-native-reanimated` carry a pinned nested `semver`, which a flat search
never finds) and pins every `react` import to `apps/mobile/node_modules`, because
the root copy is the website's React and two Reacts in one bundle break hooks.

The shared packages ship TypeScript source; Metro watches the repo root and
Babel transpiles them like app code.

---

## Not done yet

- **Supabase.** State is still the shared demo store over AsyncStorage, the same
  one the website uses over `localStorage`. Phase 2 Workstream A replaces the
  store provider in both apps; screens should not need to change.
- **Push notifications.** `expo-notifications` is installed and the offer/status
  events already exist in the store, but no token registration or delivery yet.
- **App icon** is 512×512. Store submission wants 1024×1024.
- **Medical driver type** stays non-public, and AI support is out of scope.
