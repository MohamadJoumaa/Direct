Build a **full interactive prototype of the Direct app after "Pricing Model v2"**, covering **all four roles: Client, Business, Driver and Admin**. They share **one simulated state**: an order a client places shows up as an offer for the right driver and in the admin's order list, and an admin setting changes the client's prices immediately.

Direct is a Lebanese same-city delivery and moto-taxi app: send a package or take a moto ride, watch the driver on a map, pay cash, and both sides confirm. This prototype shows my business partner what the final product will look and behave like once our implementation plan is built. **Every rule below is decided; follow it exactly.**

The prompt is long on purpose. If you run out of space, stop at a clean point and I'll say "continue".

---

## 0. Technical shape

- **One React artifact,** using Tailwind and `lucide-react`. Keep all state in one `useReducer` store so every role reads and writes the same data. No backend, no real maps, no real payments.
- **Layout:**
  - A **top bar** with the role switcher (`Client · Business · Driver · Admin`) and, for Driver, a picker for which demo driver you are.
  - A **demo controls drawer** (clock, quick scenarios, reset).
  - The **main area:** Client, Business and Driver render inside a **phone frame** (~390×800). Admin renders as a **desktop dashboard** with a side nav.
- **Clock:** a demo control sets the time, with presets Day 12:00, Evening 23:00, Night 01:00, Morning 06:30. Night = 00:00–06:00 Beirut.
- **"Simulate" buttons** move things forward without waiting: "Driver accepts", "Next step", "Partner confirms delivery", "Dispatch round times out".

---

## 1. Look and feel (follow exactly)

- **Uber-style monochrome:** white surfaces, black primary buttons (white text), text `#0a0a0a`, muted text `#575757`, borders `#e5e5e5`, muted fill `#f6f6f6`. Provide **dark mode** too: background `#0a0a0a`, cards `#141414`, borders `#2a2a2a`, white primary buttons.
- **Brand blue** `#2563eb` (dark `#4d82f3`) is an **accent only:** selected outlines, links, active nav, focus rings, map markers. Never a button or section background.
- **Gold** `#d4af37`: thin decorative lines only.
- **Font:** Plus Jakarta Sans. Bold, tight headings.
- **Icons:** lucide-react only, **never emoji**. Suggested: `Package`, `Bike`, `Car`, `Truck` (Economy), `User`, `MapPin`, `Clock`, `Moon`, `ShieldCheck`, `Flag`, `Ban`, `Wallet`, `Settings`, `Building2` (partners), `FileCheck` (documents), `AlertTriangle` (warnings).
- Touch targets ≥ 44px, transitions 150–300ms, visible focus rings.
- **On the phone:** primary actions are pinned at the bottom, and choices use **bottom sheets**.
- **Money is always dual currency:** `$5.00 · 448,000 LBP`. LBP = USD × `lbp_per_usd`, rounded to the nearest 1,000 (`Math.round(n / 1000) * 1000`).
- **Status chips:** green = good, amber = attention, red = blocked, grey = off. Semantic colours are separate from the blue accent.

---

## 2. Settings: the admin's fields, and the defaults every price comes from

Store these in state. The **Admin → Settings** page edits them, and every screen recalculates instantly.

```
// General
rounding_step_usd: 0.5          // choices 0.25 / 0.5 / 1
lbp_per_usd: 89500
taxi_enabled: true               // (in the real app it starts off until the server move; on here for the demo)
economy_enabled: true

// Package · Moto
moto_min_km: 0, moto_max_km: 50, moto_start_usd: 3, moto_included_km: 3, moto_per_km_usd: 0.25, moto_night_usd: 1

// Package · Car
car_min_km: 0, car_max_km: 100, car_start_usd: 6, car_included_km: 3, car_per_km_usd: 0.45, car_from_hour: 6, car_until_hour: 22

// Taxi · Moto
taxi_moto_min_km: 0, taxi_moto_max_km: 25, taxi_moto_start_usd: 3, taxi_moto_included_km: 3, taxi_moto_per_km_usd: 0.30, taxi_moto_night_usd: 1

// Economy
economy_min_km: 20, economy_pickup_min_km: 30, economy_max_km: 250
economy_pickup_cap_usd: 4, economy_share_pickup_usd: 1, economy_share_dropoff_usd: 1, economy_dropoff_fee_usd: 0
economy_dropoff_place: "Direct Hub, Hamra", economy_dropoff_hours: "Mon–Sat 9:00–18:00"

// Driver payments
company_percentage: 15
subscription_daily_moto_usd: 3, subscription_monthly_moto_usd: 30
subscription_daily_car_usd: 5, subscription_monthly_car_usd: 50
grace_days: 5, freeze_penalty_usd: 10
```

