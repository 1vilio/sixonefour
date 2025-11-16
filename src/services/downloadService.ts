import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import fetch from 'cross-fetch';
import { SoundCloud } from 'scdl-core';
import { NotificationManager } from '../notifications/notificationManager';
import type { TrackInfo } from '../types';
import type ElectronStore from 'electron-store';
import sanitize from 'sanitize-filename';
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

            writer.on('finish', () => {
                log(`[DownloadService] Finished downloading: ${filename}`);
                this.notificationManager.show(`Download complete: ${trackInfo.title}`);
                onStateChange('idle');
            });

            writer.on('error', (err) => {
                log(`[ERROR] [DownloadService] Error writing file: ${err.message}`);
                this.notificationManager.show(`Download failed: ${trackInfo.title}`);
                onStateChange('idle');
                // Clean up partially downloaded file
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

    public async downloadArtwork(trackInfo: TrackInfo): Promise<void> {
        if (!trackInfo || !trackInfo.artwork) {
            log('[ERROR] [DownloadService] Invalid track info or no artwork provided for artwork download.');
            this.notificationManager.show('Artwork download failed: Invalid track info');
            return;
        }

        this.notificationManager.show(`Downloading artwork for: ${trackInfo.title}`);

        try {
            // Try to get the original PNG, which is usually the highest quality
            const baseArtworkUrl = trackInfo.artwork.replace(/-\w+\.jpg$/, '');
            const artworkUrlPng = `${baseArtworkUrl}-original.png`;
            const artworkUrlJpg = `${baseArtworkUrl}-original.jpg`;

            const downloadPath = this.store.get('downloadPath') as string || app.getPath('downloads');
            const artworkFilename = sanitize(`${trackInfo.author} - ${trackInfo.title} (VilioSC).png`);
            const artworkPath = path.join(downloadPath, artworkFilename);

            log(`[DownloadService] Attempting to download artwork as PNG: ${artworkFilename}`);

            let response = await fetch(artworkUrlPng);
            
            // If PNG fails, fallback to JPG
            if (!response.ok) {
                log(`[DownloadService] PNG artwork not found, falling back to JPG.`);
                response = await fetch(artworkUrlJpg);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch artwork (tried PNG and JPG): ${response.statusText}`);
            }

            // Get the image data as a buffer
            const imageBuffer = await response.arrayBuffer();

            // Write the buffer to a file
            fs.writeFile(artworkPath, Buffer.from(imageBuffer), (err) => {
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