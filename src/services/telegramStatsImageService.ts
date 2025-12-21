import { BrowserWindow } from 'electron';
import { StatsResult } from './listeningStatsService';
import fetch from 'cross-fetch';
import fs from 'fs';
import path from 'path';

export class TelegramStatsImageService {
    /**
     * Generates a PNG image buffer for the weekly statistics.
     * Use offscreen rendering to capture a high-quality snapshot of a minimalist HTML template.
     */
    private static async getBase64Image(url: string | undefined): Promise<string> {
        if (!url) return '';
        try {
            // Ensure we get high-res if possible
            const highResUrl = url.replace('large', 't500x500');
            const response = await fetch(highResUrl);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
        } catch (e) {
            console.error(`[StatsImage] Failed to fetch image: ${url}`, e);
            return '';
        }
    }

    private static getLocalBase64(filePath: string): string {
        try {
            if (!fs.existsSync(filePath)) return '';
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).replace('.', '');
            return `data:image/${ext};base64,${buffer.toString('base64')}`;
        } catch (e) {
            console.error(`[StatsImage] Failed to read local image: ${filePath}`, e);
            return '';
        }
    }

    public static async generateStatsImage(stats: StatsResult, theme: 'white' | 'black'): Promise<Buffer> {
        const bgColor = theme === 'white' ? '#C0C0C0' : '#121212';
        const cardBg = theme === 'white' ? '#FFFFFF' : '#1E1E1E';
        const textColor = theme === 'white' ? '#000000' : '#FFFFFF';
        const subColor = theme === 'white' ? '#444444' : '#AAAAAA';
        const accentColor = '#F26101'; // SoundCloud Orange

        const now = new Date();
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const periodStr = `${start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} — ${now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;

        // Fetch all necessary images in parallel
        const top5Tracks = stats.topTracks.slice(0, 5);
        const top5Artists = stats.topArtists.slice(0, 5);

        const images = await Promise.all(top5Tracks.map(t => this.getBase64Image(t.artwork)));
        const artistImages = await Promise.all(top5Artists.map(a => this.getBase64Image(a.artwork)));
        const mostPlayedImage = stats.mostPlayedTrack ? await this.getBase64Image(stats.mostPlayedTrack.artwork) : '';

        // App Logo
        const logoPath = 'C:/Users/Vilio/.gemini/antigravity/brain/0229e1fe-47ea-45fd-9a50-c6446227fd3b/uploaded_image_1_1766329846128.png';
        const logoBase64 = this.getLocalBase64(logoPath);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
                    body {
                        margin: 0;
                        padding: 0;
                        width: 800px;
                        height: 1600px;
                        background-color: ${bgColor};
                        color: ${textColor};
                        font-family: 'Inter', sans-serif;
                        overflow: hidden;
                    }
                    .container {
                        width: 800px;
                        height: 1600px;
                        display: flex;
                        flex-direction: column;
                        padding: 50px;
                        box-sizing: border-box;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 40px;
                    }
                    .app-logo {
                        width: 120px;
                        height: auto;
                        margin-bottom: 20px;
                        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.2));
                    }
                    .header-title {
                        font-size: 18px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 8px;
                        color: ${accentColor};
                        margin-bottom: 15px;
                    }
                    .period {
                        font-size: 42px;
                        font-weight: 900;
                    }
                    
                    /* Summary Grid */
                    .summary-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 25px;
                        margin-bottom: 60px;
                    }
                    .summary-card {
                        background: ${cardBg};
                        padding: 30px;
                        border-radius: 24px;
                    }
                    .summary-label {
                        font-size: 14px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: ${subColor};
                        margin-bottom: 10px;
                    }
                    .summary-value {
                        font-size: 48px;
                        font-weight: 900;
                    }

                    /* Featured Section */
                    .featured-section {
                        margin-bottom: 60px;
                    }
                    .section-label {
                        font-size: 16px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 4px;
                        color: ${subColor};
                        margin-bottom: 25px;
                        display: block;
                    }
                    .most-played-card {
                        background: linear-gradient(135deg, ${accentColor} 0%, #D35400 100%);
                        color: white;
                        border-radius: 32px;
                        padding: 40px;
                        display: flex;
                        align-items: center;
                        gap: 35px;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    }
                    .most-played-artwork {
                        width: 180px;
                        height: 180px;
                        border-radius: 20px;
                        object-fit: cover;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
                        background: rgba(255,255,255,0.1);
                    }
                    .most-played-info {
                        flex: 1;
                    }
                    .most-played-title {
                        font-size: 38px;
                        font-weight: 900;
                        line-height: 1.1;
                        margin-bottom: 10px;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .most-played-artist {
                        font-size: 24px;
                        font-weight: 500;
                        opacity: 0.9;
                    }

                    /* Top Lists Grid */
                    .lists-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                        flex: 1;
                    }
                    .list-item {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    .list-artwork {
                        width: 60px;
                        height: 60px;
                        border-radius: 12px;
                        object-fit: cover;
                        background: ${cardBg};
                    }
                    .list-artwork.artist {
                        border-radius: 30px;
                    }
                    .list-info {
                        flex: 1;
                        min-width: 0;
                    }
                    .list-title {
                        font-size: 18px;
                        font-weight: 700;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        margin-bottom: 4px;
                    }
                    .list-subtitle {
                        font-size: 14px;
                        color: ${subColor};
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .list-rank {
                        font-size: 14px;
                        font-weight: 900;
                        color: ${accentColor};
                        width: 20px;
                    }

                    .footer {
                        text-align: center;
                        margin-top: 60px;
                        font-size: 12px;
                        font-weight: 700;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                        opacity: 0.3;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-section">
                        ${logoBase64 ? `<img src="${logoBase64}" class="app-logo">` : ''}
                        <div class="header-title">Weekly Report</div>
                        <div class="period">${periodStr}</div>
                    </div>
                    
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Tracks</div>
                            <div class="summary-value">${stats.totalTracksPlayed}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Time Spent</div>
                            <div class="summary-value">${stats.totalListeningTime.hours}h ${stats.totalListeningTime.minutes}m</div>
                        </div>
                    </div>

                    <div class="featured-section">
                        <span class="section-label">Most Played This Week</span>
                        ${stats.mostPlayedTrack ? `
                        <div class="most-played-card">
                            <img class="most-played-artwork" src="${mostPlayedImage || ''}">
                            <div class="most-played-info">
                                <div class="most-played-title">${stats.mostPlayedTrack.title}</div>
                                <div class="most-played-artist">${stats.mostPlayedTrack.artist}</div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="lists-grid">
                        <div>
                            <span class="section-label">Top Tracks</span>
                            ${top5Tracks.map((t, i) => `
                            <div class="list-item">
                                <span class="list-rank">${i + 1}</span>
                                <img class="list-artwork" src="${images[i]}">
                                <div class="list-info">
                                    <div class="list-title">${t.title}</div>
                                    <div class="list-subtitle">${t.artist}</div>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                        <div>
                            <span class="section-label">Top Artists</span>
                            ${top5Artists.map((a, i) => `
                            <div class="list-item">
                                <span class="list-rank">${i + 1}</span>
                                <img class="list-artwork artist" src="${artistImages[i]}">
                                <div class="list-info">
                                    <div class="list-title">${a.name}</div>
                                    <div class="list-subtitle">${a.playCount} plays</div>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="footer">sixonefour • DESKTOP SOUNDCLOUD CLIENT</div>
                </div>
            </body>
            </html>
        `;

        return new Promise((resolve, reject) => {
            const win = new BrowserWindow({
                width: 800,
                height: 1600,
                show: false,
                frame: false,
                transparent: true,
                enableLargerThanScreen: true,
                webPreferences: {
                    offscreen: true,
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            // Force size again
            win.setSize(800, 1600);

            win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            win.webContents.on('did-finish-load', async () => {
                try {
                    // Wait a bit longer for images to render
                    await new Promise(r => setTimeout(r, 2000));
                    const image = await win.webContents.capturePage({
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 1600
                    });
                    win.close();
                    resolve(image.toPNG());
                } catch (err) {
                    win.close();
                    reject(err);
                }
            });

            win.webContents.on('did-fail-load', () => {
                win.close();
                reject(new Error('Failed to load stats template'));
            });
        });
    }
}
