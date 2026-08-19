/* ============================== STATE ============================== */
const state = {
  loading: true,
  profiles: [],
  events: [],
  availableLeaders: [], // {id, username} — used for the DGroup Leader picker
  currentUser: null,
  tab: "dashboard",
  calMonth: (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })(),
  selectedDay: null,
  modal: null,        // 'newMember' | 'newEvent' | { type: 'eventDetail', id } | { type: 'editCampusTime', id }
  loginMode: "welcome",  // 'welcome' | 'login' | 'create'
  formError: ""
};

const ROLE_OPTIONS = ["Leader", "Member", "Leader and Member"];
const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ============================== API HELPERS ============================== */
async function apiGet(path) {
  const res = await fetch(`/api/${path}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
async function apiPost(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
async function apiPut(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
async function apiDelete(path) {
  const res = await fetch(`/api/${path}`, { method: "DELETE", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/* ============================== UTILS ============================== */
const todayISO = () => new Date().toISOString().slice(0, 10);
function daysBetween(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
}
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initial(name) { return (name || "?").trim().charAt(0).toUpperCase(); }
function isLeader(p) { return !!p && (p.role === "Leader" || p.role === "Leader and Member"); }
function isMember(p) { return !!p && (p.role === "Member" || p.role === "Leader and Member"); }
function roleBadgeClass(role) {
  if (role === "Leader") return "leader";
  if (role === "Member") return "member";
  return "both";
}
function leaderDisplayName(p) {
  if (p.leaderId) {
    const l = state.profiles.find((x) => x.id === p.leaderId);
    if (l) return l.username;
    return "";
  }
  if (p.leaderName) return p.leaderName;
  return "";
}

/* ---- multi-day checklist + multi-time-slot input helpers ---- */
function renderDayChecklist(idPrefix, selectedDays) {
  selectedDays = selectedDays || [];
  return `<div class="day-checklist" id="${idPrefix}-days">
    ${DAY_OPTIONS.map(d => `
      <label class="day-check">
        <input type="checkbox" name="${idPrefix}-day" value="${esc(d)}" ${selectedDays.includes(d) ? "checked" : ""} />
        ${esc(d)}
      </label>
    `).join("")}
  </div>`;
}
function renderTimeSlotRow(value) {
  return `
    <div class="time-slot-row">
      <input type="text" class="time-slot-input" placeholder="e.g. 2:00 PM - 4:00 PM" value="${esc(value || "")}" />
      <button type="button" class="time-slot-remove" aria-label="Remove time">✕</button>
    </div>
  `;
}
function renderTimeSlots(idPrefix, times) {
  const list = (times && times.length) ? times : [""];
  return `
    <div class="time-slot-list" id="${idPrefix}-time-list">
      ${list.map(t => renderTimeSlotRow(t)).join("")}
    </div>
    <button type="button" class="add-time-btn" id="${idPrefix}-add-time">+ Add another time</button>
  `;
}
function bindTimeSlotControls(idPrefix) {
  const listEl = document.getElementById(`${idPrefix}-time-list`);
  const addBtn = document.getElementById(`${idPrefix}-add-time`);
  if (!listEl) return;
  function bindRemove(row) {
    const btn = row.querySelector(".time-slot-remove");
    btn.addEventListener("click", () => {
      if (listEl.children.length > 1) row.remove();
      else row.querySelector(".time-slot-input").value = "";
    });
  }
  listEl.querySelectorAll(".time-slot-row").forEach(bindRemove);
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      listEl.insertAdjacentHTML("beforeend", renderTimeSlotRow(""));
      bindRemove(listEl.lastElementChild);
    });
  }
}
function collectCheckedDays(idPrefix) {
  return Array.from(document.querySelectorAll(`input[name="${idPrefix}-day"]:checked`)).map(cb => cb.value);
}
function collectTimeSlots(idPrefix) {
  return Array.from(document.querySelectorAll(`#${idPrefix}-time-list .time-slot-input`))
    .map(inp => inp.value.trim())
    .filter(Boolean);
}

/* ---- DGroup Leader picker ---- */
function renderLeaderSelect(idPrefix, leaders) {
  return `
    <select id="${idPrefix}-leader">
      <option value="">Select your DGroup Leader</option>
      ${leaders.map(l => `<option value="${esc(l.id)}">${esc(l.username)}</option>`).join("")}
      <option value="__other__">My leader isn't listed yet</option>
    </select>
    <input id="${idPrefix}-leader-other" type="text" placeholder="Type your leader's name" class="leader-other-input" style="display:none; margin-top:8px;" />
  `;
}
function bindLeaderSelect(idPrefix) {
  const sel = document.getElementById(`${idPrefix}-leader`);
  const other = document.getElementById(`${idPrefix}-leader-other`);
  if (!sel || !other) return;
  sel.addEventListener("change", () => {
    other.style.display = sel.value === "__other__" ? "block" : "none";
  });
}
function collectLeaderSelection(idPrefix) {
  const sel = document.getElementById(`${idPrefix}-leader`);
  const other = document.getElementById(`${idPrefix}-leader-other`);
  if (!sel) return { leaderId: null, leaderName: "" };
  if (sel.value === "__other__") return { leaderId: null, leaderName: (other && other.value || "").trim() };
  if (sel.value) return { leaderId: sel.value, leaderName: "" };
  return { leaderId: null, leaderName: "" };
}

/* ============================== INIT ============================== */
async function init() {
  try {
    const meRes = await apiGet("auth");
    state.currentUser = meRes.user;
  } catch {
    state.currentUser = null;
  }
  if (state.currentUser) {
    await loadData();
  } else {
    await loadLeaders();
  }
  state.loading = false;
  render();
}

async function loadData() {
  const [profRes, evRes] = await Promise.all([apiGet("profiles"), apiGet("events")]);
  state.profiles = profRes.profiles;
  state.events = evRes.events;
}

async function loadLeaders() {
  try {
    const res = await apiGet("leaders");
    state.availableLeaders = res.leaders || [];
  } catch {
    state.availableLeaders = [];
  }
}

/* ============================== ACTIONS ============================== */
async function doSignup(fields) {
  try {
    const { user } = await apiPost("auth", { action: "signup", ...fields });
    state.currentUser = user;
    state.formError = "";
    await loadData();
  } catch (err) {
    state.formError = err.message;
  }
  render();
}

async function doLogin(username, password) {
  try {
    const { user } = await apiPost("auth", { action: "login", username, password });
    state.currentUser = user;
    state.formError = "";
    await loadData();
  } catch (err) {
    state.formError = err.message;
  }
  render();
}

async function doLogout() {
  try { await apiPost("auth", { action: "logout" }); } catch {}
  state.currentUser = null;
  state.profiles = [];
  state.events = [];
  state.loginMode = "welcome";
  await loadLeaders();
  render();
}

async function removeMember(id) {
  try {
    await apiDelete(`profiles?id=${encodeURIComponent(id)}`);
    state.profiles = state.profiles.filter(p => p.id !== id);
  } catch (err) {
    console.error(err);
  }
  render();
}

async function addMemberFromModal(fields) {
  try {
    const { profile } = await apiPost("profiles", fields);
    state.profiles = [...state.profiles, profile];
    state.modal = null;
    state.formError = "";
  } catch (err) {
    state.formError = err.message;
  }
  render();
}

async function updateCampusTime(id, freeDays, freeTimes) {
  try {
    const { profile } = await apiPut("campus-time", { profileId: id, freeDays, freeTimes });
    state.profiles = state.profiles.map(p => p.id === id ? profile : p);
    if (state.currentUser && state.currentUser.id === id) state.currentUser = profile;
    state.modal = null;
    state.formError = "";
  } catch (err) {
    state.formError = err.message;
  }
  render();
}

async function createEvent(data) {
  try {
    const { event } = await apiPost("events", data);
    state.events = [...state.events, event];
    state.modal = null;
    state.formError = "";
  } catch (err) {
    state.formError = err.message;
  }
  render();
}

async function toggleRSVP(eventId) {
  try {
    const { event } = await apiPost("rsvp", { eventId });
    state.events = state.events.map(e => e.id === eventId ? event : e);
  } catch (err) {
    console.error(err);
  }
  render();
}

async function deleteEvent(eventId) {
  try {
    await apiDelete(`events?id=${encodeURIComponent(eventId)}`);
    state.events = state.events.filter(e => e.id !== eventId);
  } catch (err) {
    console.error(err);
  }
  state.modal = null;
  render();
}

/* ============================== RENDER ROOT ============================== */
function render() {
  const app = document.getElementById("app");
  document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());

  if (state.loading) {
    app.innerHTML = `<div class="center-screen"><p class="display muted">Opening Elevate UE&hellip;</p></div>`;
    return;
  }
  if (!state.currentUser) {
    app.innerHTML = renderLogin();
    bindLoginEvents();
    return;
  }
  app.innerHTML = renderApp();
  bindAppEvents();
  if (state.modal) {
    document.body.insertAdjacentHTML("beforeend", renderModal());
    bindModalEvents();
  }
}

