
import { BrowserView } from 'electron';
import fetch from 'cross-fetch';

export interface ScrapedTrack {
    title: string;
    artist: string;
    url: string;
    artwork: string;
    dateLiked?: string;
}

export class LikesScraperService {
    private view: BrowserView;
    private isScraping: boolean = false;
    private oauthToken: string | null = null;
    private clientId: string | null = null;
    private userId: number | null = null;

    constructor(view: BrowserView) {
        this.view = view;
    }

    /**
     * Captures the OAuth token and Client ID by listening to network requests.
     * Navigates to a page to trigger requests if needed.
     */
    private async captureCredentials(): Promise<boolean> {
        if (this.oauthToken && this.clientId) return true;

        return new Promise((resolve) => {
            console.log('[LikesScraper] Capturing credentials via network interception...');

            const sess = this.view.webContents.session;
            const filter = {
                urls: ['*://api-v2.soundcloud.com/*']
            };

            let found = false;

            // Define listener
            const listener = (details: Electron.OnBeforeSendHeadersListenerDetails, callback: (response: Electron.BeforeSendResponse) => void) => {
                if (found) {
                    callback({ cancel: false, requestHeaders: details.requestHeaders });
                    return;
                }

                const auth = details.requestHeaders['Authorization'];
                // client_id might be in URL
                const url = new URL(details.url);
                const clientId = url.searchParams.get('client_id');

                if (auth && clientId) {
                    this.oauthToken = auth;
                    this.clientId = clientId;
                    console.log('[LikesScraper] Credentials captured successfully!');
                    found = true;

                    // We can stop listening now, but Electron doesn't have a simple "removeListener" for this inside the callback easily
                    // We'll just set a flag and clean up later or let it be (it's lightweight)
                    // Ideally we should remove it.
                }

                callback({ cancel: false, requestHeaders: details.requestHeaders });
            };

            // Attach listener
            sess.webRequest.onBeforeSendHeaders(filter, listener);

            // Trigger a request by loading the likes page (it triggers API calls)
            this.view.webContents.loadURL('https://soundcloud.com/you/likes');

            // Check periodically if we found it
            const checkInterval = setInterval(() => {
                if (found) {
                    clearInterval(checkInterval);
                    // Cleanup listener if possible, or just leave it (it's on the session)
                    // To remove, we would need to pass null, but that removes ALL listeners.
                    // Since we are the only ones likely using it for this filter, it might be okay.
                    // But to be safe, we can leave it or try to unregister.
                    // sess.webRequest.onBeforeSendHeaders(filter, null); // This would clear it.
                    resolve(true);
                }
            }, 500);

            // Timeout
            setTimeout(() => {
                if (!found) {
                    clearInterval(checkInterval);
                    console.log('[LikesScraper] Timeout capturing credentials.');
                    resolve(false);
                }
            }, 60000);
        });
    }

    private async getUserId(): Promise<number | null> {
        if (this.userId) return this.userId;
        if (!this.oauthToken || !this.clientId) return null;

        try {
            const response = await fetch(`https://api-v2.soundcloud.com/me?client_id=${this.clientId}`, {
                headers: {
                    'Authorization': this.oauthToken
                }
            });

            if (!response.ok) {
                console.error(`[LikesScraper] Failed to get user ID: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            this.userId = data.id;
            console.log(`[LikesScraper] Got User ID: ${this.userId}`);
            return data.id;
        } catch (e) {
            console.error('[LikesScraper] Error getting user ID:', e);
            return null;
        }
    }

    public async fetchTotalLikesCount(): Promise<number> {
        // With API, we can get the total count from the /me endpoint or just rely on the loop
        // But let's try to get it from /me
        if (!await this.captureCredentials()) return 0;

        try {
            const response = await fetch(`https://api-v2.soundcloud.com/me?client_id=${this.clientId}`, {
                headers: { 'Authorization': this.oauthToken! }
            });
            const data = await response.json();
            return data.likes_count || 0;
        } catch (e) {
            console.error('[LikesScraper] Error fetching total count:', e);
            return 0;
        }
    }

    public async getLatestLikes(limit: number = 5): Promise<ScrapedTrack[]> {
        if (!await this.captureCredentials()) return [];
        const userId = await this.getUserId();
        if (!userId) return [];

        try {
            const url = `https://api-v2.soundcloud.com/users/${userId}/track_likes?client_id=${this.clientId}&limit=${limit}&offset=0&linked_partitioning=1&app_version=1732696086`; // app_version is optional but good to have

            const response = await fetch(url, {
                headers: { 'Authorization': this.oauthToken! }
            });

            if (!response.ok) return [];

            const data = await response.json();
            const collection = data.collection || [];

            return collection.map((item: any) => {
                const track = item.track;
                return {
                    title: track.title,
                    artist: track.user.username,
                    url: track.permalink_url,
                    artwork: track.artwork_url ? track.artwork_url.replace('-large', '-t500x500') : '',
                    dateLiked: item.created_at
                };
            });
        } catch (e) {
            console.error('[LikesScraper] Error getting latest likes:', e);
            return [];
        }
    }

    public async scrapeAllLikes(
        onProgress: (count: number, total: number) => void,
        onTracksFound: (tracks: ScrapedTrack[]) => Promise<void>,
        shouldStop: () => boolean
    ): Promise<void> {
        if (this.isScraping) return;
        this.isScraping = true;

        try {
            console.log('[LikesScraper] Starting API-based scrape...');

            if (!await this.captureCredentials()) {
                console.error('[LikesScraper] Could not capture credentials.');
                return;
            }

            const userId = await this.getUserId();
            if (!userId) {
                console.error('[LikesScraper] Could not get User ID.');
                return;
            }

            const total = await this.fetchTotalLikesCount();
            console.log(`[LikesScraper] Total likes to fetch: ${total}`);

            let nextHref: string | null = `https://api-v2.soundcloud.com/users/${userId}/track_likes?client_id=${this.clientId}&limit=50&offset=0&linked_partitioning=1`;
            let processedCount = 0;

            while (nextHref && !shouldStop()) {
                console.log(`[LikesScraper] Fetching: ${nextHref}`);

                // Ensure we attach client_id if it's missing in next_href (sometimes it is)
                if (!nextHref.includes('client_id=')) {
                    nextHref += `&client_id=${this.clientId}`;
                }

                const response: any = await fetch(nextHref, {
                    headers: { 'Authorization': this.oauthToken! }
                });

                if (!response.ok) {
                    console.error(`[LikesScraper] API Error: ${response.status}`);
                    break;
                }

                const data: any = await response.json();
                const collection = data.collection || [];

                if (collection.length === 0) break;

                const tracks: ScrapedTrack[] = collection.map((item: any) => {
                    const track = item.track;
                    // Handle cases where track might be deleted or null
                    if (!track) return null;

                    return {
                        title: track.title,
                        artist: track.user ? track.user.username : 'Unknown',
                        url: track.permalink_url,
                        artwork: track.artwork_url ? track.artwork_url.replace('-large', '-t500x500') : '',
                        dateLiked: item.created_at
                    };
                }).filter((t: any) => t !== null);

                // Await processing of this batch before continuing!
                await onTracksFound(tracks);

                processedCount += tracks.length;
                onProgress(processedCount, total);

                nextHref = data.next_href;

                // Delay to avoid rate limiting (429)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.error(`[LikesScraper] Error scraping all likes: ${error}`);
        } finally {
            this.isScraping = false;
            console.log('[LikesScraper] Scraping finished.');
        }
    }
}
