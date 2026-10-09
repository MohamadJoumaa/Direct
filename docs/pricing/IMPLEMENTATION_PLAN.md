# Pricing Model v2: Implementation Plan

**For:** the developer implementing the change, and any AI coding agent (Claude Code, Cursor) given a task from this plan.
**Source of truth for the business rules:** [`pricing_decisions.md`](./pricing_decisions.md). The visual version is [`pricing-map.html`](./pricing-map.html).
**Status:** ready to implement. All decisions in §2 (OD-1 to OD-15) were confirmed by the product owner. The gender rules (§3.5) are the agreed proposal.

---

## Read this first (for the developer)

1. **§1** — what changes, in one table.
2. **§3.0** — every option side by side. Then **§3.1–§3.5**: one section per order method (shared rules, Moto, Car, Economy, Taxi), each ending with its admin controls.
3. **§2** — the decisions behind it.
4. Then the details: §3 rules, §4 data model, §5 tasks, §6 test cases, §7 agent prompts.

## How to use this plan

- Work **phase by phase, in order**. Each phase has one ready-to-paste agent prompt (§7).
- Give an agent **one phase at a time**, plus this file and the repo's root `CLAUDE.md`.
- A phase is done only when its **acceptance criteria** pass and `npm run test:shared`, `npm run lint`, `npm run build` and `npm run typecheck:mobile` are all green.
- Every rule in §3 is the contract. If the code and this file disagree, this file wins. If this file and `pricing_decisions.md` disagree, ask the product owner.

### Branch strategy

The phases build on each other. After Phase 2 the store prices orders the new way, but the screens still show the old flow until Phases 3–5 land. So:

- Do all phases on **one feature branch** (e.g. `feature/pricing-v2`), one commit or PR per phase into that branch.
- **Merge into `main` only after Phase 5**, when admin, client, business and driver screens all match the new rules. Phase 6 (docs and cleanup) can follow on `main`.
- Never ship a state where the client sees one price and the driver or admin sees another.

### Repo rules that apply to every task (from `CLAUDE.md`)

1. **Never fork a domain rule between web and mobile.** All pricing math lives in `packages/shared`. All state changes live in `packages/core/src/store.ts`. The apps only call them.
2. **Mutations are pure:** `(state, ...args) => { state, error?: string }`. No IO in `packages/core`.
3. **Every new field gets a line in `migrateState()`** with a `?? default`, or saved demo states break.
4. **New shared test files must be added by hand** to the `test` script in `packages/shared/package.json`. There is no glob.
5. **i18n:** every new string goes into **both** `packages/i18n` dictionaries (en and ar), same shape.
6. **Logical CSS only** (`ps-`/`pe-`, `start`/`end`): the app flips to RTL.
7. **Money is dual currency:** show `formatDeliveryCash(usd, lbp)`.
8. Anything on the 5-second interval must **return the same state reference when nothing changed**.

---

## 1. What changes, in one table

