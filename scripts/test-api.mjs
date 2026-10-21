
const base = "http://127.0.0.1:8788";
async function main() {
  let r = await fetch(base + "/api/tally");
  console.log("tally0", r.status, await r.text());
  r = await fetch(base + "/api/vote", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({side:"left"})});
  const cookie = (r.headers.getSetCookie?.() || [])[0] || "";
  console.log("vote1", r.status, await r.text());
  console.log("cookie", cookie.slice(0, 60) + "...");
  r = await fetch(base + "/api/vote", {method:"POST", headers:{"content-type":"application/json", cookie: cookie.split(";")[0]}, body: JSON.stringify({side:"right"})});
  console.log("vote2", r.status, await r.text());
  r = await fetch(base + "/api/tally");
  console.log("tally1", r.status, await r.text());
}
main().catch(e => { console.error(e); process.exit(1); });
