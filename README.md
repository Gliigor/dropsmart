# DropSmart 🚶💰

> Save money on Uber/Bolt rides by walking the last few minutes to your destination.

**Live at:** [gligor.xyz](https://gligor.xyz)

## What it does

DropSmart helps you find cheaper drop-off points near your destination. By getting dropped off a few minutes' walk away, you can save €2–10+ per ride. The app:

1. Takes your pickup and destination
2. Generates candidate drop-off points at 250m–1200m from your destination
3. Estimates fares for each alternative using Uber/Bolt Amsterdam pricing
4. Calculates a savings score accounting for walking time (value of your time)
5. Shows the best options on an interactive map

## Fare Estimation

Uber/Bolt do not have public APIs. Fares are estimated using known Amsterdam pricing:

| Provider | Base | Per km | Per min |
|----------|------|--------|---------|
| Uber | €2.50 | €1.20 | €0.20 |
| Bolt | €1.80 | €0.95 | €0.15 |

All prices are clearly labeled as **Estimated**.

## Scoring Algorithm

```
score = rideCost + (walkingMinutes × walkingCostPerMinute)
walkingCostPerMinute = €0.40 (configurable)
```

Lower score = better deal. Alternatives with savings < €2 are filtered out.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS (dark mode, mobile-first)
- **Maps**: Leaflet + react-leaflet (OpenStreetMap)
- **Geocoding**: Nominatim (free, no API key)
- **Walking routes**: OpenRouteService
- **Database**: Supabase (analytics + rate limiting)

## Setup

### 1. Clone & install

```bash
git clone https://github.com/Gliigor/gligor.git
cd gligor/dropsmart
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:
- `ORS_API_KEY`: Get free key at [openrouteservice.org](https://openrouteservice.org)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From your Supabase project
- `SUPABASE_SERVICE_KEY`: For server-side Supabase operations
- `ADMIN_SECRET_KEY`: Any secure password for `/admin` dashboard

### 3. Supabase setup

Run this SQL in your Supabase project:

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
  savings numeric(10,2),
  walking_minutes integer,
  provider text,
  ip_hash text
);

create index searches_created_at_idx on searches(created_at);
create index searches_destination_idx on searches(destination);
```

### 4. Run

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel dashboard.

## Admin Dashboard

Visit `/admin?key=YOUR_ADMIN_SECRET_KEY` to see:
- Search volume (today / week / all time)
- Average savings generated
- Most searched destinations

## Rate Limiting

Free tier: 10 searches per IP per day. Stored in memory (resets on server restart) and Supabase for analytics.

## Architecture

```
providers/
  types.ts      # FareProvider interface
  uber.ts       # UberAdapter (€2.50 + €1.20/km + €0.20/min)
  bolt.ts       # BoltAdapter (€1.80 + €0.95/km + €0.15/min)
  index.ts      # Factory + registry

lib/
  geocoding.ts  # Nominatim geocoding
  candidates.ts # Generate drop-off candidates (concentric rings)
  walking.ts    # ORS walking route calculation
  scoring.ts    # savings score algorithm
  rateLimit.ts  # IP-based rate limiting
  supabase.ts   # Database client
```

The `FareProvider` interface is designed for future real API integration:

```typescript
interface FareProvider {
  name: string;
  getFareEstimate(pickup: Coordinates, dropoff: Coordinates): Promise<FareEstimate>
}
```

---

Built by [Gligorilla](https://gligor.xyz) · Financial tools for the modern commuter
