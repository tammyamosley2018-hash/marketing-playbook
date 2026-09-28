// Where the Cloudflare Worker lives. Local testing uses `wrangler dev` on :8787.
export const API_BASE = location.hostname === "localhost" ? "http://localhost:8787" : "https://marketing-playbook.marketing-playbook-worker.workers.dev";

// Who the finished playbook goes to (shown to clients).
export const OWNER_NAME = "Tammy";
