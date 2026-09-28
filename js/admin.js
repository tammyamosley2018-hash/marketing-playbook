import { admin } from "./api.js";
import { md, compilePlaybook, downloadWord, downloadMarkdown } from "./playbook.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const root = $("#admin");
const clientLink = (code) => `${location.origin}${location.pathname.replace(/admin\.html$/, "")}?c=${code}`;

let api = null;

function getPw() { try { return sessionStorage.getItem("pb-admin") || ""; } catch { return ""; } }
function setPw(pw) { try { pw ? sessionStorage.setItem("pb-admin", pw) : sessionStorage.removeItem("pb-admin"); } catch {} }

function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function viewLogin(error) {
  $("#logout").hidden = true;
  root.innerHTML = `<section class="card" style="max-width:420px;margin:40px auto">
    <h1>Sign in</h1>
    <form id="login" class="form">
      <label class="field"><span>Admin password</span><input type="password" id="pw" autocomplete="current-password" style="width:100%;font:inherit;padding:10px 14px;border:1.5px solid var(--line);border-radius:10px"></label>
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
      <button class="btn primary">Sign in</button>
    </form></section>`;
  $("#pw").focus();
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#pw").value;
    api = admin(pw);
    try { await api.list(); setPw(pw); viewList(); } catch (err) { viewLogin(err.message); }
  });
}

async function viewList(newCode) {
  $("#logout").hidden = false;
  root.innerHTML = `<section class="card"><p class="busy"><span class="dots"></span>Loading…</p></section>`;
  let clients;
  try { clients = await api.list(); } catch (err) { return viewLogin(err.message); }
  root.innerHTML = `
    <section class="card">
      <h1>New client link</h1>
      <form id="create" class="row">
        <label class="field"><span>Client name</span><input type="text" id="name" required placeholder="e.g. McKenna Smith"></label>
        <label class="field"><span>Private note (optional)</span><input type="text" id="notes" placeholder="Business, package, anything for you"></label>
        <button class="btn primary">Create link</button>
      </form>
      ${newCode ? `<div class="new-link"><code>${esc(clientLink(newCode))}</code><button class="btn secondary small" data-copy="${esc(clientLink(newCode))}">Copy link</button></div>` : ""}
    </section>
    <section class="card">
      <h1>Clients</h1>
      ${clients.length ? `<table class="clients"><thead><tr><th>Client</th><th>Progress</th><th>Last active</th><th></th></tr></thead><tbody>
        ${clients.map((c) => `<tr>
          <td class="name">${esc(c.name)}</td>
          <td class="progress-cell"><div class="progress">${c.done ? `<span class="pill done">Complete</span>` : `<div class="bar"><i style="width:${c.pct || 0}%"></i></div><span class="pill">${esc(c.progress || "Not started")}</span>`}</div></td>
          <td class="when">${esc(when(c.updatedAt))}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn ghost small" data-copy="${esc(clientLink(c.code))}">Copy link</button>
            <button class="btn secondary small" data-open="${esc(c.code)}">Open</button>
          </td></tr>`).join("")}
      </tbody></table>` : `<p class="empty">No clients yet. Create a link above and send it to your client.</p>`}
    </section>`;
  $("#create").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    if (!name) return;
    const { code } = await api.create(name, $("#notes").value);
    viewList(code);
  });
  wireCommon();
}

async function viewClient(code) {
  root.innerHTML = `<section class="card"><p class="busy"><span class="dots"></span>Loading…</p></section>`;
  const s = await api.get(code);
  const hasAny = Object.keys(s.drafts || {}).length > 0;
  root.innerHTML = `
    <section class="card">
      <div class="detail-head">
        <div>
          <p class="eyebrow">${s.completedAt ? "Complete" : esc(s.progress || "Not started")}</p>
          <h1>${esc(s.clientName)}</h1>
          ${s.notes ? `<p class="hint">${esc(s.notes)}</p>` : ""}
        </div>
        <button class="btn ghost" data-back>← All clients</button>
      </div>
      <div class="actions left">
        <button class="btn primary" data-md ${hasAny ? "" : "disabled"}>Download for Claude Code (.md)</button>
        <button class="btn secondary" data-word ${hasAny ? "" : "disabled"}>Download (Word)</button>
        <button class="btn ghost" data-copy="${esc(clientLink(code))}">Copy client link</button>
        <button class="btn ghost" data-delete>Delete client</button>
      </div>
      <p class="note">${s.completedAt ? "" : "Still in progress — showing the sections approved or drafted so far."}</p>
    </section>
    ${hasAny ? `<article class="card prose">${md(compilePlaybook(s))}</article>` : ""}`;
  $("[data-back]").addEventListener("click", () => viewList());
  $("[data-md]")?.addEventListener("click", () => downloadMarkdown(s));
  $("[data-word]")?.addEventListener("click", () => downloadWord(s));
  $("[data-delete]").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed) { await api.remove(code); return viewList(); }
    b.dataset.armed = "1";
    b.textContent = "Click again to permanently delete";
    b.classList.add("primary");
  });
  wireCommon();
}

function wireCommon() {
  root.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const label = b.textContent;
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied!"; } catch { b.textContent = "Copy failed"; }
      setTimeout(() => (b.textContent = label), 1500);
    })
  );
  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => viewClient(b.dataset.open)));
}

$("#logout").addEventListener("click", () => { setPw(""); api = null; viewLogin(); });

const saved = getPw();
if (saved) { api = admin(saved); viewList(); } else viewLogin();
