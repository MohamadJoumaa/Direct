Build an interactive, clickable prototype of the **client ordering flow** for **Direct**, a Lebanese delivery and moto-taxi app. I'll use it to demonstrate the flow to my business partner, so every branch below must be clickable and show real prices.

Make it **one React artifact**, using Tailwind and lucide-react. Show it as a **phone frame (about 390×800) in the centre**, with a **"Demo controls" panel beside it** (it stacks under the phone on narrow screens).

---

## 1. Look and feel (follow exactly)

- **Uber-style monochrome.** White surfaces with black primary buttons. Text `#0a0a0a`, muted text `#575757`, borders `#e5e5e5`, muted fill `#f6f6f6`.
- **Brand blue `#2563eb` is an accent only:** the selected option's outline, links, map markers, the active step. Never a button or section background.
- **Gold `#d4af37`:** decorative thin lines only, if at all.
- **Font:** Plus Jakarta Sans (Google Fonts), bold tight headings.
- **Icons:** lucide-react only. **Never emoji.** Suggested: `Package` (Packages), `Bike` (Moto), `Car` (Car), `Truck` (Economy), `User` (Taxi passenger), `MapPin`, `Clock`, `Moon`, `ShieldCheck`, `Flag`, `Ban`.
- Touch targets at least 44px, rounded cards, subtle shadows, 150–300ms transitions.
- The **primary action is pinned at the bottom** of the phone screen. Choices that pop up use **bottom sheets**, not centred dialogs.
- Money is always shown in **both currencies:** `$5.00 · 448,000 LBP`. LBP = USD × 89,500, rounded to the nearest 1,000.

---

## 2. Demo controls panel (outside the phone)

These let me jump to any situation without typing addresses:

| Control | Options |
|---|---|
| **Trip** | Preset trips (below), plus a **km slider from 1 to 260** that overrides the distance |
| **Time** | Day (12:00) · Evening (23:00) · Night (01:00) |
| **Client gender** | Female · Male |
| **Client verified** (approved selfie + ID) | Yes · No |
| **Female drivers available** | Yes · No |
| **Reset flow** | Back to the first screen |
| **Prices** (collapsible section) | Editable fields for every option, see below |

### Prices section (the admin's fields)

Every price in the phone must come from these fields and update **instantly** when a field changes. Prefill them with the defaults in §3, and add a **"Reset to proposed values"** button.

| Group | Fields |
|---|---|
| Global | Round to the nearest: $0.25 / **$0.50** / $1.00 · LBP per USD (89,500) |
| Package · Moto | Start price · Km included · Price per extra km · Night surcharge · Min km · Max km |
| Package · Car | Start price · Km included · Price per extra km · Available from (hour) · Available until (hour) · Min km · Max km |
| Taxi · Moto | Start price · Km included · Price per extra km · Night surcharge · Min km · Max km |
| Economy | Direct's share (pickup) · Direct's share (drop-off) · Pickup cap · Pickup from (km) · Drop-off from (km) · Max km · Company A and B prices per region (small editable grid) |

Under the fields, show a **mini table** with Moto, Car and Taxi prices at 4, 10, 20, 50 and 100 km, so the effect of a change is visible without leaving the panel.

**Warnings** (shown in the panel in amber; they never block anything or hide options in the phone):
- **Car vs Moto:** if Car costs the same as or less than Moto at any km where both are offered: *"Car costs the same as or less than Moto on trips from X to Y km. Raise the Car rates or lower Moto."*
- **Economy vs Moto:** if Economy (either way, using the highest company price) costs the same as or more than Moto at any km from 20 to 50: *"Economy (pickup) costs the same as or more than Moto on trips from X to Y km."*

Group consecutive km into one "from X to Y km" message.

Preset trips (road km):

| Trip | km | Regions |
|---|---|---|
| Hamra → Achrafieh | 4 | Beirut → Beirut |
| Hamra → Dbayeh | 14 | Beirut → Mount Lebanon |
| Hamra → Aley | 18 | Beirut → Mount Lebanon |
| Verdun → Jounieh | 22 | Beirut → Mount Lebanon |
| Hamra → Jbeil | 37 | Beirut → Mount Lebanon |
| Hamra → Sidon | 45 | Beirut → South |
| Hamra → Zahle | 55 | Beirut → Bekaa |
| Hamra → Tripoli | 85 | Beirut → North |
| Beirut → Tyre | 120 | Beirut → South |

---

## 3. Pricing rules (defaults for the Prices fields; compute live, don't hard-code results)

### Distance price (Moto, Car, Taxi Moto)

