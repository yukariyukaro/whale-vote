import {
  type Env,
  json,
  hmac,
  ipOf,
  getOrCreateVoter,
  verifyTurnstile,
  tally,
  isFrozen,
  bumpRate,
  recordVote,
} from "./_utils";

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const side = body && body.side;
  if (side !== "left" && side !== "right") {
    return json({ error: "bad_side" }, 400);
  }

  let current: any;
  try {
    current = await tally(env);
  } catch {
    return json({ error: "db_unavailable" }, 500);
  }
  if (current.frozen || (await isFrozen(env).catch(() => false))) {
    return json({ error: "frozen", ...current }, 503);
  }

  const ip = ipOf(request);
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(body && body.token, env.TURNSTILE_SECRET, ip);
    if (!ok) return json({ error: "captcha" }, 403);
  }

  const voter = await getOrCreateVoter(request, env);
  const secret = env.VOTE_SALT || "dev-only-salt-change-me";
  const headers: Record<string, string> = {};
  if (voter.setCookie) headers["set-cookie"] = voter.setCookie;

  const day = new Date().toISOString().slice(0, 10);
  const rateKey = await hmac(secret, "rate:" + ip + ":" + day);
  let rateCount = 0;
  try {
    rateCount = await bumpRate(env, rateKey, Date.now());
  } catch {
    return json({ error: "db_unavailable" }, 500, headers);
  }
  if (rateCount > 25) {
    return json({ error: "rate_limited" }, 429, headers);
  }

  const voterId = await hmac(secret, "voter:" + voter.id);
  const country = (request as any).cf && (request as any).cf.country ? String((request as any).cf.country) : "";
  let counted = false;
  try {
    counted = await recordVote(env, voterId, side, country);
  } catch {
    return json({ error: "db_unavailable" }, 500, headers);
  }

  const data = await tally(env).catch(() => current);
  return json({ ok: true, counted, ...data }, 200, headers);
};
