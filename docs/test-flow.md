# SeedDrop 测试流程（TypeScript 版）

发布到 ClawHub 前的完整验证清单。

---

## 一、环境准备

### 1.1 依赖检查

```bash
# 必须安装
node --version    # Node 18+（推荐 24+）
npx tsx --version # TypeScript 执行器

# 安装项目依赖
cd seedDrop && npm install
```

### 1.2 目录初始化

确认以下文件/目录存在（首次安装后）：
- [ ] `SKILL.md` 存在且 frontmatter 可解析
- [ ] `package.json` 存在且 `npm install` 成功
- [ ] `scripts/types.ts` 类型文件存在
- [ ] `scripts/` 下所有 .ts 文件可通过 `npx tsx` 执行
- [ ] `memory/brand-profile.md` 存在（模板状态）
- [ ] `memory/blacklist.md` 存在
- [ ] `templates/` 下有 reply-reddit.md, reply-x.md, reply-xiaohongshu.md
- [ ] `references/` 下有 safety-rules.md, scoring-criteria.md, platform-tos-notes.md

---

## 二、Auth Bridge 测试

### 2.1 SocialVault 检测

```bash
npx tsx scripts/auth-bridge.ts mode
# 预期输出: "local" 或 "socialvault"
```

**验证项：**
- [ ] 无 SocialVault 时输出 `local`
- [ ] 有 SocialVault 时输出 `socialvault`

### 2.2 本地凭证管理

```bash
# 添加测试凭证
npx tsx scripts/auth-bridge.ts add reddit reddit-test
# 按提示输入 authType 和 credential

# 列出凭证
npx tsx scripts/auth-bridge.ts list
# 预期: 显示 reddit-test 条目（凭证值脱敏）

# 获取凭证
npx tsx scripts/auth-bridge.ts get reddit reddit-test
# 预期: JSON 格式 Credential 对象
```

**验证项：**
- [ ] `config/accounts.json` 被自动创建
- [ ] 凭证正确存储和读取
- [ ] 无凭证时返回 `{"error":"no_credential"}`
- [ ] 输出的 Credential 对象包含 authType、value、source 字段

### 2.3 指纹请求

```bash
npx tsx scripts/auth-bridge.ts fingerprint reddit-test
# 无 SocialVault: {"source":"none"}
# 有 SocialVault: {"source":"socialvault","fingerprint":{...}}
```

---

## 三、平台适配器测试

### 3.1 适配器加载

```bash
# 各适配器自测
npx tsx scripts/adapters/reddit.ts test
npx tsx scripts/adapters/x-twitter.ts test
npx tsx scripts/adapters/xiaohongshu.ts test
# 预期: {"adapter":"<name>","status":"ok","platformId":"...","platformName":"...","rateLimit":{...}}
```

**验证项：**
- [ ] 三个适配器均返回 status: ok
- [ ] rateLimit 字段包含合理的频率限制值
- [ ] 模板适配器可加载: `npx tsx scripts/adapters/_template.ts test`

### 3.2 Reddit 搜索（需真实凭证）

```bash
npx tsx scripts/adapters/reddit.ts search "food photography" day "Bearer YOUR_TOKEN" "FoodPhotography"
# 预期: JSON 数组输出
```

**验证项：**
- [ ] 返回 Post[] JSON 数组
- [ ] 每个 Post 包含 id, url, title, body, author, createdAt, platform 字段
- [ ] platform 字段值为 "reddit"
- [ ] 无效 token 时返回空数组 + stderr 错误信息

### 3.3 Reddit 凭证检查（需真实凭证）

```bash
npx tsx scripts/adapters/reddit.ts check "Bearer YOUR_TOKEN"
# 预期: {"valid":true,"username":"your_username"}
```

### 3.4 X/Twitter & 小红书

```bash
# X API 模式
npx tsx scripts/adapters/x-twitter.ts search "keyword" day "Bearer YOUR_X_TOKEN"

# X Cookie 模式（返回 browser 指令）
npx tsx scripts/adapters/x-twitter.ts search "keyword" day "auth_token=abc; ct0=def"

# 小红书（始终 browser 模式）
npx tsx scripts/adapters/xiaohongshu.ts search "keyword" day "session_cookie_value"
```

**验证项：**
- [ ] API 模式正确调用 API 并返回 Post[]
- [ ] Cookie 模式返回 browser 指令（`id === '__browser_instruction__'`）
- [ ] 小红书始终返回 browser 指令

---

## 四、评分引擎测试

### 4.1 基础评分

```bash
echo '{"id":"t3_test1","title":"How to improve food photos for delivery apps?","body":"Looking for tips","author":"testuser","createdAt":"2026-03-16T10:00:00Z","platform":"reddit","subreddit":"FoodPhotography"}' | npx tsx scripts/scorer.ts 0.5

# 预期: 输出包含 scores 字段的 JSON
```

