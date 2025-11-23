import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import fetch from 'cross-fetch';
import { SoundCloud } from 'scdl-core';
import { NotificationManager } from '../notifications/notificationManager';
import type { TrackInfo } from '../types';
import type ElectronStore from 'electron-store';
import sanitize from 'sanitize-filename';
import * as NodeID3 from 'node-id3';
import { log } from '../utils/logger';

export class DownloadService {
    private notificationManager: NotificationManager;
    private isConnected = false;
    private store: ElectronStore;

    constructor(notificationManager: NotificationManager, store: ElectronStore) {
        this.notificationManager = notificationManager;
        this.store = store;
    }

    private async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        try {
            log('[DownloadService] Connecting to SoundCloud...');
            await SoundCloud.connect();
            this.isConnected = true;
            log('[DownloadService] Connection to SoundCloud successful.');
        } catch (error) {
            let errorMessage = 'Failed to connect to SoundCloud for downloading.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            log(`[ERROR] [DownloadService] Connection failed:`, error);
            this.notificationManager.show(errorMessage);
        }
    }

    public async downloadTrack(trackInfo: TrackInfo, onStateChange: (status: 'downloading' | 'idle') => void): Promise<void> {
        // Ensure we are connected before trying to download
        await this.connect();

        if (!this.isConnected) {
            log('[ERROR] [DownloadService] Cannot download, not connected to SoundCloud.');
            onStateChange('idle');
            return;
        }

        if (!trackInfo || !trackInfo.url) {
            log('[ERROR] [DownloadService] Invalid track info provided.');
            this.notificationManager.show('Download failed: Invalid track info');
            onStateChange('idle');
            return;
        }

        onStateChange('downloading');

        const filename = sanitize(`${trackInfo.author} - ${trackInfo.title} (VilioSC).mp3`);
        const downloadPath = this.store.get('downloadPath') as string || app.getPath('downloads');
        const filePath = path.join(downloadPath, filename);

        log(`[DownloadService] Starting download for: ${filename}`);
        this.notificationManager.show(`Downloading: ${trackInfo.title}`);

        try {
            const stream = await SoundCloud.download(trackInfo.url);
            const writer = fs.createWriteStream(filePath);

            stream.pipe(writer);
            writer.on('close', async () => {
                log(`[DownloadService] Finished downloading: ${filename}`);

                // Wait a bit to ensure file lock is released
                setTimeout(async () => {
                    try {
                        const tags: NodeID3.Tags = {
                            title: trackInfo.title,
                            artist: trackInfo.author,
                            album: 'SoundCloud',
                            userDefinedText: [{
                                description: 'Downloaded via',
                                value: 'VilioSC'
                            }]
                        };

                        // Write tags to the file
                        const success = NodeID3.write(tags, filePath);
                        if (success) {
                            log(`[DownloadService] Metadata embedded successfully for: ${filename}`);
                        } else {
                            log(`[ERROR] [DownloadService] Failed to embed metadata for: ${filename}. NodeID3 returned false.`);
                        }
                    } catch (metaError) {
                        log(`[ERROR] [DownloadService] Error embedding metadata: ${metaError}`);
                    }

                    this.notificationManager.show(`Download complete: ${trackInfo.title}`);
                    onStateChange('idle');
                }, 1000); // 1 second delay
            });

            writer.on('error', (err) => {
                log(`[ERROR] [DownloadService] Error writing file: ${err.message}`);
                this.notificationManager.show(`Download failed: ${trackInfo.title}`);
                onStateChange('idle');
                // Clean up partially downloaded file
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) log(`[ERROR] [DownloadService] Failed to delete partial file: ${unlinkErr.message}`);
                });
            });

        } catch (error) {
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            log(`[ERROR] [DownloadService] Error downloading track: ${errorMessage}`);
            this.notificationManager.show(`Download failed: ${trackInfo.title}`);
            onStateChange('idle');
        }
    }

    private async fetchArtworkBuffer(trackInfo: TrackInfo): Promise<{ buffer: Buffer, mime: string } | null> {
        if (!trackInfo || !trackInfo.artwork) {
            return null;
        }

        try {
            // Strip query parameters
            const cleanArtworkUrl = trackInfo.artwork.split('?')[0];
            // Regex to remove the size suffix (e.g., -large.jpg, -t500x500.jpg)
            // We look for a hyphen followed by alphanumeric chars and then the extension at the end
            const baseArtworkUrl = cleanArtworkUrl.replace(/-[a-zA-Z0-9]+\.(jpg|png|jpeg)$/, '');

            // Define quality tiers
            const urlsToTry = [
                { url: `${baseArtworkUrl}-original.png`, mime: 'image/png' },
                { url: `${baseArtworkUrl}-original.jpg`, mime: 'image/jpeg' },
                { url: `${baseArtworkUrl}-t500x500.jpg`, mime: 'image/jpeg' }, // High quality fallback
                { url: `${baseArtworkUrl}-large.jpg`, mime: 'image/jpeg' },    // Standard quality
                { url: trackInfo.artwork, mime: 'image/jpeg' }                  // Last resort (original input)
            ];

            log(`[DownloadService] Fetching artwork for: ${trackInfo.title}`);
            log(`[DownloadService] Base URL derived: ${baseArtworkUrl}`);

            for (const item of urlsToTry) {
                try {
                    log(`[DownloadService] Trying URL: ${item.url}`);
                    const response = await fetch(item.url);
                    if (response.ok) {
                        // Trust the content-type header if present
                        const contentType = response.headers.get('content-type');
                        const finalMime = contentType || item.mime;

                        log(`[DownloadService] Found artwork at: ${item.url} (Status: ${response.status}, Content-Type: ${finalMime})`);

                        const buffer = Buffer.from(await response.arrayBuffer());
                        return { buffer, mime: finalMime };
                    } else {
                        log(`[DownloadService] Failed URL: ${item.url} (Status: ${response.status})`);
                    }
                } catch (e) {
                    log(`[DownloadService] Error fetching URL: ${item.url} (${e})`);
                }
            }

            log(`[DownloadService] Failed to fetch artwork from all attempted URLs.`);
            return null;
        } catch (error) {
            log(`[ERROR] [DownloadService] Error fetching artwork buffer: ${error}`);
            return null;
        }
    }

    public async downloadArtwork(trackInfo: TrackInfo): Promise<void> {
        if (!trackInfo || !trackInfo.artwork) {
            log('[ERROR] [DownloadService] Invalid track info or no artwork provided for artwork download.');
            this.notificationManager.show('Artwork download failed: Invalid track info');
            return;
        }

        this.notificationManager.show(`Downloading artwork for: ${trackInfo.title}`);

        try {
            const artworkData = await this.fetchArtworkBuffer(trackInfo);

            if (!artworkData) {
                throw new Error('Could not fetch artwork image.');
            }

            const downloadPath = this.store.get('downloadPath') as string || app.getPath('downloads');
            // Determine extension based on mime type
            const ext = artworkData.mime === 'image/png' ? 'png' : 'jpg';
            const artworkFilename = sanitize(`${trackInfo.author} - ${trackInfo.title} (VilioSC).${ext}`);
            const artworkPath = path.join(downloadPath, artworkFilename);

            log(`[DownloadService] Saving artwork to: ${artworkFilename}`);

            // Write the buffer to a file
            fs.writeFile(artworkPath, artworkData.buffer, (err) => {
                if (err) {
                    log(`[ERROR] [DownloadService] Error writing artwork file: ${err.message}`);
                    this.notificationManager.show(`Artwork download failed: ${trackInfo.title}`);
                } else {
                    log(`[DownloadService] Finished downloading artwork: ${artworkFilename}`);
                    this.notificationManager.show(`Artwork download complete: ${trackInfo.title}`);
                }
            });

        } catch (artworkError) {
            let errorMessage = 'An unknown error occurred while downloading artwork';
            if (artworkError instanceof Error) {
                errorMessage = artworkError.message;
            }
            log(`[ERROR] [DownloadService] Error downloading artwork: ${errorMessage}`);
            this.notificationManager.show(`Artwork download failed: ${trackInfo.title}`);
        }
    }
}