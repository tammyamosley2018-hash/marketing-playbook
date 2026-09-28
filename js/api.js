import { API_BASE } from "./config.js";

async function call(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const loadSession = (code) => call(`/api/s/${encodeURIComponent(code)}`);
export const saveSession = (code, state) =>
  call(`/api/s/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(state) });

export const admin = (pw) => {
  const h = { "X-Admin-Password": pw };
  return {
    list: () => call("/api/admin/clients", { headers: h }),
    create: (name, notes) => call("/api/admin/clients", { method: "POST", headers: h, body: JSON.stringify({ name, notes }) }),
    get: (code) => call(`/api/admin/clients/${encodeURIComponent(code)}`, { headers: h }),
    remove: (code) => call(`/api/admin/clients/${encodeURIComponent(code)}`, { method: "DELETE", headers: h }),
  };
};

// Streams one AI draft. Calls onText(fullTextSoFar) as words arrive and
// onSearch(query) each time web research runs a search. Resolves with
// { text, stopReason, content } where content is the raw assistant blocks
// (needed to resume a paused research turn).
export async function generate(body, { onText, onSearch, signal } = {}) {
  const res = await fetch(API_BASE + "/api/gen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `The writer couldn't start (${res.status}). Please try again.`);
  }

  const blocks = [];
  const partialJson = {};
  let stopReason = null;
  let buffer = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const visibleText = () => {
    // If a fallback model took over, only its text counts.
    let start = 0;
    blocks.forEach((b, i) => { if (b && b.type === "fallback") start = i + 1; });
    return blocks.slice(start).filter((b) => b && b.type === "text").map((b) => b.text).join("");
  };

  const handle = (event, data) => {
    if (event === "error") throw new Error(data?.error?.type === "overloaded_error" ? "The AI is busy right now. Please wait a minute and try again." : "The writer hit a problem. Please try again.");
    if (data.type === "content_block_start") {
      const b = structuredClone(data.content_block);
      if (b.type === "text") b.text = b.text || "";
      if (b.type === "thinking") b.thinking = b.thinking || "";
      blocks[data.index] = b;
      if (b.type === "server_tool_use" || b.type === "tool_use") partialJson[data.index] = "";
    } else if (data.type === "content_block_delta") {
      const b = blocks[data.index];
      const d = data.delta;
      if (!b) return;
      if (d.type === "text_delta") { b.text += d.text; onText?.(visibleText()); }
      else if (d.type === "input_json_delta") partialJson[data.index] += d.partial_json;
      else if (d.type === "thinking_delta") b.thinking += d.thinking;
      else if (d.type === "signature_delta") b.signature = d.signature;
      else if (d.type === "citations_delta") (b.citations ||= []).push(d.citation);
    } else if (data.type === "content_block_stop") {
      const b = blocks[data.index];
      if (b && data.index in partialJson) {
        try { b.input = JSON.parse(partialJson[data.index] || "{}"); } catch { b.input = {}; }
        if (b.type === "server_tool_use" && b.name === "web_search" && b.input.query) onSearch?.(b.input.query);
      }
    } else if (data.type === "message_delta") {
      if (data.delta?.stop_reason) stopReason = data.delta.stop_reason;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = "message";
      let dataLine = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (dataLine) handle(event, JSON.parse(dataLine));
    }
  }

  if (stopReason === "refusal") throw new Error("The writer couldn't complete this one. Try “Change something” and rephrase, or try again.");
  const content = blocks.filter(Boolean);
  return { text: visibleText(), stopReason, content };
}
