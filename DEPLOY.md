# 部署到 Cloudflare Pages

GitHub Pages 不能运行 Pages Functions。下面的步骤把**静态页 + API + D1**部署到 Cloudflare Pages。

> 迁移安全底线：
> - 先备份，再执行 `d1 migrations apply`。
> - 新库和已有生产库都走 `d1 migrations apply`，不要用 `schema.sql` 代替迁移。
> - 上线后**不要轮换 `VOTE_SALT`**，迁移 `0002` 也不需要轮换。
> - **先迁移数据库，再部署新代码**：新代码会读写 `network_key`。
> - 不把备份、`.dev.vars`、Secret 提交进仓库。

## 0. 前置

- Node.js 22+
- 一个 Cloudflare 账号
- 在仓库根目录执行

## 1. 登录

```bash
npx wrangler login
```

## 2. 创建 D1

已有生产库可跳过创建，直接看第 3 节。

```bash
npx wrangler d1 create whale-vote
```

把输出里的 `database_id` 填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "whale-vote"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 3. 应用数据库迁移

迁移文件：

- `migrations/0001_init.sql`：原始 schema，全部 `IF NOT EXISTS` / `INSERT OR IGNORE`；对已有库是 no-op，对空库建立基线。
- `migrations/0002_network_dedup.sql`：增加 `network_key` 列和部分唯一索引，不改动、不删除旧票。

### 3.1 已有生产库（当前 `votes` 表没有 `network_key`）

先备份到仓库上一级目录，避免把含数据的 SQL 误提交：

```bash
npx wrangler d1 export whale-vote --remote --output=../whale-vote-backup-before-0002.sql
```

确认当前结构（应只有 `voter_id` / `side` / `created_at` / `country`，**没有** `network_key`）：

```bash
npx wrangler d1 execute whale-vote --remote --command "PRAGMA table_info(votes);"
```

查看待执行迁移（预期 `0001` 和 `0002` 都是 pending）：

```bash
npx wrangler d1 migrations list whale-vote --remote
```

应用迁移：

```bash
npx wrangler d1 migrations apply whale-vote --remote
```

迁移期间数据库可能短暂不可用，建议选低峰执行，并等迁移完成后再发布新代码。

执行过程：

1. `0001` 的所有语句都是 `IF NOT EXISTS`，对已有表是 no-op，只补上 `d1_migrations` 记录。
2. `0002` 给 `votes` 加 `network_key`，再建 `WHERE network_key IS NOT NULL` 的部分唯一索引。
3. 每个迁移在事务中执行；失败会回滚该迁移，之前成功的迁移保持已应用。不要在中途强制中断。

迁移后验证：

```bash
npx wrangler d1 execute whale-vote --remote --command "PRAGMA table_info(votes);"
npx wrangler d1 execute whale-vote --remote --command "SELECT id, name FROM d1_migrations ORDER BY id;"
npx wrangler d1 execute whale-vote --remote --command "SELECT COUNT(*) AS legacy_rows FROM votes WHERE network_key IS NULL;"
```

预期：`votes` 出现 `network_key`；ledger 中有 `0001_init.sql`、`0002_network_dedup.sql`；旧票的 `network_key` 为 `NULL`。

**如果 `PRAGMA` 显示 `network_key` 已存在但 ledger 为空**：说明有人手工执行过新版 `schema.sql` 或 `0002`。此时不要再跑 `migrations apply`（`0002` 会因重复列失败）。先停下核对，用备份恢复或人工对齐 `d1_migrations` 后再继续；不要重复执行 `ALTER TABLE`。

### 3.2 全新数据库

```bash
npx wrangler d1 migrations apply whale-vote --remote
```

新库会按顺序执行 `0001` → `0002`，最终结构与 `schema.sql` 一致。

**不要先用 `schema.sql` 初始化新库**：新版 `schema.sql` 已包含 `network_key`，再跑 `0002` 会因重复列失败，且 ledger 与真实结构不一致。`schema.sql` 只作为最终结构参考。

`package.json` 里的 `db:init` / `db:init:local` 仍会直接执行 `schema.sql`；不要用它们初始化或升级走迁移的库，结构变更只走 `d1 migrations apply`。

### 3.3 本地开发库

```bash
npx wrangler d1 migrations apply whale-vote --local
```

然后在 `npm run dev` 前确认本地 D1 已迁移。

## 4. 创建 Pages 项目

```bash
npx wrangler pages project create whale-vote --production-branch main
```

## 5. 设置 Secrets

### VOTE_SALT

只设置一次，之后**不要轮换**：