/* ============================== LOGIN / SIGNUP SCREENS ============================== */
function renderLogin() {
  const mode = state.loginMode;
  let inner = "";
  let subtitle = "Log in to your account, or create one to get started.";

  if (mode === "welcome") {
    inner = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-accent btn-full" id="goLoginBtn">Log In</button>
        <button class="btn btn-ink btn-full" id="goCreateBtn">Create an Account</button>
      </div>
    `;
  } else if (mode === "login") {
    subtitle = "Log In";
    inner = `
      <div class="field"><label>Username</label><input id="login-username" placeholder="Your username" /></div>
      <div class="field"><label>Password</label><input id="login-password" type="password" placeholder="Your password" /></div>
      ${state.formError ? `<p class="err-text">${esc(state.formError)}</p>` : ""}
      <button class="btn btn-accent btn-full" id="submitLoginBtn">Log In</button>
      <button class="back-link" id="backToWelcomeBtn">&larr; Back</button>
    `;
  } else {
    subtitle = "Create an Account";
    inner = `
      <div class="field">
        <label>Username</label>
        <input id="f-name" placeholder="Choose a username" />
      </div>
      <div class="field">
        <label>Password</label>
        <input id="f-password" type="password" placeholder="At least 4 characters" />
      </div>
      <div class="field">
        <label>Role</label>
        <div class="role-picker" id="role-picker" data-selected="Member">
          ${ROLE_OPTIONS.map(r => `<button type="button" data-role="${esc(r)}" class="${r==='Member'?'active':''}">${esc(r)}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <label>Year / Program</label>
        <input id="f-group" placeholder="e.g. 1st Year - Computer Engineering" />
      </div>
      <div class="field">
        <label>Who is your DGroup Leader?</label>
        ${renderLeaderSelect("f", state.availableLeaders)}
      </div>
      <div class="field">
        <label>Campus Time — what days are you free? (select all that apply)</label>
        ${renderDayChecklist("f", [])}
      </div>
      <div class="field">
        <label>Campus Time — what time(s) are you free?</label>
        ${renderTimeSlots("f", [""])}
      </div>
      ${state.formError ? `<p class="err-text">${esc(state.formError)}</p>` : ""}
      <button class="btn btn-accent btn-full" id="createProfileBtn">Create Account</button>
      <button class="back-link" id="backToWelcomeBtn">&larr; Back</button>
    `;
  }

  return `
    <div class="center-screen">
      <div class="login-box">
        <div class="login-head">
          <div class="login-badge">✦</div>
          <h1 class="display" style="font-weight:600; font-size:28px; margin:0;">Elevate UE</h1>
          <p class="muted" style="margin-top:6px;">${esc(subtitle)}</p>
        </div>
        <div class="card">${inner}</div>
      </div>
    </div>
  `;
}

function bindLoginEvents() {
  const goLoginBtn = document.getElementById("goLoginBtn");
  if (goLoginBtn) goLoginBtn.addEventListener("click", () => { state.loginMode = "login"; state.formError = ""; render(); });

  const goCreateBtn = document.getElementById("goCreateBtn");
  if (goCreateBtn) goCreateBtn.addEventListener("click", async () => {
    await loadLeaders();
    state.loginMode = "create";
    state.formError = "";
    render();
  });

  const backToWelcomeBtn = document.getElementById("backToWelcomeBtn");
  if (backToWelcomeBtn) backToWelcomeBtn.addEventListener("click", () => { state.loginMode = "welcome"; state.formError = ""; render(); });

  const submitLoginBtn = document.getElementById("submitLoginBtn");
  if (submitLoginBtn) {
    submitLoginBtn.addEventListener("click", () => {
      const username = document.getElementById("login-username").value;
      const password = document.getElementById("login-password").value;
      doLogin(username, password);
    });
  }

  const rolePicker = document.getElementById("role-picker");
  if (rolePicker) {
    rolePicker.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        rolePicker.dataset.selected = b.getAttribute("data-role");
        rolePicker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
      });
    });
  }

  bindLeaderSelect("f");
  bindTimeSlotControls("f");

  const createBtn = document.getElementById("createProfileBtn");
  if (createBtn) {
    createBtn.addEventListener("click", () => {
      const username = document.getElementById("f-name").value;
      const password = document.getElementById("f-password").value;
      const role = document.getElementById("role-picker").dataset.selected || "Member";
      const group = document.getElementById("f-group").value;
      const { leaderId, leaderName } = collectLeaderSelection("f");
      const freeDays = collectCheckedDays("f");
      const freeTimes = collectTimeSlots("f");
      doSignup({ username, password, role, group, leaderId, leaderName, freeDays, freeTimes });
    });
  }
}

