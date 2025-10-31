import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SoundCloud } from 'scdl-core';
import { NotificationManager } from '../notifications/notificationManager';
import type { TrackInfo } from '../types';

export class DownloadService {
    private notificationManager: NotificationManager;
    private isConnected = false;

    constructor(notificationManager: NotificationManager) {
        this.notificationManager = notificationManager;
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
            console.error(`[DownloadService] Connection failed: ${errorMessage}`);
            this.notificationManager.show(errorMessage);
        }
    }

    private sanitizeFilename(filename: string): string {
        return filename.replace(/[\\/:*?"<>|]/g, '-');
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

        const filename = this.sanitizeFilename(`${trackInfo.author} - ${trackInfo.title}.mp3`);
        const downloadsPath = app.getPath('downloads');
        const filePath = path.join(downloadsPath, filename);

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