```bash
npx wrangler pages secret put VOTE_SALT --project-name whale-vote
```

- `network_key` 由 `HMAC(VOTE_SALT, network)` 生成，Cookie 签名也用它。
- 轮换后：旧 Cookie 全部验签失败（每个人变成新 voter），旧 `network_key` 无法匹配（同一网络可再次投票）。效果等于重新开放投票。
- 迁移 `0002` 不需要轮换盐；旧票回填不了，也不要为了“让旧票参与去重”而换盐。
- 用 32 字节以上的随机值，存在密码管理器或 Cloudflare Secret 中；不要写进仓库或 `.dev.vars` 的提交版本。

### 验证码（无 Turnstile）

本项目不接入 Turnstile 或任何第三方人机验证：没有 Site Key、Secret、前端脚本或 `DEV` 开关需要配置。反滥用只靠服务端签名 Cookie、网络去重、每分钟限频和冻结开关。

旧部署如果设置过 `TURNSTILE_SECRET`，代码已不再读取，可以删除（可选）：

```bash
npx wrangler pages secret delete TURNSTILE_SECRET --project-name whale-vote
```

## 6. 部署

```bash
npx wrangler pages deploy public --project-name whale-vote
```

## 7. 验证

- 打开 `https://whale-vote.pages.dev`
- 点一次投票，票数应 +1
- 再点另一边或刷新，应提示“已经投过票了”；无痕窗口在同一网络下也应如此
- 页面只有**两个稳定状态**：未投票、已投票；“提交中…”只是临时文案，结果不明时前端会重新查询 `/api/participation`，不会自动重发 POST
- 同一网络在未被去重命中时，每分钟最多 10 次新投票尝试，第 11 次返回 `429`；全程没有验证码和登录步骤
- `curl https://whale-vote.pages.dev/api/tally` 返回 JSON
- `curl https://whale-vote.pages.dev/api/participation` 返回当前网络/浏览器的参与状态
- `https://whale-vote.pages.dev/sitemap.xml` 只含正式域名 URL，`robots.txt` 指向它

## 8. 冻结计票（可选）

```bash
npx wrangler d1 execute whale-vote --command "UPDATE meta SET value='1' WHERE key='freeze'" --remote
```

解除：

```bash
npx wrangler d1 execute whale-vote --command "UPDATE meta SET value='0' WHERE key='freeze'" --remote
```

## 9. 自定义域名

Cloudflare Dashboard → Pages → whale-vote → Custom domains。国内访问建议测试；Cloudflare 的默认域名在部分网络下可能较慢。

换域名时同步更新 `public/index.html` 与 `public/about.html` 的 canonical、`og:image`、`public/config.js` 的 `productionUrl`、`public/sitemap.xml` 和 `public/robots.txt` 里的绝对 URL；否则抓取提示仍指向 `whale-vote.pages.dev`。GitHub Pages 镜像继续由 `scripts/build-mirror.mjs` 构建为 noindex 预览，不要给它配置 canonical。这些只是静态元数据，不承诺收录或排名。

## 备注：去重口径与已知边界

- **旧票无法回填**：原始 IP 从未保存，`HMAC` 也不可逆。已有行的 `network_key` 只能是 `NULL`，仍计入总票数，但不参与网络去重，只受 Cookie 去重。部分唯一索引允许任意多条 `NULL`，不会阻塞迁移。
- **IPv4 按公网地址、IPv6 按 /64**：同一 NAT / CGNAT / 学校 / 公司出口可能被当成一个人，误伤同网其他参与者；IPv6 一个 /64 通常覆盖整个家庭或移动终端网段。
- **VPN / 代理可以绕过，也会误伤**：一个人可借多个出口投出多票；共享 VPN/Tor 出口又会把无关用户拦在同一票之外。
- **不是实名一人一票**：这是“Cookie + 网络 + 限频 + 冻结开关”的成本约束，没有登录和 CAPTCHA；无法保证绝对公平，也不能当作统计抽样。
- **限频是每分钟 10 次**，按网络和自然分钟做 HMAC 分桶，不是每日额度，也不会因为清 Cookie 重置网络桶。
- **前端只有两个稳定状态**，见第 7 节；不要基于“提交中”这类临时文案做运维判断。
- **不要提交**：`../whale-vote-backup-before-0002.sql`、`.dev.vars`、任何 Secret 或导出数据。
- 如果你把 `public/config.js` 的 `apiBase` 指向另一个域名，需要额外处理 CORS 和跨站 Cookie；当前默认同源部署，不需要。
