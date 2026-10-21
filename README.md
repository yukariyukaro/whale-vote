# 如何评价 B 站评论区扎堆的鲸鱼娘？

一个极简、非官方、匿名的社区投票。页面只有标题、两张分别代表两种感受的插画、两个按钮，以及一个前往 B 站官方反馈论坛的链接。

## 线上地址

- 正式投票（Cloudflare Pages + D1）：https://whale-vote.pages.dev
- 静态预览（GitHub Pages，投票禁用）：https://yukariyukaro.github.io/whale-vote/

## 为什么不是纯静态

纯静态页没法做全站计票，也没法防刷。这个项目用 **Cloudflare Pages Functions + D1**：

- `POST /api/vote`：写/验签名 Cookie、按网络去重、按分钟限频、`INSERT OR IGNORE` 原子去重
- `GET /api/tally`：返回聚合票数和冻结状态
- `GET /api/participation`：返回当前浏览器/网络是否已有票；前端只信这个服务端结果
- `migrations/`：D1 结构变更的唯一入口；`schema.sql` 只是最终结构的参考

GitHub Pages 只能托管静态页，不能运行 Functions；所以本仓库的 GitHub Pages 是**静态预览**，正式投票在 Cloudflare Pages。

投票不需要登录，也没有 CAPTCHA / 人机验证：服务端只凭签名 Cookie、网络标识和限频做匿名去重，前端不加载任何第三方验证脚本。

## 计票规则与边界

每轮投票同时按**浏览器**和**网络**去重：

- **同一浏览器最多一票**：签名 Cookie 保存随机 ID；清 Cookie 或无痕模式会换新 ID。
- **同一网络最多一票**：服务端用 `HMAC(VOTE_SALT, network)` 生成 `network_key`，和 Cookie 一起去重。
  - IPv4 按公网地址；IPv6 按 /64 前缀。
  - 换浏览器、无痕模式或清 Cookie 只会换 Cookie，同一网络仍会被拦。
  - 同一 NAT / CGNAT / 学校 / 公司出口会被当成一个网络，可能误伤同网的其他参与者；共享 VPN / Tor 出口同理。
  - 换网络会换新的网络键：切换 IPv4/IPv6、换一个 /64、使用 VPN / 代理或移动数据，都可能让同一个人投出多票。
  - 因此这不是实名“一人一票”，只是成本更高的匿名去重，无法保证绝对公平。
- **限频**：在未被去重命中时，同一网络每分钟最多 10 次新的投票尝试，第 11 次返回 `429`。这不是每日额度。
- **前端只有两个稳定状态**：未投票、已投票。如果只命中网络去重、没有本浏览器的票，仍属于“已投票”，显示“已经投过票了”且不选中任何一边。“提交中…”只是临时文案；提交结果不明时前端会重新查询 `/api/participation`，不会自动重发投票请求。票数刷新永远不改变参与状态。
- **不要轮换 `VOTE_SALT`**：`network_key` 和 Cookie 签名都由它派生。轮换后旧 Cookie 验签失败、旧去重键失配，等于重新开放投票；迁移 `0002` 也不需要轮换它。

## 数据迁移

- `migrations/0001_init.sql`：**原始 schema**（`votes` 还没有 `network_key`），全部使用 `IF NOT EXISTS` / `INSERT OR IGNORE`。既有库执行时是 no-op，用于补上迁移记录；新库据此建立基线。
- `migrations/0002_network_dedup.sql`：增加 `network_key` 列和部分唯一索引，保留全部旧票。
- 无论新库还是已有生产库，统一使用：

  ```bash
  npx wrangler d1 migrations apply whale-vote --remote
  ```

  本地开发用 `--local`。**不要**再用 `schema.sql` 初始化一个走迁移的库（包括 `npm run db:init` / `db:init:local`，它们会直接执行 `schema.sql`），也不要跳过迁移手工执行 `0002`。
- **迁移前先备份**（`wrangler d1 export`）。已有生产库的具体步骤、检查项和回滚边界见 [DEPLOY.md](./DEPLOY.md)。
- **旧票无法回填**：原始 IP 从未保存，HMAC 也不可逆，旧行的 `network_key` 只能保持 `NULL`。它们照常计入总数，但只受 Cookie 去重，不参与网络去重。
- `schema.sql` 保留为最终结构参考；已有/新库的结构演进以 `migrations/` 和 `d1_migrations` 记录为准。

## 本地开发

```bash
npx wrangler d1 migrations apply whale-vote --local
npm run dev
# http://localhost:8788
```

本地通过 `pages dev` 的 D1 绑定运行，首次启动前先应用 `--local` 迁移。`VOTE_SALT` 需要设置（本地可用任意开发值，不要复用生产盐）；没有 Turnstile、CAPTCHA 或其它验证码需要配置。`.dev.vars` 里残留的 `DEV=1` 是旧开关，当前代码不再读取。

## 部署

见 [DEPLOY.md](./DEPLOY.md)。部署前先备份数据库，并且不要轮换 `VOTE_SALT`。

## SEO 与索引

站点是纯静态 HTML，SEO 只做基础约定，不做内容优化，也不承诺任何搜索表现：

- 每个静态页在 HTML 里写死标题、description、Open Graph 和 `robots` 元信息；正式站使用 `index,follow,max-image-preview:large`。
- `canonical` 指向正式域名（`https://whale-vote.pages.dev/` 等）；`public/sitemap.xml` 只列正式域名下的页面，`public/robots.txt` 指向该 sitemap。
- GitHub Pages 镜像由 `scripts/build-mirror.mjs` 生成：把页面 `robots` 改成 `noindex,follow`、移除 sitemap，并保留指向正式域名的 canonical。它只是静态预览，不作为可索引的正式副本。
- 以上只影响抓取提示，不保证被收录、排序或获得流量；也不要把镜像当作正式副本或为它单独建立收录入口。

## 结构

```
public/            静态页、样式、插画、about、robots/sitemap
functions/api/     Pages Functions
scripts/           镜像构建等辅助脚本
migrations/        D1 迁移（0001 基线，0002 网络去重）
schema.sql         D1 最终结构参考（不要替代迁移）
wrangler.toml      Pages + D1 绑定
```

## 中立性与许可

- 站点不输出“哪种感受更正确”的结论；两张图同角色、同画风、同尺寸。
- 角色形象来自社区二创（原作：上善无形「溟月」；二创：ZipZipPipe 等），CC BY-NC-SA 4.0。
- 插画由 AI 辅助生成；站点不放广告、不商用。
- 非官方，与 DeepSeek、哔哩哔哩无隶属关系。
