const cfg = window.SITE_CONFIG || {};
const apiBase = String(cfg.apiBase || "").replace(/\/$/, "");
const buttons = Array.from(document.querySelectorAll("button[data-choice]"));
const status = document.querySelector("#status");
const notice = document.createElement("p");
notice.className = "request-note";
notice.setAttribute("role", "alert");
notice.hidden = true;
status.after(notice);
let hasVoted = false;
let busy = false;
let frozen = false;
let checking = true;

function showNotice(message = "") {
  notice.textContent = message;
  notice.hidden = !message;
}
function syncButtons() {
  for (const button of buttons) button.disabled = checking || busy || hasVoted || frozen;
}
function showState(voted, side = null) {
  hasVoted = voted;
  status.textContent = voted ? "已经投过票了，谢谢参与。" : "选一个更接近你的感受。";
  for (const button of buttons) {
    const selected = voted && button.dataset.choice === side;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  syncButtons();
}
function render(data) {
  const left = Number(data.left || 0), right = Number(data.right || 0);
  document.querySelector("#left-count").textContent = left.toLocaleString("zh-CN");
  document.querySelector("#right-count").textContent = right.toLocaleString("zh-CN");
  const ratio = left + right ? left / (left + right) * 100 : 50;
  document.querySelector("#left-bar").style.width = ratio + "%";
  document.querySelector("#right-bar").style.width = (100 - ratio) + "%";
  frozen = Boolean(data.frozen);
  if (frozen) showNotice("计票暂时暂停，稍后可再来查看。");
  syncButtons();
}
async function refresh() {
  try {
    const response = await fetch(apiBase + "/api/tally", { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) return;
    render(await response.json());
  } catch { /* A tally refresh never changes participation state. */ }
}
async function checkParticipation() {
  const response = await fetch(apiBase + "/api/participation", { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("check_failed");
  const data = await response.json();
  showState(Boolean(data.hasVoted), data.ownSide || null);
}
async function vote(side) {
  if (checking || busy || hasVoted || frozen) return;
  busy = true;
  syncButtons();
  showNotice("");
  const button = buttons.find(b => b.dataset.choice === side);
  const original = button.innerHTML;
  button.textContent = "提交中…";
  try {
    // Re-check in case another browser on this network has already voted.
    await checkParticipation().catch(() => {});
    if (hasVoted) return;
    button.textContent = "提交中…";
    const response = await fetch(apiBase + "/api/vote", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ side }), signal: AbortSignal.timeout(20000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error("submit_failed");
    render(data);
    showState(true, data.counted ? side : null);
  } catch {
    // Unknown delivery is reconciled with the server, never automatically re-posted.
    try { await checkParticipation(); } catch { /* Retain last confirmed state. */ }
    if (!hasVoted) showNotice("本次尚未确认计票，请稍后重试。");
  } finally {
    button.innerHTML = original;
    busy = false;
    syncButtons();
  }
}
async function init() {
  if (location.protocol === "file:" || (/\.github\.io$/.test(location.hostname) && !apiBase)) {
    status.textContent = "静态预览，请前往正式投票。";
    document.querySelector("#preview-note").hidden = false;
    buttons.forEach(b => b.disabled = true);
    return;
  }
  // Ignore obsolete local flags; only the server can confirm an existing ballot.
  try { localStorage.removeItem("whale_vote_side"); } catch {}
  showState(false);
  buttons.forEach(b => b.addEventListener("click", () => vote(b.dataset.choice)));
  await Promise.all([refresh(), checkParticipation().catch(() => {})]);
  checking = false;
  syncButtons();
  setInterval(() => { if (!document.hidden) refresh(); }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { refresh(); if (!busy) checkParticipation().catch(() => {}); }
  });
}
init();