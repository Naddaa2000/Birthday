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
- `CREATOR_EMAIL` + SMTP settings — guest emails BCC you (address never shown in the UI)

**Never commit `.env`.** It contains secrets.

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Other** (or leave default).
3. Add the same keys from `.env` under **Project → Settings → Environment Variables**.
4. Redeploy after pushing these Vercel fixes (`vercel.json` + `api/index.js`).

This app needs the Node API (`/api/config`, time gate, email). Static-only hosting will break those features.