| Area | Today | After |
|---|---|---|
| Price formula | One fare band (`interpolateFare`: flat to 3 km, linear to 150 km) × an order-type multiplier | **Each option has its own formula:** start price + (km − km included) × price per km, rounded to the nearest $0.50 |
| What the client picks | One price, plus an "urgent ×3" toggle | First a **service picker**: two large cards, **Packages** and **Taxi**, each with an icon or illustration. Then the **options**: Moto, Car or Economy for packages; **Moto only** for taxi (Car isn't shown at all) |
| Urgency | `is_urgent` triples the price | **Removed.** The option decides the speed: Moto and Car are same day, Economy takes 2–3 days |
| Availability | Every order is offered | Each option has a **distance range**. Out-of-range options are shown **greyed out with a reason**, never hidden |
| Night surcharge | One flat $1 / 89,000 LBP on every order | **Per option:** Moto +$1, Taxi Moto +$1, Car **not offered** at night (admin hours), Economy none |
| Vehicles | Drivers have a `driver_type` but no vehicle | Drivers have a **vehicle** (moto or car). Orders only go to drivers with the matching vehicle |
| Economy | Does not exist | Partner courier companies, a **region price table per company**, the **cheapest total chosen automatically**, and the company **hidden from the client** |
| Admin settings | Fare bands + multipliers | **One group of plain fields per option**, partner companies, **Taxi and Economy on/off switches**, and **warnings** when prices conflict (Car ≤ Moto, or Economy ≥ Moto). Full list in §5b |
| Driver payments | $2/day or $20/month for every driver, or 15% | **Subscription by vehicle:** Moto $3/day or $30/month, Car $5/day or $50/month. **Percentage stays 15%** for everyone (§3.7) |
| Taxi safety | Does not exist | **Gender matching** for Taxi only, with gender taken from the approved ID, verified accounts on both sides, and report/block (§3.5) |

**Not in this plan:** Taxi by car, waiting time, package size and box fees, the Supabase cutover. See §8.

> ⚠️ **Launch order:** Packages can ship on the demo store. **Taxi must not go live before the Supabase cutover.** Gender and ID approval are only trustworthy when stored on a server the user can't edit. In the demo store, anyone can change their own saved data.

---

## 2. Decisions (confirmed)

Confirmed by the product owner on 2026-10-09. Build exactly on the "Decision" column.

| # | Question | Decision | Why |
|---|---|---|---|
| OD-1 | **LBP price:** separate LBP fields per option (as today), or one exchange rate? | **One setting `lbp_per_usd` (89,500).** LBP = USD price × rate, rounded to 1,000 | Every decision was made in USD. One rate halves the admin fields. ⚠️ This replaces the current deliberate "independent USD and LBP bands" rule in `CLAUDE.md`, so update that section |
| OD-2 | **Economy with Direct pickup:** minimum trip distance? | **30 km** (drop-off stays from 20 km) | At 20–30 km, pickup + company + share costs more than Moto |
| OD-3 | **Economy pickup cap** | **$4** | A client far from the company must not pay a full Moto trip to reach it |
| OD-4 | **Car hours** | **06:00–22:00 Beirut**, both admin settings | Owner said "not after 10 pm". The start hour is an assumption |
| OD-5 | **Who can do Taxi Moto?** | Moto drivers who **opt in** (`accepts_passengers`, default false) | Carrying a person needs a passenger helmet and consent. Not every moto courier will |
| OD-6 | **Who does the Economy pickup?** | Moto drivers | The pickup is priced as a Moto trip |
| OD-7 | **Economy payment** | Client pays the **full Economy price at handover**: to the driver at pickup, or at Direct's counter at drop-off | Direct holds the money before giving the package to the partner |
| OD-8 | **Who marks Economy as delivered?** | **Admin**, when the partner confirms. The client may also confirm receipt | The partner has no app |
| OD-9 | **Business accounts:** keep the per-business min/max clamp? | **Yes for Moto and Car. No for Economy and Taxi** | Economy is a real partner cost, and Taxi is never ordered by a shop |
| OD-10 | **Client raising the price (tip above the quote)** | **Keep for Moto, Car and Taxi. Disable for Economy** | Nobody is dispatched for the Economy company leg, so a tip has no effect |
| OD-11 | **Old fields:** `fare_*`, `multiplier_*`, `is_urgent`, `night_surcharge_*` | Keep the **types and migrations** so old states load. Remove them from **every UI and every new calculation** | Safest for saved demo states |
| OD-12 | **How gender gets onto an account** | **A: the admin picks Male / Female while approving the ID** (they already review every ID). **For the developer to evaluate:** B, automatic reading by an ID verification service (e.g. Sumsub, Veriff, Onfido, roughly $0.50–2 per check, needs the Supabase server; it can also match the selfie to the ID photo). Switch to B when sign-up volume justifies the cost | A costs nothing and adds one click to an existing step |
| OD-13 | **Minimum age** | **No age limit** for clients or drivers. No birth date is collected | Owner's decision. Drivers still need an approved driving licence, which already requires adulthood in Lebanon |
| OD-14 | **Economy pickup cash:** the client pays the driver the full price, but the driver only earns ①. How does ② + ③ reach Direct? | **Confirmed (option A).** The driver keeps ① and **owes Direct ② + ③** as "cash to hand in". It's added to the same daily balance as commission (`dueNow`), paid through the existing Whish / "I already paid" flow, and blocks new work after the next 07:00 if unpaid, exactly like commission today | Reuses a flow that already exists and is already tested. No new payment method |
| OD-15 | **Driver payments** | **Percentage: 15% for every vehicle** (unchanged). **Subscription by vehicle:** Moto $3/day or $30/month; Car $5/day or $50/month. A Taxi Moto driver is a Moto driver | A percentage already grows with the fare, so one rate is fair. A subscription is flat, so car drivers (higher fares) pay more. Monthly = the price of 10 days, as today |

---

## 3. The rules (the contract)

All numbers below are **defaults** in `DEFAULT_SETTINGS`, and every one is editable by the admin.

### 3.0 Each option at a glance

Default values. Every number is an admin setting.

| | Package · Moto | Package · Car | Package · Economy (Direct picks up) | Package · Economy (drop-off at Direct) | Taxi · Moto |
|---|---|---|---|---|---|
| **Trip range** | 0–50 km | 0–100 km | 30–250 km | 20–250 km | 0–25 km |
| **Price** | $3 for the first 3 km + $0.25 per extra km | $6 for the first 3 km + $0.45 per extra km | ① Moto price to the company branch (max $4) + ② company price + ③ $1 | ② company price + ③ $1 (+ drop-off fee $0) | $3 for the first 3 km + $0.30 per extra km |
| **Rounding** | nearest $0.50 | nearest $0.50 | nearest $0.50 | nearest $0.50 | nearest $0.50 |
| **Night (00–06)** | +$1 | not offered 22:00–06:00 | no surcharge; driver dispatched from 06:00 | no rule | +$1 |
| **Speed** | same day | same day | 2–3 days | 2–3 days from drop-off | now |
| **Who carries it** | moto driver | car driver | moto driver to the company, then the partner | Direct (daily trip), then the partner | moto driver with "carries passengers" on, gender-matched (§3.5) |
| **Client tracking** | live map all the way | live map all the way | live map until pickup, then statuses | statuses only | live map all the way |
| **Client pays** | cash on delivery | cash on delivery | full price to the driver at pickup | full price at Direct's counter | cash at arrival |
| **Tip above the quote** | yes | yes | no | no | yes |
| **Business min/max clamp** | yes | yes | no | no | no |
| **Order ends when** | both confirm (as today) | both confirm (as today) | admin marks delivered | admin marks delivered | both confirm + rating |
| **Example** | 10 km = $5.00 | 10 km = $9.00 | Hamra → Sidon = $8.50 | Hamra → Sidon = $5.00 | 10 km = $5.00 |

### 3.1 Shared rules (all options)

**Services and options**

```
service = "package" | "taxi"
option  = "moto" | "car" | "economy"     (package)
        = "moto"                         (taxi; Car isn't shown at all)
```

**Distance:** the road distance pickup → destination from `measureRouteKm` (Distance Matrix, with the haversine fallback), the same number the app uses today. Ranges are inclusive at both ends.

**Distance price** (used by Package Moto, Package Car, Taxi Moto, and Economy's pickup part):

```
raw   = start_usd + max(0, km − included_km) × per_km_usd
price = roundToStep(raw, rounding_step_usd)          // default step 0.5, half rounds up
price = price + night_usd   if isNightShift(now) and the option has a night surcharge
lbp   = roundLbp(price × lbp_per_usd)                 // OD-1
```

- `roundToStep(x, step) = Math.round(x / step + 1e-9) * step`. The epsilon stops float noise such as `5.1000000000000005`.
- The night surcharge is added **after** rounding, so it stays exact.
- Night = `isNightShift()`, 00:00–06:00 Asia/Beirut, already in `packages/shared/src/beirut-time.ts`.

**Greyed out, never hidden:**
- An option is unavailable **only** because of its distance range, Car hours, or an admin on/off switch. **Never because of price.**
- An unavailable option is still shown, disabled, with its reason:
  - `"Only for trips up to {max} km"`
  - `"Only for trips from {min} km"`
  - `"Available {from} – {until}"` (Car)
  - `"Economy is paused"` (switch off)
  - `"Economy isn't available for this route"` (no partner covers it)
- If every option is unavailable: `"Contact Direct for this trip"`.
- **Service switches:** `taxi_enabled = false` → the Taxi card shows "Coming soon" and can't be opened. `economy_enabled = false` → Economy is disabled with `"Economy is paused"`.

**No urgency.** The option decides the speed. `is_urgent` is gone from every screen (OD-11).

**Shared admin controls (Settings → General):** rounding step ($0.25 / $0.50 / $1), LBP per USD, Taxi on/off, Economy on/off.

---

### 3.2 Package · Moto

| Rule | Value (default) |
|---|---|
| Range | 0–50 km |
| Price | $3.00 for the first 3 km + $0.25 per extra km, rounded to $0.50 |
| Night | +$1.00 |
| Speed | Same day |
| Who carries it | A driver with `vehicle = "moto"` |
| Client tracking | Live map all the way (as today) |
| Client pays | Cash on delivery (as today) |
| Tip above the quote | Allowed (OD-10) |
| Business min/max clamp | Applies (OD-9) |
| Order ends | Both sides confirm, as today |

**Examples:** 4 km = $3.50 · 10 km = $5.00 · 20 km = $7.50 · 50 km = $15.00 · 10 km at night = $6.00.

**Why this method:** the price grows a little with every km, so similar trips always cost similar prices and there are no sudden jumps.

**Admin controls (Settings → Moto):** min km, max km, start price, km included, price per extra km, night surcharge. Live preview of sample trips.

---

### 3.3 Package · Car

| Rule | Value (default) |
|---|---|
| Range | 0–100 km |
| Price | $6.00 for the first 3 km + $0.45 per extra km, rounded to $0.50 |
| Night | **Not offered** outside 06:00–22:00 (OD-4) |
| Speed | Same day |
| Who carries it | A driver with `vehicle = "car"` |
| Client tracking | Live map all the way |
| Client pays | Cash on delivery |
| Tip above the quote | Allowed |
| Business min/max clamp | Applies |
| Boxes | One price per trip, whatever the number of boxes (box fees are out of scope) |
| Order ends | Both sides confirm, as today |

**Examples:** 5 km = $7.00 · 10 km = $9.00 · 20 km = $13.50 · 100 km = $49.50 · 10 km at 23:00 = unavailable.

**Why its own numbers, not "Moto × 2":** a car costs more to start any trip (fuel, parking, traffic), but on long highway trips the gap matters less. Separate fields let the admin raise the start price without making long trips too expensive.

**Rule:** Car must always cost more than Moto where both are offered. The admin gets a warning if it doesn't (§3.6).

**Admin controls (Settings → Car):** min km, max km, start price, km included, price per extra km, available from (hour), available until (hour).

---

### 3.4 Package · Economy

**Name shown to the client:** "Economy" (Arabic "اقتصادي"), with "2–3 days". **The partner company's name is never shown to a client.**

| Rule | Direct picks up | Client drops off at Direct |
|---|---|---|
| Range | 30–250 km (OD-2) | 20–250 km |
| Route | Direct moto driver: client → company branch → partner delivers | Client → Direct's drop-off place → daily trip → partner delivers |
| ① Pickup part | Moto price for client → branch (no night surcharge), **capped at $4** (OD-3) | Drop-off fee, default $0 |
| ② Company part | The company's table price for the route | same |
| ③ Direct's share | `economy_share_pickup_usd` ($1) | `economy_share_dropoff_usd` ($1) |
| Price | round(① + ② + ③) | round(① + ② + ③) |
| Night | No surcharge. Created at night, dispatched from 06:00 | No rule |
| Who carries it | A `moto` driver (OD-6), then the partner | Direct, then the partner |
| Client tracking | Live map **until pickup**, then statuses only | Statuses only |
| Client pays | Full price to the driver at pickup (OD-7) | Full price at Direct's counter |
| Tip above the quote | Not allowed | Not allowed |
| Business min/max clamp | Doesn't apply | Doesn't apply |
| Order ends | Admin marks delivered (OD-8) | Admin marks delivered |

**Examples** (Hamra → Sidon, companies A and B from §6.2): drop-off = **$5.00** (company B) · Direct picks up = **$8.50** (company A).

**Choosing the company (automatic, per order):**
1. Consider only companies with `active = true`.
2. Find the route's regions: `regionForPoint(pickup)` and `regionForPoint(destination)`.
3. Skip companies with no price for that region pair.
4. Compute each company's **total**. For pickup, ① depends on the distance to that company's branch.
5. Pick the **lowest total**. On a tie, the `preferred` company, then the lowest id.
6. No company qualifies → unavailable, `"Economy isn't available for this route"`.

**Regions:** `beirut`, `mount_lebanon`, `north`, `south`, `bekaa`. `regionForPoint(lat, lng)` returns the region of the nearest anchor point (at least 3 per region):
- Beirut: Beirut centre
- Mount Lebanon: Jounieh, Jbeil, Aley, Baabda, Broummana
- North: Tripoli, Batroun, Halba
- South: Sidon, Tyre, Nabatieh
- Bekaa: Zahle, Chtaura, Baalbek

Trips near a border may land on the wrong side; polygons can replace the anchors later. Price tables are **symmetric** and stored with a sorted pair key (`"beirut|south"`, 15 keys including `"beirut|beirut"`).

**Statuses** (adds one new status, `with_partner`):

```
pickup:   pending → accepted → picked_up → with_partner → completed
dropoff:  pending ──(admin: "received at Direct")──▶ at_warehouse → with_partner → completed
```

| Status | Client sees |
|---|---|
| `picked_up` | "Picked up by Direct" |
| `at_warehouse` | "Received at Direct" |
| `with_partner` | "On its way · arrives in 2–3 days" |
| `completed` | "Delivered" |

- The driver's job ends at `with_partner`: they hand it to the company and tap "Handed to partner". That frees their capacity.
- The admin moves `at_warehouse → with_partner` (daily batch) and `with_partner → completed`.

**Tracking and privacy:** from `picked_up` onwards, no live map and no driver location reaches the client. The driver sees the company's name and branch address; the admin sees everything.

**Money:** the driver earns ① (and the existing subscription / % logic applies to ① only). Direct earns ③ (+ the drop-off fee). The partner is owed ②. The order stores ①, ② and ③ separately. **OD-14:** with pickup, the driver collects the full price, keeps ①, and owes Direct ② + ③, added to their daily `dueNow` balance as "Economy cash to hand in".

**Why it works this way:** drop-off is at Direct, never at the company, and tracking stops at pickup, so the partner stays hidden. The system picks the cheapest **total**, not the cheapest company price, because a far-away branch makes the pickup cost more.

**Admin controls:**
- Settings → Economy: Economy on/off, drop-off min km, pickup min km, max km, pickup cap, Direct's share for each way, drop-off fee, drop-off place (a Warehouse) and its hours text.
- Partner companies page: name, branch (map pin), active, preferred, and a symmetric 5×5 region price grid.
- Orders page → Economy actions: received at Direct, send to partner (batch), delivered.

---

### 3.5 Taxi · Moto

| Rule | Value (default) |
|---|---|
| Range | 0–25 km |
| Price | $3.00 for the first 3 km + $0.30 per extra km, rounded to $0.50 |
| Night | +$1.00 |
| Speed | Now |
| Who carries it | A `moto` driver with `accepts_passengers = true` (OD-5), gender-matched (below) |
| Client tracking | Live map for the **whole** ride |
| Client pays | Cash at arrival |
| Tip above the quote | Allowed |
| Business min/max clamp | Doesn't apply |
| Order ends | Both sides confirm + rating |
| Availability | Only when `taxi_enabled = true` (off until the Supabase cutover, §1) |

**Examples:** 5 km = $3.50 · 10 km = $5.00 · 25 km = $9.50 · 26 km = unavailable · 10 km at night = $6.00.

**Why distance only:** the price is known before the ride, and the map's travel time is for cars, while a moto weaves through traffic. Time-based or mixed pricing would charge a moto passenger for minutes the ride never took.

**Gender matching** (Taxi only; never changes the price):

| Passenger ↓ / Driver → | Female driver | Male driver |
|---|---|---|
| Female, preference `female_only` (default) | ✅ | ❌ |
| Female, preference `any` | ✅ | ✅ |
| Male | ❌ | ✅ |

- A female passenger picks `female_only` (default) or `any`. A male passenger sees no toggle.
- Female drivers take female passengers only in this version.
- One pure function in `packages/shared`: `canMatchTaxi(passengerGender, preference, driverGender) → boolean`, called by dispatch and by claim.

**Safety rules (all required before Taxi goes live):**

1. **Gender is set from the ID, never by the user.** When an admin approves a user's `id` document, the admin must also pick `gender` (male/female) from the card (OD-12, option A). This applies to clients and drivers alike. The user can never edit their own `gender`; only an admin can correct it.
2. **Verified on both sides:** a Taxi can only be requested by a passenger, and accepted by a driver, whose account is `is_trusted` (approved selfie and ID; this already exists) and whose `gender` is set.
3. **Identity check at pickup:** after acceptance, the passenger sees the driver's verified photo, first name and vehicle, and the driver sees the passenger's verified photo and first name. Either side can cancel at pickup with the reason "Not the person shown", with no penalty, and this creates a report.
4. **Full live tracking for the whole ride,** visible to the passenger and the admin. The §3.4 "stop at pickup" rule is for Economy only.
5. **Report and block:** after every Taxi ride, both sides can report the other. A report with the reason "Safety / harassment" **immediately pauses** the reported account from Taxi until an admin reviews it. Each side can block the other so they are never matched again.
6. **Phone numbers** are shown only while the ride is active. `toPublicContact` already limits contact data to name and phone; for Taxi, hide the phone again after `completed`.
7. **No silent widening:** if no female driver accepts within the dispatch timeout, ask the passenger: "No female driver is free right now. Search all drivers?" Never switch automatically.
8. **Packages are unaffected:** no gender field, no preference, no matching rule.

| Taxi message | Shown when |
|---|---|
| "Verify your account to use Taxi" | passenger not `is_trusted` or no `gender` set |
| "No female driver is free right now. Search all drivers?" | `female_only` and the dispatch round timed out |

**Admin controls:**
- Settings → Taxi: Taxi on/off, min km, max km, start price, km included, price per extra km, night surcharge.
- Document review: Male / Female is required when approving an ID (OD-12 A).
- Driver and client detail: vehicle, "carries passengers", gender (admin only), "Paused from Taxi" with Clear, blocks with Remove.

---

### 3.6 Admin warnings (never block anything)

On the settings page and the partner companies page, run `pricingWarnings(settings, companies)` and show each warning. Saving is never blocked, and nothing is hidden from clients.

- **Economy vs Moto:** for every whole km from `economy_min_km` to `moto_max_km`, using each active company's **highest** table price (the worst case):
  - drop-off total = max company price + share (drop-off) + drop-off fee. Warn if **≥** `motoPrice(km)`.
  - pickup total = pickup cap + max company price + share (pickup), only from `economy_pickup_min_km`. Warn if **≥** `motoPrice(km)`.
- **Car vs Moto:** for every whole km from `max(moto_min_km, car_min_km)` to `min(moto_max_km, car_max_km)`, by day. Warn if `carPrice(km)` **≤** `motoPrice(km)`.
- **Known limit:** the Economy check uses each company's highest price, which is the worst case. With real tables it can warn at distances where that expensive route (e.g. North–South) can't actually happen. That's acceptable: the warning only advises and never blocks. A finer per-route check can come later.
- Group consecutive km into one message, e.g. *"With these prices, Economy (pickup) costs the same as or more than Moto on trips from 20 to 29 km. Raise the Moto rates or lower Economy."*

### 3.7 Driver payments (how drivers pay Direct)

Each driver still picks **subscription** or **percentage** on their profile, as today. Only the amounts change.

| | Moto driver (packages + Taxi) | Car driver |
|---|---|---|
| Percentage of each trip's base price | 15% | 15% |
| Daily subscription (24 h) | $3 | $5 |
| Monthly subscription (30 days) | $30 | $50 |

- The price comes from the **driver's vehicle** (`Driver.vehicle`). Everything else about subscriptions stays as it is: renewal adds time, daily has no grace, monthly keeps `grace_days`, the freeze penalty, Whish collect.
- **Price changes apply at the next payment.** Time a driver has already paid for is never shortened or re-charged.
- If an admin changes a driver's vehicle, the new price applies from their next payment.
- Economy pickup: the percentage applies to ① only (§3.4).

**Example (a moto driver, the trip prices in §3.2):**

| Moto driver doing… | 15% costs them | Daily plan | Monthly plan (per day) |
|---|---|---|---|
| 3 trips/day (~$15) | $2.25 | $3.00 | $1.00 |
| 10 trips/day (~$50) | $7.50 | $3.00 | $1.00 |

**Admin controls (Settings → Driver payments):** percentage; Moto daily and monthly price; Car daily and monthly price; grace days and freeze penalty (as today).

---

## 4. Data model changes

### 4.1 `packages/shared`: `CompanySettings` and `DEFAULT_SETTINGS`

Add the fields below. Keep the existing ones (OD-11).

```ts
// global
lbp_per_usd: 89_500,
rounding_step_usd: 0.5,

// package · moto
moto_min_km: 0, moto_max_km: 50,
moto_start_usd: 3, moto_included_km: 3, moto_per_km_usd: 0.25,
moto_night_usd: 1,

// package · car
car_min_km: 0, car_max_km: 100,
car_start_usd: 6, car_included_km: 3, car_per_km_usd: 0.45,
car_from_hour: 6, car_until_hour: 22,          // Beirut time, OD-4

// taxi · moto
taxi_moto_min_km: 0, taxi_moto_max_km: 25,
taxi_moto_start_usd: 3, taxi_moto_included_km: 3, taxi_moto_per_km_usd: 0.30,
taxi_moto_night_usd: 1,

// economy
economy_min_km: 20, economy_max_km: 250,
economy_pickup_min_km: 30,                     // OD-2
economy_pickup_cap_usd: 4,                     // OD-3
economy_share_pickup_usd: 1,
economy_share_dropoff_usd: 1,
economy_dropoff_fee_usd: 0,
economy_dropoff_warehouse_id: null as string | null,   // Direct's drop-off place = a Warehouse
economy_dropoff_hours: "Mon–Sat 9:00–18:00",            // shown to clients next to the address

// driver payments (OD-15); company_percentage stays 15
subscription_daily_moto_usd: 3,
subscription_monthly_moto_usd: 30,
subscription_daily_car_usd: 5,
subscription_monthly_car_usd: 50,

// service switches
taxi_enabled: false,        // stays off until the Supabase cutover (§1); client sees "Coming soon"
economy_enabled: true,      // admin can switch Economy off for everyone without deleting companies
```

### 4.2 `packages/shared`: new types

```ts
export const SERVICES = ["package", "taxi"] as const;
export type Service = (typeof SERVICES)[number];

export const DELIVERY_OPTIONS = ["moto", "car", "economy"] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

export const VEHICLES = ["moto", "car"] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const REGIONS = ["beirut", "mount_lebanon", "north", "south", "bekaa"] as const;
export type Region = (typeof REGIONS)[number];

export type EconomyHandoff = "pickup" | "dropoff";

export type PartnerCompany = {
  id: string;
  name: string;              // admin and driver only, never the client
  branch_address: string;
  branch_lat: number;
  branch_lng: number;
  active: boolean;
  preferred: boolean;
  /** Sorted pair key → USD price, e.g. { "beirut|south": 4.5 }. Missing key = no service. */
  prices: Record<string, number>;
};

export type OptionQuote =
  | { option: DeliveryOption; available: true; usd: number; lbp: number; nightUsd: number;
      economy?: { handoff: EconomyHandoff; companyId: string;
                  pickupUsd: number; companyUsd: number; shareUsd: number } }
  | { option: DeliveryOption; available: false;
      reason: "too_far" | "too_close" | "car_hours" | "no_partner" | "switched_off"; limit?: number };
```

### 4.3 `packages/core/src/store.ts`

| Type | New field | Default in `migrateState` |
|---|---|---|
| `Driver` | `vehicle: Vehicle` | `"moto"` |
| `Driver` | `accepts_passengers: boolean` | `false` |
| `Order` | `service: Service` | `"package"` |
| `Order` | `delivery_option: DeliveryOption` | `"moto"` |
| `Order` | `economy_handoff: EconomyHandoff \| null` | `null` |
| `Order` | `partner_company_id: string \| null` | `null` |
| `Order` | `economy_pickup_usd`, `economy_company_usd`, `economy_share_usd` | `0` |
| `Order` | `driver_gender_pref: "female_only" \| "any" \| null` (Taxi only) | `null` |
| `Profile` | `gender: "male" \| "female" \| null` (set by an admin from the ID) | `null` |
| `DemoState` | `blocks: { user_id: string; blocked_id: string }[]` | `[]` |
| `DemoState` | `partner_companies: PartnerCompany[]` | `[]` |
| `OrderStatus` (shared) | add `"with_partner"` | n/a |

`is_urgent` stays on `Order` for old data. New orders always write `false` (OD-11).

---

## 5. Phases and tasks

Each task lists **files**, **what to do**, and **done when**. File paths are relative to the repo root.

### Phase 1: Shared pricing engine (pure functions and tests, no UI)

**T1.1: Types and settings**
- Files: `packages/shared/src/index.ts`
- Add the §4.1 settings with defaults and the §4.2 types. Add `"with_partner"` to `ORDER_STATUSES`.
- Done when: `npm run typecheck:mobile` and `npm run build` pass (existing callers still compile).

**T1.2: Distance pricing**
- New file: `packages/shared/src/option-price.ts` (+ `option-price.test.ts`, registered in `package.json`)
- Functions:
  - `roundToStep(x, step)`
  - `distancePriceUsd(rate, km)` where `rate = { start_usd, included_km, per_km_usd }`
  - `optionRange(settings, service, option, handoff?) → { min, max }`
  - `carOpenAt(settings, date) → boolean`
  - `quoteDistanceOption(settings, service, option, km, at) → OptionQuote` (§3.1–§3.3, §3.5)
- Done when: every row of §6.1 passes as a test.

**T1.3: Regions**
- New file: `packages/shared/src/regions.ts` (+ `regions.test.ts`)
- Functions: `regionForPoint(lat, lng)`, `regionPairKey(a, b)` (sorted, joined with `|`), `REGION_ANCHORS`.
- Done when: Hamra → `beirut`, Jounieh → `mount_lebanon`, Tripoli → `north`, Sidon → `south`, Zahle → `bekaa`; `regionPairKey("south","beirut") === "beirut|south"`.

**T1.4: Economy quote**
- New file: `packages/shared/src/economy-price.ts` (+ test)
- Function: `quoteEconomy(settings, companies, { pickup, dropoff, km, handoff, distanceToBranchKm })`, where `distanceToBranchKm(company) → number` is injected so the function stays pure.
- Applies the §3.4 ranges, selection and the tie-breaks.
- Done when: every row of §6.2 passes.

**T1.5: Quote all options at once**
- Same file as T1.2, or `quote-options.ts`
- `quoteAllOptions(settings, companies, { service, km, at, pickup, dropoff, distanceToBranchKm, economyHandoff }) → OptionQuote[]`, in display order: Moto, Car, Economy for packages; Moto for taxi.
- Done when: a 120 km package returns Moto `too_far`, Car `too_far`, Economy available.

**T1.6: Admin warning**
- New file: `packages/shared/src/pricing-warnings.ts` (+ test)
- `pricingWarnings(settings, companies) → { kind: "economy_pickup" | "economy_dropoff" | "car_vs_moto"; fromKm; toKm }[]` (§3.6)
- Done when: with the §6 defaults and a company price of $4.50, the pickup warning covers no km (because pickup starts at 30 km). With `economy_pickup_min_km = 20`, it reports exactly 20 to 29 km (pickup total $9.50 vs Moto $7.50–$9.50). With the defaults, there's no `car_vs_moto` warning. With Moto set to $3.50 + $0.50/km, `car_vs_moto` covers the km where Car ≤ Moto.

**T1.7: Remove urgency from shared**
- Mark `applyUrgentPricing` and `URGENT_PRICE_MULTIPLIER` `@deprecated`, and stop exporting them from new code paths. Delete them once Phase 4 no longer imports them, together with their tests.

**T1.8: Subscription price by vehicle**
- File: `packages/shared/src/subscription.ts` (+ update `subscription.test.ts`)
- `subscriptionPriceUsd(plan, settings, vehicle)` reads the four new fields. Keep `subscription_price_usd` / `subscription_daily_price_usd` in the type for old saved states only (OD-11).
- Done when: moto daily = 3, moto monthly = 30, car daily = 5, car monthly = 50.

### Phase 2: Core state (`packages/core/src/store.ts`)

**T2.1: Fields and migrations**
- Add the §4.3 fields and the `migrateState` lines. Add `partner_companies: []` to `seed()`.
- Seed one demo partner company with a few prices, inactive by default, so the demo shows the admin page.
- Done when: an old saved state from `main` loads without errors (paste one from localStorage).

**T2.2: Driver vehicle**
- `registerDriver` / the driver creation input accepts `vehicle` and `accepts_passengers`.
- New mutation: `setDriverVehicle(state, actorId, driverId, { vehicle, accepts_passengers })`. A driver can change their own; an admin can change anyone's.
- Done when: unit-level checks pass, and an unknown actor gets an error string.

**T2.3: `createOrder` rewrite**
- New input: `service`, `delivery_option`, `economy_handoff?`, plus the injected distances.
- Use `quoteAllOptions` and refuse an unavailable option with its reason as the error string.
- Apply the business clamp only for Moto and Car (OD-9). Allow `price_usd` only for Moto, Car and Taxi (OD-10).
- Store the economy breakdown and `partner_company_id`. Always write `is_urgent: false`.
- Revenue split: keep today's call, but for Economy pass ① as the driver-side base, and set `company_cut_usd = ③`.
- Done when: creating each option from §6 produces exactly the expected `delivery_fee_usd` and `delivery_fee_lbp`.
- Economy pickup cash (OD-14): when the driver moves the order to `with_partner`, ② + ③ is added to that driver's `dueNow` as "Economy cash to hand in". Done when: the E2 order ($8.50, ① $3.00) leaves the driver owing $5.50.

**T2.4: Dispatch by vehicle**
- `isDispatchEligible` and the offer logic: an order is only offered to drivers where:
  - Package Moto, and Economy `pickup` → `vehicle === "moto"`
  - Package Car → `vehicle === "car"`
  - Taxi Moto → `vehicle === "moto" && accepts_passengers`
  - Economy `dropoff` → **never dispatched** (no driver involved)
  - Economy `pickup` during `isNightShift` → not dispatched until 06:00
- Remove the urgent-first sort in `availableOrdersForDriver`. Keep nearest pickup first.
- Keep the same-reference rule for the 5-second interval.
- Done when: a car-only online driver is never offered a Moto order, and vice versa.

**T2.5: Economy status transitions**
- `advanceOrder`: allow a driver to go `picked_up → with_partner` for Economy `pickup` orders. That completes their leg: free their capacity, keep the order open.
- New admin mutations:
  - `markEconomyReceived(orderId)`: `pending → at_warehouse` (drop-off)
  - `markEconomyWithPartner(orderIds[])`: batch `at_warehouse → with_partner`
  - `markEconomyDelivered(orderId)`: `with_partner → completed`, stamps `completed_at`
- **Notifications to the client** (new `NotificationKind` values, rendered from the dictionary like the existing kinds, in `notification-copy.ts`): `economy_received` ("We received your package"), `economy_with_partner` ("Your package is on its way · 2–3 days"), `economy_delivered` ("Delivered"). For Taxi: `taxi_paused` to the paused account, and `taxi_no_female_driver` when the dispatch round times out (§3.5 rule 7).
- Done when: each transition refuses the wrong starting status with an error string, and each one sends its notification.

**T2.6: Partner companies**
- Mutations: `addPartnerCompany`, `updatePartnerCompany`, `removePartnerCompany` (refuse if an open order uses it), `setPartnerPrice(companyId, pairKey, usd | null)`.
- Done when: prices round-trip, and removal of an in-use company returns an error.

**T2.7: Privacy**
- `publicDriverInfo` / the client order view: for Economy from `picked_up` onwards, return no location (§3.4).
- Add a helper `clientOrderView(order)` that strips `partner_company_id` and the company name. Use it on every client surface.
- Done when: no client screen can reach the company name or the driver's position after pickup.

**T2.8: Taxi matching and safety (§3.5)**
- Shared: `canMatchTaxi`, `taxiEligibilityError(profile)` (+ tests for every cell of the §3.5 matrix).
- Store: dispatch and `claimOrder` apply `canMatchTaxi`, `is_trusted` and `blocks` for Taxi orders.
- Document approval: approving an `id` document requires `gender` from the admin (OD-12 A). New admin-only mutation: `setProfileGender(actorId, userId, gender)`. `updateProfile` must refuse `gender` from non-admins.
- Reports: a Taxi report with reason `safety` sets a `taxi_paused` flag on the reported profile (migration default `false`) until an admin clears it.
- Mutations: `blockUser`, `unblockUser`.
- Done when: every §6.3 case passes.

**T2.9: Driver payments by vehicle**
- `packages/core/src/store.ts`: the two `subscriptionPriceUsd` calls (subscription payment request and freeze reactivation) pass `driver.vehicle`.
- Screens that show the plan price pass the driver's vehicle: `apps/web/src/app/app/driver/dashboard/page.tsx`, `apps/web/src/app/app/profile/page.tsx`, and `apps/mobile/app/(app)/(tabs)/profile.tsx`. Also update the subscription prices in `packages/shared/src/payment-rules.md`.
- Existing `subscription_ends_at` is never changed by a price change.
- Done when: a Car driver requesting a daily plan is asked for $5, a Moto driver for $3.

### Phase 3: Admin UI (web and mobile)

**T3.1: Settings page**
- Files: `apps/web/src/app/app/admin/settings/page.tsx`, `apps/mobile/app/(app)/admin/settings.tsx`
- Replace the fare band and multiplier fields with **one section per option**:
  - Moto: range, start, km included, per km, night
  - Car: range, start, km included, per km, hours
  - Taxi Moto: range, start, km included, per km, night
  - Economy: ranges, pickup minimum, pickup cap, shares, drop-off fee, drop-off place (a Warehouse select)
- **Driver payments:** percentage, Moto daily/monthly, Car daily/monthly, grace days, freeze penalty (replacing the old single daily/monthly fields).
- Global: rounding step, LBP rate, and the two service switches (**Taxi on/off**, **Economy on/off**). The Taxi switch shows the note "Turn on only after the Supabase cutover".
- Economy also gets the drop-off **hours** text field.
- Each section shows a **live preview** of 4–5 sample trips using the shared functions. See `pricing-map.html` → "Admin settings" for the intended behaviour.
- Show `pricingWarnings` above the save button.
- Done when: changing a field updates the preview instantly, and saving persists it.

**T3.2: Partner companies page**
- New: `apps/web/src/app/app/admin/partners/page.tsx` + nav entry; mobile under `apps/mobile/app/(app)/admin/partners.tsx` + the "More" menu.
- List, add, edit and remove companies: name, branch (map pin, reuse the warehouse pin UI), active, preferred, and a **5×5 symmetric price grid** where editing one cell updates its mirror.
- Done when: the admin can create a company, fill prices, and see the warning update.

**T3.3: Economy operations**
- On the admin orders page, add an "Economy" filter with actions: "Received at Direct", "Send to partner" (batch, grouped by company), "Delivered".
- Done when: an Economy drop-off order can be taken from `pending` to `completed` by an admin alone.

**T3.4: Admin driver controls**
- Files: `apps/web/src/app/app/admin/drivers/[id]/page.tsx`, `apps/mobile/app/(app)/admin/drivers/[id].tsx`
- Show and **edit** the driver's **vehicle** (Moto / Car) and **"Carries passengers (Taxi)"**, via `setDriverVehicle`.
- Show the driver's **gender** (editable by the admin only, `setProfileGender`) and a **"Paused from Taxi"** badge with a **"Clear pause"** action.
- Show the user's **blocks** (who they blocked, who blocked them), with **Remove** for each.
- The same gender, pause and blocks panel goes on the client and business detail views the admin already has.
- Done when: an admin can change every one of these without the driver doing anything.

**T3.5: Admin order detail**
- Files: `apps/web/src/app/app/admin/orders/[id]/page.tsx`, the admin branch of `apps/mobile/app/(app)/orders/[id].tsx`
- Show the **service**, **option** and, for Economy, the **way** (pickup / drop-off), the **partner company name**, and the price breakdown **① pickup, ② company, ③ Direct's share**.
- For Taxi: the passenger's gender preference, and any report or "Not the person shown" event.
- Done when: an admin can answer "why did this order cost this much, and who has it now?" from this one screen.

### Phase 4: Client ordering (web and mobile)

**T4.1: New order flow**
- Files: `apps/web/src/app/app/client/new/page.tsx`, `apps/mobile/app/(app)/(tabs)/new.tsx`
- **Remove the urgent toggle** and all its copy.
- Start with a **service picker**: two large cards, **Packages** and **Taxi**, each with an icon or illustration. Icons are Lucide only (e.g. `Package`, `Bike`), never emoji; custom SVG illustrations are fine if they follow `MASTER.md` (monochrome, blue accent only). Taxi then shows **Moto only**: no Car card at all, not even disabled.
- For Taxi, the description field becomes "Passenger" and there's no package text. A **female** passenger sees the toggle **"Female driver only" / "Any driver"** (default "Female driver only"). A male passenger sees no toggle. A passenger who isn't verified sees the §3.5 message instead of the order button.
- After pickup and destination are set: call `quoteAllOptions` and render **one card per option**. Each card shows name, speed ("Same day" / "2–3 days"), price, or, when disabled, the reason. One card is selected; the first available one is selected by default.
- For Economy, show a **"Direct picks up" / "I'll drop it off"** choice. Drop-off shows Direct's drop-off address and hours and the note "2–3 days start when we receive it".
- Keep the "raise the price" control only for options where OD-10 allows it.
- Done when: the §6 scenarios show the exact prices and reasons on both web and mobile.

**T4.2: Order detail and lists**
- Files: `apps/web/src/app/app/client/orders/[id]/page.tsx`, `apps/mobile/app/(app)/orders/[id].tsx`, `apps/web/src/components/order-receipt.tsx`, `apps/mobile/src/components/order-card.tsx`, `apps/web/src/app/app/client/page.tsx`, `apps/web/src/app/app/admin/page.tsx`, `apps/web/src/app/app/driver/page.tsx`
- Replace every "Urgent" badge with an **option badge** (Moto / Car / Economy / Taxi).
- Economy: the §3.4 tracking rule and status copy.
- Done when: no client-facing file renders `is_urgent`, and an Economy order hides the map after pickup.

### Phase 5: Driver side (web and mobile)

**T5.1: Vehicle at registration and profile**
- Files: `apps/web/src/app/register/page.tsx`, `apps/mobile/app/register.tsx`, both profile pages
- Ask "Moto or Car". For Moto, add an opt-in checkbox: "I also carry passengers (Taxi)".
- Done when: the choice is saved and visible to the admin on the driver detail page.

**T5.3: Taxi safety screens**
- After acceptance: show the verified photo and first name of the other side, plus "Not the person shown" (cancel and report).
- After completion: a report form (with a "Safety / harassment" reason) and a "Block" action, on both sides.
- Admin: on document review, a required Male / Female choice when approving an ID. Add a "Paused from Taxi" list on the reports page.
- Done when: §6.4 step 10 passes.

**T5.2: Economy pickup job**
- Driver order detail: after pickup, the destination is the **company branch** (name and address), and the final action is **"Handed to partner"**.
- Done when: the driver can't reach "arrived / confirm" steps on an Economy order. Their flow ends at the handover.

### Phase 6: Copy, docs and cleanup

**T6.1: i18n.** Add all new keys to both dictionaries, in a new `pricing` section, or extend `order` and `admin`. Arabic for Economy is "اقتصادي".
**T6.2: Update `CLAUDE.md` → "Business rules → Pricing".** Replace steps 1–5 with §3 of this plan. Remove the urgent ×3 text. Update the client-set price section for OD-10, and the shared test count.
**T6.3: Remove dead code.** Remove `applyUrgentPricing`, the urgent sort, and the fare band UI. Keep the migration lines.
**T6.4: Supabase drift note.** Add the new columns (`vehicle`, `accepts_passengers`, `service`, `delivery_option`, economy fields, `driver_gender_pref`, `gender`, `taxi_paused`, `taxi_enabled`, `economy_enabled`, the `partner_companies` and `blocks` tables, the `with_partner` status) to the "Known drift" list, together with the server-side rules from §8. Do **not** write SQL now.

---

## 5b. Coverage check: every client-facing behaviour has an admin control

| What the client sees | Admin controls it in | Task |
|---|---|---|
| Moto, Car, Taxi prices | Settings → each option: start, km included, per km | T3.1 |
| Rounding, LBP amount | Settings → global: rounding step, LBP rate | T3.1 |
| Night surcharge | Settings → Moto / Taxi: night amount | T3.1 |
| Car greyed out at night | Settings → Car: available from / until | T3.1 |
| Options greyed out by distance | Settings → each option: min / max km; Economy pickup from | T3.1 |
| Economy price | Partner companies (region prices, active, preferred) + Settings → Economy (shares, cap, drop-off fee) | T3.1, T3.2 |
| Drop-off address and hours | Settings → Economy: drop-off place + hours | T3.1 |
| Economy statuses | Orders → Economy actions: received, send to partner, delivered | T3.3 |
| Taxi shown or "Coming soon" | Settings → Taxi on/off | T3.1 |
| Economy available or paused | Settings → Economy on/off | T3.1 |
| Which drivers get an order | Driver detail → vehicle, carries passengers | T3.4 |
| Gender matching | Document review (set gender) + driver/client detail (correct it) | T5.3, T3.4 |
| Taxi pause after a safety report | Driver/client detail → clear pause; Reports page | T3.4, T5.3 |
| Blocked matches | Driver/client detail → remove a block | T3.4 |
| Driver subscription price and percentage | Settings → Driver payments | T3.1 |
| Price range for a business account | Businesses page → min / max (exists today; applies to Moto and Car only, OD-9) | existing |
| Warnings when prices conflict | Settings and Partners pages (never blocks anything) | T1.6, T3.1 |
| Why an order costs what it costs | Order detail → breakdown and partner | T3.5 |

Not admin-controlled on purpose: the price formulas themselves, the gender matching table, and the rule that options are greyed out only by distance or a switch. Those are product rules; changing them is a code change.

---

## 6. Golden test cases (use these exact numbers)

Defaults from §4.1, `lbp_per_usd = 89,500`. "Day" = 12:00 Beirut, "night" = 01:00 Beirut.

### 6.1 Distance options

| # | Service · option | km | Time | Expected USD | Expected LBP | Or unavailable |
|---|---|---|---|---|---|---|
| 1 | Package · Moto | 2 | day | 3.00 | 269,000 | |
| 2 | Package · Moto | 3 | day | 3.00 | 269,000 | |
| 3 | Package · Moto | 5 | day | 3.50 | 313,000 | |
| 4 | Package · Moto | 10 | day | 5.00 | 448,000 | |
| 5 | Package · Moto | 20 | day | 7.50 | 671,000 | |
| 6 | Package · Moto | 50 | day | 15.00 | 1,343,000 | |
| 7 | Package · Moto | 50.1 | day | | | `too_far`, limit 50 |
| 8 | Package · Moto | 10 | night | 6.00 | 537,000 | |
| 9 | Package · Car | 5 | day | 7.00 | 627,000 | |
| 10 | Package · Car | 10 | day | 9.00 | 806,000 | |
| 11 | Package · Car | 20 | day | 13.50 | 1,208,000 | |
| 12 | Package · Car | 100 | day | 49.50 | 4,430,000 | |
| 13 | Package · Car | 100.5 | day | | | `too_far`, limit 100 |
| 14 | Package · Car | 10 | 23:00 | | | `car_hours` |
| 15 | Package · Car | 10 | night | | | `car_hours` |
| 16 | Taxi · Moto | 5 | day | 3.50 | 313,000 | |
| 17 | Taxi · Moto | 10 | day | 5.00 | 448,000 | |
| 18 | Taxi · Moto | 25 | day | 9.50 | 850,000 | |
| 19 | Taxi · Moto | 26 | day | | | `too_far`, limit 25 |
| 20 | Taxi · Moto | 10 | night | 6.00 | 537,000 | |

LBP = `roundLbp(usd × 89,500)` with the existing `roundLbp` (`Math.round(n / 1000) * 1000`). For example, 3.00 × 89,500 = 268,500 → **269,000**. Every value in this table was computed with that function.

### 6.2 Economy

Two active companies. Route: Hamra (Beirut) → Sidon (South), road distance 45 km.

| Company | `beirut\|south` price | Branch distance from the client | Preferred |
|---|---|---|---|
| A | 4.50 | 2 km | no |
| B | 4.00 | 12 km | no |

| # | Handoff | Calculation | Expected |
|---|---|---|---|
| E1 | dropoff | A: 0 + 4.50 + 1 = 5.50 · B: 0 + 4.00 + 1 = **5.00** | **$5.00, company B** |
| E2 | pickup | A: motoPrice(2) = 3.00 → **8.50** · B: motoPrice(12) = 5.50, capped to 4.00 → 9.00 | **$8.50, company A** |
| E3 | pickup, trip 25 km | below `economy_pickup_min_km` | unavailable, `too_close`, limit 30 |
| E4 | dropoff, trip 19 km | below `economy_min_km` | unavailable, `too_close`, limit 20 |
| E5 | dropoff, A and B at 4.00, A preferred | tie | **$5.00, company A** |
| E6 | dropoff, both inactive | — | unavailable, `no_partner` |
| E7 | pickup, created at 01:00 | priced normally ($8.50) | created, but **not dispatched before 06:00** |
| E8 | dropoff, trip 260 km | above `economy_max_km` | unavailable, `too_far`, limit 250 |

### 6.3 Taxi matching

| # | Passenger | Preference | Driver | Matched? |
|---|---|---|---|---|
| G1 | female | female_only | female | ✅ |
| G2 | female | female_only | male | ❌ |
| G3 | female | any | male | ✅ |
| G4 | female | any | female | ✅ |
| G5 | male | — | male | ✅ |
| G6 | male | — | female | ❌ |
| G7 | female, not `is_trusted` | female_only | female | ❌ cannot request |
| G8 | male, no `gender` set yet | — | male | ❌ cannot request |
| G9 | female | female_only | female who blocked her | ❌ |
| G10 | female | female_only | female with `taxi_paused` | ❌ |
| G11 | any | — | male driver with `accepts_passengers = false` | ❌ |
| G12 | package order, any client | — | any moto driver | gender ignored ✅ |

All G cases run with `taxi_enabled = true`. With it off, no Taxi order can be created at all.

### 6.4 Manual QA script (after Phase 4)

1. As admin, open Settings. Every section shows its preview, and no warnings appear with the defaults.
2. Create partner companies A and B as in §6.2 and pick a drop-off warehouse.
3. Set `economy_pickup_min_km` to 20. A warning appears for 20 to 29 km. Set it back to 30 and the warning disappears.
4. As a client, order Hamra → Sidon. The trip is about 45 km, so Moto, Car and Economy are all priced. Try a trip over 50 km and Moto shows "Only for trips up to 50 km". Switch Economy between pickup and drop-off and check E1 and E2.
5. Order a 10 km package at 23:00 (change the device clock or inject the time). Car is disabled with its hours.
6. Switch to Taxi: it shows "Coming soon". As admin, turn Taxi on in Settings. Now only Moto shows, and 26 km is disabled.
7. As a car driver, go online: Moto orders never appear. As a moto driver without passenger opt-in, Taxi orders never appear.
8. Do an Economy pickup end to end. The client loses the live map after pickup and sees "Picked up by Direct". The driver ends at "Handed to partner". The admin marks it Delivered.
9. Load a saved state from `main` (before this change). The app opens, and old urgent orders still display.
10. Taxi safety: approve a woman's ID as admin (gender required). She requests a Taxi with "Female driver only": only an online, verified female moto driver with passengers enabled gets the offer. After the ride, she reports "Safety": the driver is paused from Taxi until an admin clears it.

---

## 7. Agent prompts (paste one per phase)

Each prompt assumes the agent can read the repo. Attach or point to this file.

### Phase 1

```
Read CLAUDE.md and docs/pricing/IMPLEMENTATION_PLAN.md (sections 1–4 and 6).
Implement Phase 1 (tasks T1.1–T1.8) only: pure functions and tests in packages/shared.
- No UI changes, no store.ts changes.
- Register every new *.test.ts file in packages/shared/package.json's "test" script.
- Turn every row of §6.1 and §6.2 into a test, using the exact USD and LBP values.
- Existing callers must still compile.
Finish with: npm run test:shared, npm run lint, npm run build, npm run typecheck:mobile — all green.
Summarize what you added and any rule in the plan you found ambiguous.
```

### Phase 2

```
Read CLAUDE.md and docs/pricing/IMPLEMENTATION_PLAN.md (§2–§5, §6).
Phase 1 is merged. Implement Phase 2 (T2.1–T2.9) in packages/core/src/store.ts only.
- Mutations stay pure: (state, ...args) => { state, error?: string }.
- Add a migrateState line for every new field. Old saved states must load.
- Keep the 5-second dispatch interval returning the same state reference when nothing changed.
- Use the shared functions from Phase 1; do not re-implement any price math.
- Update the web and mobile store-context.tsx to expose the new mutations,
  but do not change any screen yet.
Finish with all four checks green and a list of the new context methods.
```

### Phase 3

```
Read CLAUDE.md, design-system/direct-delivery/MASTER.md and docs/pricing/IMPLEMENTATION_PLAN.md (§3, T3.x).
Implement Phase 3 (T3.1–T3.5) on BOTH web and mobile: the settings page sections with live previews,
warnings and service switches, the partner companies page with the symmetric 5×5 price grid, the Economy
admin actions, the admin driver controls, and the admin order detail. Check every row of §5b.
- Use only shared/core functions for numbers.
- Add every string to both en and ar dictionaries.
- Logical CSS only; 44px touch targets; Lucide icons only.
Check at 375px wide, in Arabic (RTL), and in dark mode. All four checks green.
```

### Phase 4

```
Read CLAUDE.md and docs/pricing/IMPLEMENTATION_PLAN.md (§3, T4.x, §6.4).
Implement Phase 4 on BOTH web and mobile: remove the urgent toggle everywhere, add the
Packages/Taxi picker cards (Taxi shows Moto only) and option cards with disabled reasons,
the Taxi gender preference toggle for female passengers (§3.5), the Economy pickup/drop-off choice,
option badges in lists, and the Economy tracking rule.
- Gate anything derived from maps or storage behind a mount effect (hydration rule).
- No client-facing code may read partner_company_id or a company name.
Walk through §6.4 steps 4–6 and 8 and report what you saw. All four checks green.
```

### Phase 5

```
Read CLAUDE.md and docs/pricing/IMPLEMENTATION_PLAN.md (T5.x).
Implement Phase 5 on BOTH web and mobile: vehicle choice and passenger opt-in at registration
and on the profile, admin view of the vehicle, the Economy pickup job ending at
"Handed to partner", and the Taxi safety screens (T5.3). Walk through §6.4 steps 7, 8 and 10.
All four checks green.
```

### Phase 6

```
Read docs/pricing/IMPLEMENTATION_PLAN.md (T6.x).
Finish Phase 6: i18n review, update CLAUDE.md's pricing section to match §3 of the plan,
remove dead urgent/fare-band code (keep the migration lines), and add the new fields to the
Supabase "Known drift" list. Do not write SQL. All four checks green.
```

---

## 8. Out of scope (later)

| Topic | Note |
|---|---|
| Taxi by car | Method C: distance + map time, price fixed at booking |
| Waiting time (shopping) | An add-on booked in time blocks |
| Package size, fit check, extra-box fee for Car | Distance price + a fee per extra box, with the first box included |
| Company picking up from the client itself | A per-company `includes_pickup` flag. It needs care: the company's courier would reveal the partner |
| Trusted, private, owner, medical order types | Parked. `createOrder` keeps `order_type: "normal"` |
| Partner payables on the Money page | The order fields (②) make it possible; the screen comes later |
| Business pricing | To discuss later: own rates or discounts, volume discounts, weekly/monthly billing, cash-on-delivery for goods, who pays the fee. Until then, businesses use client prices plus the existing per-business min/max (Moto and Car only, OD-9) |
| Supabase schema | Phase 2 Workstream A. **Taxi launches only after it** (§1). The cutover must enforce on the server (RLS/RPC): clients can never read `partner_companies` or `partner_company_id`; only admins can write `gender` and `taxi_paused`; Taxi claims re-check `canMatchTaxi` inside the claim RPC |

---

## 9. Definition of done (whole project)

- Every row in §6 passes as an automated test or in the §6.4 walkthrough.
- No file in `apps/` contains pricing arithmetic. Prices come only from `packages/shared`.
- `is_urgent` is no longer read by any client-facing UI.
- Every row of §5b works: changing the admin control changes what the client sees.
- Every §6.3 Taxi matching case passes, and `gender` can't be changed by its own user.
- `CLAUDE.md`'s pricing section matches §3.
- `npm run test:shared`, `npm run lint`, `npm run build` and `npm run typecheck:mobile` are green.
