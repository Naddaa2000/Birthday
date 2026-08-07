# Birthday — Origin Night

A full-viewport birthday experience with themed cake, wish candles, burst balloons, a time-lock gate, and email sealing.

## Setup (local)

1. Copy `.env.example` to `.env` and fill in party details, unlock time, and SMTP.
2. Install and run:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Configure via `.env` / Vercel env

- `NAME`, `AGE`, `FROM`, `THEME` (`batman` | `spiderman`)
- `WISHES` (pipe-separated balloon messages), `WISHES_COUNT`, `CAKE_WISH`
- `TIMEZONE`, `CITY_LABEL`, `UNLOCK_AT` — site stays locked until that local time
- `PARTY_TOKEN` / `PARTY_TOKENS` — invite secrets. Give **each guest their own** `?k=` link. After they seal, only that guest’s token locks.
- `PARTY_ONE_SHOT=false` — same link reusable by everyone (no lock after seal).
- On Vercel, set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` ([Upstash](https://upstash.com)) so locks persist.
- `CREATOR_EMAIL` + SMTP settings — guest emails BCC you (address never shown in the UI)

**Never commit `.env`.** It contains secrets.

## Invites for multiple guests

1. In Vercel env (or `.env`):

```env
PARTY_TOKENS=alex-a1b2,sam-c3d4,jordan-e5f6
PARTY_ONE_SHOT=true
```

2. Redeploy, then send **different** links:

- `https://yoursite/?k=alex-a1b2`
- `https://yoursite/?k=sam-c3d4`
- `https://yoursite/?k=jordan-e5f6`

3. When Alex seals, only Alex’s link locks. Sam and Jordan still work.

**Why one PC locked the other:** you shared one token. Sealing it once locked that invite for everyone.

To reopen a used invite: delete its `party:…` key in Upstash, or issue a new token.

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Other** (or leave default).
3. Add the same keys from `.env` under **Project → Settings → Environment Variables**.
4. Redeploy after pushing these Vercel fixes (`vercel.json` + `api/index.js`).

This app needs the Node API (`/api/config`, time gate, email). Static-only hosting will break those features.