```
raw   = start + max(0, km − 3) × perKm
price = round to the nearest $0.50 (half rounds up)   // Math.round(raw / 0.5 + 1e-9) * 0.5
price = price + night surcharge (if night and the option has one)
```

| Option | Start (first 3 km) | Per extra km | Range (km) | Night (00:00–06:00) |
|---|---|---|---|---|
| Package · Moto | $3.00 | $0.25 | 0–50 | +$1 |
| Package · Car | $6.00 | $0.45 | 0–100 | **Not available 22:00–06:00** |
| Taxi · Moto | $3.00 | $0.30 | 0–25 | +$1 |

### Economy (packages only, 2–3 days)

A partner courier company delivers. **The client never sees the company's name**, only "Direct Economy".

```
total = pickup part + company price + Direct's share ($1)
```

| Way | Pickup part | Available from |
|---|---|---|
| **Direct picks up** | Moto price for the trip from the client to the company's branch, **capped at $4** | 30 km to 250 km |
| **I'll drop it off at Direct** | $0 | 20 km to 250 km |

Partner companies (hidden from the client; the system picks the cheapest **total**):

| Company | Beirut→Beirut | Beirut→Mount Lebanon | Beirut→South | Beirut→Bekaa | Beirut→North | Branch distance from client |
|---|---|---|---|---|---|---|
| A | 3.00 | 3.50 | 4.50 | 5.00 | 5.00 | 2 km |
| B | 3.00 | 3.50 | 4.00 | 5.50 | 5.50 | 12 km |

Check: Hamra → Sidon, drop-off = **$5.00** (company B). Pickup = A: $3.00 + 4.50 + 1 = **$8.50**; B: $4.00 (capped) + 4.00 + 1 = $9.00, so the client sees **$8.50**.

### Availability rules

- An option outside its range, or Car at night, is **still shown, greyed out, with a reason**:
  - "Only for trips up to 50 km"
  - "Only for trips from 20 km"
  - "Available 6 am – 10 pm"
- Options are greyed out **only** because of distance or Car hours, never because of price.
- If every option is unavailable: "Contact Direct for this trip".
- There is **no "urgent" option**. Speed comes from the vehicle: Moto and Car are same day, Economy takes 2–3 days.

---

## 4. Screens and flow

Show a small progress indicator at the top of each screen.

### Screen 1: Choose a service
Two large cards with an illustration-style composition of lucide icons:
- **Packages:** "Send anything across Lebanon"
- **Taxi:** "A moto ride, now"

### PACKAGES flow

**P1: Where?** Pickup and destination fields, prefilled from the selected preset trip, with a simple map placeholder (two pins and a line, drawn in SVG; no real map). It shows "{km} km by road".

**P2: Choose how to send.** Three option cards, in this order:
- **Moto** · Same day · price
- **Car** · Same day · price · "For bigger loads"
- **Economy** · 2–3 days · "from" the lower of its two prices

Rules for this screen:
- The selected card has a blue outline. A disabled card is dimmed, with the reason under its name.
- Night: a small `Moon` note under the price, "Includes $1 night surcharge" (Moto only).
- Selecting **Economy** opens a bottom sheet with two choices:
  - **Direct picks it up** · price · "A Direct driver collects it from you"
  - **I'll drop it off at Direct** · price · "Direct Hub, Hamra · Mon–Sat 9:00–18:00 · 2–3 days start when we receive it"
  - Disable either one, with its reason, outside its range.
- Below the cards: a price stepper, "Add a tip so a driver accepts faster", which can go **up only**, never below the quote. Hide it for Economy.

**P3: What are you sending?** A short text field, then **Confirm** with the final price.

**P4: Tracking (Moto and Car).** Animate through these states, with a "Next step" button for the demo: Finding a driver → Driver on the way (live map, driver photo placeholder, name, vehicle) → Picked up → Arriving → Delivered → rate 1–5 stars. Cash on delivery.

**P4-E: Tracking (Economy)**
- *Direct picks up:* Finding a driver → Driver on the way (**live map**) → **"Picked up by Direct"**, after which the map disappears and a note says "Live tracking ends at pickup" → **"On its way · arrives in 2–3 days"** → Delivered. The client pays the driver at pickup.
- *Drop-off:* "Bring your package to Direct Hub" with the address and hours → "Received at Direct" → "On its way · arrives in 2–3 days" → Delivered. The client pays at the counter.
- The company's name never appears anywhere.

### TAXI flow (moto only)

**T0: Verification gate.** If "Client verified" = No, show a `ShieldCheck` screen: "Verify your account to use Taxi. Upload a selfie and your ID; we review it within 24 hours." Stop here.

**T1: Where to?** Same as P1. Max 25 km.

