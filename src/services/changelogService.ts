import fetch from 'cross-fetch';
import { log } from '../utils/logger';

export interface ReleaseInfo {
    version: string;
    body: string;
    date: string;
    url: string;
}

export class ChangelogService {
    private readonly repo = '1vilio/sixonefour';
    private readonly apiUrl = `https://api.github.com/repos/${this.repo}/releases`;
    private cachedReleases: ReleaseInfo[] = [];

    public async getReleases(limit: number = 20): Promise<ReleaseInfo[]> {
        try {
            const response = await fetch(this.apiUrl, {
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'sixonefour-desktop',
                },
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            this.cachedReleases = data.map((item: any) => ({
                version: item.tag_name,
                body: this.cleanBody(item.body),
                date: new Date(item.published_at).toLocaleDateString(),
                url: item.html_url,
            }));

            return this.cachedReleases.slice(0, limit);
        } catch (error) {
            log(`[ERROR] [ChangelogService] Failed to fetch releases: ${error}`);
            return this.cachedReleases.length > 0 ? this.cachedReleases.slice(0, limit) : [];
        }
    }

    private cleanBody(body: string): string {
        if (!body) return 'No release notes available.';

        // Remove common CI artifacts or redundant headers if any
        return body
            .replace(/## What's Changed/g, '')
            .replace(/\* .*? by @.*? in .*?\n/g, '') // remove "by @user in PR" lines if too noisy
            .trim();
    }
}

export const changelogService = new ChangelogService();
