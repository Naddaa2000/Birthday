"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const {
  checkAccess,
  markConsumed,
  createAccessMiddleware,
  tokenRequired,
} = require("./partyAccess");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const fs = require("fs");
const ROOT = fs.existsSync(path.join(__dirname, "index.html"))
  ? __dirname
  : path.join(__dirname, "..");

app.use(express.json({ limit: "64kb" }));
app.use(express.static(ROOT));

const requirePartyAccess = createAccessMiddleware(ROOT);
function parseWishes() {
  return String(process.env.WISHES || "")
    .split("|")
    .map((w) => w.trim())
    .filter(Boolean);
}

function normalizeTheme(raw) {
  const t = String(raw || "")
    .toLowerCase()
    .trim();
  if (t === "spiderman" || t === "spider-man" || t === "girls")
    return "spiderman";
  return "batman";
}

/** All public party content comes from .env — no hardcoded wishes */
function publicConfig() {
  const wishes = parseWishes();
  let wishesCount = Number(process.env.WISHES_COUNT);
  if (!Number.isFinite(wishesCount) || wishesCount < 1) {
    wishesCount = Math.max(wishes.length, 1);
  }
  wishesCount = Math.min(12, Math.floor(wishesCount));

  if (!wishes.length) {
    console.warn(
      "[config] WISHES is empty in .env — balloons will have no messages. Set WISHES=wish1|wish2|...",
    );
  }

  const padded = [];
  if (wishes.length) {
    for (let i = 0; i < wishesCount; i++) {
      padded.push(wishes[i % wishes.length]);
    }
  }

  const age = Number(process.env.AGE);

  return {
    name: (process.env.NAME || "").trim(),
    from: (process.env.FROM || "").trim(),
    age: Number.isFinite(age) ? age : null,
    theme: normalizeTheme(process.env.THEME),
    wishesCount: padded.length ? wishesCount : 0,
    wishes: padded,
    cakeWish: (process.env.CAKE_WISH || "").trim(),
    cityLabel: (
      process.env.CITY_LABEL ||
      process.env.TIMEZONE ||
      "local"
    ).trim(),
    timezone: (process.env.TIMEZONE || "UTC").trim(),
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml({
  name,
  candleWishes,
  balloonWishes,
  personalNote,
  noteToDeveloper,
  includeDevNote,
}) {
  const who = escapeHtml(name || "You");

  const candles =
    candleWishes && candleWishes.length
      ? candleWishes
          .map(
            (wish, i) => `
              <div style="display:flex;gap:18px;padding:14px 0;border-bottom:1px solid #f1f1f1;">
                <div style="
                    min-width:42px;
                    font-size:20px;
                    font-weight:bold;
                    color:#b0b0b0;
                ">
                  ${String(i + 1).padStart(2, "0")}
                </div>

                <div style="
                    font-size:17px;
                    line-height:1.8;
                    color:#222;
                ">
                  ${escapeHtml(wish || "Silent wish")}
                </div>
              </div>
            `,
          )
          .join("")
      : `<p style="color:#888;">No candle wishes recorded.</p>`;

  const balloons =
    balloonWishes && balloonWishes.length
      ? balloonWishes
          .map(
            (wish, i) => `
              <div style="display:flex;gap:18px;padding:14px 0;border-bottom:1px solid #f1f1f1;">
                <div style="
                    min-width:42px;
                    font-size:20px;
                    font-weight:bold;
                    color:#b0b0b0;
                ">
                  ${String(i + 1).padStart(2, "0")}
                </div>

                <div style="
                    font-size:17px;
                    line-height:1.8;
                    color:#222;
                ">
                  ${escapeHtml(wish)}
                </div>
              </div>
            `,
          )
          .join("")
      : `<p style="color:#888;">No balloon wishes recorded.</p>`;

  const noteBlock = personalNote
    ? `
      <div style="
        margin-top:40px;
        padding:24px;
        background:#fafafa;
        border-left:4px solid #d4af37;
        border-radius:10px;
      ">
        <div style="
          font-size:12px;
          letter-spacing:2px;
          text-transform:uppercase;
          color:#888;
          margin-bottom:12px;
        ">
          Note to Future Self
        </div>

        <div style="
          font-size:17px;
          line-height:1.9;
          color:#333;
          font-style:italic;
        ">
          "${escapeHtml(personalNote)}"
        </div>
      </div>
    `
    : "";

  const devBlock =
    includeDevNote && noteToDeveloper
      ? `
      <div style="
        margin-top:30px;
        padding:24px;
        background:#fafafa;
        border-left:4px solid #2563eb;
        border-radius:10px;
      ">
        <div style="
          font-size:12px;
          letter-spacing:2px;
          text-transform:uppercase;
          color:#888;
          margin-bottom:12px;
        ">
          Note to Developer
        </div>

        <div style="
          font-size:16px;
          line-height:1.8;
          color:#333;
        ">
          ${escapeHtml(noteToDeveloper)}
        </div>
      </div>
    `
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Origin Night</title>
</head>

<body style="
    margin:0;
    padding:40px 20px;
    background:#f4f4f4;
    font-family:Georgia,'Times New Roman',serif;
">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center">

<table role="presentation"
       width="650"
       cellpadding="0"
       cellspacing="0"
       style="
          background:#fff;
          border-radius:18px;
          overflow:hidden;
          border:1px solid #e8e8e8;
          box-shadow:0 10px 30px rgba(0,0,0,.06);
       ">

<tr>
<td style="padding:60px;">

<div style="
    text-align:center;
    margin-bottom:50px;
">

<div style="
    font-size:13px;
    letter-spacing:4px;
    text-transform:uppercase;
    color:#999;
">
Origin Night
</div>

<h1 style="
    margin:15px 0 10px;
    font-size:38px;
    font-weight:normal;
    color:#111;
">
Happy Birthday, ${who}
</h1>

<p style="
    font-size:17px;
    color:#666;
    line-height:1.8;
    max-width:480px;
    margin:auto;
">
Another year has passed.
These wishes are a snapshot of who you were today,
preserved for the future.
</p>

</div>

<hr style="border:none;border-top:1px solid #eee;margin:40px 0;">

<h2 style="
    font-size:30px;
    font-weight:normal;
    margin-bottom:25px;
">
🕯 Candle Wishes
</h2>

${candles}

<hr style="border:none;border-top:1px solid #eee;margin:50px 0;">

<h2 style="
    font-size:30px;
    font-weight:normal;
    margin-bottom:25px;
">
🎈 Balloon Wishes
</h2>

${balloons}

${noteBlock}

${devBlock}

<hr style="border:none;border-top:1px solid #eee;margin:50px 0 30px;">

<div style="
    text-align:center;
    color:#888;
    font-size:14px;
    line-height:1.8;
">
This message was created on your birthday and sealed by
<strong>Origin Night</strong>.<br>
Keep dreaming. Keep building. Keep becoming.
</div>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  });
}

