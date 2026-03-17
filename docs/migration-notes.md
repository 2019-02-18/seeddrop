# SeedDrop v1→v2 迁移笔记

> 本文档记录 v1 (bash) 版本开发过程中的经验教训，供 v2 (TypeScript) 重构时参考。

## 一、为什么从 bash 迁移到 TypeScript

### 1.1 bash 版本遇到的实际问题

| 问题 | 影响 | TS 如何解决 |
|------|------|-------------|
| 浮点运算依赖 bc | bc 不是所有环境都有，scorer.sh 需额外 awk 降级逻辑 | TS 原生 Number 运算 |
| JSON 处理依赖 jq | 额外安装需求，jq 表达式不直观 | TS 原生 JSON.parse/stringify |
| while+pipe 子进程变量丢失 | monitor.sh、scorer.sh 多次因此出 bug（变量在子进程中修改但主进程不可见） | TS 没有子进程变量隔离问题 |
| auth-bridge 的 KEY=VALUE 文本协议 | 解析脆弱，值中含特殊字符就出错 | 直接返回 Credential 对象 |
| Windows 无原生 bash | 用户在 Windows 上执行 `bash scripts/xxx.sh` 直接报错 | `npx tsx` 跨平台一致 |
| 错误处理不够精细 | set -euo pipefail 是全局开关，个别命令需要 `|| true` 绕过 | try/catch 精细控制 |
| 代码复用困难 | source 机制导致命名冲突，函数不能返回复杂数据 | import/export + TypeScript 类型系统 |

### 1.2 TypeScript 的实际可行性验证

- SocialVault skill 已使用 TypeScript + `npx tsx` 开发完成
- 在 OpenClaw Agent 环境中验证 `npx tsx` 可正常执行
- `SKILL.md` 的 tools 声明中 `bash` 仍然保留（用于简单 shell 命令），但核心逻辑用 TS
- 两个 Skill 统一技术栈后，类型定义（Credential 等）可直接复用

## 二、bash 版本中的具体 bug 记录

### 2.1 子进程变量丢失（影响：monitor.sh, scorer.sh, responder.sh）

**问题代码：**
```bash
local count=0
cat file.jsonl | while read line; do
  count=$((count + 1))  # 这里修改的是子进程中的 count
done
echo $count  # 永远是 0
```

**修复方式（bash 中）：** 改用 awk 在管道内计数，或用进程替换避免子进程。

**TS 中不存在此问题：**
```typescript
let count = 0;
for (const line of lines) {
  count++;
}
console.log(count); // 正确
```

### 2.2 浮点比较（影响：scorer.sh）

**问题：** bash 不支持浮点比较，必须依赖 bc 或 awk：
```bash
# 需要：if (score >= 0.6)
# bash 做法：
if echo "$score >= $threshold" | bc -l | grep -q 1; then ...
# bc 不可用时的降级：
if awk "BEGIN {exit !($score >= $threshold)}"; then ...
```

**TS 中：** `if (score >= threshold)` — 就这么简单。

### 2.3 SocialVault 路径检测（影响：auth-bridge.sh）

**问题：** 初始版本硬编码了开发目录的相对路径，部署到其他环境就找不到 SocialVault。

**修复：** 优先检查 OpenClaw 标准安装路径 `$HOME/.openclaw/skills/social-vault/SKILL.md`，开发路径作为降级。

**TS 重写时注意：**
- 使用 `os.homedir()` 获取用户目录
- 路径拼接用 `path.join()`，不用字符串拼接
- 保持相同的检测优先级

## 三、文件持久化问题

### 3.1 问题描述

在长聊天会话中，通过 AI 工具写入的文件存在"静默丢失"现象。17 个文件在显示写入成功后实际不存在于磁盘。

### 3.2 教训

- 每个 Phase 完成后，用 `ls` 或 `dir` 确认文件确实存在
- 关键文件写入后立即验证
- 不要假设之前写入的文件一定存在，重写时先检查

### 3.3 v2 重构建议

- Phase 0 先创建空文件骨架（package.json, tsconfig.json, 所有 .ts 桩文件）
- 立即 `npm install` 验证 package.json 有效
- 每完成一个模块就 `npx tsx scripts/xxx.ts test` 验证可执行

## 四、ClawHub 发布经验

### 4.1 许可证

- ClawHub 发布接受 MIT-0（无署名要求）
- GitHub 仓库可以用 MIT
- 打包上传时**不要**包含 LICENSE 文件
- 在 `clawhub.json` 中声明 `"license": "MIT-0"`

### 4.2 敏感词

- ClawHub 有自动检测机制，会 flag 含有 spam/轰炸/群发/bot 等词汇的 Skill
- SKILL.md description 应使用价值导向的语言：
  - ✅ "community engagement" "brand outreach" "audience connection"
  - ❌ "auto reply" "mass messaging" "spam" "bot"

### 4.3 发布方式

- ClawHub 是直接上传文件夹，不是链接 GitHub 仓库
- 使用 `clawhub publish` 命令（或 Web UI 上传 zip）
- 打包时排除：docs/, .cursor/, .git/, node_modules/, config/accounts.json, memory/*.jsonl, memory/*.json, feedback-history-*.json

### 4.4 metadata 格式

- 使用 `metadata.clawdbot`（不是 `metadata.openclaw`）
- 必须包含 description, version, tags
- tags 至少 3 个
- requires.anyBins 列出运行时依赖

## 五、跨平台适配器开发经验

### 5.1 Reddit

- User-Agent 必须遵循 `linux:appname:version (by /u/username)` 格式
- 实际限制是 60 req/min（文档说 100 但实测更严格）
- OAuth token 有效期 1 小时，需 SocialVault 自动刷新

### 5.2 X/Twitter

- 免费 API 极其受限：17 req/24h、500 posts/month
- Cookie 模式通过 browser 工具实现，绕过 API 限制但风险更高
- 建议 API 模式下评分阈值提高到 0.8（减少无效消耗）

### 5.3 小红书

- 无公开 API，只能通过 browser 模式
- Cookie 有效期约 12 小时（远低于预期的 7 天）
- 请求间隔 ≥ 3 秒（否则触发验证码）
- 强烈推荐配合 SocialVault 做 Cookie 自动刷新

## 六、v2 重构注意事项清单

- [ ] 保留 bash 版文件直到 TS 版全部验证通过，然后一次性删除
- [ ] `SKILL.md` 中 tools 仍声明 bash（用于简单 shell 命令）+ browser
- [ ] package.json 中 type 设为 "module"（ESM）
- [ ] tsconfig.json 中 module 设为 "NodeNext"
- [ ] 所有文件 import 使用 `.js` 后缀（ESM 规范）
- [ ] 管道操作保留 JSONL stdin/stdout 模式，便于与 bash 命令组合
- [ ] Windows 上测试 `npx tsx` 是否正常工作（v1 的 bash 在 Windows 失败过）
- [ ] 打包脚本也可以改用 TypeScript（或保留 pack.ps1 给 Windows 用户）
