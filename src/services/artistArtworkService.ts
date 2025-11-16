import fetch from 'cross-fetch';
import { log } from '../utils/logger';

class ArtistArtworkService {
    private artworkCache = new Map<string, string>();

    public async getArtistArtwork(artistUrl: string): Promise<string | null> {
        if (this.artworkCache.has(artistUrl)) {
            return this.artworkCache.get(artistUrl) || null;
        }

        try {
            const response = await fetch(artistUrl);
            if (!response.ok) {
                log(`[ERROR] [Artwork] Failed to fetch artist page: ${response.statusText}`);
                return null;
            }

            const html = await response.text();
            const match = html.match(/<meta property="og:image" content="([^"]+)">/);

            if (match && match[1]) {
                const artworkUrl = match[1];
                log(`[Artwork] Found artist artwork for ${artistUrl}: ${artworkUrl}`);
                this.artworkCache.set(artistUrl, artworkUrl);
                return artworkUrl;
            }

            log(`[WARN] [Artwork] Could not find artist artwork for ${artistUrl}`);
            return null;
        } catch (error) {
            log(`[ERROR] [Artwork] Error fetching or parsing artist page for ${artistUrl}:`, error);
            return null;
        }
    }
}

export const artistArtworkService = new ArtistArtworkService();