---

## 3. Pricing rules (implement as pure functions; never hard-code a result)

### 3.1 Distance price (Package Moto, Package Car, Taxi Moto, and Economy's pickup part)

```
raw   = start + max(0, km − included_km) × per_km
price = Math.round(raw / step + 1e-9) * step      // step = rounding_step_usd
price = price + night surcharge                   // only if night and the option has one; added AFTER rounding
lbp   = Math.round(price × lbp_per_usd / 1000) * 1000
```

### 3.2 Availability: an option is greyed out, never hidden

An option is unavailable **only** because of its distance range (inclusive), Car hours, an admin switch, or no partner covering the route. **Never because of price.** Show it disabled, with the reason:
- "Only for trips up to {max} km"
- "Only for trips from {min} km"
- "Available 6 am – 10 pm" (Car, built from the hour settings)
- "Economy is paused" (switch off)
- "Economy isn't available for this route" (no active company has a price for it)
- If everything is unavailable: "Contact Direct for this trip".
- Taxi switched off: the Taxi card on the service picker shows "Coming soon".

### 3.3 The options

| | Package · Moto | Package · Car | Economy: Direct picks up | Economy: drop-off at Direct | Taxi · Moto |
|---|---|---|---|---|---|
| Range | 0–50 km | 0–100 km | 30–250 km | 20–250 km | 0–25 km |
| Price | Moto formula | Car formula | ① + ② + ③ | ① + ② + ③ | Taxi formula |
| Night | +$1 | not offered outside 06–22 | no surcharge; created at night, dispatched from 06:00 | no rule | +$1 |
| Speed label | Same day | Same day | 2–3 days | 2–3 days from drop-off | Now |
| Who carries it | driver with vehicle **moto** | driver with vehicle **car** | **moto** driver to the company branch, then the partner | Direct, then the partner | **moto** driver with **"carries passengers" on**, gender-matched |
| Client tracking | live map all the way | live map all the way | live map **until pickup**, then statuses only | statuses only | live map **the whole ride** |
| Client pays | cash on delivery | cash on delivery | full price to the driver at pickup | full price at Direct's counter | cash at arrival |
| Tip above the quote | yes (price can go **up** only) | yes | no | no | yes |
| Business min/max clamp | yes | yes | no | no | no |
| Ends when | client confirms with 1–5 stars + driver confirms | same | admin marks delivered | admin marks delivered | both confirm + rating |

### 3.4 Economy pricing and company choice

- ① pickup = Moto formula for the km from the client to **that company's branch**, **without** night, **capped** at `economy_pickup_cap_usd`. For drop-off, ① = `economy_dropoff_fee_usd`.
- ② = the company's table price for the route's region pair.
- ③ = Direct's share for that way.
- Total = round(① + ② + ③).
- **Choosing the company:** consider active companies with a price for the region pair, compute each one's **total**, and take the lowest. On a tie, the **preferred** one wins.
- **The client never sees a company name.** It's always "Economy" / "Direct Economy". Drivers and admins do see it.

**Regions:** Beirut, Mount Lebanon, North, South, Bekaa. **Price tables are symmetric:** A→B = B→A, so there are 15 cells per company, including same-region trips.

**Seed partner companies:**

