# DropSmart 🚶💰

> Save money on Uber/Bolt rides by walking the last few minutes to your destination.

**Live at:** [gligor.xyz](https://gligor.xyz)

## What it does

DropSmart answers one question: **is getting dropped off a few minutes early actually worth it?**

Most of the time the honest answer is "no": Uber and Bolt fares are dominated by base and minimum charges, so a drop-off 500 m closer saves about a euro, and the walk costs more than that in time. DropSmart says so. It only recommends walking when it clearly wins:

1. Geocodes pickup and destination (Nominatim).
2. Lays candidate drop-offs on the pickup-facing side of the destination (a drop-off on the far side can only cost more).
3. Routes the ride on the **real road network** (OSRM) and snaps every candidate to a drivable road, so one-way streets, canals and car-free zones are counted and no drop-off is in a park.
4. Prices each option, scaled to the **real quote** you type in from the app (this captures surge).
5. Compares the whole journey with the direct ride:

```
savings  = directFare - fare
timeCost = ((drive + walk) - (directDrive + directWalk)) x valueOfTime
net      = savings - timeCost        # walk only if net >= EUR 1
```

`timeCost` can be negative: when the destination is behind a long detour, dropping off nearby and walking can be cheaper **and** faster. That is where the tool genuinely earns its keep.

## Fare model (read this)

Uber and Bolt have no public price API. Without a quote, a fare is modelled as
`max(minFare, base + perKm x km + perMin x minutes)` using the real driving distance and time (`src/lib/fare.ts`). **These rates are unverified defaults**, and the minimum fares are assumptions. Enter the price your app shows for the direct ride and every estimate is scaled to it; the results panel labels which one you are looking at. Each option also has a box to enter the real price for that drop-off, which gives the true net gain.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS (dark mode, mobile-first)
- **Maps**: Leaflet + react-leaflet (OpenStreetMap)
- **Geocoding**: Nominatim (free, throttled to 1 req/s)
- **Driving routes**: OSRM `table` (one request for all candidates)
- **Walking routes**: OpenRouteService matrix + directions (optional key)
- **Database**: Supabase (optional analytics)
- **Tests**: Vitest

## Setup

```bash
git clone https://github.com/Gliigor/dropsmart.git
cd dropsmart
npm install
cp .env.example .env.local   # all variables are optional, see the comments inside
npm run dev                  # http://localhost:3000
```

```bash
npm test          # unit + pipeline tests (routing services are stubbed, no network needed)
npm run typecheck
npm run build
```

Optional analytics table (Supabase):

```sql
create table searches (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  pickup text not null,
  destination text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  dest_lat double precision,
  dest_lng double precision,
  direct_price numeric(10,2),
  best_price numeric(10,2),
  savings numeric(10,2),   -- net benefit of the best option, 0 when the verdict was "just ride"
  walking_minutes integer,
  provider text,
  ip_hash text
);
```

Deploy with `vercel deploy` and set the same variables in the Vercel dashboard.

## Admin Dashboard

Visit `/admin?key=YOUR_ADMIN_SECRET_KEY` to see:
- Search volume (today / week / all time)
- Average savings generated
- Most searched destinations

## Rate Limiting

10 searches per IP per day, held in memory per server instance (so it resets on restart and is approximate on serverless).

## Architecture

```
lib/
  search.ts      # pipeline: geocode -> candidates -> routes -> fares -> verdict
  decision.ts    # net-benefit rule (the part that decides walk vs ride)
  fare.ts        # fare model + calibration to a real quote
  routing.ts     # OSRM driving, ORS walking, straight-line fallbacks
  candidates.ts  # candidate drop-offs on the pickup-facing side
  geocoding.ts   # Nominatim (throttled)
  geo.ts         # distance / bearing helpers
  rateLimit.ts   # per-IP daily limit (in-memory)
  supabase.ts    # optional analytics
tests/           # decision rule, fare model, candidates, full pipeline with stubbed services
```

If OSRM or ORS is down the app degrades to straight-line estimates and shows a warning instead of failing.

---

Built by [Gligorilla](https://gligor.xyz) · Financial tools for the modern commuter
