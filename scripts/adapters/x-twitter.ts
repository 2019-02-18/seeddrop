// SECURITY MANIFEST:
//   Environment variables accessed: none
//   External endpoints called: https://api.twitter.com/2/tweets/search/recent, https://api.twitter.com/2/tweets
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

const X_API_V2 = 'https://api.twitter.com/2';

export class XTwitterAdapter implements PlatformAdapter {
  readonly platformId = 'x-twitter';
  readonly platformName = 'X (Twitter)';

  async search(
    keyword: string,
    timeRange: string,
    credential: Credential,
    target?: string,
  ): Promise<Post[]> {
    if (credential.authType === 'cookie') {
      return this.browserSearch(keyword, credential);
    }
    return this.apiSearch(keyword, timeRange, credential);
  }

  private async apiSearch(
    keyword: string,
    _timeRange: string,
    credential: Credential,
  ): Promise<Post[]> {
    try {
      const params = new URLSearchParams({
        query: `${keyword} -is:retweet -is:reply lang:en`,
        'tweet.fields': 'author_id,created_at,text,conversation_id',
        'user.fields': 'username',
        expansions: 'author_id',
        max_results: '10',
      });

      const response = await fetch(`${X_API_V2}/tweets/search/recent?${params}`, {
        headers: { 'Authorization': `Bearer ${credential.value}` },
      });

      if (!response.ok) {
        console.error(`[x-twitter] API search failed: ${response.status}`);
        if (response.status === 429) {
          console.error('[x-twitter] Rate limited. Free tier: 17 req/24h');
        }
        return [];
      }

      const data = await response.json() as {
        data?: Array<{
          id: string;
          text: string;
          author_id: string;
          created_at: string;
          conversation_id?: string;
        }>;
        includes?: {
          users?: Array<{ id: string; username: string }>;
        };
      };

      if (!data.data) return [];

      const userMap = new Map<string, string>();
      for (const user of data.includes?.users ?? []) {
        userMap.set(user.id, user.username);
      }

      return data.data.map(tweet => ({
        id: tweet.id,
        url: `https://x.com/${userMap.get(tweet.author_id) ?? 'user'}/status/${tweet.id}`,
        title: '',
        body: tweet.text,
        author: userMap.get(tweet.author_id) ?? tweet.author_id,
        createdAt: tweet.created_at,
        platform: this.platformId,
        metadata: { conversationId: tweet.conversation_id },
      }));
    } catch (error) {
      console.error(`[x-twitter] API search error: ${(error as Error).message}`);
      return [];
    }
  }

  private browserSearch(keyword: string, credential: Credential): Post[] {
    const instruction: BrowserInstruction = {
      mode: 'browser',
      action: 'search',
      steps: [
        { action: 'navigate', url: `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live` },
        { action: 'wait', selector: 'article[data-testid="tweet"]' },
        { action: 'extract', selector: 'article[data-testid="tweet"]', fields: ['text', 'url', 'author', 'time'] },
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
    if (credential.authType === 'cookie') {
      return this.browserReply(postId, content, credential);
    }
    return this.apiReply(postId, content, credential);
  }

  private async apiReply(
    postId: string,
    content: string,
    credential: Credential,
  ): Promise<ReplyResult> {
    try {
      const response = await fetch(`${X_API_V2}/tweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credential.value}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          reply: { in_reply_to_tweet_id: postId },
        }),
      });

      if (!response.ok) {
        return { success: false, error: `X API error: ${response.status}`, mode: 'api' };
      }

      const data = await response.json() as { data?: { id?: string } };
      return { success: true, replyId: data.data?.id, mode: 'api' };
    } catch (error) {
      return { success: false, error: (error as Error).message, mode: 'api' };
    }
  }

  private browserReply(postId: string, content: string, credential: Credential): ReplyResult {
    const instruction: BrowserInstruction = {
      mode: 'browser',
      action: 'reply',
      steps: [
        { action: 'navigate', url: `https://x.com/i/status/${postId}` },
        { action: 'wait', selector: 'div[data-testid="tweetTextarea_0"]' },
        { action: 'click', selector: 'div[data-testid="tweetTextarea_0"]' },
        { action: 'type', text: content },
        { action: 'click', selector: 'button[data-testid="tweetButton"]' },
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
    if (credential.authType === 'cookie') {
      return { valid: credential.value.length > 0, username: '(cookie mode — verify via browser)' };
    }
    try {
      const response = await fetch(`${X_API_V2}/users/me`, {
        headers: { 'Authorization': `Bearer ${credential.value}` },
      });
      if (!response.ok) return { valid: false, error: `HTTP ${response.status}` };
      const data = await response.json() as { data?: { username?: string } };
      return { valid: true, username: data.data?.username };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  rateLimitInfo(): RateLimitInfo {
    return {
      requestsPerMinute: 1,
      repliesPerDay: 15,
      minReplyIntervalSeconds: 300,
      notes: 'Free API: 17 req/24h, 500 posts/month. Cookie mode bypasses API limits but higher risk.',
    };
  }
}

const isMainModule = process.argv[1]?.replace(/\\/g, '/').endsWith('x-twitter.ts');
if (isMainModule && process.argv[2] === 'test') {
  const adapter = new XTwitterAdapter();
  console.log(JSON.stringify({
    adapter: 'x-twitter',
    status: 'ok',
    platformId: adapter.platformId,
    platformName: adapter.platformName,
    rateLimit: adapter.rateLimitInfo(),
  }));
}
