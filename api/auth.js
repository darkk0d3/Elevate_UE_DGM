const bcrypt = require("bcryptjs");
const { supabase } = require("../lib/supabase");
const { sign, verify, parseCookies } = require("../lib/auth");
const { toClientProfile } = require("../lib/util");

const COOKIE_NAME = "edg_session";

function setCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
}
function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const cookies = parseCookies(req);
      const id = verify(cookies[COOKIE_NAME]);
      if (!id) return res.status(200).json({ user: null });
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      return res.status(200).json({ user: toClientProfile(data) });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { action } = req.body || {};

    if (action === "signup") {
      const { username, password, role, group, leaderId, leaderName, freeDays, freeTimes } = req.body;
      const name = (username || "").trim();
      if (!name) return res.status(400).json({ error: "Username is required." });
      if (!password || password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });

      const { data: existing } = await supabase.from("profiles").select("id").ilike("username", name).maybeSingle();
      if (existing) return res.status(409).json({ error: "That username is already taken." });

      const passwordHash = await bcrypt.hash(password, 10);
      const { data: inserted, error } = await supabase
        .from("profiles")
        .insert({
          username: name,
          password_hash: passwordHash,
          role: role || "Member",
          group_name: (group || "").trim(),
          leader_id: leaderId || null,
          leader_name: (leaderName || "").trim(),
          free_days: Array.isArray(freeDays) ? freeDays : [],
          free_times: Array.isArray(freeTimes) ? freeTimes : [],
        })
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });

      setCookie(res, sign(inserted.id));
      return res.status(200).json({ user: toClientProfile(inserted) });
    }

    if (action === "login") {
      const { username, password } = req.body;
      const { data: row } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", (username || "").trim())
        .maybeSingle();

      if (!row) return res.status(401).json({ error: "Account not found." });
      const ok = row.password_hash ? await bcrypt.compare(password || "", row.password_hash) : false;
      if (!ok) return res.status(401).json({ error: "Incorrect password." });

      setCookie(res, sign(row.id));
      return res.status(200).json({ user: toClientProfile(row) });
    }

    if (action === "logout") {
      clearCookie(res);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};
