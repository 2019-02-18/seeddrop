# SeedDrop v2 — 开发任务清单（TypeScript 重构版）

> 本清单基于 v1 (bash) 版本的经验教训重新编排。
> 所有 bash 脚本将用 TypeScript 重写，保留相同的业务逻辑和安全规则。

## Phase 0: 项目脚手架 (Day 1)

### P0. TypeScript 基础设施
- [x] P0-1: 创建 `package.json`（name: seeddrop, type: module, devDependencies: tsx, typescript）
- [x] P0-2: 创建 `tsconfig.json`（target: ES2022, module: NodeNext, strict: true）
- [x] P0-3: 创建 `scripts/types.ts` — 统一类型定义（Post, ScoredPost, Credential, ReplyResult, CheckResult, RateLimitInfo, PlatformAdapter 接口）
- [x] P0-4: 运行 `npm install` 验证 `npx tsx scripts/types.ts` 可执行
- [x] P0-5: 更新 SKILL.md — 所有命令从 `bash scripts/*.sh` 改为 `npx tsx scripts/*.ts`，metadata 中 requires 改为 node，tools 保留 bash + browser
- [x] P0-6: 更新 `clawhub.json` — requires 中 bash→node，添加 tsx

## Phase 1: 核心模块重写 (Day 2-3)

### A. Auth Bridge
- [x] A1: 重写 `scripts/auth-bridge.ts` — SocialVault 检测（检查 OpenClaw 标准路径）
- [x] A2: 实现本地降级 — 读写 `config/accounts.json`，返回 `Credential` 对象
- [x] A3: 实现凭证检查 — 调用适配器的 `check()` 方法
- [x] A4: 实现指纹请求 — SocialVault 模式下获取指纹
- [x] A5: 测试 `npx tsx scripts/auth-bridge.ts mode` 输出 local/socialvault
- [x] A6: 测试 `npx tsx scripts/auth-bridge.ts get reddit <profile>` 返回 Credential JSON

### B. 平台适配器基类
- [x] B1: 创建 `scripts/adapters/base.ts` — PlatformAdapter 接口 + 工厂函数 `getAdapter(platformId)`
- [x] B2: 重写 `scripts/adapters/reddit.ts` — 实现 search/reply/check/rateLimitInfo
- [x] B3: 测试 Reddit adapter（mock token）

### C. 评分引擎
- [x] C1: 重写 `scripts/scorer.ts` — 从 stdin 读 JSONL，TypeScript 原生浮点运算
- [x] C2: 多维评分（relevance, intent, freshness, risk）权重配置化
- [x] C3: 测试 `echo '...' | npx tsx scripts/scorer.ts 0.5` 输出评分结果

### D. 回复生成器
- [x] D1: 重写 `scripts/responder.ts` — approve/auto 双模式
- [x] D2: 去重检查（读 interaction-log.jsonl）
- [x] D3: 同作者冷却（24h 内 max 1 次）
- [x] D4: 每日回复硬上限检查
- [x] D5: 测试 approve 模式草稿输出格式

### E. 监控调度
- [x] E1: 重写 `scripts/monitor.ts` — 读取 brand-profile，调用适配器搜索
- [x] E2: 去重已回复帖子
- [x] E3: 管道集成：`npx tsx scripts/monitor.ts reddit | npx tsx scripts/scorer.ts | npx tsx scripts/responder.ts approve`

### F. 统计报告
- [x] F1: 重写 `scripts/analytics.ts` — daily/weekly/tune 子命令
- [x] F2: 调优建议（关键词、阈值、时段优化）

## Phase 2: 扩展平台 (Day 4-5)

### G. X/Twitter 适配器
- [x] G1: 重写 `scripts/adapters/x-twitter.ts` — API + browser 双模式
- [x] G2: 测试 API 模式搜索
- [x] G3: 测试 browser 模式降级

### H. 小红书适配器
- [x] H1: 重写 `scripts/adapters/xiaohongshu.ts` — 纯 browser 实现
- [x] H2: 测试搜索和回复指令输出

### I. 适配器模板
- [x] I1: 创建 `scripts/adapters/_template.ts`（参考 base.ts 接口）
- [x] I2: 更新 `guides/adapter-development.md` — 示例代码改为 TypeScript

## Phase 3: 集成验证 + 发布 (Day 6-7)

### J. 端到端测试
- [ ] J1: Reddit 完整 pipeline 验证（真实凭证）
- [ ] J2: X/Twitter 完整 pipeline 验证
- [ ] J3: 小红书完整 pipeline 验证
- [ ] J4: SocialVault 存在时的凭证路径验证
- [ ] J5: SocialVault 不存在时的降级路径验证
- [ ] J6: Cron 触发完整 pipeline 验证

### K. 安全自检
- [x] K1: 所有 .ts 文件包含 Security Manifest 注释
- [x] K2: 凭证值不在日志中出现
- [x] K3: 注入风险检查（用户输入不拼接到命令中）
- [x] K4: 频率限制在脚本中硬编码，不可通过配置覆盖

### L. 发布准备
- [x] L1: SKILL.md frontmatter 最终检查（metadata.clawdbot）
- [x] L2: clawhub.json 元数据最终检查
- [x] L3: README.md 更新（技术栈改为 TypeScript）
- [x] L4: 清理 bash 版残余文件（无 bash 残余，项目从头构建）
- [ ] L5: 打包验证（排除 docs/, .cursor/, node_modules/, config/accounts.json）
- [ ] L6: `clawhub publish` 发布 v2.0.0

## 清理 — bash 版文件移除清单

> 以下文件在 TypeScript 版本全部完成并验证后删除：

```
scripts/auth-bridge.sh          → scripts/auth-bridge.ts
scripts/monitor.sh              → scripts/monitor.ts
scripts/scorer.sh               → scripts/scorer.ts
scripts/responder.sh            → scripts/responder.ts
scripts/analytics.sh            → scripts/analytics.ts
scripts/platform-adapters/      → scripts/adapters/
  ├── _template.sh              → _template.ts
  ├── reddit.sh                 → reddit.ts
  ├── x-twitter.sh              → x-twitter.ts
  └── xiaohongshu.sh            → xiaohongshu.ts
scripts/pack.sh                 → （可选保留）
scripts/pack.ps1                → （可选保留）
```
