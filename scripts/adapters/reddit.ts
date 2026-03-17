// SECURITY MANIFEST:
//   Environment variables accessed: none
//   External endpoints called: https://oauth.reddit.com/search, https://oauth.reddit.com/api/comment
//   Local files read: none
//   Local files written: none

import type {
  PlatformAdapter,
  Credential,
  Post,
  ReplyResult,
  CheckResult,
  RateLimitInfo,
} from '../types.js';

const REDDIT_API = 'https://oauth.reddit.com';
const USER_AGENT = 'linux:seeddrop:2.0.0 (by /u/seeddrop-bot)';

function buildHeaders(credential: Credential): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };
  if (credential.authType === 'oauth' || credential.authType === 'api_token') {
    headers['Authorization'] = `Bearer ${credential.value}`;
  }
  return headers;
}

export class RedditAdapter implements PlatformAdapter {
  readonly platformId = 'reddit';
  readonly platformName = 'Reddit';

  async search(
    keyword: string,
    timeRange: string,
    credential: Credential,
    target?: string,
  ): Promise<Post[]> {
    try {
      const params = new URLSearchParams({
        q: keyword,
        sort: 'new',
        t: timeRange || 'day',
        type: 'link',
        limit: '25',
      });
      if (target) {
        params.set('restrict_sr', 'true');
      }

      const url = target
        ? `${REDDIT_API}/r/${target}/search?${params}`
        : `${REDDIT_API}/search?${params}`;

      const response = await fetch(url, { headers: buildHeaders(credential) });
      if (!response.ok) {
        console.error(`[reddit] Search failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as {
        data: {
          children: Array<{
            data: {
              id: string;
              permalink: string;
              title: string;
              selftext: string;
              author: string;
              created_utc: number;
              subreddit: string;
              link_flair_text?: string;
              stickied?: boolean;
              distinguished?: string | null;
            };
          }>;
        };
      };

      return data.data.children
        .filter(child => {
          const d = child.data;
          if (d.stickied || d.distinguished) return false;
          const flair = (d.link_flair_text ?? '').toLowerCase();
          if (['meta', 'announcement', 'mod post', 'official'].includes(flair)) return false;
          if (d.author === '[deleted]' || d.author === 'AutoModerator') return false;
          return true;
        })
        .map(child => {
          const d = child.data;
          return {
            id: d.id,
            url: `https://reddit.com${d.permalink}`,
            title: d.title,
            body: d.selftext,
            author: d.author,
            createdAt: new Date(d.created_utc * 1000).toISOString(),
            platform: this.platformId,
            subreddit: d.subreddit,
          };
        });
    } catch (error) {
      console.error(`[reddit] Search error: ${(error as Error).message}`);
      return [];
    }
  }

  async reply(
    postId: string,
    content: string,
    credential: Credential,
  ): Promise<ReplyResult> {
    try {
      const response = await fetch(`${REDDIT_API}/api/comment`, {
        method: 'POST',
        headers: {
          ...buildHeaders(credential),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          thing_id: `t3_${postId}`,
          text: content,
        }).toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Reddit API error: ${response.status}`,
          mode: 'api',
        };
      }

      const data = await response.json() as {
        json?: {
          data?: {
            things?: Array<{ data?: { id?: string } }>;
          };
          errors?: string[][];
        };
      };

      if (data.json?.errors?.length) {
        return {
          success: false,
          error: data.json.errors.map(e => e.join(': ')).join('; '),
          mode: 'api',
        };
      }

      return {
        success: true,
        replyId: data.json?.data?.things?.[0]?.data?.id,
        mode: 'api',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        mode: 'api',
      };
    }
  }

  async check(credential: Credential): Promise<CheckResult> {
    try {
      const response = await fetch(`${REDDIT_API}/api/v1/me`, {
        headers: buildHeaders(credential),
      });
      if (!response.ok) {
        return { valid: false, error: `HTTP ${response.status}` };
      }
      const data = await response.json() as { name?: string };
      return { valid: true, username: data.name };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  rateLimitInfo(): RateLimitInfo {
    return {
      requestsPerMinute: 60,
      repliesPerDay: 20,
      minReplyIntervalSeconds: 300,
      notes: 'Reddit OAuth: 60 req/min (10-min rolling window). User-Agent must follow format.',
    };
  }
}

if (process.argv[2] === 'test') {
  const adapter = new RedditAdapter();
  console.log(JSON.stringify({
    adapter: 'reddit',
    status: 'ok',
    platformId: adapter.platformId,
    platformName: adapter.platformName,
    rateLimit: adapter.rateLimitInfo(),
  }));
}
