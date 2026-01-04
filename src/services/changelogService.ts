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
                    Accept: 'application/vnd.github.v3.html+json', // Request pre-rendered HTML
                    'User-Agent': 'sixonefour-desktop',
                },
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            log(`[DEBUG] [ChangelogService] Fetched ${data.length} releases.`);

            this.cachedReleases = data.map((item: any) => {
                // Use body_html provided by GitHub
                const finalBody = item.body_html || item.name || 'No release notes available for this version.';

                return {
                    version: item.tag_name,
                    body: finalBody,
                    date: new Date(item.published_at).toLocaleDateString(),
                    url: item.html_url,
                };
            });

            return this.cachedReleases.slice(0, limit);
        } catch (error) {
            log(`[ERROR] [ChangelogService] Failed to fetch releases: ${error}`);
            return this.cachedReleases.length > 0 ? this.cachedReleases.slice(0, limit) : [];
        }
    }
}

export const changelogService = new ChangelogService();
