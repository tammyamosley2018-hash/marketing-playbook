import { SCREENS, SECTIONS, GEN_SCREENS } from "./flow.js";
import { loadSession, saveSession, generate } from "./api.js";
import { md, wordCount, compilePlaybook, downloadWord } from "./playbook.js";
import { OWNER_NAME } from "./config.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const code = new URLSearchParams(location.search).get("c");
let s = null; // the client's saved state
let busy = null; // { id, text, searches, phase } while the AI is writing
let uiError = null; // { id, message }
let panel = null; // "change" | "edit" | "note" — open panel on a review screen

// ---------- Navigation ----------
const visible = () => SCREENS.filter((x) => !x.when || x.when(s));
const indexOf = (id) => visible().findIndex((x) => x.id === id);
const current = () => visible()[Math.max(0, indexOf(s.pos))] || visible()[0];

function go(id) {
  const i = indexOf(id);
  if (i < 0) return;
  s.pos = id;
  s.furthest = Math.max(s.furthest ?? 0, i);
  panel = null;
  uiError = null;
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const next = () => { const v = visible(); go(v[Math.min(v.length - 1, indexOf(s.pos) + 1)].id); };
const back = () => { const v = visible(); go(v[Math.max(0, indexOf(s.pos) - 1)].id); };

// Something at screen `id` changed, so every AI draft after it is out of date.
function invalidateAfter(id) {
  const v = visible();
  const i = v.findIndex((x) => x.id === id);
  v.slice(i + 1).forEach((x) => {
    if (GEN_SCREENS.includes(x.id)) { delete s.drafts[x.id]; delete s.approved[x.id]; }
  });
  delete s.completedAt;
  s.furthest = Math.min(s.furthest ?? 0, i + 1);
}

function setAnswer(key, value, screenId) {
  const before = JSON.stringify(s.answers[key] ?? "");
  s.answers[key] = value;
  if (JSON.stringify(value ?? "") !== before) invalidateAfter(screenId);
}

// ---------- Saving ----------
let saveTimer = null;
let saving = Promise.resolve();
function save(now = false) {
  const scr = current();
  s.progress = SECTIONS[scr.section];
  s.pct = Math.round((indexOf(scr.id) / (visible().length - 1)) * 100);
  clearTimeout(saveTimer);
  setSaveStatus("Saving…");
  const run = () => {
    saving = saving.then(() =>
      saveSession(code, s).then(() => setSaveStatus("Saved"), () => setSaveStatus("Not saved — check your connection", true))
    );
  };
  if (now) run(); else saveTimer = setTimeout(run, 700);
}
function setSaveStatus(text, bad) {
  const el = $("#save-status");
  if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); }
}

window.addEventListener("beforeunload", (e) => { if (busy) { e.preventDefault(); e.returnValue = ""; } });

// ---------- AI writing ----------
const slim = () => ({ answers: s.answers, drafts: s.drafts });

async function runGen(scr, { feedback } = {}) {
  const previous = s.drafts[scr.id];
  busy = { id: scr.id, text: "", searches: [], phase: "writing" };
  uiError = null;
  panel = null;
  render();
  try {
    const onText = (t) => { busy.text = t; paintStream(); };
    let { text } = await generate({ code, task: scr.task, state: slim(), feedback, previous: feedback ? previous : undefined }, { onText });

    if (scr.words) {
      const [min, max] = scr.words;
      const wc = wordCount(text);
      if (wc < min || wc > max) {
        busy.phase = "polishing";
        busy.text = "";
        paintStream();
        const fix = await generate(
          { code, task: scr.task, state: slim(), previous: text, lengthFix: `This draft is ${wc} words, but it must be between ${min} and ${max} words.` },
          { onText }
        );
        text = fix.text;
      }
    }
    if (!text.trim()) throw new Error("The writer came back empty. Please try again.");
    s.drafts[scr.id] = text.trim();
    delete s.approved[scr.id];
    invalidateAfter(scr.id);
    save(true);
  } catch (err) {
    uiError = { id: scr.id, message: err.message };
  } finally {
    busy = null;
    render();
  }
}