| Company | Branch | Active | Preferred | Beirut–Beirut | Beirut–Mt Leb | Beirut–North | Beirut–South | Beirut–Bekaa | MtLeb–MtLeb | MtLeb–North | MtLeb–South | MtLeb–Bekaa | North–North | North–South | North–Bekaa | South–South | South–Bekaa | Bekaa–Bekaa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cedar Express | Karantina | yes | no | 3 | 3.5 | 5 | 4.5 | 5 | 3 | 4.5 | 5 | 5 | 3 | 6 | 6 | 3 | 5.5 | 3 |
| Nahr Couriers | Choueifat | yes | no | 3 | 3.5 | 5.5 | 4 | 5.5 | 3 | 5 | 4.5 | 5 | 3 | 6 | 6 | 3 | 5.5 | 3 |

(These names are made up for the demo. They appear only on driver and admin screens.)

### 3.5 Preset trips (the client picks one; the demo also has a km slider override)

| Trip | Road km | Regions | Client → Cedar branch | Client → Nahr branch |
|---|---|---|---|---|
| Hamra → Achrafieh | 4 | Beirut → Beirut | 3 km | 12 km |
| Hamra → Dbayeh | 14 | Beirut → Mount Lebanon | 3 km | 12 km |
| Verdun → Jounieh | 22 | Beirut → Mount Lebanon | 4 km | 11 km |
| Hamra → Jbeil | 37 | Beirut → Mount Lebanon | 3 km | 12 km |
| Hamra → Sidon | 45 | Beirut → South | 2 km | 12 km |
| Hamra → Zahle | 55 | Beirut → Bekaa | 3 km | 12 km |
| Hamra → Tripoli | 85 | Beirut → North | 3 km | 12 km |
| Beirut → Tyre | 120 | Beirut → South | 3 km | 12 km |

### 3.6 Check values (the prototype must show exactly these with the defaults)

| Case | Expected |
|---|---|
| Moto, Hamra → Achrafieh (4 km), day | **$3.50 · 313,000 LBP** |
| Same, night | **$4.50 · 403,000 LBP** |
| Moto 10 km / 20 km / 50 km | $5.00 / $7.50 / $15.00 |
| Car 10 km / 20 km / 100 km | $9.00 / $13.50 / $49.50 |
| Car at 23:00 | disabled, "Available 6 am – 10 pm" |
| Taxi 10 km / 25 km / 26 km | $5.00 / $9.50 / disabled "Only for trips up to 25 km" |
| Economy drop-off, Hamra → Sidon | **$5.00** (Nahr: 0 + 4 + 1) |
| Economy pickup, Hamra → Sidon | **$8.50** (Cedar: Moto(2 km) = $3 + 4.5 + 1; Nahr would be min($4, Moto(12 km) = $5.50) + 4 + 1 = $9) |
| Economy pickup, Verdun → Jounieh (22 km) | disabled "Only for trips from 30 km"; drop-off available |
| Beirut → Tyre (120 km) | Moto and Car disabled with reasons; Economy available |

---

## 4. People in the demo (seed data)

| Name | Role | Gender | Verified (selfie + ID approved) | Vehicle | Carries passengers | Pays by |
|---|---|---|---|---|---|---|
| Lara Haddad | Client | female | yes | — | — | — |
| Karim Nassar | Client | male | yes | — | — | — |
| Maya Saad | Client | female | **no** (ID pending review) | — | — | — |
| Beit Zaatar Shop | Business | — | yes | — | — | — |
| Rami Khoury | Driver | male | yes | moto | yes | monthly subscription |
| Nour Aziz | Driver | female | yes | moto | yes | percentage |
| Hadi Mansour | Driver | male | yes | car | no | daily subscription |
| Ziad Fares | Driver | male | yes | moto | **no** | percentage |
| Admin | Admin | — | — | — | — | — |

- Gender is **set by an admin from the ID** and shown as read-only on the user's own profile: "From your verified ID".
- Beit Zaatar Shop has a **per-business min/max** of $4 / $12 for Moto and Car.

---

## 5. CLIENT (phone)

**Home:** greeting, a big **"Send or ride"** button, active orders as cards with option badges (`Bike` Moto, `Car` Car, `Truck` Economy, `User` Taxi) and status chips, and a notifications bell.