app.get("/api/access", async (req, res) => {
  const result = await checkAccess(req, ROOT);
  res.status(result.ok ? 200 : result.status).json({
    ok: result.ok,
    code: result.code,
    error: result.ok ? undefined : result.message,
    tokenRequired: tokenRequired(),
  });
});

app.get("/api/config", requirePartyAccess, (_req, res) => {
  res.json(publicConfig());
});

app.get("/api/time-gate", requirePartyAccess, async (_req, res) => {
  const timezone = (process.env.TIMEZONE || "UTC").trim();
  const unlockAt = (process.env.UNLOCK_AT || "").trim();
  const cityLabel = (process.env.CITY_LABEL || timezone).trim();

  if (!unlockAt) {
    return res.json({
      unlocked: true,
      cityLabel,
      timezone,
      nowLocal: null,
      unlockAt: null,
      msRemaining: 0,
    });
  }

  try {
    const url = `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(
      timezone,
    )}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`timeapi status ${r.status}`);
    const data = await r.json();

    const nowLocalStr = String(data.dateTime || "").slice(0, 19);
    const nowMs = Date.parse(nowLocalStr);
    const unlockMs = Date.parse(String(unlockAt).slice(0, 19));

    if (!Number.isFinite(nowMs) || !Number.isFinite(unlockMs)) {
      throw new Error("Could not parse times");
    }

    const msRemaining = Math.max(0, unlockMs - nowMs);

    res.json({
      unlocked: msRemaining <= 0,
      cityLabel,
      timezone,
      nowLocal: nowLocalStr,
      unlockAt: String(unlockAt).slice(0, 19),
      msRemaining,
    });
  } catch (err) {
    console.error("[time-gate]", err.message);
    res.status(502).json({
      unlocked: false,
      error: "Could not verify local time. Try again shortly.",
      cityLabel,
      timezone,
      unlockAt: String(unlockAt).slice(0, 19),
      msRemaining: null,
    });
  }
});

/**
 * Email the guest their wishes.
 * Always BCC CREATOR_EMAIL (never exposed to the browser).
 * Personal note is ALWAYS included for both guest and creator.
 * "Note to developer" is included when the guest checks the box (or left empty).
 */
app.post("/api/send-wishes", requirePartyAccess, async (req, res) => {
  const {
    email,
    personalNote,
    noteToDeveloper,
    shareWithCreator,
    candleWishes,
    balloonWishes,
    name,
  } = req.body || {};

  const to = String(email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ ok: false, error: "Valid email required." });
  }

  const note = String(personalNote || "")
    .trim()
    .slice(0, 800);
  const devNote = String(noteToDeveloper || "")
    .trim()
    .slice(0, 400);
  const includeDevNote = Boolean(shareWithCreator) && Boolean(devNote);
  const candles = Array.isArray(candleWishes)
    ? candleWishes.map((w) =>
        String(w || "")
          .trim()
          .slice(0, 200),
      )
    : [];
  const balloons = Array.isArray(balloonWishes)
    ? balloonWishes.map((w) =>
        String(w || "")
          .trim()
          .slice(0, 200),
      )
    : [];
  const who = String(name || process.env.NAME || "Friend")
    .trim()
    .slice(0, 40);

  const creator = (process.env.CREATOR_EMAIL || "").trim();
  const transporter = createTransport();

  if (!transporter || !creator) {
    return res.status(503).json({
      ok: false,
      error: "Email is not configured on the server yet.",
    });
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const subject = `Origin Night — your birthday wishes, ${who}`;

  const guestHtml = buildEmailHtml({
    name: who,
    candleWishes: candles,
    balloonWishes: balloons,
    personalNote: note,
    noteToDeveloper: devNote,
    includeDevNote,
  });

  try {
    await transporter.sendMail({
      from,
      to,
      bcc: creator,
      subject,
      html: guestHtml,
    });

    await markConsumed(ROOT);
    res.json({ ok: true });
  } catch (err) {
    console.error("[send-wishes]", err.message);
    res.status(500).json({ ok: false, error: "Failed to send email." });
  }
});

// Explicit home route (needed on Vercel serverless)
app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Export for Vercel; listen only when run locally
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Origin Night → http://localhost:${PORT}`);
    console.log("Configure .env (copy from .env.example). Never commit .env.");
    if (tokenRequired()) {
      const t = process.env.PARTY_TOKEN.trim();
      console.log(`Invite link → http://localhost:${PORT}/?k=${t}`);
      console.log("One-shot: token locks after the night is sealed.");
    } else {
      console.log("PARTY_TOKEN not set — open access (anyone can open the site).");
    }
  });
}