async function runResearch(scr) {
  busy = { id: scr.id, text: "", searches: [], phase: "searching" };
  uiError = null;
  panel = null;
  render();
  try {
    let content = [];
    let text = "";
    for (let pass = 0; pass < 5; pass++) {
      const base = text;
      const r = await generate(
        { code, task: "research", state: slim(), continuation: pass ? content : undefined },
        {
          onText: (t) => { busy.phase = "writing"; busy.text = base + t; paintStream(); },
          onSearch: (q) => { busy.searches.push(q); paintStream(); },
        }
      );
      content = content.concat(r.content);
      text = base + r.text;
      if (r.stopReason !== "pause_turn") break;
    }
    if (!text.trim()) throw new Error("The research came back empty. Please try again.");
    s.drafts.research = text.trim();
    delete s.approved.research;
    invalidateAfter("research");
    save(true);
  } catch (err) {
    uiError = { id: scr.id, message: err.message };
  } finally {
    busy = null;
    render();
  }
}

// Repaint just the streaming area (cheap, throttled) instead of the whole screen.
let paintQueued = false;
function paintStream() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    const out = $("#stream");
    if (out && busy) out.innerHTML = md(busy.text);
    const log = $("#search-log");
    if (log && busy) log.innerHTML = searchLog();
    const st = $("#busy-label");
    if (st && busy) st.textContent = busyLabel(current());
  });
}

function busyLabel(scr) {
  if (busy.phase === "polishing") return "Fine-tuning the length…";
  if (scr.type === "research") return busy.phase === "writing" ? "Writing up what I found…" : "Researching your market…";
  return `Writing ${scr.title.replace(/^Your /, "your ")}…`;
}

function searchLog() {
  const items = [`<li class="ok">Understanding your business</li>`]
    .concat(busy.searches.map((q) => `<li class="ok">Searched: “${esc(q)}”</li>`))
    .concat(busy.phase === "writing" ? [`<li class="ok">Collecting your customers' exact words</li>`] : [`<li class="spin">Looking for real conversations, reviews, and competitors…</li>`]);
  return items.join("");
}

// ---------- Rendering ----------
function render() {
  renderSteps();
  const scr = current();
  const main = $("#screen");
  const fn = { welcome: vWelcome, q: vQuestion, choice: vChoice, form: vForm, gen: vGen, research: vResearch, done: vDone }[scr.type];
  main.innerHTML = fn(scr);
  wire(scr, main);
  const first = main.querySelector("textarea, input[type=text]");
  if (first && (scr.type === "q" || panel)) first.focus({ preventScroll: true });
}

function renderSteps() {
  const scr = current();
  const v = visible();
  const furthest = s.furthest ?? 0;
  $("#steps").innerHTML =
    `<ol>` +
    SECTIONS.map((name, i) => {
      const firstIdx = v.findIndex((x) => x.section === i);
      const state = i < scr.section ? "done" : i === scr.section ? "now" : "todo";
      const reachable = firstIdx > -1 && firstIdx <= furthest && !busy;
      return `<li class="${state}">${reachable && state !== "now" ? `<button data-jump="${v[firstIdx].id}">${esc(name)}</button>` : `<span>${esc(name)}</span>`}</li>`;
    }).join("") +
    `</ol>`;
  $("#mobile-progress").innerHTML = `<span>Step ${scr.section + 1} of ${SECTIONS.length} · ${esc(SECTIONS[scr.section])}</span><div class="bar"><i style="width:${Math.round(((scr.section + (scr.type === "done" ? 1 : 0)) / SECTIONS.length) * 100)}%"></i></div>`;
  document.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => go(b.dataset.jump)));
}

const eyebrow = (scr, extra = "") => `<p class="eyebrow">${esc(SECTIONS[scr.section])}${extra ? ` · ${extra}` : ""}</p>`;
const backBtn = () => `<button class="btn ghost" data-act="back">← Back</button>`;

function qPosition(scr) {
  const group = visible().filter((x) => x.type === "q" && x.section === scr.section);
  return `Question ${group.indexOf(scr) + 1} of ${group.length}`;
}

function vWelcome() {
  return `<section class="card welcome">
    <p class="eyebrow">Welcome</p>
    <h1>Welcome, ${esc(s.clientName.split(" ")[0])}!</h1>
    <p class="lead">I'm excited to help you build your complete Marketing Playbook. I'll do the heavy lifting — you just answer questions in your own words, like you're talking to a friend.</p>
    <div class="what-you-get">
      <h2>By the end, you'll have</h2>
      <ul class="checks">
        <li>Your Brand Voice Profile</li><li>A professional bio</li><li>Real market research on your customers</li>
        <li>A detailed ideal-customer avatar</li><li>Your signature offer</li><li>Sales page copy</li><li>Copy for your Home, About, Services &amp; Contact pages</li>
      </ul>
    </div>
    <p class="note">Plan on about an hour. <strong>Your progress saves automatically</strong> — you can close this page anytime and come back to this same link to pick up where you left off.</p>
    <div class="actions"><span></span><button class="btn primary" data-act="next">Let's begin →</button></div>
  </section>`;
}

