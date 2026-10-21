# 部署到 Cloudflare Pages

GitHub Pages 不能运行 Pages Functions。下面的步骤把**静态页 + API + D1**部署到 Cloudflare Pages。

## 0. 前置

- Node.js 22+
- 一个 Cloudflare 账号
- 在仓库根目录执行

## 1. 登录

```bash
npx wrangler login
```

## 2. 创建 D1

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

初始化表：

```bash
npx wrangler d1 execute whale-vote --file=./schema.sql --remote
```

## 3. 创建 Pages 项目

```bash
npx wrangler pages project create whale-vote --production-branch main
```

## 4. 设置 Secrets

```bash
# 随机盐，建议 32 字节以上
npx wrangler pages secret put VOTE_SALT --project-name whale-vote
```

如果要启用 Turnstile：

1. Cloudflare Dashboard → Turnstile → Add widget，domain 填你的 Pages 域名；
2. 把 **Site Key** 填进 `public/config.js` 的 `turnstileSiteKey`；
3. 把 **Secret Key** 写入：

```bash
npx wrangler pages secret put TURNSTILE_SECRET --project-name whale-vote
```

**不要**在 Production 设置 `DEV=1`。

## 5. 部署

```bash
npx wrangler pages deploy public --project-name whale-vote
```

## 6. 验证

- 打开 `https://whale-vote.pages.dev`
- 点一次投票，票数应 +1
- 再点另一边，应提示“已经投过”
- 清 Cookie 后再投，应被 IP 限频逐渐拦住（25 次/天）
- `curl https://whale-vote.pages.dev/api/tally` 返回 JSON

## 7. 冻结计票（可选）

```bash
npx wrangler d1 execute whale-vote --command "UPDATE meta SET value='1' WHERE key='freeze'" --remote
```

解除：

```bash
npx wrangler d1 execute whale-vote --command "UPDATE meta SET value='0' WHERE key='freeze'" --remote
```

## 8. 自定义域名

Cloudflare Dashboard → Pages → whale-vote → Custom domains。国内访问建议测试；Cloudflare 的默认域名在部分网络下可能较慢。

## 备注

- 本站的“一人一票”是“一浏览器一票 + IP 限频”，不是实名制。没有身份绑定就无法保证绝对一人一票；方法页已写明。
- 如果你把 `public/config.js` 的 `apiBase` 指向另一个域名，需要额外处理 CORS 和跨站 Cookie；当前默认同源部署，不需要。
