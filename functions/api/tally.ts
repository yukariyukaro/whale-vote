import { type Env, json, tally } from "./_utils";

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    const data = await tally(env);
    return json(data);
  } catch {
    return json({ error: "db_unavailable" }, 500);
  }
};
