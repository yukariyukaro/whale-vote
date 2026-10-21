# SEO 可发现性迭代记录

正式站：https://whale-vote.pages.dev/  
镜像：https://yukariyukaro.github.io/whale-vote/ （noindex）

## 循环约定

- 频率：Asia/Shanghai 每日 10:00；提醒 ID：schedule-4e650b75-90ee-4716-9755-fcef10248efe。
- 截止：2026-10-29（含）。到期汇报并停止，不自动续期。
- 目标：精确网址/站点查询能找到正式站；至少两条固定非 site 主题查询前 10 条出现正式站，并跨两个不同日期确认。
- 不把直接 Extract、限定域名搜索或 IndexNow 收件回执当作自然搜索排名。
- 不买链接、不刷评论、不做不相关目录链接；不为了索引使用 JobPosting/BroadcastEvent API。
- 每轮最多一项有证据的实质改进；无进展时等待抓取，不反复改标题或重交不变 URL。

## 固定搜索基线

执行：

~~~sh
node scripts/audit-discovery.mjs
~~~

查询保持不变：
1. 鲸鱼娘 投票 site:whale-vote.pages.dev
2. "whale-vote.pages.dev"
3. DeepSeek 鲸鱼娘 B站 评论区 投票
4. DSH 大肥鱼 自动评论 喜欢 不喜欢 投票 网站

原始结果与排序写入 artifacts/seo-audits/<时间>/，不提交抓取内容/个人后台截图。

## 第 1 轮：2026-10-22（Asia/Shanghai）

### 实测，不是检查计数
- Tavily advanced：四条固定查询均未出现正式站。修改后复测仍未出现。
- Google：自动化搜索受异常流量验证影响，无法据此判断索引状态。
- Bing：抽样相关词未出现本站；site 查询返回站外相关结果，不把它当作确定未收录的证据。
- 直接 Tavily Extract 可以读取正文；fresh query 诊断抓取能读到新部署的主题上下文。不是搜索发现成功。

### 本轮措施
- 建立了固定查询测量脚本，避免只改搜索提示词制造成功。
- 在真实、相关、同一维护者的 bilibili-cli README 添加一次披露关系的社区投票链接。外链 commit：https://github.com/yukariyukaro/bilibili-cli/commit/1930d037ac8e30c152b3a067e9a24dbad56ac44f 。没有在第三方论坛/评论区批量发布。
- 首页初始票数用 Pages Functions HTMLRewriter 服务端渲染，同样 HTML 给所有用户与爬虫；不按 UA 差异化，不暴露个人票。初始 HTML 与 API 票数一致（1 / 0），无须 JS 才能读到数值。
- 内部说明页链接对齐 /about，减少 308 跳转；主页面仍保持中立极简和首屏反馈入口。
- 对本次真实内容变化发送 IndexNow，返回 200：通知已收到，不代表索引成功。

### 站长渠道状态
- 系统 Chrome 已有可用 Google 登录，独立窗口打开 URL-prefix 新增界面。
- 已填写 https://whale-vote.pages.dev/，但 UIA SetValue 未触发表单验证；原生键盘后台输入与 DevTools 接入需要额外授权。
- 用户在本次交互选择“现在不方便，先完成其他 SEO 迭代”，因此停止这一步；尚未获取验证标签、尚未证明所有权、尚未提交 GSC sitemap/request indexing。不得宣称完成。
- Bing Webmaster Tools 自动化隔离浏览器未登录，尚未验证站点。

### 下一轮优先级
1. 若所有者完成 GSC URL-prefix 继续操作，取 HTML meta 验证标签、部署验证，再提交 sitemap 和请求索引；不要用会被重定向的 google*.html 验证方式。
2. 检查 IndexNow/Bing 与固定查询的真实变化。
3. 不增加无依据的 SEO 页、隐藏词、llms.txt 或假结构化数据。

## 官方依据
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/search/docs/essentials/spam-policies
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/webmasters/answer/9012289
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- https://www.indexnow.org/documentation
