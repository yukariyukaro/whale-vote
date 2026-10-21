import { tally, type Env } from "./api/_utils";

// The same public snapshot is rendered for readers and crawlers: no bot-specific HTML.
export const onRequest = async (context: {request: Request; env: Env; next: () => Promise<Response>}) => {
  const path = new URL(context.request.url).pathname;
  const response = await context.next();
  if (context.request.method !== "GET" || !["/", "/index.html"].includes(path) || response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) return response;
  try {
    const data = await tally(context.env);
    const left = Number(data.left) || 0, right = Number(data.right) || 0;
    const ratio = left + right ? left / (left + right) * 100 : 50;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-cache");
    headers.delete("Content-Length");
    return new HTMLRewriter()
      .on("#left-count", {element: e => e.setInnerContent(left.toLocaleString("zh-CN"))})
      .on("#right-count", {element: e => e.setInnerContent(right.toLocaleString("zh-CN"))})
      .on("#left-bar", {element: e => e.setAttribute("style", "width:" + ratio.toFixed(2) + "%")})
      .on("#right-bar", {element: e => e.setAttribute("style", "width:" + (100-ratio).toFixed(2) + "%")})
      .on(".results", {element: e => e.setAttribute("aria-label", "当前匿名投票：喜欢 " + left + " 票，不喜欢 " + right + " 票")})
      .transform(new Response(response.body, {status: response.status, headers}));
  } catch (error) {
    console.error("Public tally snapshot unavailable", error);
    return response;
  }
};
