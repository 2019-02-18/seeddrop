# SeedDrop — Platform Adapter 开发规范 (TypeScript)

## 一、概述

Platform Adapter 是 SeedDrop 的平台扩展机制。每个适配器是一个 TypeScript 模块，实现统一的 `PlatformAdapter` 接口。新增平台只需创建一个 `.ts` 文件，无需修改核心脚本。

## 二、文件位置

```
scripts/adapters/
├── base.ts              # PlatformAdapter 接口 + 工厂函数
├── reddit.ts            # Reddit 适配器
├── x-twitter.ts         # X/Twitter 适配器
├── xiaohongshu.ts       # 小红书适配器
└── _template.ts         # 新适配器开发模板
```

## 三、核心接口定义

接口定义在 `scripts/types.ts` 中：

```typescript
interface Credential {
  authType: 'api_token' | 'cookie' | 'oauth';
  value: string;
  profile?: string;
  source: 'socialvault' | 'local';
}

interface Post {
  id: string;
  url: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;       // ISO 8601
  platform: string;
  subreddit?: string;      // Reddit 专用
  metadata?: Record<string, unknown>;
}

interface ReplyResult {
  success: boolean;
  replyId?: string;
  error?: string;
  mode?: 'api' | 'browser';
}

interface CheckResult {
  valid: boolean;
  username?: string;
  error?: string;
}

interface RateLimitInfo {
  requestsPerMinute: number;
  repliesPerDay: number;
  minReplyIntervalSeconds: number;
  notes: string;
}

interface PlatformAdapter {
  readonly platformId: string;
  readonly platformName: string;

  search(keyword: string, timeRange: string, credential: Credential, target?: string): Promise<Post[]>;
  reply(postId: string, content: string, credential: Credential): Promise<ReplyResult>;
  check(credential: Credential): Promise<CheckResult>;
  rateLimitInfo(): RateLimitInfo;
}
```

## 四、适配器实现规范

### 4.1 文件结构

```typescript
// SECURITY MANIFEST:
//   Environment variables accessed: (列出)
//   External endpoints called: (列出)
//   Local files read: (列出)
//   Local files written: (列出)

import type { PlatformAdapter, Credential, Post, ReplyResult, CheckResult, RateLimitInfo } from '../types.js';

export class MyPlatformAdapter implements PlatformAdapter {
  readonly platformId = 'my-platform';
  readonly platformName = 'My Platform';

  async search(keyword: string, timeRange: string, credential: Credential, target?: string): Promise<Post[]> {
    // 实现搜索逻辑
  }

  async reply(postId: string, content: string, credential: Credential): Promise<ReplyResult> {
    // 实现回复逻辑
  }

  async check(credential: Credential): Promise<CheckResult> {
    // 实现凭证验证
  }

  rateLimitInfo(): RateLimitInfo {
    return {
      requestsPerMinute: 60,
      repliesPerDay: 20,
      minReplyIntervalSeconds: 300,
      notes: '参考平台官方文档'
    };
  }
}
```

### 4.2 注册适配器

在 `scripts/adapters/base.ts` 的工厂函数中注册：

```typescript
import { RedditAdapter } from './reddit.js';
import { XTwitterAdapter } from './x-twitter.js';
import { XiaohongshuAdapter } from './xiaohongshu.js';

const adapters: Record<string, () => PlatformAdapter> = {
  'reddit': () => new RedditAdapter(),
  'x-twitter': () => new XTwitterAdapter(),
  'xiaohongshu': () => new XiaohongshuAdapter(),
};

export function getAdapter(platformId: string): PlatformAdapter {
  const factory = adapters[platformId];
  if (!factory) throw new Error(`Unknown platform: ${platformId}`);
  return factory();
}
```

## 五、API 模式 vs Browser 模式

### 5.1 API 模式（优先）

适用于有公开 API 的平台（Reddit、X/Twitter API 模式）：

```typescript
async search(keyword: string, timeRange: string, credential: Credential): Promise<Post[]> {
  const response = await fetch('https://api.example.com/search', {
    headers: { 'Authorization': credential.value }
  });
  const data = await response.json();
  return data.results.map(this.transformToPost);
}
```

### 5.2 Browser 模式（降级 / 无 API 平台）

适用于无公开 API 的平台（小红书、X/Twitter Cookie 模式）。
返回 browser 指令 JSON，由 OpenClaw Agent 的 browser 工具执行：

```typescript
async search(keyword: string, timeRange: string, credential: Credential): Promise<Post[]> {
  return [{
    id: '__browser_instruction__',
    url: '',
    title: '',
    body: JSON.stringify({
      mode: 'browser',
      action: 'search',
      steps: [
        { action: 'navigate', url: `https://example.com/search?q=${encodeURIComponent(keyword)}` },
        { action: 'wait', selector: '.result-item' },
        { action: 'extract', selector: '.result-item', fields: ['title', 'url', 'author'] }
      ],
      cookies: credential.value
    }),
    author: '',
    createdAt: new Date().toISOString(),
    platform: this.platformId
  }];
}
```

> **约定**：当 `id === '__browser_instruction__'` 时，`body` 中包含 Agent 需执行的 browser 操作步骤。

## 六、错误处理

```typescript
async search(...): Promise<Post[]> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.error(`[${this.platformId}] Search failed: ${response.status}`);
      return [];
    }
    return this.parseResults(await response.json());
  } catch (error) {
    console.error(`[${this.platformId}] Search error:`, (error as Error).message);
    return [];
  }
}
```

规则：
- 网络错误返回空数组（search）或 `{ success: false, error: ... }`（reply/check）
- 错误日志输出到 stderr（`console.error`）
- 凭证值**不得**出现在错误日志中

## 七、测试

每个适配器应支持通过命令行直接测试：

```bash
npx tsx scripts/adapters/reddit.ts test
# 输出: {"adapter":"reddit","status":"ok","platformId":"reddit","platformName":"Reddit"}
```

在适配器文件末尾添加：

```typescript
if (process.argv[2] === 'test') {
  const adapter = new RedditAdapter();
  console.log(JSON.stringify({
    adapter: 'reddit',
    status: 'ok',
    platformId: adapter.platformId,
    platformName: adapter.platformName,
    rateLimit: adapter.rateLimitInfo()
  }));
}
```

## 八、新增适配器开发步骤

1. 复制 `scripts/adapters/_template.ts`
2. 修改 `platformId` 和 `platformName`
3. 实现 `search()`、`reply()`、`check()`、`rateLimitInfo()`
4. 在 `base.ts` 工厂函数中注册
5. 创建 `templates/reply-<platform>.md` 回复风格指南
6. 在 `references/safety-rules.md` 中添加频率限制
7. 在 `references/platform-tos-notes.md` 中添加 ToS 摘要
8. 运行 `npx tsx scripts/adapters/<platform>.ts test` 验证
