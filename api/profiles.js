const bcrypt = require("bcryptjs");
const { supabase } = require("../lib/supabase");
const { verify, parseCookies } = require("../lib/auth");
const { isLeader, toClientProfile } = require("../lib/util");

async function currentUser(req) {
  const cookies = parseCookies(req);
  const id = verify(cookies["edg_session"]);
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return data || null;
}

module.exports = async (req, res) => {
  try {
    const meRow = await currentUser(req);
    if (!meRow) return res.status(401).json({ error: "Not logged in." });
    const me = toClientProfile(meRow);

    if (req.method === "GET") {
      const { data, error } = await supabase.from("profiles").select("*").order("joined_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ profiles: data.map(toClientProfile) });
    }

    if (req.method === "POST") {
      if (!isLeader(me)) return res.status(403).json({ error: "Only leaders can add members." });
      const { name, password, role, group, leaderId, leaderName, freeDays, freeTimes } = req.body || {};
      const n = (name || "").trim();
      if (!n) return res.status(400).json({ error: "Name is required." });
      if (!password || password.length < 4) return res.status(400).json({ error: "Temporary password must be at least 4 characters." });

      const { data: existing } = await supabase.from("profiles").select("id").ilike("username", n).maybeSingle();
      if (existing) return res.status(409).json({ error: "That name is already taken." });

      const passwordHash = await bcrypt.hash(password, 10);
      const { data: inserted, error } = await supabase
        .from("profiles")
        .insert({
          username: n,
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
      return res.status(200).json({ profile: toClientProfile(inserted) });
    }

    if (req.method === "DELETE") {
      if (!isLeader(me)) return res.status(403).json({ error: "Only leaders can remove members." });
      const id = (req.query && req.query.id) || "";
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};