function vQuestion(scr) {
  const val = s.answers[scr.key] || "";
  return `<section class="card">
    ${eyebrow(scr, qPosition(scr))}
    ${scr.intro ? `<p class="intro">${esc(scr.intro)}</p>` : ""}
    <h1 class="question">${esc(scr.q)}</h1>
    ${scr.hint ? `<p class="hint">${esc(scr.hint)}</p>` : ""}
    <textarea id="answer" rows="${scr.story ? 9 : 6}" placeholder="Type your answer here…">${esc(val)}</textarea>
    <p class="tip">${scr.story ? "Details and real moments help me catch your voice — the more you share, the better. " : ""}On a phone, you can tap the 🎤 on your keyboard to talk instead of type.</p>
    <div class="actions">
      ${backBtn()}
      <div class="right">
        ${scr.unsure ? `<button class="btn ghost" data-act="unsure">Not sure — you recommend</button>` : ""}
        <button class="btn primary" data-act="answer">Continue →</button>
      </div>
    </div>
  </section>`;
}

function vChoice(scr) {
  const val = s.answers[scr.key];
  return `<section class="card">
    ${eyebrow(scr)}
    <h1 class="question">${esc(scr.q)}</h1>
    ${scr.hint ? `<p class="hint">${esc(scr.hint)}</p>` : ""}
    <div class="choices">
      ${scr.options.map((o) => `<button class="choice ${val === o.v ? "picked" : ""}" data-choice="${esc(o.v)}"><strong>${esc(o.label)}</strong>${o.sub ? `<span>${esc(o.sub)}</span>` : ""}</button>`).join("")}
    </div>
    <div class="actions">${backBtn()}</div>
  </section>`;
}