/* ============================== MAIN APP SHELL ============================== */
function renderApp() {
  const leaders = state.profiles.filter(isLeader);
  const members = state.profiles.filter(isMember);
  const upcoming = state.events.filter(e => daysBetween(e.date) >= 0).sort((a,b) => a.date.localeCompare(b.date));
  const soon = upcoming.filter(e => daysBetween(e.date) <= 7);

  return `
    <header class="header">
      <div class="wrap header-top">
        <div class="brand">
          <div class="brand-badge">✦</div>
          <div>
            <p class="brand-name">Elevate UE</p>
            <p class="brand-tag">Discipleship Group Tracker</p>
          </div>
        </div>
        <div class="who">
          <span class="role-badge ${roleBadgeClass(state.currentUser.role)}">${esc(state.currentUser.role)}</span>
          <button class="switch-btn" id="switchBtn">↩ ${esc(state.currentUser.username)}</button>
        </div>
      </div>
      <div class="wrap tabs">
        <button class="tab-btn ${state.tab==='dashboard'?'active':''}" data-tab="dashboard">Dashboard</button>
        <button class="tab-btn ${state.tab==='members'?'active':''}" data-tab="members">Members</button>
        <button class="tab-btn ${state.tab==='calendar'?'active':''}" data-tab="calendar">Calendar</button>
        <button class="tab-btn ${state.tab==='campustime'?'active':''}" data-tab="campustime">Campus Time</button>
      </div>
    </header>

    ${soon.length ? `
    <div class="reminder">
      <div class="wrap">
        <span style="flex-shrink:0; opacity:.8;">🔔 Reminders:</span>
        ${soon.map(ev => `<a href="#" class="rem-link" data-open-event="${ev.id}">${esc(ev.title)} &middot; ${daysBetween(ev.date)===0?"today":daysBetween(ev.date)+"d"}</a>`).join("")}
      </div>
    </div>` : ""}

    <main class="content"><div class="wrap" id="tabContent">
      ${state.tab === "dashboard" ? renderDashboard(leaders, members, upcoming) : ""}
      ${state.tab === "members" ? renderMembers(leaders, members) : ""}
      ${state.tab === "calendar" ? renderCalendar() : ""}
      ${state.tab === "campustime" ? renderCampusTime() : ""}
    </div></main>
  `;
}

