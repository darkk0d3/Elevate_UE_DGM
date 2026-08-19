function isLeader(p) {
  return !!p && (p.role === "Leader" || p.role === "Leader and Member");
}
function isMember(p) {
  return !!p && (p.role === "Member" || p.role === "Leader and Member");
}

// Supabase rows use snake_case columns and never include the password hash
// in what we send back to the browser.
function toClientProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    group: row.group_name || "",
    leaderId: row.leader_id || null,
    leaderName: row.leader_name || "",
    freeDays: row.free_days || [],
    freeTimes: row.free_times || [],
    joinedAt: row.joined_at,
  };
}

function toClientEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time || "",
    location: row.location || "",
    description: row.description || "",
    createdBy: row.created_by || "",
    rsvps: row.rsvps || [],
  };
}

module.exports = { isLeader, isMember, toClientProfile, toClientEvent };
