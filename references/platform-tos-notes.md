# 平台服务条款关键摘要

## Reddit

- User-Agent 格式: `<platform>:<app ID>:<version> (by /u/<username>)`
- API 请求限制: 60 req/min (OAuth, 10 分钟滚动窗口)
- 响应头监控: `X-Ratelimit-Remaining`, `X-Ratelimit-Reset`
- Bot 必须标明身份，回复必须提供价值
- 违规后果: 账号封禁、IP 限制、App 吊销

## X/Twitter

- 免费 API tier 极度受限: 17 req/24h, 500 posts/month
- Cookie/browser 模式推荐（不受 API 配额限制）
- 禁止批量发送重复内容
- 需遵守 X Automation Rules

## 小红书

- 无公开 API，所有操作通过浏览器模拟
- Cookie 有效期极短: ~12 小时
- 动态 Token (X-s, X-t) 有效期仅 5-10 秒
- 多层反爬: Header + 行为指纹 + 设备ID + WASM
- 强烈建议配合 SocialVault 自动续期
- 评论区不允许外部链接
- 请求间隔不低于 3 秒
