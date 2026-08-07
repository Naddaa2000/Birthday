"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Multi-invite token gate.
 *
 * PARTY_TOKEN=one-secret
 *   — or —
 * PARTY_TOKENS=alice-secret,bob-secret,cara-secret
 *
 * Each guest gets their own link: https://yoursite/?k=THEIR_SECRET
 * After THAT guest seals, only their token locks. Others still work.
 *
 * PARTY_ONE_SHOT=false — valid tokens never lock (shared reusable link)
 *
 * Storage: data/party-state.json + optional Upstash Redis
 */

function parseTokenList() {
  const set = new Set();
  const single = String(process.env.PARTY_TOKEN || "").trim();
  if (single) set.add(single);

  const multi = String(process.env.PARTY_TOKENS || "");
  for (const part of multi.split(/[,|\n]/)) {
    const t = part.trim();
    if (t) set.add(t);
  }
  return [...set];
}

function tokenRequired() {
  return parseTokenList().length > 0;
}

function oneShotEnabled() {
  const raw = String(process.env.PARTY_ONE_SHOT ?? "true")
    .trim()
    .toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
}

function extractToken(req) {
  const q = req.query || {};
  const fromQuery = String(q.k || q.token || "").trim();
  if (fromQuery) return fromQuery;

  const header = String(
    req.get?.("x-party-token") || req.headers?.["x-party-token"] || "",
  ).trim();
  if (header) return header;

  const body = req.body || {};
  return String(body.token || body.k || "").trim();
}

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function tokenMatches(provided) {
  const list = parseTokenList();
  if (!list.length) return true;
  if (!provided) return false;
  return list.some((expected) => timingSafeEqualStr(provided, expected));
}

function stateKeyForToken(token) {
  const t = String(token || "").trim();
  if (!t) return "party:default";
  return `party:${crypto.createHash("sha256").update(t).digest("hex").slice(0, 24)}`;
}

function statePath(root) {
  return path.join(root, "data", "party-state.json");
}

function tmpStatePath() {
  return path.join(require("os").tmpdir(), "origin-night-party-state.json");
}

function readFileState(root) {
  for (const file of [statePath(root), tmpStatePath()]) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw);
    } catch {
      /* try next */
    }
  }
  return {};
}

function writeFileState(root, data) {
  const payload = JSON.stringify(data, null, 2);
  let wrote = false;
  try {
    const dir = path.join(root, "data");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath(root), payload, "utf8");
    wrote = true;
  } catch {
    /* Vercel / read-only */
  }
  try {
    fs.writeFileSync(tmpStatePath(), payload, "utf8");
    wrote = true;
  } catch {
    /* ignore */
  }
  if (!wrote) {
    console.warn(
      "[partyAccess] could not persist lock — set UPSTASH_REDIS_REST_URL on Vercel",
    );
  }
}

async function upstashGet(key) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const r = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.result;
}

async function upstashSet(key, value) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return false;
  const r = await fetch(
    `${base}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return r.ok;
}

async function isConsumed(root, providedToken) {
  if (!tokenRequired() || !oneShotEnabled()) return false;
  const key = stateKeyForToken(providedToken);

  const remote = await upstashGet(key);
  if (remote === "1" || remote === 1 || remote === "true") return true;

  const local = readFileState(root);
  return Boolean(local[key]?.consumed);
}

async function markConsumed(root, providedToken) {
  if (!tokenRequired() || !oneShotEnabled()) return;
  const token = String(providedToken || "").trim();
  if (!token) return;

  const key = stateKeyForToken(token);
  const stamp = {
    consumed: true,
    at: new Date().toISOString(),
  };

  await upstashSet(key, "1");

  try {
    const local = readFileState(root);
    local[key] = stamp;
    writeFileState(root, local);
  } catch (err) {
    console.warn("[partyAccess] could not write local state:", err.message);
  }
}

/**
 * @returns {Promise<{ ok: boolean, code: string, status: number, message: string }>}
 */
async function checkAccess(req, root) {
  if (!tokenRequired()) {
    return {
      ok: true,
      code: "open",
      status: 200,
      message: "Token not configured — open access.",
    };
  }

  const provided = extractToken(req);
  if (!provided) {
    return {
      ok: false,
      code: "missing",
      status: 401,
      message: "Invite link required. Open the private URL you were sent.",
    };
  }

  if (!tokenMatches(provided)) {
    return {
      ok: false,
      code: "invalid",
      status: 403,
      message: "This invite link is not valid.",
    };
  }

  if (await isConsumed(root, provided)) {
    return {
      ok: false,
      code: "consumed",
      status: 410,
      message:
        "This invite was already used. Each guest needs their own private link.",
    };
  }

  return {
    ok: true,
    code: "ok",
    status: 200,
    message: "Access granted.",
  };
}

function createAccessMiddleware(root) {
  return async function requirePartyAccess(req, res, next) {
    const result = await checkAccess(req, root);
    if (result.ok) return next();
    return res.status(result.status).json({
      ok: false,
      code: result.code,
      error: result.message,
    });
  };
}

function listInviteHints(baseUrl) {
  const list = parseTokenList();
  return list.map((t) => `${baseUrl}/?k=${encodeURIComponent(t)}`);
}

module.exports = {
  tokenRequired,
  parseTokenList,
  extractToken,
  checkAccess,
  markConsumed,
  createAccessMiddleware,
  listInviteHints,
  oneShotEnabled,
};
