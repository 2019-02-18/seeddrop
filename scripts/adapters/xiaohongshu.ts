// SECURITY MANIFEST:
//   Environment variables accessed: none
//   External endpoints called: none (all via browser mode)
//   Local files read: none
//   Local files written: none

import type {
  PlatformAdapter,
  Credential,
  Post,
  ReplyResult,
  CheckResult,
  RateLimitInfo,
  BrowserInstruction,
} from '../types.js';
import { BROWSER_INSTRUCTION_ID } from '../types.js';

export class XiaohongshuAdapter implements PlatformAdapter {
  readonly platformId = 'xiaohongshu';
  readonly platformName = '小红书';

  async search(
    keyword: string,
    _timeRange: string,
    credential: Credential,
    _target?: string,
  ): Promise<Post[]> {
    const instruction: BrowserInstruction = {
      mode: 'browser',
      action: 'search',
      steps: [
        { action: 'navigate', url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes` },
        { action: 'wait', selector: '.note-item' },
        { action: 'extract', selector: '.note-item', fields: ['title', 'url', 'author', 'likes'] },
      ],
      cookies: credential.value,
    };

    return [{
      id: BROWSER_INSTRUCTION_ID,
      url: '',
      title: '',
      body: JSON.stringify(instruction),
      author: '',
      createdAt: new Date().toISOString(),
      platform: this.platformId,
    }];
  }

  async reply(
    postId: string,
    content: string,
    credential: Credential,
  ): Promise<ReplyResult> {
    const instruction: BrowserInstruction = {
      mode: 'browser',
      action: 'reply',
      steps: [
        { action: 'navigate', url: `https://www.xiaohongshu.com/explore/${postId}` },
        { action: 'wait', selector: '#content-textarea' },
        { action: 'click', selector: '#content-textarea' },
        { action: 'type', text: content },
        { action: 'click', selector: '.submit-btn' },
      ],
      cookies: credential.value,
    };

    return {
      success: true,
      replyId: `__browser_pending__:${JSON.stringify(instruction)}`,
      mode: 'browser',
    };
  }

  async check(credential: Credential): Promise<CheckResult> {
    if (!credential.value || credential.value.length === 0) {
      return { valid: false, error: 'No cookie provided' };
    }
    return {
      valid: true,
      username: '(cookie mode — verify via browser, cookies expire ~12h)',
    };
  }

  rateLimitInfo(): RateLimitInfo {
    return {
      requestsPerMinute: 20,
      repliesPerDay: 10,
      minReplyIntervalSeconds: 3,
      notes: 'No public API. Browser-only. Cookies expire ~12h. Min 3s between requests. Strongly recommend SocialVault for auto cookie refresh.',
    };
  }
}

const isMainModule = process.argv[1]?.replace(/\\/g, '/').endsWith('xiaohongshu.ts');
if (isMainModule && process.argv[2] === 'test') {
  const adapter = new XiaohongshuAdapter();
  console.log(JSON.stringify({
    adapter: 'xiaohongshu',
    status: 'ok',
    platformId: adapter.platformId,
    platformName: adapter.platformName,
    rateLimit: adapter.rateLimitInfo(),
  }));
}
