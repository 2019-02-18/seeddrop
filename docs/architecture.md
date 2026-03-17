# SeedDrop — 技术架构

## 运行环境

- OpenClaw Agent（Node 24+ / Bun）
- 内置工具：bash、browser、web_fetch、cron
- 可选依赖：SocialVault skill（运行时检测）
- 脚本语言：TypeScript，通过 `npx tsx` 执行
- 运行时依赖：tsx（开发时 devDependency）
- JSON / 浮点运算：TypeScript 原生处理，无需 jq / bc

## 技术栈选型理由

> v0 原型使用 bash + jq + curl，在实际开发中暴露了以下问题：
> - 浮点运算依赖 bc/awk，跨平台不一致
> - JSON 处理依赖 jq，增加部署前置条件
> - while+pipe 子进程变量丢失引发多个 bug
> - Windows 无原生 bash（用户实际碰到的阻塞问题）
> - auth-bridge 的 KEY=VALUE 文本协议容易出错
>
> TypeScript 方案优势：
> - JSON / 浮点原生支持，零外部依赖
> - 类型安全，IDE 提示完善
> - `npx tsx` 在 OpenClaw 环境中已验证可行（SocialVault 同架构）
> - 两个 Skill 技术栈统一，降低维护成本
> - Windows / Linux / macOS 行为一致

## 目录结构

```
seedDrop/
├── SKILL.md                          # 主入口，Agent 指令
├── package.json                      # 依赖管理（仅 tsx）
├── tsconfig.json                     # TypeScript 配置
├── scripts/
│   ├── types.ts                      # 统一类型定义
│   ├── auth-bridge.ts                # SocialVault 检测与降级层
│   ├── monitor.ts                    # 监控调度主脚本
│   ├── scorer.ts                     # 评分引擎
│   ├── responder.ts                  # 回复生成与发送
│   ├── analytics.ts                  # 统计与报告
│   └── adapters/
│       ├── base.ts                   # 适配器基类 / 接口
│       ├── reddit.ts                 # Reddit 适配器（API）
│       ├── x-twitter.ts             # X 适配器（API + browser）
│       └── xiaohongshu.ts           # 小红书适配器（browser）
├── memory/
│   ├── brand-profile.md              # 品牌人设配置
│   ├── interaction-log.jsonl         # 已回复记录（追加写入）
│   ├── blacklist.md                  # 黑名单
│   └── performance-stats.json        # 统计数据
├── templates/
│   ├── reply-reddit.md               # Reddit 回复风格指南
│   ├── reply-x.md                    # X 回复风格
│   └── reply-xiaohongshu.md          # 小红书回复风格
├── references/
│   ├── scoring-criteria.md           # 评分维度详细说明
│   ├── safety-rules.md               # 安全规则与频率限制
│   └── platform-tos-notes.md         # 各平台 ToS 摘要
├── guides/
│   ├── quickstart.md                 # 5 分钟上手
│   ├── brand-profile-setup.md        # 品牌配置引导
│   └── adapter-development.md        # 适配器开发指南
├── config/
│   └── accounts.json                 # 本地凭证（降级模式用）
└── docs/
    ├── architecture.md               # 本文档
    ├── task-list.md                   # 开发任务清单
    ├── adapter-spec.md               # 适配器规范
    ├── brand-profile.md              # 品牌档案默认示例
    ├── test-flow.md                  # 测试流程
    ├── migration-notes.md            # bash→TS 迁移经验
    └── socialvault-integration.md    # SocialVault 集成说明
```

## 核心架构：Auth Bridge

SeedDrop 通过 auth-bridge.ts 实现与 SocialVault 的松耦合：

```
SeedDrop 脚本 → auth-bridge.ts → SocialVault (若存在)
                                → 本地 accounts.json (降级)
```

auth-bridge.ts 是项目中唯一引用 SocialVault 的文件。

## 数据流

```
Cron 触发
    │
    ▼
auth-bridge.ts (获取凭证) → 返回 Credential 对象
    │
    ▼
monitor.ts (调用平台适配器搜索，去重已回复帖子)
    │ 输出 Post[]
    ▼
scorer.ts (多维评分 + 阈值过滤)
    │ 输出 ScoredPost[]（得分 ≥ 阈值）
    ▼
responder.ts (安全检查 + 回复生成)
    │
    ├─► [Approve] 展示草稿，等待用户确认
    └─► [Auto] 直接发送
    │
    ▼
interaction-log.jsonl (记录)
    │
    ▼
analytics.ts (统计报告 + 调优建议)
```

## 平台适配器接口

```typescript
interface PlatformAdapter {
  readonly platformId: string;
  readonly platformName: string;

  search(keyword: string, timeRange: string, credential: Credential, target?: string): Promise<Post[]>;
  reply(postId: string, content: string, credential: Credential): Promise<ReplyResult>;
  check(credential: Credential): Promise<CheckResult>;
  rateLimitInfo(): RateLimitInfo;
}
```

每个适配器实现 `PlatformAdapter` 接口，通过 `adapters/base.ts` 中的工厂函数按 platformId 加载。

## SKILL.md 脚本调用格式

所有 Cron 和手动触发的命令统一为：

```
npx tsx {baseDir}/scripts/<name>.ts [args]
```

## Cron 任务

| 任务 | 频率 | 命令 |
|------|------|------|
| 监控扫描 | 每 30 分钟 | `npx tsx scripts/monitor.ts` |
| 日报 | 每晚 22:00 | `npx tsx scripts/analytics.ts daily` |
| 周报 + 调优 | 每周一 10:00 | `npx tsx scripts/analytics.ts weekly` |

## 与 SocialVault 的关系

| 维度 | SeedDrop | SocialVault |
|------|----------|-------------|
| 定位 | 营销自动化 | 账号安全管理 |
| 语言 | TypeScript | TypeScript |
| 关系 | 上层消费者 | 基础设施提供者 |
| 耦合 | 仅 auth-bridge.ts | 无感知 |
| 独立性 | 可单独运行（本地降级） | 完全独立 |
