import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SoundCloud } from 'scdl-core';
import { NotificationManager } from '../notifications/notificationManager';
import type { TrackInfo } from '../types';
import type ElectronStore from 'electron-store';
import sanitize from 'sanitize-filename';

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
            console.log('[DownloadService] Connecting to SoundCloud...');
            await SoundCloud.connect();
            this.isConnected = true;
            console.log('[DownloadService] Connection to SoundCloud successful.');
        } catch (error) {
            let errorMessage = 'Failed to connect to SoundCloud for downloading.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            console.error(`[DownloadService] Connection failed:`, error);
            this.notificationManager.show(errorMessage);
        }
    }

    public async downloadTrack(trackInfo: TrackInfo, onStateChange: (status: 'downloading' | 'idle') => void): Promise<void> {
        // Ensure we are connected before trying to download
        await this.connect();

        if (!this.isConnected) {
            console.error('[DownloadService] Cannot download, not connected to SoundCloud.');
            onStateChange('idle');
            return;
        }

        if (!trackInfo || !trackInfo.url) {
            console.error('[DownloadService] Invalid track info provided.');
            this.notificationManager.show('Download failed: Invalid track info');
            onStateChange('idle');
            return;
        }

        onStateChange('downloading');

        const filename = sanitize(`${trackInfo.author} - ${trackInfo.title} (VilioSC).mp3`);
        const downloadPath = this.store.get('downloadPath') as string || app.getPath('downloads');
        const filePath = path.join(downloadPath, filename);

        console.log(`[DownloadService] Starting download for: ${filename}`);
        this.notificationManager.show(`Downloading: ${trackInfo.title}`);

        try {
            const stream = await SoundCloud.download(trackInfo.url);
            const writer = fs.createWriteStream(filePath);

            stream.pipe(writer);

            writer.on('finish', () => {
                console.log(`[DownloadService] Finished downloading: ${filename}`);
                this.notificationManager.show(`Download complete: ${trackInfo.title}`);
                onStateChange('idle');
            });

            writer.on('error', (err) => {
                console.error(`[DownloadService] Error writing file: ${err.message}`);
                this.notificationManager.show(`Download failed: ${trackInfo.title}`);
                onStateChange('idle');
                // Clean up partially downloaded file
            });

        } catch (error) {
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            console.error(`[DownloadService] Error downloading track: ${errorMessage}`);
            this.notificationManager.show(`Download failed: ${trackInfo.title}`);
            onStateChange('idle');
        }
    }
}