function bindAppEvents() {
  const switchBtn = document.getElementById("switchBtn");
  if (switchBtn) switchBtn.addEventListener("click", doLogout);

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => { state.tab = btn.getAttribute("data-tab"); state.selectedDay = null; render(); });
  });

  document.querySelectorAll("[data-open-event]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.preventDefault(); state.modal = { type: "eventDetail", id: btn.getAttribute("data-open-event") }; render(); });
  });

  bindTabSpecificEvents();
}

/* ============================== DASHBOARD ============================== */
function renderDashboard(leaders, members, upcoming) {
  const next = upcoming[0];
  return `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">👑 Leaders</div><p class="stat-value">${leaders.length}</p></div>
      <div class="stat-card"><div class="stat-label">🙂 Members</div><p class="stat-value">${members.length}</p></div>
      <div class="stat-card"><div class="stat-label">📅 Upcoming Events</div><p class="stat-value">${upcoming.length}</p></div>
    </div>

    <div class="card">
      <h2 class="display" style="font-size:18px; font-weight:600; margin:0 0 14px;">The Fellowship</h2>
      ${renderThreadDiagram(leaders, members)}
    </div>

    <div class="card">
      <h2 class="display" style="font-size:18px; font-weight:600; margin:0 0 12px;">Next Event</h2>
      ${next ? `
        <button class="list-row" style="width:100%; text-align:left; cursor:pointer;" data-open-event="${next.id}">
          <div>
            <p class="person-name">${esc(next.title)}</p>
            <p class="person-sub">${fmtDate(next.date)}${next.time ? ", "+esc(next.time) : ""}${next.location ? " · 📍 "+esc(next.location) : ""}</p>
          </div>
          <span class="count-badge">${next.rsvps.length} going</span>
        </button>
      ` : `<p class="muted">No event scheduled yet.</p>`}
    </div>
  `;
}

