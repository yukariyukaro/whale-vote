export interface Env {
  DB?: any;
  TURNSTILE_SECRET?: string;
  VOTE_SALT?: string;
  DEV?: string;
}

const encoder = new TextEncoder();
const DEV_SALT = "dev-only-salt-change-me";

const memory: any = (globalThis as any).__whaleVoteMemory || ((globalThis as any).__whaleVoteMemory = {
  votes: new Map<string, string>(),
  rate: new Map<string, number>(),
  freeze: false,
});

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url(new Uint8Array(sig));
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function ipOf(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export async function getOrCreateVoter(request: Request, env: Env): Promise<{ id: string; setCookie: string | null }> {
  const secret = env.VOTE_SALT || DEV_SALT;
  const raw = parseCookies(request)["whale_voter"];
  if (raw) {
    const dot = raw.lastIndexOf(".");
    if (dot > 0) {
      const id = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      if (id.length >= 16 && (await hmac(secret, id)) === sig) {
        return { id, setCookie: null };
      }
    }
  }
  const id = randomHex(16);
  const sig = await hmac(secret, id);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    setCookie: `whale_voter=${id}.${sig}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=31536000`,
  };
}

export async function verifyTurnstile(token: string | undefined, secret: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data: any = await res.json();
    return data && data.success === true;
  } catch {
    return false;
  }
}

function isDev(env: Env): boolean {
  return env.DEV === "1";
}

function memoryTally(): any {
  let left = 0;
  let right = 0;
  for (const side of memory.votes.values()) {
    if (side === "left") left++;
    else if (side === "right") right++;
  }
  return { left, right, total: left + right, frozen: Boolean(memory.freeze), updatedAt: Date.now() };
}

export async function tally(env: Env): Promise<any> {
  if (!env.DB) {
    if (isDev(env)) return memoryTally();
    throw new Error("db_unavailable");
  }
  try {
    const rows: any = await env.DB.prepare("SELECT side, COUNT(*) AS n FROM votes GROUP BY side").all();
    let left = 0;
    let right = 0;
    for (const row of rows.results || []) {
      if (row.side === "left") left = Number(row.n) || 0;
      if (row.side === "right") right = Number(row.n) || 0;
    }
    const meta: any = await env.DB.prepare("SELECT value FROM meta WHERE key = 'freeze'").first();
    return {
      left,
      right,
      total: left + right,
      frozen: Boolean(meta && meta.value === "1"),
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (isDev(env)) {
      console.error("D1 tally failed in dev; using memory", err);
      return memoryTally();
    }
    throw err;
  }
}

export async function isFrozen(env: Env): Promise<boolean> {
  if (!env.DB) return isDev(env) ? Boolean(memory.freeze) : false;
  try {
    const meta: any = await env.DB.prepare("SELECT value FROM meta WHERE key = 'freeze'").first();
    return Boolean(meta && meta.value === "1");
  } catch (err) {
    if (isDev(env)) {
      console.error("D1 freeze check failed in dev; using memory", err);
      return Boolean(memory.freeze);
    }
    throw err;
  }
}

function memoryBumpRate(key: string): number {
  const next = (memory.rate.get(key) || 0) + 1;
  memory.rate.set(key, next);
  return next;
}

export async function bumpRate(env: Env, key: string, now: number): Promise<number> {
  if (!env.DB) {
    if (!isDev(env)) throw new Error("db_unavailable");
    return memoryBumpRate(key);
  }
  try {
    await env.DB.prepare(
      "INSERT INTO rate (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1",
    ).bind(key, now).run();
    const row: any = await env.DB.prepare("SELECT count FROM rate WHERE key = ?").bind(key).first();
    return Number(row && row.count) || 1;
  } catch (err) {
    if (isDev(env)) {
      console.error("D1 rate bump failed in dev; using memory", err);
      return memoryBumpRate(key);
    }
    throw err;
  }
}

function memoryRecordVote(voterId: string, side: string): boolean {
  if (memory.votes.has(voterId)) return false;
  memory.votes.set(voterId, side);
  return true;
}

export async function recordVote(env: Env, voterId: string, side: string, country: string): Promise<boolean> {
  if (!env.DB) {
    if (!isDev(env)) throw new Error("db_unavailable");
    return memoryRecordVote(voterId, side);
  }
  try {
    const res: any = await env.DB.prepare(
      "INSERT OR IGNORE INTO votes (voter_id, side, created_at, country) VALUES (?, ?, ?, ?)",
    ).bind(voterId, side, Date.now(), country).run();
    return Boolean(res && res.meta && res.meta.changes === 1);
  } catch (err) {
    if (isDev(env)) {
      console.error("D1 vote insert failed in dev; using memory", err);
      return memoryRecordVote(voterId, side);
    }
    throw err;
  }
}