**T2: Your ride.** One card only, **Moto ride** (no Car option at all), with its price, or disabled above 25 km ("Only for trips up to 25 km").
- **If the client is female:** a segmented toggle, **"Female driver only"** (default) / **"Any driver"**, with a one-line explanation: "Female driver only means only verified female drivers see your request."
- **If the client is male:** no toggle. Show a small note: "You'll be matched with a male driver."
- A note that gender never changes the price.

**T3: Finding your driver**
- If female + "Female driver only" + Female drivers available = No: after a short wait, show a bottom sheet: **"No female driver is free right now. Search all drivers?"** with "Keep waiting" / "Search all drivers". **Never switch automatically.**
- Otherwise: "Driver found".

**T4: Check your driver.** Large verified photo placeholder with a `ShieldCheck` "Verified" badge, first name, moto, plate. Two buttons: **"That's my driver"** and **"Not the person shown"**. The second cancels with no fee and opens a report confirmation.

**T5: On the ride.** Live map for the **whole** ride, a "Share trip" button (shows a link), and an SOS-style "Report a problem" link.

**T6: Arrived.** Pay cash, rate 1–5, and two actions: **"Report"** (reasons include "Safety / harassment", with the note "This immediately pauses the driver from Taxi until Direct reviews it") and **"Block this driver"** ("You'll never be matched again").

### Safety rules to show inside the Taxi flow (a small "How we keep you safe" sheet from a `ShieldCheck` icon)
- Gender comes from your approved ID and can't be changed in the app.
- Every driver and passenger is verified with a selfie and ID.
- Men are matched with male drivers. Women choose female drivers only, or any driver.
- You see your driver's verified photo before you ride.
- Live tracking for the whole ride.
- Report or block after every ride.

---

## 5. Demo paths (one-click jumps)

In the demo panel, add a **"Demo paths"** list. Clicking a path sets the demo controls (trip, time, gender, verified, female drivers) and opens the phone at the right screen. Each path also has a ✓ that ticks once I've walked it to the end, so I can see what I've already shown.

| # | Path | Sets | Ends at |
|---|---|---|---|
| 1 | Package · Moto, short city trip | Hamra → Achrafieh, day | Delivered + rating ($3.50) |
| 2 | Package · Moto at night | Hamra → Achrafieh, night | Price shows the +$1 night note ($4.50) |
| 3 | Package · Car | Hamra → Dbayeh, day | Delivered + rating |
| 4 | Car closed in the evening | Hamra → Dbayeh, 23:00 | Car greyed out: "Available 6 am – 10 pm" |
| 5 | Economy · drop-off at Direct | Hamra → Sidon, day | "On its way · arrives in 2–3 days" → Delivered ($5.00) |
| 6 | Economy · Direct picks up | Hamra → Sidon, day | Map disappears after "Picked up by Direct" ($8.50) |
| 7 | Economy pickup too short | Verdun → Jounieh (22 km) | Pickup disabled "Only for trips from 30 km", drop-off available |
| 8 | Long trip, Economy only | Beirut → Tyre (120 km) | Moto and Car greyed out with reasons |
| 9 | Taxi · not verified | Female, verified = No | Verification screen |
| 10 | Taxi · woman, female driver | Female, verified, female drivers = Yes | Check your driver → ride → rating |
| 11 | Taxi · no female driver free | Female, verified, female drivers = No | "Search all drivers?" sheet; choosing it finds a driver |
| 12 | Taxi · man | Male, verified | Note "matched with a male driver" → ride |
| 13 | Taxi · wrong person at pickup | Female, verified | "Not the person shown" → cancelled, no fee, report sent |
| 14 | Taxi · report and block after the ride | Male, verified | Report "Safety / harassment" + Block confirmation |
| 15 | Taxi too far | Hamra → Jbeil (37 km) | Moto ride greyed out: "Only for trips up to 25 km" |

**Navigation:** every phone screen has a **back arrow** (top start) that goes to the previous step. In the tracking screens, a **"Next step"** button advances the simulated order, so I control the pace while presenting.

## 6. Content and quality

- Use real Lebanese place names and the exact prices from the rules. Check: Hamra → Achrafieh (4 km) by Moto = **$3.50 · 313,000 LBP** by day and **$4.50 · 403,000 LBP** at night.
- Every number on screen must come from the formulas.
- Write all copy in plain, friendly English. Add an **EN / عربي toggle** in the demo panel if you can; it must flip the phone to right-to-left. If it's too much, English only is fine.
- No lorem ipsum, no emoji, no fake company names on client screens.
- Above the phone, add a one-line title: "Direct · Client ordering flow (prototype)".
