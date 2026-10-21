// Public runtime configuration. No secrets here.
window.SITE_CONFIG = {
  // Leave empty when the site and /api are on the same origin (Cloudflare Pages).
  // On a static-only mirror (GitHub Pages) set this to the Cloudflare Pages origin.
  apiBase: "",
  // Cloudflare Turnstile site key. Empty string = no widget (local/dev only).
  turnstileSiteKey: "0x4AAAAAAFfPVqZWDfkX36Je",
  // Official Bilibili feedback forum.
  feedbackUrl: "https://www.bilibili.com/blackboard/activity-GBnHKZEX.html",
  productionUrl: "https://whale-vote.pages.dev"
};
