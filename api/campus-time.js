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
    if (req.method !== "PUT") {
      res.setHeader("Allow", "PUT");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const meRow = await currentUser(req);
    if (!meRow) return res.status(401).json({ error: "Not logged in." });
    const me = toClientProfile(meRow);

    const { profileId, freeDays, freeTimes } = req.body || {};
    if (!(isLeader(me) || me.id === profileId)) {
      return res.status(403).json({ error: "You can only edit your own Campus Time." });
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        free_days: Array.isArray(freeDays) ? freeDays : [],
        free_times: Array.isArray(freeTimes) ? freeTimes : [],
      })
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: toClientProfile(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};