function renderThreadDiagram(leaders, members) {
  if (!leaders.length && !members.length) {
    return `<p class="muted">Add members to see your group here.</p>`;
  }
  const w = 600, cols = Math.min(6, Math.max(members.length, 1));
  const h = Math.max(140, 70 + Math.ceil(members.length / cols) * 40);
  const leaderY = 30, memberY0 = 90, spacing = w / (cols + 1);

  let lines = "", nodes = "";
  members.forEach((m, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = spacing * (col + 1), y = memberY0 + row * 40;
    lines += `<line x1="${w/2}" y1="${leaderY+10}" x2="${x}" y2="${y-8}" stroke="var(--line)" stroke-width="1.5" />`;
    nodes += `<g><circle cx="${x}" cy="${y}" r="9" fill="var(--accent)" /><text x="${x}" y="${y+3}" text-anchor="middle" font-size="9" font-weight="700" fill="white">${esc(initial(m.username))}</text></g>`;
  });
  const leaderNode = leaders.length
    ? `<g><circle cx="${w/2}" cy="${leaderY}" r="11" fill="var(--ink-soft)" /><text x="${w/2}" y="${leaderY+4}" text-anchor="middle" font-size="10" font-weight="700" fill="white">L</text><text x="${w/2}" y="${leaderY-18}" text-anchor="middle" font-size="11" fill="var(--slate)">${leaders.length} Leader${leaders.length!==1?"s":""}</text></g>`
    : `<text x="${w/2}" y="${leaderY}" text-anchor="middle" font-size="11" fill="var(--slate)">No leader yet</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; max-height:220px;" role="img" aria-label="Group diagram">${lines}${leaderNode}${nodes}</svg>`;
}

/* ============================== MEMBERS ============================== */
function renderMembers(leaders, members) {
  const canManage = isLeader(state.currentUser);
  return `
    <div class="section-head">
      <h2 class="display" style="font-size:18px; font-weight:600; margin:0;">Group Members</h2>
      ${canManage ? `<button class="btn btn-accent" id="addMemberBtn">+ Add Member</button>` : ""}
    </div>
    <div style="height:16px;"></div>
    ${renderPersonList("Leaders (incl. Leader &amp; Member)", "👑", leaders, canManage)}
    <div style="height:18px;"></div>
    ${renderPersonList("Members (incl. Leader &amp; Member)", "🙂", members, canManage)}
  `;
}

