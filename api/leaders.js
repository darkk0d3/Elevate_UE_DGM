const { supabase } = require("../lib/supabase");

// Intentionally public / no-auth: the signup form needs this list before the
// visitor has an account yet. Only id + username are exposed, nothing sensitive.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, role")
      .in("role", ["Leader", "Leader and Member"])
      .order("username", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ leaders: data.map((d) => ({ id: d.id, username: d.username })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};
