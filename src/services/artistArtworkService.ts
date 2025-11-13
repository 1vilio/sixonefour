import fetch from 'cross-fetch';

class ArtistArtworkService {
    private artworkCache = new Map<string, string>();

    public async getArtistArtwork(artistUrl: string): Promise<string | null> {
        if (this.artworkCache.has(artistUrl)) {
            return this.artworkCache.get(artistUrl) || null;
        }

        try {
            const response = await fetch(artistUrl);
            if (!response.ok) {
                console.error(`Failed to fetch artist page: ${response.statusText}`);
                return null;
            }

            const html = await response.text();
            const match = html.match(/<meta property="og:image" content="([^"]+)">/);

            if (match && match[1]) {
                const artworkUrl = match[1];
                console.log(`Found artist artwork for ${artistUrl}: ${artworkUrl}`);
                this.artworkCache.set(artistUrl, artworkUrl);
                return artworkUrl;
            }

            console.log(`Could not find artist artwork for ${artistUrl}`);
            return null;
        } catch (error) {
            console.error(`Error fetching or parsing artist page for ${artistUrl}:`, error);
            return null;
        }
    }
}

export const artistArtworkService = new ArtistArtworkService();
