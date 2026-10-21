import { type Env, json, tally } from "./_utils";

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    const data = await tally(env);
    return json(data);
  } catch (error) {
    console.error("tally failed", error);
    return json({ error: "db_unavailable" }, 500);
  }
};
