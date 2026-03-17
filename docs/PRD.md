# SeedDrop — 产品需求文档

## 一句话定义

SeedDrop 是一个 OpenClaw Skill，7×24 自动监控多平台社交讨论，在合适的上下文中植入有价值的回复，为小微企业和独立开发者实现零人工种草。

## 与 SocialVault 的关系

SeedDrop 与 SocialVault 是**独立发布、可选组合**的关系：

| 场景 | 行为 |
|------|------|
| 已安装 SocialVault | SeedDrop 自动调用 `socialvault use <profile>` 获取 cookie/token，享受加密存储、健康检查、指纹一致性等全部能力 |
| 未安装 SocialVault | SeedDrop 退化为"手动模式"——用户通过环境变量或对话直接提供 API token / cookie，SeedDrop 自行存入本地明文配置文件 |

**设计原则：SeedDrop 的 SKILL.md 和所有脚本中，不得硬编码 SocialVault 的路径或接口。所有 SocialVault 调用必须经过统一的 `auth-bridge` 层，该层在运行时检测 SocialVault 是否存在并做降级。**

## 目标用户

- 小微企业主（餐饮、本地服务、电商）
- 独立开发者 / Indie Hacker
- 自由职业营销人员
- 个人品牌运营者

## 核心痛点

1. 手动在 Reddit / 知乎 / 小红书 / X 等平台找相关帖子并回复，耗时且不可持续
2. 现有 OpenClaw 社交 Skill（PostFast、upload-post、crosspost）只做"发帖"，不做"种草"
3. ChatGPT / 豆包等大厂 AI 只能写文案，无法执行发布动作
4. 群发消息类 Skill 已被 ClawHub 大量标记为恶意（373 个），需要走价值导向路线

## 核心功能

### F1: Monitor Engine — 全平台监控

- 使用 Cron 定时触发（默认 30 分钟）
- 通过 browser / web_fetch / 平台 API 抓取新内容
- 支持关键词、竞品名、话题标签等多维过滤
- 首批平台：Reddit（API）、X（browser）、小红书（browser）
- 可扩展：知乎、V2EX、Facebook Groups、Discord（通过适配器模式）

### F2: Analyzer & Scorer — 智能评分

- 对每条命中内容进行多维评分：
  - 相关度（关键词命中 + 语义匹配）
  - 意图强度（提问 > 讨论 > 吐槽 > 纯分享）
  - 时效性（越新越好，超过 48h 降权）
  - 平台权重（用户自定义优先级）
  - 风险评估（是否可能引发负面反应）
- 仅高于阈值（默认 0.6）的内容进入回复流程

### F3: Responder — 回复生成

- 基于 Brand Profile 生成回复草稿
- 规则：
  - 必须提供真实价值（回答问题、分享经验、给出建议）
  - 品牌/产品提及控制在回复的 20% 以内
  - 不使用营销话术、不夸大、不虚假承诺
  - 每条回复风格有随机微调，避免模板化
- 支持两种执行模式：
  - **Approve 模式**（默认）：草稿推送至 Telegram / WhatsApp / 终端，等待用户确认
  - **Auto 模式**：自动发送，每日汇总报告

### F4: Memory & Analytics — 记忆与分析

- 使用 MEMORY.md 持久化：
  - Brand Profile（业务信息、语气、关键词）
  - Interaction Log（已回复的帖子 ID、时间、内容摘要）
  - Blacklist（不再回复的用户/帖子/subreddit）
  - Performance Stats（回复数、获赞数、点击率趋势）
- 每周自动生成优化建议

## 非目标（明确不做）

- 不做发帖/排期（交给 PostFast / upload-post 等专业 Skill）
- 不做账号管理（交给 SocialVault）
- 不做群发消息 / DM 轰炸
- 不做刷赞 / 刷评论 / 任何违反平台 ToS 的行为
- 不做内容创作（只做回复，不做原创帖子）

## 安全与合规

- 每平台每日回复硬上限（Reddit: 20, X: 15, 小红书: 10）
- 同一帖子不重复回复
- 同一用户帖子 24h 内最多回复 1 次
- 回复间隔随机化（5-15 分钟）
- 不在明确禁止自动回复的 subreddit / 社区发布
- Auto 模式仅对用户已确认安全的平台启用

## 里程碑

| Phase | 时间 | 内容 |
|-------|------|------|
| 1 | Week 1-2 | MVP：Reddit 单平台 + Approve 模式 + 基础评分 |
| 2 | Week 3-4 | 加入 X、小红书；支持 Auto 模式；SocialVault 集成 |
| 3 | Week 5-6 | 性能统计 + 自动调优 + 平台适配器框架开放 |
| 4 | 持续 | 社区贡献更多平台适配器、模板市场 |