function field(f, v) {
  const id = `f-${f.key}`;
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : "";
  if (f.type === "text") return `<label class="field" for="${id}"><span>${esc(f.label)}</span>${hint}<input type="text" id="${id}" data-key="${f.key}" value="${esc(v || "")}"></label>`;
  if (f.type === "textarea") return `<label class="field" for="${id}"><span>${esc(f.label)}${f.required ? "" : ""}</span>${hint}<textarea id="${id}" data-key="${f.key}" rows="${f.rows || 4}">${esc(v || "")}</textarea></label>`;
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const otherVal = (list.find((x) => x.startsWith("Other: ")) || "").slice(7);
  const kind = f.type === "checks" ? "checkbox" : "radio";
  return `<fieldset class="field" data-key="${f.key}" data-kind="${kind}"><legend>${esc(f.label)}</legend>${hint}
    <div class="opts">${f.options.map((o) => `<label class="opt"><input type="${kind}" name="${id}" value="${esc(o)}" ${list.includes(o) ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div>
    ${f.other ? `<label class="opt other">Other: <input type="text" data-other value="${esc(otherVal)}"></label>` : ""}
  </fieldset>`;
}

function vForm(scr) {
  const vals = s.answers[scr.key] || {};
  return `<section class="card">
    ${eyebrow(scr)}
    <h1 class="question">${esc(scr.q)}</h1>
    ${scr.hint ? `<p class="hint">${esc(scr.hint)}</p>` : ""}
    <form id="form" class="form" novalidate>${scr.fields(s).map((f) => field(f, vals[f.key])).join("")}</form>
    <p class="form-error" id="form-error" hidden></p>
    <div class="actions">
      ${backBtn()}
      <div class="right">
        ${scr.optional ? `<button class="btn ghost" data-act="skip">Skip — we'll cover it on our call</button>` : ""}
        <button class="btn primary" data-act="form">Continue →</button>
      </div>
    </div>
  </section>`;
}

function errorBox(scr) {
  return uiError && uiError.id === scr.id
    ? `<div class="error"><p>${esc(uiError.message)}</p><button class="btn primary" data-act="retry">Try again</button></div>`
    : "";
}

function reviewPanel(scr, draft) {
  if (panel === "change")
    return `<div class="panel"><label class="field"><span>What would you like changed?</span><small>Be as specific as you like — "make it warmer", "mention my 10 years as a nurse", "shorter opening"…</small><textarea id="feedback" rows="4"></textarea></label>
      <div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="rewrite">Rewrite it</button></div></div>`;
  if (panel === "edit")
    return `<div class="panel"><label class="field"><span>Edit the text directly</span><small>Lines starting with # are headings; words between ** ** are bold.</small><textarea id="edit" rows="18" class="mono">${esc(draft)}</textarea></label>
      <div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-edit">Save my edits</button></div></div>`;
  if (panel === "note")
    return `<div class="panel"><label class="field"><span>Add a note about your customers</span><small>e.g. "Most of my clients are actually over 50" — I'll use this in everything that follows.</small><textarea id="note" rows="4">${esc(s.answers.researchNote || "")}</textarea></label>
      <div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-note">Save note</button></div></div>`;
  return "";
}

function wordBadge(scr, draft) {
  if (!scr.words) return "";
  const wc = wordCount(draft);
  const [min, max] = scr.words;
  const ok = wc >= min && wc <= max;
  return `<span class="badge ${ok ? "" : "warn"}">${wc} words${ok ? "" : ` · target ${min}–${max}`}</span>`;
}

function vGen(scr) {
  const draft = s.drafts[scr.id];
  const tip = typeof scr.tip === "function" ? scr.tip(s) : "";
  if (busy && busy.id === scr.id) {
    return `<section class="card">${eyebrow(scr)}<h1>${esc(scr.title)}</h1>
      <p class="busy"><span class="dots"></span><span id="busy-label">${esc(busyLabel(scr))}</span></p>
      <article class="draft prose streaming" id="stream">${md(busy.text)}</article></section>`;
  }
  if (!draft) {
    return `<section class="card">${eyebrow(scr)}<h1>${esc(scr.title)}</h1>${errorBox(scr)}
      ${uiError ? "" : `<p class="busy"><span class="dots"></span>Getting started…</p>`}
      <div class="actions">${backBtn()}</div></section>`;
  }
  return `<section class="card">
    ${eyebrow(scr)}
    <div class="title-row"><h1>${esc(scr.title)}</h1>${wordBadge(scr, draft)}</div>
    ${errorBox(scr)}
    <article class="draft prose">${md(draft)}</article>
    <div class="review">
      <p class="check">${esc(scr.check)}</p>
      ${tip ? `<p class="hint">${esc(tip)}</p>` : ""}
      ${reviewPanel(scr, draft)}
      ${panel ? "" : `<div class="actions">
        ${backBtn()}
        <div class="right">
          <button class="btn ghost" data-act="edit">Edit it myself</button>
          <button class="btn secondary" data-act="change">Change something</button>
          <button class="btn primary" data-act="approve">${s.approved[scr.id] ? "Continue →" : "Yes, this is me — continue →"}</button>
        </div></div>`}
    </div>
  </section>`;
}

function vResearch(scr) {
  const draft = s.drafts.research;
  if (busy && busy.id === scr.id) {
    return `<section class="card">${eyebrow(scr)}<h1>${esc(scr.title)}</h1>
      <p class="busy"><span class="dots"></span><span id="busy-label">${esc(busyLabel(scr))}</span></p>
      <ul class="search-log" id="search-log">${searchLog()}</ul>
      <p class="note">This usually takes 2–4 minutes. Please keep this page open.</p>
      <article class="draft prose streaming" id="stream">${md(busy.text)}</article></section>`;
  }
  if (!draft) {
    return `<section class="card">
      ${eyebrow(scr)}
      <h1>Let's research your market</h1>
      <p class="lead">Now I'll do real market research on your ideal customers — so your copy uses <em>their</em> words, not guesses.</p>
      <ul class="checks">
        <li>What your customers complain about, in their own words</li>
        <li>What they've already tried that didn't work</li>
        <li>Your top competitors and what they charge</li>
        <li>What makes people ready to buy right now</li>
      </ul>
      <p class="note">It takes about 2–4 minutes. Keep this page open while I work.</p>
      ${errorBox(scr)}
      <div class="actions">${backBtn()}<button class="btn primary" data-act="research">Start my research →</button></div>
    </section>`;
  }
  const note = s.answers.researchNote;
  return `<section class="card">
    ${eyebrow(scr)}
    <h1>${esc(scr.title)}</h1>
    ${errorBox(scr)}
    <article class="draft prose">${md(draft)}</article>
    ${note ? `<div class="note-box"><strong>Your note:</strong> ${esc(note)}</div>` : ""}
    <div class="review">
      <p class="check">Does this match what you know about your customers?</p>
      ${reviewPanel(scr, draft)}
      ${panel ? "" : `<div class="actions">
        ${backBtn()}
        <div class="right">
          <button class="btn ghost" data-act="research">Run the research again</button>
          <button class="btn secondary" data-act="note">${note ? "Edit my note" : "Add a note"}</button>
          <button class="btn primary" data-act="approve">${s.approved.research ? "Continue →" : "Looks right — continue →"}</button>
        </div></div>`}
    </div>
  </section>`;
}

function vDone() {
  return `<section class="card done">
    <p class="eyebrow">All done</p>
    <h1>Congratulations, ${esc(s.clientName.split(" ")[0])}! 🎉</h1>
    <p class="lead">Your Marketing Playbook is complete. ${esc(OWNER_NAME)} has it now and will reach out to set up your Zoom call to start building your website.</p>
    <div class="actions left">
      <button class="btn primary" data-act="word">Download (Word)</button>
      <button class="btn secondary" data-act="print">Print / Save as PDF</button>
      ${backBtn()}
    </div>
  </section>
  <article class="card prose playbook">${md(compilePlaybook(s))}</article>`;
}

// ---------- Events ----------
function wire(scr, root) {
  root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); act(b.dataset.act, scr); }));
  root.querySelectorAll("[data-choice]").forEach((b) =>
    b.addEventListener("click", () => { setAnswer(scr.key, b.dataset.choice, scr.id); next(); })
  );
  const ta = $("#answer", root);
  if (ta) ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) act("answer", scr); });

  // Kick off writing automatically when arriving at a draft screen with nothing yet.
  if (scr.type === "gen" && !s.drafts[scr.id] && !busy && !uiError) runGen(scr);
  if (scr.type === "done" && !s.completedAt) { s.completedAt = Date.now(); save(true); }
}