**Service picker:** two large illustrated cards, built from lucide icons:
- **Packages:** "Send anything across Lebanon"
- **Taxi:** "A moto ride, now", or "Coming soon" when switched off

### Packages flow
1. **Where?** Pick a preset trip. Show a simple SVG map (two pins and a line) and "{km} km by road".
2. **Choose how to send:** cards for **Moto · Car · Economy**, each with its speed label and price, or disabled with its reason. A night note appears on Moto: "Includes $1 night surcharge".
   - Choosing Economy opens a sheet: **"Direct picks it up"** (price) / **"I'll drop it off at Direct"** (price, address, hours, "2–3 days start when we receive it"). Each is disabled outside its range.
   - **Tip stepper** (up only, never below the quote) for Moto and Car. Hidden for Economy.
3. **What are you sending?** A text field, then **Confirm $X**.
4. **Tracking:**
   - **Moto/Car:** Finding a driver → Driver on the way (live map, driver photo placeholder, name, vehicle) → Picked up → Arriving → Delivered → rate 1–5 → done.
   - **Economy, pickup:** Finding a driver → Driver on the way (**live map**) → **"Picked up by Direct"**, after which the map is removed with the note "Live tracking ends at pickup" → "On its way · arrives in 2–3 days" → "Delivered".
   - **Economy, drop-off:** "Bring your package to Direct Hub" → "Received at Direct" → "On its way · arrives in 2–3 days" → "Delivered".

### Taxi flow
1. **Not verified** (Maya): a `ShieldCheck` screen, "Verify your account to use Taxi". Stop.
2. **Where to?** Preset trips, max 25 km.
3. **Your ride:** one **Moto ride** card. **No Car card at all.**
   - **Women** (Lara): a segmented toggle, **"Female driver only"** (default) / **"Any driver"**, with "Only verified female drivers see your request."
   - **Men** (Karim): no toggle; the note "You'll be matched with a male driver."
   - A note: "Gender never changes the price."
4. **Finding your driver.** If "Female driver only" and no female driver accepts in time (the demo button "Dispatch round times out"), a sheet asks: **"No female driver is free right now. Search all drivers?"** with "Keep waiting" / "Search all drivers". **Never switch automatically.**
5. **Check your driver:** the verified photo with a `ShieldCheck` "Verified" badge, first name, moto, plate. **"That's my driver"** / **"Not the person shown"**. The second cancels with no fee and files a report.
6. **On the ride:** live map for the whole ride, "Share trip", "Report a problem".
7. **Arrived:** pay cash, rate 1–5, **Report** (reasons include "Safety / harassment") and **Block this driver**.
8. A "How we keep you safe" sheet: gender comes from your approved ID and can't be changed in the app · everyone is verified · men ride with male drivers, women choose · see your driver's photo before you ride · live tracking the whole ride · report or block after every ride.

**Profile:** name, phone, gender (read-only, "From your verified ID", or "Not verified yet"), and documents status.

**Notifications** include: "We received your package", "Your package is on its way · 2–3 days", "Delivered", "Your driver is on the way".

---

## 6. BUSINESS (phone)

Same screens as Client, with these differences:
- **Packages only.** The Taxi card shows "Not available for business accounts". *(This follows the pending business proposal; label it "Business pricing: to be decided" in a small note on the business home.)*
- **Moto and Car prices are clamped** to that business's min/max, e.g. a 4 km Moto at $3.50 shows **$4.00** for Beit Zaatar, with a small note "Your business rate". Economy is never clamped.
- The pickup address defaults to the shop's address.

---

## 7. DRIVER (phone)

The demo driver picker switches between Rami, Nour, Hadi and Ziad.

**Home / jobs:**
- **Online/offline** toggle.
- A **payment status card:**
  - **Subscription:** plan, time left, price by vehicle (moto $3/day or $30/month; car $5/day or $50/month).
  - **Percentage:** "15% of each trip", "Due now", "Accruing today".
  - **"Economy cash to hand in"**, shown separately when it exists.
