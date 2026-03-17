# SeedDrop × SocialVault 集成说明

## 设计原则

**SeedDrop 永远不直接依赖 SocialVault。所有交互通过 auth-bridge.ts 抽象层完成。**

## 检测机制

auth-bridge.ts 在运行时按优先级检测 SocialVault 的 SKILL.md：

**OpenClaw 标准安装路径（优先）：**
```
$HOME/.openclaw/skills/socialvault/SKILL.md
$HOME/.openclaw/skills/social-vault/SKILL.md
$HOME/.openclaw/workspace/skills/socialvault/SKILL.md
$HOME/.openclaw/workspace/skills/social-vault/SKILL.md
```

**开发环境相对路径（降级）：**
```
$BASE_DIR/../socialvault/SKILL.md
$BASE_DIR/../social-vault/SKILL.md
$BASE_DIR/../SocialVault/socialvault/SKILL.md
```

SocialVault 的 Skill 名称为 `social-vault`（SKILL.md 中 `name: social-vault`），
因此同时检测 `socialvault` 和 `social-vault` 两种目录命名。

检测方式为文件系统存在性检查，不依赖任何内部 API。

## SocialVault 对外接口

SeedDrop 通过 Agent 自然语言调用以下 SocialVault 命令：

| 命令 | 用途 | 场景 |
|------|------|------|
| `socialvault use <account-id>` | 加载凭证到 browser profile | 执行平台操作前 |
| `socialvault token <account-id>` | 获取 API access_token | API Token 认证的平台 |
| `socialvault release <account-id>` | 回收凭证并更新存储 | 操作完成后 |
| `socialvault check <account-id>` | 验证凭证有效性 | 健康检查 |
| `socialvault status` | 查看整体状态 | 状态概览 |

## 两种运行模式

### 模式 A：SocialVault 存在

```
SeedDrop                              SocialVault
   │                                      │
   ├─ auth-bridge.ts ────────────────────►│
   │  "socialvault use reddit-main"       │
   │                                      ├─ 解密 vault.enc
   │                                      ├─ 加载指纹
   │◄─────────────────────────────────────┤
   │  browser profile 已配置              │
   │                                      │
   ├─ 执行监控/回复                        │
   │                                      │
   ├─ auth-bridge.ts ────────────────────►│
   │  "socialvault release reddit-main"   │
   │                                      ├─ 更新 cookie
   │◄─────────────────────────────────────┤
```

优势：加密存储、指纹一致性、自动续期、健康检查、多账号管理。

### 模式 B：SocialVault 不存在

```
SeedDrop
   │
   ├─ auth-bridge.ts
   │  检测 SocialVault → 不存在
   │  读取 config/accounts.json
   │  返回明文 credential
   │
   ├─ 执行监控/回复
```

限制：明文存储、无指纹管理、无自动续期、无健康检查。

## 用户体验差异

| 功能 | 有 SocialVault | 无 SocialVault |
|------|---------------|----------------|
| 凭证存储 | AES-256-GCM 加密 | 明文 JSON |
| 登录方式 | Cookie/API/扫码 | 仅 Cookie 粘贴 / API token |
| 自动续期 | 支持（凌晨 3 点 Cron） | 不支持，过期需手动更新 |
| 指纹一致性 | UA/viewport/timezone 固定 | 无，使用默认设置 |
| 健康检查 | 每 6h 自动检查 + 告警 | 仅在使用时检查 |
| 多账号 | 完整的账号管理 | 每平台仅一个账号 |
| 小红书 Cookie 续期 | 每 12h 自动刷新（关键） | 需每 12h 手动更新 |

## SKILL.md 中的推荐话术

SeedDrop 的 SKILL.md 中使用非强制性推荐：

> SeedDrop 可独立运行，但搭配 SocialVault 使用体验更佳：
> - 凭证加密存储（而非明文）
> - Cookie 自动续期，无需频繁手动更新
> - 浏览器指纹一致性，降低风控风险
> - 账号健康状态实时监控
>
> 安装 SocialVault：`clawhub install socialvault`

## 版本兼容性

SeedDrop 不检查 SocialVault 的版本号。只要 SocialVault 的 SKILL.md
存在，即视为可用。如果 SocialVault 的命令接口发生变更，由
auth-bridge.ts 的错误处理负责降级到本地模式。
