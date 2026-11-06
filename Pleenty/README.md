# Pleenty Grocery Delivery

Next.js grocery-delivery MVP with a storefront, basket, checkout, and admin dashboard.

## Stack
- Next.js App Router + TypeScript
- Supabase PostgreSQL accessed through Prisma
- Client-side basket persistence
- Vercel deployment
- Admin dashboard at `/admin` (own folder: `app/admin`)

## Required environment variables

Copy `.env.example` to `.env.local` for local development, then configure the same variables in **Vercel → Project Settings → Environment Variables** for Production, Preview, and Development as needed.

- `DATABASE_URL`: Supabase PostgreSQL connection URI (include the database password; use the connection details shown in Supabase Project Settings → Database).
- `ADMIN_ACCESS_KEY`: a long, random secret used by the MVP admin gate.
- `GOOGLE_MAPS_API_KEY`: a server-only Google Maps Platform key with the Geocoding API and Routes API enabled. Checkout geocodes the submitted address and uses driving-route distance to check coverage and calculate delivery.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: reserved for the Supabase client integration.

Do not commit real environment values or expose database passwords/service-role keys in browser code. The current Vercel project has no environment variables configured, so database-backed catalogue, admin, and checkout features will not work until these are added.

Restrict the Google Maps key to the Geocoding API and Routes API, keep it server-side (never use a `NEXT_PUBLIC_` variable), and configure the key and billing in Google Cloud before accepting orders. In `/admin` → **Delivery areas**, manage enabled cities and provinces, their reference coordinates, and their maximum driving distance. The initial Mthatha / Eastern Cape reference point is an approximate CBD coordinate, not the shop address. Delivery is R45 for the first 8 road kilometres and R5 per additional kilometre (rounded up); orders of R500 or more receive free delivery. Addresses outside enabled coverage are rejected before an order is created.

## Database

The Prisma models map to the existing Supabase tables and column names (`categories`, `products`, `orders`, and `order_items`). Generate the client with:

```bash
npm install
npx prisma generate
npm run dev
```

The seed script inserts or updates the demo categories and products. Run it only after `DATABASE_URL` points to the intended database:

```bash
npx prisma db seed
```

**Do not run `prisma db push` against the existing Supabase project.** The project already has tables and security policies; schema changes should be reviewed and applied through a deliberate migration.

## Admin

Open `/admin`. The owner signs in with the value configured as `ADMIN_ACCESS_KEY` and has full access. The owner can add **order managers** under **Team** by entering the email of a People's Market account (the person must create and confirm that account first). Order managers sign in on `/admin` using the **Order manager** option with their account email and password, and can only view orders and mark products sold out or back in stock; every action is enforced on the server (`app/admin/_lib/permissions.ts`). The dashboard updates live (about every 4 seconds) and the storefront reflects stock changes within about 5 seconds. Staff are stored in the existing `app_settings` table (key `admin_staff`), so no migration is needed. The access key remains a shared secret: keep it long and private.

## Staff push notifications

FreshCart can send browser push notifications to the owner and approved order managers when a Yoco payment is verified. Staff opt in from the admin dashboard using **Enable notifications**; the browser permission prompt is never shown automatically. Notifications are sent only for paid orders, not abandoned or unpaid checkouts.

### Setup

1. Create a Firebase project and register a Web App.
2. In Firebase Project Settings → Cloud Messaging, generate a Web Push certificate (VAPID key) and enable the Cloud Messaging API.
3. Create a Firebase service account for the server-side Admin SDK. Keep its private key secret.
4. Set the Firebase variables from `.env.example` in Vercel. The `NEXT_PUBLIC_FIREBASE_*` values are browser configuration; `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` must remain server-only.
5. Set the Vercel Node.js runtime to Node 22 or later (also enforced by `package.json`).
6. Before deploying this branch, apply `prisma/migrations/20261106133800_fcm_order_notifications/migration.sql` to the Supabase database using the SQL Editor. The migration creates two RLS-protected tables; no existing order, product, customer, or staff rows are changed.
7. Deploy the branch, sign in to `/admin` as the owner and each order manager, then select **Enable notifications** on every browser/device that should receive alerts.

The server stores device tokens and notification delivery events in the new tables. Repeated payment verification is idempotent: a paid order event is only sent once successfully. If Firebase is not configured or a device has not opted in, checkout and payment verification continue to work; notification delivery failures are recorded without failing the customer's order.

Web push requires HTTPS and browser support. iPhone/iPad notifications require the site to be installed as a web app on supported iOS/iPadOS versions before permission can be granted.

## Known MVP limits

- Storefront display data is currently a curated static list; the checkout validates product slugs and prices against the database.
- Live courier tracking, notifications, and customer-facing delivery maps are not implemented.
- Do not accept real payments or rely on the demo tracking timeline until those integrations are completed and tested.
