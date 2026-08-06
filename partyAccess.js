"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Invite token gate.
 * Set PARTY_TOKEN in .env, share https://yoursite/?k=THAT_TOKEN
 * After a successful seal email, the token is marked consumed (one night).
 *
 * Storage: local file data/party-state.json
 * Optional (Vercel): UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */

function expectedToken() {
  return String(process.env.PARTY_TOKEN || "").trim();
}

function tokenRequired() {
  return Boolean(expectedToken());
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
  const expected = expectedToken();
  if (!expected) return true;
  if (!provided) return false;
  return timingSafeEqualStr(provided, expected);
}

function stateKey() {
  const t = expectedToken();
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

async function isConsumed(root) {
  if (!tokenRequired()) return false;
  const key = stateKey();

  const remote = await upstashGet(key);
  if (remote === "1" || remote === 1 || remote === "true") return true;

  const local = readFileState(root);
  return Boolean(local[key]?.consumed);
}

async function markConsumed(root) {
  if (!tokenRequired()) return;
  const key = stateKey();
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

  if (await isConsumed(root)) {
    return {
      ok: false,
      code: "consumed",
      status: 410,
      message: "This night is already sealed. The invite can only be used once.",
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

module.exports = {
  tokenRequired,
  expectedToken,
  extractToken,
  checkAccess,
  markConsumed,
  createAccessMiddleware,
};
