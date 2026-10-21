const cfg = window.SITE_CONFIG || {};
const apiBase = String(cfg.apiBase || "").replace(/\/$/, "");
const turnstileSiteKey = String(cfg.turnstileSiteKey || "");

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  left: 0,
  right: 0,
  total: 0,
  frozen: false,
  voted: null,
  busy: false,
  preview: false,
  turnstileId: null,
  turnstileToken: "",
  turnstileWaiters: [],
};

const els = {
  leftCount: $("#left-count"),
  rightCount: $("#right-count"),
  leftBar: $("#left-bar"),
  rightBar: $("#right-bar"),
  status: $("#status"),
  turnstileWrap: $("#turnstile-wrap"),
  turnstile: $("#turnstile"),
  buttons: $$("button[data-choice]"),
};

function api(path) {
  return (apiBase || "") + path;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", Boolean(isError));
}

function format(n) {
  return Number(n || 0).toLocaleString("zh-CN");
}

function setButtonsDisabled(disabled) {
  for (const btn of els.buttons) {
    btn.disabled = disabled;
  }
}

function render(data) {
  if (!data) return;
  const left = Number(data.left || 0);
  const right = Number(data.right || 0);
  const total = Number(data.total || left + right);
  state.left = left;
  state.right = right;
  state.total = total;
  state.frozen = Boolean(data.frozen);

  els.leftCount.textContent = format(left);
  els.rightCount.textContent = format(right);

  const leftPct = total > 0 ? (left / total) * 100 : 50;
  els.leftBar.style.width = leftPct.toFixed(2) + "%";
  els.rightBar.style.width = (100 - leftPct).toFixed(2) + "%";

  if (state.frozen) {
    setStatus("计票暂时冻结，正在核查异常流量。", true);
    setButtonsDisabled(true);
  }
}

function markVoted(side) {
  state.voted = side;
  for (const btn of els.buttons) {
    const selected = btn.dataset.choice === side;
    btn.classList.toggle("selected", selected);
    btn.disabled = true;
    if (selected) btn.setAttribute("aria-pressed", "true");
  }
}

function resetButtons() {
  for (const btn of els.buttons) {
    btn.disabled = false;
    btn.classList.remove("selected");
    btn.removeAttribute("aria-pressed");
  }
}

async function fetchTally() {
  const res = await fetch(api("/api/tally"), {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("tally_unavailable");
  return res.json();
}

async function refresh() {
  if (state.preview) return;
  try {
    const data = await fetchTally();
    render(data);
    if (!state.voted && !state.busy && !state.frozen) {
      setStatus("选一个更接近你的感受。");
    }
  } catch {
    if (!state.voted && !state.busy) {
      setStatus("票数暂时不可用，请稍后再试。", true);
    }
  }
}

function ensureTurnstile() {
  if (!turnstileSiteKey) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-turnstile]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", () => reject(new Error("turnstile_load")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "1";
    script.addEventListener("load", () => resolve(window.turnstile));
    script.addEventListener("error", () => reject(new Error("turnstile_load")));
    document.head.appendChild(script);
  });
}

function takeTurnstileToken() {
  if (!turnstileSiteKey) return Promise.resolve("");
  if (state.turnstileToken) {
    const token = state.turnstileToken;
    state.turnstileToken = "";
    return Promise.resolve(token);
  }
  if (!window.turnstile || state.turnstileId === null) {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.turnstileWaiters = state.turnstileWaiters.filter((w) => w !== done);
      resolve("");
    }, 15000);
    function done(token) {
      clearTimeout(timer);
      state.turnstileWaiters = state.turnstileWaiters.filter((w) => w !== done);
      resolve(token || "");
    }
    state.turnstileWaiters.push(done);
    try {
      window.turnstile.execute(state.turnstileId);
    } catch {
      done("");
    }
  });
}

async function setupTurnstile() {
  if (!turnstileSiteKey) return;
  try {
    const turnstile = await ensureTurnstile();
    if (!turnstile) return;
    els.turnstileWrap.hidden = false;
    state.turnstileId = turnstile.render(els.turnstile, {
      sitekey: turnstileSiteKey,
      theme: "light",
      size: "flexible",
      appearance: "interaction-only",
      callback: (token) => {
        state.turnstileToken = token;
        const waiters = state.turnstileWaiters.slice();
        state.turnstileWaiters = [];
        for (const waiter of waiters) waiter(token);
      },
      "error-callback": () => {
        const waiters = state.turnstileWaiters.slice();
        state.turnstileWaiters = [];
        for (const waiter of waiters) waiter("");
      },
      "expired-callback": () => {
        state.turnstileToken = "";
      },
    });
  } catch {
    // If Turnstile cannot load, let the server decide (it may be disabled in dev).
    els.turnstileWrap.hidden = true;
  }
}

async function vote(side) {
  if (state.preview) return;
  if (state.busy) return;
  if (state.voted) {
    setStatus("你已经投过了。");
    return;
  }
  if (state.frozen) {
    setStatus("计票暂时冻结，请稍后再来。", true);
    return;
  }

  state.busy = true;
  setButtonsDisabled(true);
  setStatus("正在记录…");

  try {
    const token = await takeTurnstileToken();
    const res = await fetch(api("/api/vote"), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ side, token }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 403 && data.error === "captcha") {
      throw new Error("人机验证没通过，请刷新后再试一次。");
    }
    if (res.status === 429) {
      throw new Error("操作太频繁了，请过一会儿再试。");
    }
    if (res.status === 503 && data.error === "frozen") {
      render(data);
      throw new Error("计票暂时冻结，正在核查异常流量。");
    }
    if (!res.ok) {
      throw new Error("投票失败，请稍后再试。");
    }

    render(data);
    if (data.counted === false) {
      markVoted(side);
      setStatus("你之前已经投过这一票了。");
    } else {
      markVoted(side);
      try { localStorage.setItem("whale_vote_side", side); } catch {}
      setStatus("已记录，谢谢。");
    }
    if (window.turnstile && state.turnstileId !== null) {
      try { window.turnstile.reset(state.turnstileId); } catch {}
      state.turnstileToken = "";
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "投票失败，请稍后再试。", true);
    if (!state.voted) {
      resetButtons();
    }
  } finally {
    state.busy = false;
    if (!state.voted && !state.frozen) {
      setButtonsDisabled(false);
    }
  }
}

function isStaticPreview() {
  if (location.protocol === "file:") return true;
  if (/\.github\.io$/.test(location.hostname) && !apiBase) return true;
  return false;
}

function init() {
  state.preview = isStaticPreview();
  if (state.preview) {
    setStatus("静态预览：投票接口尚未连接。", true);
    setButtonsDisabled(true);
    els.leftCount.textContent = "—";
    els.rightCount.textContent = "—";
    return;
  }

  let saved = null;
  try { saved = localStorage.getItem("whale_vote_side"); } catch {}
  if (saved === "left" || saved === "right") {
    markVoted(saved);
    setStatus("你已经投过了。");
  }

  for (const btn of els.buttons) {
    btn.addEventListener("click", () => vote(btn.dataset.choice));
  }

  setupTurnstile();
  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
}

init();
