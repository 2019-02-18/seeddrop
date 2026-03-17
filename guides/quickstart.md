# SeedDrop 快速上手

## 1. 安装

```bash
clawhub install seeddrop
```

## 2. 配置品牌档案

```
seeddrop setup
```

按引导回答 5-6 个问题，自动生成品牌档案。

## 3. 添加平台凭证

### Reddit（推荐首先配置）

```
seeddrop auth add reddit
```

**API Token（推荐）：** 前往 reddit.com/prefs/apps 创建 script 应用。

**Cookie 粘贴：** 浏览器登录 → Cookie-Editor 插件导出 → 粘贴。

## 4. 验证凭证

```
seeddrop auth check reddit
```

## 5. 运行监控

```
seeddrop monitor reddit
```

## 6. 设置定时（可选）

SeedDrop 内置 Cron 任务，安装后自动注册：
- 每 30 分钟扫描
- 每晚 22:00 日报

## 搭配 SocialVault（推荐）

```bash
clawhub install socialvault
```

安装后 SeedDrop 自动识别，无需额外配置。
优势：加密存储、自动续期（小红书 Cookie 仅 12h 有效）、指纹一致性。