- **Offers list:** only orders this driver may take:
  - Package Moto and Economy pickup → **moto** drivers
  - Package Car → **car** drivers
  - Taxi → **moto + carries passengers**, then gender matching: Nour gets women who chose "Female driver only" or "Any driver"; Rami gets men, and women who chose "Any driver"; Ziad never gets Taxi; Hadi never gets Moto or Taxi.
  - Economy pickup at night: not offered until 06:00.
  - Each offer shows: option badge, pickup → destination (for Economy pickup the destination is **the company branch, with its name**), distance to pickup, and the **driver's earning**.
- **Accept** / **Skip**.

**Job flow:**
- **Moto/Car packages:** Go to pickup → Picked up → Arrived → Confirm delivered (the client confirms with stars).
- **Economy pickup:** Go to pickup → collect **the full price** in cash (show it: "Collect $8.50 · you keep $3.00 · hand in $5.50") → drive to **Cedar Express, Karantina** → **"Handed to partner"**. The driver's job ends here and capacity is freed.
- **Taxi:** **Check your passenger** (verified photo + first name; "Not the person shown") → ride with live map → arrived → collect cash → rate the passenger, **Report** / **Block**.

**Earnings / payments screen:**
- Today's trips with **earning per trip**:
  - Package or Taxi: the price, minus 15% of the base if on percentage.
  - Economy pickup: ① only, and 15% of ① if on percentage.
- **Balance due:** commission (percentage drivers) + **Economy cash to hand in** (all drivers). A **"Pay with Whish"** button and **"I already paid"**. Unpaid after **07:00 the next day** → a red banner "Pay your balance to take new jobs", and offers stop.
- Subscription renewal shows **the price for this driver's vehicle**.

**Check values:**
- Nour (percentage) completes a 10 km Moto package at $5.00 → earns **$4.25**, commission **$0.75**.
- Rami (subscription) does the Hamra → Sidon Economy pickup → collects **$8.50**, keeps **$3.00**, owes **$5.50**.

**Profile:** vehicle (Moto/Car), "I also carry passengers (Taxi)" (moto only), gender (read-only, from ID), and documents (selfie, ID, vehicle registration, driving licence) with statuses.

---

## 8. ADMIN (desktop dashboard)

Side nav: **Orders · Drivers · Clients · Partners · Documents · Reports · Money · Settings**.

### 8.1 Settings
Sections: **General · Moto · Car · Economy · Taxi · Driver payments**, each with labelled inputs for every field in §2.
- **Each option section** shows a **live preview table** (sample trips at 4, 10, 20, 50 and 100 km: exact price and what the client sees).
- **Switches:** Taxi on/off (note "In the real app, turn on only after the server move"), Economy on/off.
- **Warnings panel** (amber, never blocks saving or hides anything). Group consecutive km into "from X to Y km":
  - **Car vs Moto:** Car ≤ Moto at any km where both are offered.
  - **Economy vs Moto:** with each active company's **highest** price, drop-off total or pickup total (cap + price + share, from the pickup minimum) **≥** Moto at any km from 20 to 50.
  - Demo check: with the defaults, the highest company price is $6 (North–South), so the worst-case pickup total is $4 + $6 + $1 = $11. The panel should show **"Economy (pickup) costs the same as or more than Moto on trips from 30 to 35 km"**. Setting `economy_pickup_min_km` to 20 widens it to **20 to 35 km**. Raising `moto_per_km_usd` to $0.30 shrinks it to **30 km only**.
- **"Reset to proposed values"** and **Save** (a toast "Settings saved").

### 8.2 Partners
- A company list: name, branch, active toggle, preferred star.
- An **edit** view: name, branch (pin on an SVG map), active, preferred, and a **5×5 symmetric price grid** (editing a cell updates its mirror). Empty cell = no service.
- Add / remove a company. Removal is refused while an open order uses it, with "An open order still uses this company".

