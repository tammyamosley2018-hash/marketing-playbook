// Turns approved drafts into the finished Marketing Playbook and handles downloads.
/* global marked, DOMPurify */

export function md(text) {
  return DOMPurify.sanitize(marked.parse(text || "", { gfm: true, breaks: false }), { ADD_ATTR: ["target"] });
}

export function wordCount(text) {
  return (text || "").replace(/[#*_>`\[\]()|-]/g, " ").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

// Push every markdown heading down `by` levels so a draft nests under its section title.
const demote = (text, by = 1) => (text || "").replace(/^(#{1,5}) /gm, (_, h) => "#".repeat(Math.min(6, h.length + by)) + " ");

const PREZOOM_LABELS = {
  sites: "Websites they love",
  colors: "Colors",
  logo: "Has a logo",
  photos: "Has photos",
  domain: "Domain",
  notes: "Other notes",
};

export function compilePlaybook(s) {
  const d = s.drafts || {};
  const parts = [`# ${s.clientName}'s Marketing Playbook`];
  const add = (title, body) => { if (body && body.trim()) parts.push(`## ${title}\n\n${demote(body, 2)}`); };

  add("Brand Voice Profile", d.brandVoice);
  add("Business Description", d.business);
  add("Professional Bio", d.bio);
  const note = s.answers?.researchNote?.trim();
  add("Target Market Research Insights", d.research + (note ? `\n\n**Note from ${s.clientName}:** ${note}` : ""));
  add("Ideal Customer Avatar", d.avatar);
  add("Signature Offer", d.offer);
  add("Sales Page Copy", d.salesPage);
  add("Services Offered", d.services);
  add("Website Copy", d.website);

  const pz = s.answers?.prezoom;
  if (pz && !pz.skipped) {
    const lines = Object.entries(PREZOOM_LABELS)
      .map(([k, label]) => [label, Array.isArray(pz[k]) ? pz[k].join(", ") : pz[k]])
      .filter(([, v]) => v && String(v).trim())
      .map(([label, v]) => `- **${label}:** ${v}`);
    if (lines.length) parts.push(`## Website Wish List (for our Zoom call)\n\n${lines.join("\n")}`);
  }
  return parts.join("\n\n---\n\n");
}

const fileName = (s, ext) => `${(s.clientName || "Client").replace(/[^\w\s-]/g, "").trim()} Marketing Playbook.${ext}`;

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function downloadWord(s) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${fileName(s, "")}</title>
<style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.5;color:#201B18}h1,h2,h3,h4{font-family:Georgia,serif;color:#3E2513}h1{font-size:24pt}h2{font-size:18pt;margin-top:24pt}h3{font-size:14pt}h4{font-size:12pt}hr{border:none;border-top:1px solid #d9cfc7}</style>
</head><body>${md(compilePlaybook(s))}</body></html>`;
  download(fileName(s, "doc"), new Blob(["﻿", html], { type: "application/msword" }));
}

export function downloadMarkdown(s) {
  download(fileName(s, "md"), new Blob([compilePlaybook(s)], { type: "text/markdown" }));
}
