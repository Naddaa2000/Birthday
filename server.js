"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const fs = require("fs");
const ROOT = fs.existsSync(path.join(__dirname, "index.html"))
  ? __dirname
  : path.join(__dirname, "..");

app.use(express.json({ limit: "64kb" }));
app.use(express.static(ROOT));function parseWishes() {
  return String(process.env.WISHES || "")
    .split("|")
    .map((w) => w.trim())
    .filter(Boolean);
}

function normalizeTheme(raw) {
  const t = String(raw || "").toLowerCase().trim();
  if (t === "spiderman" || t === "spider-man" || t === "girls") return "spiderman";
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
      "[config] WISHES is empty in .env — balloons will have no messages. Set WISHES=wish1|wish2|..."
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
    cityLabel: (process.env.CITY_LABEL || process.env.TIMEZONE || "local").trim(),
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
  const candles = candleWishes
    .map(
      (w, i) =>
        `<li><strong>Candle ${i + 1}:</strong> ${escapeHtml(w || "(silent wish)")}</li>`
    )
    .join("");
  const balloons = balloonWishes
    .map((w, i) => `<li><strong>Balloon ${i + 1}:</strong> ${escapeHtml(w)}</li>`)
    .join("");

  // Personal note is always included when present
  let noteBlock = "";
  if (personalNote) {
    noteBlock = `
      <h3>Note to future self</h3>
      <blockquote style="border-left:3px solid #f5c518;padding-left:12px;color:#333;">
        ${escapeHtml(personalNote)}
      </blockquote>`;
  }

  let devBlock = "";
  if (includeDevNote && noteToDeveloper) {
    devBlock = `
      <h3>Note to developer</h3>
      <blockquote style="border-left:3px solid #2b6cff;padding-left:12px;color:#333;">
        ${escapeHtml(noteToDeveloper)}
      </blockquote>`;
  }

  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#111;">
      <h1 style="font-size:22px;">Origin Night — ${who}</h1>
      <p>A sealed record of this birthday.</p>
      <h3>Candle wishes</h3>
      <ol>${candles || "<li>(none)</li>"}</ol>
      <h3>Balloon wishes</h3>
      <ol>${balloons || "<li>(none)</li>"}</ol>
      ${noteBlock}
      ${devBlock}
      <p style="margin-top:28px;color:#666;font-size:13px;">Saved from Origin Night.</p>
    </div>`;
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

app.get("/api/config", (_req, res) => {
  res.json(publicConfig());
});

app.get("/api/time-gate", async (_req, res) => {
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
      timezone
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
app.post("/api/send-wishes", async (req, res) => {
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

  const note = String(personalNote || "").trim().slice(0, 800);
  const devNote = String(noteToDeveloper || "").trim().slice(0, 400);
  const includeDevNote = Boolean(shareWithCreator) && Boolean(devNote);
  const candles = Array.isArray(candleWishes)
    ? candleWishes.map((w) => String(w || "").trim().slice(0, 200))
    : [];
  const balloons = Array.isArray(balloonWishes)
    ? balloonWishes.map((w) => String(w || "").trim().slice(0, 200))
    : [];
  const who = String(name || process.env.NAME || "Friend").trim().slice(0, 40);

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
  });
}
