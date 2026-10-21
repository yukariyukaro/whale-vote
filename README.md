# 如何评价 B 站评论区扎堆的鲸鱼娘？

一个极简、非官方、匿名的社区投票。页面只有标题、两张分别代表两种感受的插画、两个按钮，以及一个前往 B 站官方反馈论坛的链接。

## 线上地址

- 正式投票（Cloudflare Pages + D1 + Turnstile）：https://whale-vote.pages.dev
- 静态预览（GitHub Pages，投票禁用）：https://yukariyukaro.github.io/whale-vote/

## 为什么不是纯静态

纯静态页没法做全站计票，也没法防刷。这个项目用 **Cloudflare Pages Functions + D1**：

- `POST /api/vote`：校验 Turnstile、写 Cookie、按 IP/天限频、`INSERT OR IGNORE` 去重
- `GET /api/tally`：返回聚合票数和冻结状态
- `schema.sql`：`votes` / `rate` / `meta` 三张表

GitHub Pages 只能托管静态页，不能运行 Functions；所以本仓库的 GitHub Pages 是**静态预览**，正式投票在 Cloudflare Pages。

## 本地开发

```bash
npm run dev
# http://localhost:8788
```

本地默认使用 `.dev.vars` 里的 `DEV=1` 和内存计数，不依赖 D1；Turnstile 在本地默认关闭。生产环境不要设置 `DEV=1`。

## 部署

见 [DEPLOY.md](./DEPLOY.md)。

## 结构

```
public/            静态页、样式、插画、about
functions/api/     Pages Functions
schema.sql         D1 表结构
wrangler.toml      Pages + D1 绑定
```

## 中立性与许可

- 站点不输出“哪种感受更正确”的结论；两张图同角色、同画风、同尺寸。
- 角色形象来自社区二创（原作：上善无形「溟月」；二创：ZipZipPipe 等），CC BY-NC-SA 4.0。
- 插画由 AI 辅助生成；站点不放广告、不商用。
- 非官方，与 DeepSeek、哔哩哔哩无隶属关系。
