const { supabase } = require("../lib/supabase");
const { verify, parseCookies } = require("../lib/auth");
const { toClientEvent } = require("../lib/util");

async function currentUser(req) {
  const cookies = parseCookies(req);
  const id = verify(cookies["edg_session"]);
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  return data || null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ error: "Not logged in." });

    const { eventId } = req.body || {};
    const { data: ev, error: fetchErr } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    if (fetchErr || !ev) return res.status(404).json({ error: "Event not found." });

    const rsvps = ev.rsvps || [];
    const going = rsvps.includes(me.id);
    const nextRsvps = going ? rsvps.filter((id) => id !== me.id) : [...rsvps, me.id];

    const { data: updated, error } = await supabase.from("events").update({ rsvps: nextRsvps }).eq("id", eventId).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ event: toClientEvent(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};
