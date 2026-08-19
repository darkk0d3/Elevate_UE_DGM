const { createClient } = require("@supabase/supabase-js");

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set as Environment Variables
// in the Vercel project settings — never hardcoded here. The service_role key
// bypasses Row Level Security, which is why it must only ever be used from
// server-side code (these /api functions), never sent to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
