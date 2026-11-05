const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CRM_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STAGES = ["New inquiry", "Quote sent", "Booked", "In progress", "Delivered"];
const $ = s => document.querySelector(s);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };

async function initLogin() {
  const { data: { session } } = await db.auth.getSession();
  if (session) return location.replace("dashboard.html");
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const { error } = await db.auth.signInWithPassword({ email: $("#email").value, password: $("#password").value });
    if (error) { $("#msg").textContent = "That email or password is incorrect."; return; }
    location.replace("dashboard.html");
  });
}

async function initDashboard() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return location.replace("index.html");
  const { data: profile } = await db.from("profiles").select("full_name, role").eq("id", session.user.id).single();
  $("#who").textContent = profile?.full_name || session.user.email;
  if (profile?.role === "admin") document.querySelectorAll(".admin-only").forEach(n => n.hidden = false);
  $("#signout").onclick = async () => { await db.auth.signOut(); location.replace("index.html"); };
  $("#new-lead").onclick = () => $("#lead-dialog").showModal();
  $("#lead-form").addEventListener("submit", async e => {
    if (e.submitter?.value === "cancel") return;
    const f = new FormData(e.target);
    const { error } = await db.from("leads").insert({
      name: f.get("name"), email: f.get("email"), phone: f.get("phone"),
      job_type: f.get("job_type"), due_date: f.get("due_date") || null
    });
    if (error) { e.preventDefault(); $("#form-msg").textContent = "Could not save this lead. " + error.message; return; }
    e.target.reset(); loadLeads();
  });
  loadLeads();
}

async function loadLeads() {
  const { data: leads, error } = await db.from("leads").select("*").order("due_date", { nullsFirst: false });
  const board = $("#board"); board.replaceChildren();
  if (error) { board.append(el("p", "Could not load leads. Refresh and try again.", "msg")); return; }
  for (const stage of STAGES) {
    const col = el("section", null, "col");
    const mine = leads.filter(l => l.stage === stage);
    const h = el("h2", stage); h.append(el("span", String(mine.length)));
    col.append(h);
    if (!mine.length) col.append(el("p", "No leads in this stage.", "empty"));
    for (const l of mine) {
      const card = el("article", null, "lead");
      card.append(el("h3", l.name), el("p", l.job_type || ""), el("p", l.due_date ? "Due " + l.due_date : "No due date"));
      const sel = el("select"); sel.setAttribute("aria-label", "Move " + l.name + " to stage");
      for (const s of STAGES) { const o = el("option", s); o.value = s; o.selected = s === l.stage; sel.append(o); }
      sel.onchange = async () => { await db.from("leads").update({ stage: sel.value }).eq("id", l.id); loadLeads(); };
      card.append(sel); col.append(card);
    }
    board.append(col);
  }
}