function act(name, scr) {
  switch (name) {
    case "next": return next();
    case "back": return back();
    case "answer": {
      const v = $("#answer").value.trim();
      if (!v) { $("#answer").classList.add("shake"); setTimeout(() => $("#answer")?.classList.remove("shake"), 400); return; }
      setAnswer(scr.key, v, scr.id);
      return next();
    }
    case "unsure": setAnswer(scr.key, "", scr.id); return next();
    case "form": {
      const out = {};
      scr.fields(s).forEach((f) => {
        if (f.type === "text" || f.type === "textarea") out[f.key] = $(`[data-key="${f.key}"]`).value.trim();
        else {
          const fs = $(`fieldset[data-key="${f.key}"]`);
          const picked = [...fs.querySelectorAll("input:checked")].map((i) => i.value);
          const other = fs.querySelector("[data-other]")?.value.trim();
          if (other) picked.push(`Other: ${other}`);
          out[f.key] = f.type === "radio" ? picked[0] || "" : picked;
        }
      });
      const missing = scr.fields(s).filter((f) => f.required && !out[f.key]);
      if (missing.length) {
        const err = $("#form-error");
        err.textContent = `Please fill in: ${missing.map((f) => f.label).join(", ")}`;
        err.hidden = false;
        return;
      }
      setAnswer(scr.key, out, scr.id);
      return next();
    }
    case "skip": setAnswer(scr.key, { skipped: true }, scr.id); return next();
    case "retry": uiError = null; return scr.type === "research" ? runResearch(scr) : runGen(scr);
    case "research": return runResearch(scr);
    case "approve": s.approved[scr.id] = true; return next();
    case "change": case "edit": case "note": panel = name; return render();
    case "close": panel = null; return render();
    case "rewrite": {
      const fb = $("#feedback").value.trim();
      if (!fb) return;
      return runGen(scr, { feedback: fb });
    }
    case "save-edit": {
      const t = $("#edit").value.trim();
      if (t && t !== s.drafts[scr.id]) { s.drafts[scr.id] = t; delete s.approved[scr.id]; invalidateAfter(scr.id); save(true); }
      panel = null;
      return render();
    }
    case "save-note": {
      setAnswer("researchNote", $("#note").value.trim(), scr.id);
      save(true);
      panel = null;
      return render();
    }
    case "word": return downloadWord(s);
    case "print": return window.print();
  }
}

// ---------- Start ----------
async function start() {
  const main = $("#screen");
  if (!code) {
    main.innerHTML = `<section class="card"><h1>Welcome!</h1><p class="lead">This page needs your personal link. Please use the link ${esc(OWNER_NAME)} sent you.</p></section>`;
    return;
  }
  try {
    s = await loadSession(code);
  } catch (err) {
    main.innerHTML = `<section class="card"><h1>Hmm, that link didn't work</h1><p class="lead">${esc(err.message)}</p></section>`;
    return;
  }
  s.answers ||= {};
  s.drafts ||= {};
  s.approved ||= {};
  if (!s.pos || indexOf(s.pos) < 0) s.pos = "welcome";
  document.title = `${s.clientName} · Marketing Playbook`;
  document.body.classList.add("ready");
  render();
}

start();