### 8.3 Orders
- A table with filters: option (Moto / Car / Economy / Taxi), status, and **Economy queue**.
- Economy actions: **"Received at Direct"** (drop-off orders), **"Send to partner"** (batch-select, grouped by company), **"Mark delivered"**.
- **Order detail:** service, option, Economy way, **partner company name**, a price breakdown **① pickup · ② company · ③ Direct's share**, the driver and their earning, a status timeline, and for Taxi the passenger's gender preference and any report or "Not the person shown" event.

### 8.4 Drivers (and Clients)
- A list with status chips: online, subscription status / percentage due, paused from Taxi, banned.
- **Detail:** edit **vehicle**, **carries passengers**, **gender** (admin only), a **"Paused from Taxi"** badge with **Clear pause**, **blocks** with **Remove**, payment mode and balance, and freeze / unfreeze / ban (existing actions).

### 8.5 Documents
- Pending documents with an image placeholder.
- **Approving an ID requires choosing Male / Female** ("Read it from the ID card"). Approving the selfie and ID makes the account verified, which unlocks Taxi.
- Maya's ID is pending, to demo this.

### 8.6 Reports
- Taxi reports, including "Safety / harassment".
- A safety report **immediately pauses** the reported account from Taxi. Actions: **Clear pause** or **Ban**.

### 8.7 Money
- Today's totals: deliveries, Direct's commission, subscriptions, **Economy shares**, and **owed to partners** (② totals per company).
- Driver balances due, including "Economy cash to hand in".
- Pending "I already paid" confirmations.

---

## 9. Demo scenarios (one-click buttons in the demo drawer)

Each sets the role, user, clock and trip, then opens the right screen. Tick ✓ once walked.

| # | Scenario | Shows |
|---|---|---|
| 1 | Client Moto, short trip | $3.50 → Rami gets the offer → delivered → rating |
| 2 | Moto at night | $4.50 with the night note |
| 3 | Car order | Hadi gets it, Rami doesn't |
| 4 | Car at 23:00 | Disabled with its hours |
| 5 | Economy drop-off | $5.00 → admin "Received" → "Send to partner" → "Mark delivered" |
| 6 | Economy pickup | $8.50 → Rami collects $8.50, keeps $3 → hands it to Cedar → client's map disappears → admin delivers → Rami's balance shows $5.50 to hand in |
| 7 | Economy pickup too short | Verdun → Jounieh: pickup disabled, drop-off available |
| 8 | Long trip | Tyre: only Economy |
| 9 | Business order | Beit Zaatar: 4 km Moto shows $4.00 (clamped); no Taxi |
| 10 | Taxi, woman, female driver | Lara + "Female driver only" → only Nour gets it → check driver → ride → rating |
| 11 | No female driver free | Nour offline → timeout → "Search all drivers?" → Rami gets it |
| 12 | Taxi, man | Karim → Rami gets it, Nour doesn't |
| 13 | Not verified | Maya → verification screen → admin approves her ID, choosing Female → she can now order Taxi |
| 14 | Wrong person at pickup | "Not the person shown" → cancelled, report filed |
| 15 | Safety report | Lara reports Rami "Safety" → Rami paused from Taxi (offers stop) → admin clears the pause |
| 16 | Admin changes a price | Moto per km $0.25 → $0.30: client prices update; a Car vs Moto warning appears if they cross |
| 17 | Admin switches Taxi off | Client Taxi card shows "Coming soon" |
| 18 | Driver payments | Nour (percentage) after a $5 trip: earns $4.25. Hadi renews daily: asked $5 (car), Rami's monthly shows $30 (moto) |
| 19 | Balance blocks work | Set the clock past 07:00 next day with Rami's $5.50 unpaid → red banner, no offers → "I already paid" → admin confirms → offers return |

---

## 10. Quality bar

- Every number comes from the functions and the settings. Change a setting and every role reflects it.
- **No company name on any client or business screen.** Check it.
- No emoji. No lorem ipsum. Real Lebanese place names.
- An **EN / عربي** toggle if you can manage it: Arabic flips the layout right-to-left, and Economy = "اقتصادي". Otherwise English only.
- A title above everything: "Direct · Pricing Model v2 · Full app prototype".
