const crypto = require("crypto");

// Set SESSION_SECRET as an Environment Variable in Vercel for real deployments.
// The fallback below only exists so the app doesn't crash if you forget —
// replace it by setting the env var before you consider this "live".
const SECRET = process.env.SESSION_SECRET || "elevate-ue-dgm-please-set-a-real-secret";

function sign(profileId) {
  const payload = Buffer.from(JSON.stringify({ id: profileId, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.id || null;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

module.exports = { sign, verify, parseCookies };
