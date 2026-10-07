# Pricing Decisions Log

> Confirmed decisions only, in the order we made them. All numbers are **examples**; real prices are set last, and every number is an admin setting.

---

## Working order

```
PACKAGES                         TAXI
1. Moto     → confirm ✅          4. Moto → confirm ✅
2. Car      → confirm ✅
3. Economy  → confirm ✅
                  ↓
      5. Final check: all prices side by side
                  ↓
      6. Driver payments: subscription and percentage per vehicle
```

- Packages first. Taxi comes later (moto only for now).
- Size is ignored for now and discussed later.

---

## How an order is priced

1. The client sets **pickup** and **destination**.
2. The system measures the **road distance**.
3. The client sees **Moto**, **Car** and **Economy**, each with its own price.
4. An option that doesn't fit the distance stays visible but is **greyed out** with a short reason.

Each option has its **own formula**, not built from the others.

**Who controls prices:** the admin types the numbers in Settings (rates, company prices, Direct's share). The system only does the math. When the market changes, the admin updates a number and every price updates.

---

## Carried over from Draft 3

- **Urgency comes from the vehicle:** Moto and Car are same day, Economy takes 2–3 days. The urgent ×3 option is removed.
- **Driver gender preference** affects matching only, never the price.

---

## Distance ranges

| Option | Speed | Min | Max |
|---|---|---|---|
| Moto | Same day | 0 km | 50 km |
| Car | Same day | 0 km | 100 km |
| Economy | 2–3 days | 20 km | All of Lebanon (~250 km, to verify) |

| Distance | Client can press |
|---|---|
| 0–20 km | Moto · Car |
| 20–50 km | Moto · Car · Economy |
| 50–100 km | Car · Economy |
| 100 km + | Economy only |

---

## Economy (partner company)

"Economy" replaces the name "Company". Full decisions are in Step 3 below.

---

## Step 1 · Package · Moto ✅

### The two methods we compared

**Method A: start price + price per km**
The price grows a little with every km, like a taxi meter.
Example: the first 3 km cost $2, then +$0.20 for each extra km.

**Method B: price list by distance group**
One fixed price per group, which jumps at each group edge.
Example: 0–5 km $2 · 5–15 km $4 · 15–30 km $7 · 30–50 km $10.

### Decision: Method A

**Why A wins:** two similar trips always get a similar price.

| | Distance | Method A | Method B |
|---|---|---|---|
| Neighbour 1 | 14.9 km | $4.18 | $4 |
| Neighbour 2 | 15.1 km | $4.22 | **$7** |

With B, 200 metres costs $3 more. Clients feel cheated, argue with drivers, or move the pin on the map to pay less. With A, further always costs a little more, so there is nothing to argue about. A is also how the current system already works, so it's less work to build.

The admin sets 3 numbers: **start price**, **km included**, **price per km**.

### Rounding: nearest $0.50

Prices are rounded to the nearest $0.50, so clients see clean prices that are easy to pay in cash. LBP keeps its own rounding to the nearest 1,000.

| Trip | Exact | Client sees |
|---|---|---|
| 4 km | $2.20 | $2.00 |
| 7 km | $2.80 | $3.00 |
| 14 km | $4.20 | $4.00 |
| 16 km | $4.60 | $4.50 |
| 22 km | $5.80 | $6.00 |
| 31 km | $7.60 | $7.50 |
| 42 km | $9.80 | $10.00 |

> Checked with Gemini on real Beirut trips: it also chose A, but its prices for A were wrong (about $1 to $1.50 too high) and some distances looked off. Use the table above, not Gemini's numbers.

---

## Step 2 · Package · Car ✅

### Decision: same method as Moto, with its own numbers

**Start price + price per km**, rounded to the nearest $0.50.
Example: the first 3 km cost $5, then +$0.35 for each extra km.

| Trip | Moto | Car |
|---|---|---|
| 4 km | $2.00 | $5.50 |
| 10 km | $3.50 | $7.50 |
| 20 km | $5.50 | $11.00 |
| 50 km | $11.50 | $21.50 |
| 100 km | not offered | $39.00 |

**Why its own numbers instead of "Moto × 2":** a car costs more to start any trip (fuel, parking, Beirut traffic), but on longer highway trips the gap matters less. Separate numbers let the admin set a higher start price without long trips becoming too expensive.

The admin sets the same fields as Moto: **start price**, **km included**, **price per km**, **rounding**.

### Boxes: distance only for now

One price per trip, whatever the number of boxes.

- **Not per box only** ($5 × boxes): it ignores distance. 3 boxes over 2 km would cost $15 (too expensive), and 3 boxes over 90 km would also cost $15 (the driver loses money).
- **Not a client choice** between box pricing and distance pricing: the client always picks the cheaper one, so Direct and the driver always lose, and it adds a confusing choice.
- **Later, with the size topic:** distance price + a fee for each extra box, with the first box included. Example: 20 km with 3 boxes = $11 + 2 × $2 = $15. It's one more admin field and changes nothing above.

---

## Noted for later: what drivers pay Direct

Not decided. This topic is still parked; this is the recommendation to start from.

- **Percentage: same for Moto and Car.** It already scales with the fare. At 10%, a 20 km moto trip ($5.50) gives Direct $0.55 and a car trip ($11) gives $1.10. A higher car percentage would charge car drivers twice.
- **Subscription: a different price per vehicle.** A subscription is a flat amount and doesn't grow with the fare, so equal prices would favour car drivers. Example: Moto $2/day, Car $3/day.

---

## Step 3 · Package · Economy ✅

Delivered by a partner company in 2–3 days. **The client never sees which company**: only "Direct Economy".

### Assumption: the company does not pick up from the client

We assume the company only delivers from its own place. **To confirm with each company:** "Does your price include pickup from the sender's address?" If yes, the pickup part is removed and nothing else changes.

### Two ways to send

```
Direct picks up:     Client ──(Direct driver)─────────────────────────▶ Company ──(2–3 days)──▶ Destination
Client drops off:    Client ──(brings it)──────▶ Direct ──(daily trip)──▶ Company ──(2–3 days)──▶ Destination
```

**Price = ① pickup + ② company price + ③ Direct's share**

| | Direct picks up | Client drops off at Direct |
|---|---|---|
| ① Pickup | Moto price, e.g. $3 | $0 |
| ② Company price | $4 | $4 |
| ③ Direct's share | $1 | $1 |
| **Client sees** | **$8** | **$5** |

- **Pickup = the Moto price** for the trip from the client **straight to the company** (method A). There are no new numbers, and a client close by pays less. Only the driver sees the company; the client never does.
- **Drop-off is at Direct's place, never at the company**, so the company stays hidden. The app shows Direct's address and opening hours. The 2–3 days start at drop-off, and the app says so.
- **The daily trip from Direct to the company** is only for drop-offs. It carries all the day's dropped-off packages at once and is covered by Direct's share, so the client isn't charged for it.
- **Picking the company when Direct picks up:** the pickup price depends on how far the company is, so the system compares the **full price** (pickup + company price) and picks the cheapest total, not just the cheapest company price.

### Why Direct takes a share

The driver's subscription or percentage only covers the pickup. Without a share, Direct earns nothing on the company part, but still handles the order, the support and the risk. The share can start at $0 to attract clients and be raised later.

### Company prices: one region table per company

Lebanon is split into **5 regions**: Beirut, Mount Lebanon, North, South, Bekaa. The admin fills one table per partner company. The price is **the same both directions**, so there are 15 prices per company.

```
COMPANY A          → Beirut  Mount Leb.  North  South  Bekaa
Beirut                $3      $3.5       $5     $4.5   $5
Mount Lebanon                 $3         $4.5   $5     $5
North                                    $3     $6     $6
South                                           $3     $5.5
Bekaa                                                  $3
```

**For each order, the system picks the cheapest company automatically** for that route. The admin never picks by hand.

| Route | Company A | Company B | System picks |
|---|---|---|---|
| Beirut → South | $4.5 | **$4** | B |
| Beirut → North | **$5** | $5.5 | A |

- **Switch a company off** and the system skips it.
- **Two companies at the same price:** the system uses the one the admin marked as preferred.

### Tracking ✅

Live tracking would show the driver arriving at the company and reveal the partner. So for Economy, the client sees the live map only until pickup, then status updates only: "Picked up by Direct", then "On its way · arrives in 2–3 days", then "Delivered". Moto and Car keep full live tracking. The driver sees the company's name and address.

### Admin settings for Economy

| Setting | Controls |
|---|---|
| Pickup (Direct picks up) | Follows the Moto settings |
| Drop-off fee | Default $0 |
| Company price tables | One per company, 5 regions |
| Direct's share (Direct picks up) | Its own field |
| Direct's share (client drops off) | Its own field |
| Company on / off · preferred | Per company |
| Direct's drop-off place | Address and opening hours |

---

## Step 4 · Taxi · Moto ✅

Carrying **a person** on a motorcycle. It's priced separately from packages.

### Decision: A, distance only

**Start price + price per km**, with its own numbers, rounded to the nearest $0.50. It's the same method as packages.
Example: the first 3 km cost $2.50, then +$0.30 per km.

| Ride | Price |
|---|---|
| 5 km | $3.00 |
| 10 km | $4.50 |
| 20 km | $7.50 |

### The three methods we compared

| Method | How | Verdict |
|---|---|---|
| **A. Distance** | Start + per km | ✅ Chosen. The price is known before the ride. |
| **B. Time** | Per minute of the ride | ❌ Only known after the ride, and traffic causes arguments. |
| **C. Mix** | Start + per km + per minute | ❌ For moto. Even with the map's estimated time fixed at booking, the map's time is for cars: in traffic it might say 45 min while a moto takes 20, so the client pays for time the moto never spent. |

**Why not let the client choose between A, B and C:** the client picks whichever is cheaper for that traffic, so the driver always gets the lower price. B and C also have no real price at booking, and it slows down booking. The client's real choice is the vehicle: Moto or Car.

### Noted for later

- **Taxi · Car:** use **C**: distance + time taken from the map, with the price **fixed at booking**. Traffic really slows a car, and the map's time is accurate for cars.
- **Waiting time (e.g. shopping):** a separate add-on, picked in blocks before the trip, so the price is known upfront. Example at $0.20/min: 15 min $3 · 30 min $6 · 60 min $12. Going over is charged at the same rate and confirmed by the driver in the app. It fits Car taxi better than Moto.

---

## Step 5 · Final check ✅

### Taxi · Moto range: 0–25 km ✅

Shorter than Moto packages (0–50 km): a person on a moto is less safe than a box, and long highway rides are tiring and risky. 25 km covers Greater Beirut and close suburbs (Jounieh, Aley, Damour are each around 20 km). It's an admin setting and can be raised later.

### Night surcharge ✅

Night = midnight to 6 am, Beirut time (today's rule).

| Option | At night |
|---|---|
| Moto packages | +$1 |
| Car packages | Not offered at night: greyed out with "Available until 10 pm" |
| Economy | No surcharge, and no Direct pickup at night: the company is closed, so the driver collects in the morning |
| Taxi · Moto | +$1 |

- **Car working hours are an admin setting** (e.g. until 10 pm).
- Each night surcharge is its own admin field, so Moto packages and Taxi Moto can change separately.

### Prices side by side ✅

With the example numbers:

| Trip | Moto | Car | Economy (drop-off) | Economy (Direct picks up) | Taxi Moto |
|---|---|---|---|---|---|
| 5 km | $2.50 | $5.50 | — | — | $3.00 |
| 10 km | $3.50 | $7.50 | — | — | $4.50 |
| 20 km | $5.50 | $11.00 | $4.50 | $7.00 | $7.50 |
| 50 km | $11.50 | $21.50 | $5.50 | $8.50 | — |
| 100 km | — | $39.00 | $6.00 | $9.00 | — |

- Car always costs more than Moto. Taxi Moto costs a little more than a Moto package. Further never costs less.
- At 20 km, Economy with pickup ($7.00) came out above Moto ($5.50). That came from the example numbers, not the logic.

### Rule: options are greyed out only because of distance ✅

Nothing is hidden or greyed out because of price. **Moto must always cost more than Economy** where they overlap (20–50 km). That's the admin's job when setting the real prices.

**Safety net: a warning in Admin → Settings.** If the numbers make Moto cheaper than Economy anywhere from 20 to 50 km, the page shows e.g. *"With these prices, Economy costs more than Moto on trips from 20 to 30 km. Raise the Moto rates or lower Economy."* It warns only: it never hides an option or blocks saving.

---

## Research proposal: starting values (not decided)

Researched on 2026-10-07. These are starting values to review, not decisions. Some sources are blogs or aggregators, and trips per day are estimates.

### Inputs

| Input | Value |
|---|---|
| Petrol 95 | 2,825,000 LBP / 20 L (6 Oct 2026), about **$1.58 / L** at 89,500 LBP/$ |
| Moto fuel use | ~4.5 L / 100 km in city, so about **$0.13 / km** with return trips and upkeep |
| Car fuel use | ~9 L / 100 km, so about **$0.35 / km** with empty return and upkeep |
| Same-day delivery in Beirut | Toters $3–6 · Wakilni $2–6 |
| Delivery across Lebanon in 1–3 days | Wakilni $6–15+ |
| Uber X in Beirut | $1.70 base + $0.38 / km + $0.10 / min |
| Moto delivery job | ~$150 / week, bike and fuel provided by the employer |

### Proposed price settings

| Option | Start price (first 3 km) | Per extra km | Night |
|---|---|---|---|
| Moto package | $3.00 | $0.25 | +$1 |
| Car package | $6.00 | $0.45 | not offered |
| Taxi · Moto | $3.00 | $0.30 | +$1 |
| Economy | company table + Direct's share $1 | pickup capped at $4 | none |

| Trip | Moto | Car | Taxi Moto |
|---|---|---|---|
| 5 km | $3.50 | $7.00 | $3.50 |
| 10 km | $5.00 | $9.00 | $5.00 |
| 20 km | $7.50 | $13.50 | $8.00 |
| 50 km | $15.00 | $27.00 | — |
| 100 km | — | $49.50 | — |

### Findings that need a decision

1. **Economy with Direct pickup can't stay below Moto at 20–30 km** with real prices: pickup (~$3.50) + company (~$4) + share ($1) = $8.50, against a 20 km Moto at $7.50. Proposal: **drop-off from 20 km, Direct pickup from 30 km**. It's a distance rule, so it fits "greyed out only because of distance".
2. **Cap the Economy pickup price** (e.g. $4). A client far from the company would otherwise pay a full Moto trip just to reach it.

### Proposed driver payments (Step 6)

Assumed: moto ~12 trips/day ($60 gross, ~$15 costs); car ~8 trips/day ($96 gross, ~$35 costs).

| | Moto | Car |
|---|---|---|
| Percentage | 12% (≈ $7 / day) | 12% (≈ $11.50 / day) |
| Daily subscription | $4 | $6 |
| Monthly subscription | $60 | $90 |

Today's system: $2 daily / $20 monthly for everyone.

> **Feedback:** the monthly subscription proposed here is too high. Revisit it in Step 6.

Sources: [LBC fuel prices](https://www.lbcgroup.tv/news/economy/896158/lebanon-updates-fuel-prices/en) · [Daily Beirut](https://dailybeirut.com/en/lebanon-news/rise-in-fuel-prices/) · [Wakilni](https://wakilni.com/delivery) · [Voxire, delivery apps 2026](https://voxire.com/blog/delivery-apps-lebanese-stores-2026/) · [Voxire, e-commerce logistics 2026](https://voxire.com/blog/ecommerce-shipping-delivery-lebanon-2026/) · [TaxiFareFinder, Uber X Beirut](https://www.taxifarefinder.com/main.php?city=Uber-X-Beirut-Lebanon) · [Motorcycle delivery job listing](https://jobsboard.ai/job-listings/motorcycle-delivery-driver--bf824290-aa72-4c97-a6d2-a966f853b157) · [125cc fuel use](https://www.spritmonitor.de/en/evaluation/economic_motorcycles.html)

---

## Next: Step 6 · Driver payments