function renderPersonList(title, icon, people, canManage) {
  return `
    <div class="card">
      <h3 style="font-size:13px; font-weight:600; color:var(--slate); margin:0 0 10px; display:flex; align-items:center; gap:6px;">
        ${icon} ${title} (${people.length})
      </h3>
      ${people.length === 0 ? `<p class="muted">Nothing here yet.</p>` : people.map(p => `
        <div class="list-row">
          <span class="person">
            <span class="avatar">${esc(initial(p.username))}</span>
            <span>
              <p class="person-name">${esc(p.username)}</p>
              ${p.group ? `<p class="person-sub">${esc(p.group)}</p>` : ""}
              ${leaderDisplayName(p) ? `<p class="person-sub">DGroup Leader: ${esc(leaderDisplayName(p))}</p>` : ""}
            </span>
          </span>
          ${canManage ? `<button class="link-danger" data-remove-member="${p.id}">Remove</button>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================== CALENDAR ============================== */
function renderCalendar() {
  const { y, m } = state.calMonth;
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  const eventsByDay = {};
  state.events.forEach(ev => { (eventsByDay[ev.date] = eventsByDay[ev.date] || []).push(ev); });

  let cells = "";
  for (let i = 0; i < startWeekday; i++) cells += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const has = !!eventsByDay[iso];
    const isToday = iso === todayISO();
    const isSel = iso === state.selectedDay;
    cells += `<button class="cal-day ${isToday?'today':''} ${isSel?'selected':''}" data-day="${iso}">
      <span>${d}</span>${has ? `<span class="cal-dot"></span>` : ""}
    </button>`;
  }

  const dayList = state.selectedDay
    ? (eventsByDay[state.selectedDay] || []).sort((a,b) => a.date.localeCompare(b.date))
    : state.events.filter(e => daysBetween(e.date) >= 0).sort((a,b) => a.date.localeCompare(b.date));

  const canManage = isLeader(state.currentUser);

  return `
    <div class="section-head">
      <h2 class="display" style="font-size:18px; font-weight:600; margin:0;">Calendar</h2>
      ${canManage ? `<button class="btn btn-accent" id="addEventBtn">+ New Event</button>` : ""}
    </div>
    <div style="height:16px;"></div>
    <div class="card">
      <div class="cal-nav">
        <button data-cal-prev>&larr;</button>
        <p class="display" style="font-size:14px; font-weight:600; margin:0;">${monthLabel}</p>
        <button data-cal-next>&rarr;</button>
      </div>
      <div class="cal-grid-labels"><div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div></div>
      <div style="height:4px;"></div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div class="card">
      <h3 style="font-size:13px; font-weight:600; color:var(--slate); margin:0 0 10px;">${state.selectedDay ? fmtDate(state.selectedDay) : "Upcoming Events"}</h3>
      ${dayList.length === 0 ? `<p class="muted">No events.</p>` : dayList.map(ev => `
        <button class="list-row" style="width:100%; text-align:left; cursor:pointer;" data-open-event="${ev.id}">
          <div>
            <p class="person-name">${esc(ev.title)}</p>
            <p class="person-sub">${fmtDate(ev.date)}${ev.time ? " &middot; "+esc(ev.time) : ""}</p>
          </div>
          <span class="count-badge">${ev.rsvps.length}</span>
        </button>
      `).join("")}
    </div>
  `;
}

/* ============================== CAMPUS TIME ============================== */
function renderCampusTime() {
  const withTime = state.profiles.filter(p => (p.freeDays && p.freeDays.length) || (p.freeTimes && p.freeTimes.length));
  const withoutTime = state.profiles.filter(p => !(p.freeDays && p.freeDays.length) && !(p.freeTimes && p.freeTimes.length));

  const grouped = {};
  DAY_OPTIONS.forEach(d => grouped[d] = []);
  grouped["Unspecified day"] = [];
  withTime.forEach(p => {
    const days = (p.freeDays && p.freeDays.length) ? p.freeDays : ["Unspecified day"];
    days.forEach(day => {
      const key = DAY_OPTIONS.includes(day) ? day : "Unspecified day";
      grouped[key].push(p);
    });
  });

  const dayKeys = [...DAY_OPTIONS, "Unspecified day"];
  const nonEmptyDays = dayKeys.filter(d => grouped[d] && grouped[d].length);

  return `
    <div class="section-head">
      <h2 class="display" style="font-size:18px; font-weight:600; margin:0;">Campus Time</h2>
    </div>
    <p class="muted" style="margin:6px 0 16px;">What time and day is everyone free? Use this to find a slot that works for the whole group.</p>

    <div class="card">
      ${nonEmptyDays.length === 0 ? `<p class="muted">No one has shared their free day/time yet.</p>` : nonEmptyDays.map(day => `
        <div class="day-group">
          <p class="day-group-title">${esc(day)}</p>
          ${grouped[day].map(p => `
            <div class="slot-row">
              <span class="person">
                <span class="avatar">${esc(initial(p.username))}</span>
                <span>
                  <p class="person-name">${esc(p.username)} <span class="role-badge ${roleBadgeClass(p.role)}" style="margin-left:6px;">${esc(p.role)}</span></p>
                </span>
              </span>
              <span class="chip-wrap" style="justify-content:flex-end;">
                ${(p.freeTimes && p.freeTimes.length) ? p.freeTimes.map(t => `<span class="slot-time">${esc(t)}</span>`).join("") : `<span class="slot-time">Time not set</span>`}
              </span>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>

    ${withoutTime.length ? `
    <div class="card">
      <p class="day-group-title">Haven't shared yet</p>
      ${withoutTime.map(p => `
        <div class="slot-row">
          <span class="person">
            <span class="avatar">${esc(initial(p.username))}</span>
            <p class="person-name">${esc(p.username)}</p>
          </span>
          <span style="display:flex; align-items:center; gap:10px;">
            <span class="muted" style="font-size:12px;">No Campus Time set</span>
            ${(isLeader(state.currentUser) || state.currentUser.id === p.id) ? `<button class="link-accent" data-edit-campustime="${p.id}">Edit</button>` : ""}
          </span>
        </div>
      `).join("")}
    </div>` : ""}
  `;
}

/* ============================== TAB-SPECIFIC BINDINGS ============================== */
function bindTabSpecificEvents() {
  const addMemberBtn = document.getElementById("addMemberBtn");
  if (addMemberBtn) addMemberBtn.addEventListener("click", () => { state.modal = "newMember"; state.formError = ""; render(); });

  document.querySelectorAll("[data-remove-member]").forEach(btn => {
    btn.addEventListener("click", () => removeMember(btn.getAttribute("data-remove-member")));
  });

  const addEventBtn = document.getElementById("addEventBtn");
  if (addEventBtn) addEventBtn.addEventListener("click", () => { state.modal = "newEvent"; state.formError = ""; render(); });

  document.querySelectorAll("[data-cal-prev]").forEach(btn => btn.addEventListener("click", () => {
    const { y, m } = state.calMonth;
    state.calMonth = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    render();
  }));
  document.querySelectorAll("[data-cal-next]").forEach(btn => btn.addEventListener("click", () => {
    const { y, m } = state.calMonth;
    state.calMonth = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
    render();
  }));
  document.querySelectorAll("[data-day]").forEach(btn => btn.addEventListener("click", () => {
    const iso = btn.getAttribute("data-day");
    state.selectedDay = state.selectedDay === iso ? null : iso;
    render();
  }));

  document.querySelectorAll("[data-edit-campustime]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.modal = { type: "editCampusTime", id: btn.getAttribute("data-edit-campustime") };
      state.formError = "";
      render();
    });
  });
}

/* ============================== MODALS ============================== */
function renderModal() {
  if (state.modal === "newMember") return renderNewMemberModal();
  if (state.modal === "newEvent") return renderNewEventModal();
  if (state.modal && state.modal.type === "eventDetail") return renderEventDetailModal(state.modal.id);
  if (state.modal && state.modal.type === "editCampusTime") return renderEditCampusTimeModal(state.modal.id);
  return "";
}

function renderEditCampusTimeModal(id) {
  const p = state.profiles.find(x => x.id === id);
  if (!p) return "";
  return `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <div class="modal-head"><h3 class="display">Campus Time — ${esc(p.username)}</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
        <div class="modal-body">
          <div class="field">
            <label>What days is ${esc(p.username)} free? (select all that apply)</label>
            ${renderDayChecklist("ct", p.freeDays || [])}
          </div>
          <div class="field">
            <label>What time(s) is ${esc(p.username)} free?</label>
            ${renderTimeSlots("ct", (p.freeTimes && p.freeTimes.length) ? p.freeTimes : [""])}
          </div>
          ${state.formError ? `<p class="err-text">${esc(state.formError)}</p>` : ""}
          <button class="btn btn-accent btn-full" id="saveCampusTimeBtn">Save</button>
        </div>
      </div>
    </div>
  `;
}

function renderNewMemberModal() {
  const leaders = state.profiles.filter(isLeader).map(l => ({ id: l.id, username: l.username }));
  return `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <div class="modal-head"><h3 class="display">Add Member</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Username</label><input id="m-name" placeholder="Full name / username" /></div>
          <div class="field"><label>Temporary Password</label><input id="m-password" type="password" placeholder="At least 4 characters" /></div>
          <div class="field">
            <label>Role</label>
            <div class="role-picker" id="m-role-picker" data-selected="Member">
              ${ROLE_OPTIONS.map(r => `<button type="button" data-role="${esc(r)}" class="${r==='Member'?'active':''}">${esc(r)}</button>`).join("")}
            </div>
          </div>
          <div class="field"><label>Year / Program </label><input id="m-group" placeholder="e.g. 1st Year - Computer Engineering" /></div>
          <div class="field">
            <label>Who is their DGroup Leader?</label>
            ${renderLeaderSelect("m", leaders)}
          </div>
          <div class="field">
            <label>Campus Time — what days are they free? (select all that apply)</label>
            ${renderDayChecklist("m", [])}
          </div>
          <div class="field">
            <label>Campus Time — what time(s) are they free?</label>
            ${renderTimeSlots("m", [""])}
          </div>
          ${state.formError ? `<p class="err-text">${esc(state.formError)}</p>` : ""}
          <button class="btn btn-accent btn-full" id="submitMemberBtn">Add</button>
        </div>
      </div>
    </div>
  `;
}

function renderNewEventModal() {
  return `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <div class="modal-head"><h3 class="display">New Event</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Event Name</label><input id="e-title" placeholder="e.g. Youth Fellowship Night" /></div>
          <div class="two-col">
            <div class="field"><label>Date</label><input type="date" id="e-date" value="${todayISO()}" /></div>
            <div class="field"><label>Time</label><input type="time" id="e-time" /></div>
          </div>
          <div class="field"><label>Location</label><input id="e-location" placeholder="e.g. School Chapel" /></div>
          <div class="field"><label>Details (optional)</label><textarea id="e-desc" rows="3" placeholder="Short event details"></textarea></div>
          ${state.formError ? `<p class="err-text">${esc(state.formError)}</p>` : ""}
          <button class="btn btn-accent btn-full" id="submitEventBtn">Create Event</button>
        </div>
      </div>
    </div>
  `;
}

function renderEventDetailModal(eventId) {
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return "";
  const going = ev.rsvps.includes(state.currentUser.id);
  const attendees = ev.rsvps.map(id => state.profiles.find(p => p.id === id)).filter(Boolean);
  const canDelete = isLeader(state.currentUser);

  return `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <div class="modal-head"><h3 class="display">${esc(ev.title)}</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
        <div class="modal-body">
          <p class="muted">🕐 ${fmtDate(ev.date)}${ev.time ? ", "+esc(ev.time) : ""}</p>
          ${ev.location ? `<p class="muted">📍 ${esc(ev.location)}</p>` : ""}
          ${ev.description ? `<p style="font-size:14px;">${esc(ev.description)}</p>` : ""}
          <button class="btn ${going ? '' : 'btn-accent'} btn-full" id="rsvpBtn" style="${going ? 'background:var(--tint-soft); color:var(--accent);' : ''}">
            ✓ ${going ? "You're Going" : "RSVP"}
          </button>
          <div>
            <p style="font-size:12px; font-weight:600; color:var(--slate); margin:0 0 8px;">Going (${attendees.length})</p>
            ${attendees.length === 0 ? `<p class="muted" style="font-size:12px;">No RSVPs yet.</p>` : `
              <div class="chip-wrap">${attendees.map(a => `<span class="rsvp-chip">${esc(a.username)}</span>`).join("")}</div>
            `}
          </div>
          ${canDelete ? `<button class="link-danger" id="deleteEventBtn" style="text-align:left;">Delete event</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

function bindModalEvents() {
  const overlay = document.getElementById("modalOverlay");
  const closeBtn = document.getElementById("modalCloseBtn");
  const closeModal = () => { state.modal = null; state.formError = ""; render(); };
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  const mRolePicker = document.getElementById("m-role-picker");
  if (mRolePicker) {
    mRolePicker.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        mRolePicker.dataset.selected = b.getAttribute("data-role");
        mRolePicker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
      });
    });
  }

  bindLeaderSelect("m");
  bindTimeSlotControls("m");
  bindTimeSlotControls("ct");

  const saveCampusTimeBtn = document.getElementById("saveCampusTimeBtn");
  if (saveCampusTimeBtn && state.modal && state.modal.type === "editCampusTime") {
    saveCampusTimeBtn.addEventListener("click", () => {
      const freeDays = collectCheckedDays("ct");
      const freeTimes = collectTimeSlots("ct");
      updateCampusTime(state.modal.id, freeDays, freeTimes);
    });
  }

  const submitMemberBtn = document.getElementById("submitMemberBtn");
  if (submitMemberBtn) {
    submitMemberBtn.addEventListener("click", () => {
      const name = document.getElementById("m-name").value;
      const password = document.getElementById("m-password").value;
      const role = document.getElementById("m-role-picker").dataset.selected || "Member";
      const group = document.getElementById("m-group").value;
      const { leaderId, leaderName } = collectLeaderSelection("m");
      const freeDays = collectCheckedDays("m");
      const freeTimes = collectTimeSlots("m");
      addMemberFromModal({ name, password, role, group, leaderId, leaderName, freeDays, freeTimes });
    });
  }

  const submitEventBtn = document.getElementById("submitEventBtn");
  if (submitEventBtn) {
    submitEventBtn.addEventListener("click", () => {
      const title = document.getElementById("e-title").value.trim();
      const date = document.getElementById("e-date").value;
      const time = document.getElementById("e-time").value;
      const location = document.getElementById("e-location").value.trim();
      const description = document.getElementById("e-desc").value.trim();
      if (!title || !date) { state.formError = "Name and date are required."; render(); return; }
      createEvent({ title, date, time, location, description });
    });
  }

  const rsvpBtn = document.getElementById("rsvpBtn");
  if (rsvpBtn && state.modal && state.modal.type === "eventDetail") {
    rsvpBtn.addEventListener("click", () => toggleRSVP(state.modal.id));
  }

  const deleteEventBtn = document.getElementById("deleteEventBtn");
  if (deleteEventBtn && state.modal && state.modal.type === "eventDetail") {
    deleteEventBtn.addEventListener("click", () => deleteEvent(state.modal.id));
  }
}

/* ============================== START ============================== */
init();
