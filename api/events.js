const { supabase } = require("../lib/supabase");
const { verify, parseCookies } = require("../lib/auth");
const { isLeader, toClientProfile, toClientEvent } = require("../lib/util");

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
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ events: data.map(toClientEvent) });
    }

    if (req.method === "POST") {
      if (!isLeader(me)) return res.status(403).json({ error: "Only leaders can create events." });
      const { title, date, time, location, description } = req.body || {};
      if (!title || !date) return res.status(400).json({ error: "Name and date are required." });

      const { data: inserted, error } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          date,
          time: time || "",
          location: (location || "").trim(),
          description: (description || "").trim(),
          created_by: me.username,
          rsvps: [],
        })
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ event: toClientEvent(inserted) });
    }

    if (req.method === "DELETE") {
      if (!isLeader(me)) return res.status(403).json({ error: "Only leaders can delete events." });
      const id = (req.query && req.query.id) || "";
      const { error } = await supabase.from("events").delete().eq("id", id);
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