**验证项：**
- [ ] 高相关度帖子获得高分 (> 0.7)
- [ ] 包含求助关键词的帖子 intent 评分高
- [ ] 新鲜帖子（< 2h）freshness 为 1.0
- [ ] 包含 "mod" "announcement" 的帖子 risk 评分低
- [ ] 低于阈值的帖子被过滤（无输出）
- [ ] 浮点运算全部使用 TypeScript 原生，无需 bc/awk

### 4.2 阈值过滤

```bash
# 低阈值 — 应通过更多帖子
echo '...' | npx tsx scripts/scorer.ts 0.3

# 高阈值 — 应过滤更多
echo '...' | npx tsx scripts/scorer.ts 0.9
```

---

## 五、回复生成器测试

### 5.1 Approve 模式

```bash
echo '{"id":"t3_test","title":"Need food photography tips","body":"Help","author":"user1","platform":"reddit","subreddit":"FoodPhotography","url":"https://reddit.com/r/test","scores":{"final":0.8}}' | npx tsx scripts/responder.ts approve

# 预期: 输出回复草稿格式，包含 Post/Author/Score/Actions
```

**验证项：**
- [ ] 输出包含 "REPLY DRAFT" 标记
- [ ] 显示帖子信息和评分
- [ ] 记录写入 `memory/interaction-log.jsonl`

### 5.2 Auto 模式

```bash
echo '...' | npx tsx scripts/responder.ts auto
# 预期: 输出 auto mode 执行指令
```

### 5.3 安全规则验证

```bash
# 重复帖子测试 — 第二次应被跳过
echo '{"id":"t3_dup","title":"test","body":"","author":"u","platform":"reddit","scores":{"final":0.8}}' | npx tsx scripts/responder.ts approve
echo '{"id":"t3_dup","title":"test","body":"","author":"u","platform":"reddit","scores":{"final":0.8}}' | npx tsx scripts/responder.ts approve
# 预期: 第二次输出包含 "Already replied" 提示

# 同作者冷却测试
echo '{"id":"t3_new1","title":"t1","body":"","author":"same_user","platform":"reddit","scores":{"final":0.8}}' | npx tsx scripts/responder.ts approve
echo '{"id":"t3_new2","title":"t2","body":"","author":"same_user","platform":"reddit","scores":{"final":0.8}}' | npx tsx scripts/responder.ts approve
# 预期: 第二次输出包含 "Author on cooldown" 提示
```

---

## 六、监控调度测试

### 6.1 品牌档案解析

```bash
npx tsx scripts/monitor.ts reddit 2>&1 | head -10
# 预期: stderr 日志显示搜索的关键词和 subreddit
```

### 6.2 完整 Pipeline

```bash
# 完整链路（需真实凭证）
npx tsx scripts/monitor.ts reddit | npx tsx scripts/scorer.ts | npx tsx scripts/responder.ts approve
```

---

## 七、统计报告测试

### 7.1 日报

```bash
npx tsx scripts/analytics.ts daily
# 预期: Markdown 格式日报
```

### 7.2 周报

```bash
npx tsx scripts/analytics.ts weekly
# 预期: Markdown 格式周报，包含 7 天趋势
```

### 7.3 调优建议

```bash
npx tsx scripts/analytics.ts tune
# 预期: 基于历史数据的优化建议
```

---

## 八、SKILL.md 合规检查

- [ ] `name` 字段: 小写字母和连字符
- [ ] `metadata.clawdbot.description` 存在且无敏感词
- [ ] `metadata.clawdbot.tags` 至少 3 个
- [ ] `tools` 声明: bash, browser
- [ ] `external_endpoints` 列出所有外部域名
- [ ] `files` 声明所有读写目录
- [ ] `cron` 定义格式正确（name, schedule, session, command）
- [ ] `requires` 中包含 node（而非 jq/curl）
- [ ] 正文中无 spam/轰炸/群发等 ClawHub 敏感词
- [ ] 安全规则标注为 "hardcoded, cannot be overridden"

---

## 九、打包前最终检查

- [ ] 所有 .ts 文件包含 Security Manifest 头注释
- [ ] `package.json` 存在且 dependencies 正确
- [ ] `config/accounts.json` 不在打包中
- [ ] `memory/interaction-log.jsonl` 不在打包中
- [ ] `memory/performance-stats.json` 不在打包中
- [ ] `docs/` 目录不在打包中
- [ ] `.cursor/` 目录不在打包中
- [ ] `.git/` 目录不在打包中
- [ ] `node_modules/` 目录不在打包中
- [ ] `feedback-history-*.json` 不在打包中
- [ ] `clawhub.json` 在打包中
- [ ] 无 LICENSE 文件（ClawHub 发布时接受 MIT-0）
- [ ] 旧版 .sh 文件已清理

---

## 十、清理测试数据

测试完成后执行：

```bash
# 清理测试凭证
echo '{}' > config/accounts.json

# 清理交互日志
rm -f memory/interaction-log.jsonl
rm -f memory/performance-stats.json

# 重置 brand-profile 为模板状态
# （确认 memory/brand-profile.md 中所有值为"待配置"）
```
