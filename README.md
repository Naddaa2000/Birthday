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
- `PARTY_TOKEN` — secret invite key. Share only `https://yoursite/?k=YOUR_TOKEN`. After the guest seals (sends email), that token is locked for good. Leave empty for open testing.
- On Vercel, also set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (free [Upstash](https://upstash.com) Redis) so the lock survives serverless restarts.
- `CREATOR_EMAIL` + SMTP settings — guest emails BCC you (address never shown in the UI)

**Never commit `.env`.** It contains secrets.

## One-time invite

1. Set a long random value: `PARTY_TOKEN=my-long-secret-abc123`
2. Restart / redeploy
3. Send the guest **only** this link: `https://YOUR-DOMAIN/?k=my-long-secret-abc123`
4. They play once and seal → later visits with the same link show “Already sealed.”

To reset for a rehearsal, delete `data/party-state.json` (local) or clear the Upstash key / change `PARTY_TOKEN`.

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Other** (or leave default).
3. Add the same keys from `.env` under **Project → Settings → Environment Variables**.
4. Redeploy after pushing these Vercel fixes (`vercel.json` + `api/index.js`).

This app needs the Node API (`/api/config`, time gate, email). Static-only hosting will break those features.
