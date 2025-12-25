import * as Ably from 'ably';
import { log } from '../utils/logger';
import type { BrowserWindow } from 'electron';
import type ElectronStore from 'electron-store';

export class OnlineUsersService {
    private client: Ably.Realtime | null = null;
    private channel: Ably.RealtimeChannel | null = null;
    private store: ElectronStore;
    private mainWindow: BrowserWindow | null = null;
    private headerView: any | null = null; // Can be BrowserView or any with webContents
    private isInitialized: boolean = false;
    private onlineCount: number = 0;

    constructor(store: ElectronStore) {
        this.store = store;
    }

    public initialize(mainWindow: BrowserWindow, headerView?: any): void {
        this.mainWindow = mainWindow;
        this.headerView = headerView;

        const apiKey = process.env.ABLY_API_KEY || this.store.get('ablyApiKey') as string;
        const enabled = this.store.get('onlineStatusEnabled', true) as boolean;

        if (!enabled || !apiKey) {
            log('[OnlineUsers] Service disabled or API Key missing.');
            return;
        }

        try {
            this.client = new Ably.Realtime({ key: apiKey, clientId: `user-${Math.random().toString(36).substr(2, 9)}` });
            this.channel = this.client.channels.get('app-presence');

            this.channel.presence.subscribe('enter', () => this.updatePresenceCount());
            this.channel.presence.subscribe('leave', () => this.updatePresenceCount());
            this.channel.presence.subscribe('present', () => this.updatePresenceCount());

            this.channel.presence.enter();

            // Initial count
            this.updatePresenceCount();

            this.isInitialized = true;
            log('[OnlineUsers] Service initialized and connected to Ably.');
        } catch (error) {
            log(`[ERROR] [OnlineUsers] Failed to initialize: ${error}`);
        }
    }

    private async updatePresenceCount(): Promise<void> {
        if (!this.channel) return;

        try {
            const presenceSet = await this.channel.presence.get();
            this.onlineCount = presenceSet.length;

            log(`[OnlineUsers] Updated count: ${this.onlineCount}`);

            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('online-users-count', this.onlineCount);
            }
            if (this.headerView && this.headerView.webContents && !this.headerView.webContents.isDestroyed()) {
                this.headerView.webContents.send('online-users-count', this.onlineCount);
            }
        } catch (error) {
            log(`[ERROR] [OnlineUsers] Failed to update count: ${error}`);
        }
    }

    public setEnabled(enabled: boolean): void {
        if (enabled && !this.isInitialized) {
            if (this.mainWindow) this.initialize(this.mainWindow);
        } else if (!enabled && this.isInitialized) {
            this.disconnect();
        }
    }

    public disconnect(): void {
        if (this.channel) {
            this.channel.presence.leave();
            this.channel.unsubscribe();
        }
        if (this.client) {
            this.client.close();
        }
        this.isInitialized = false;
        this.client = null;
        this.channel = null;
        log('[OnlineUsers] Disconnected from Ably.');
    }
}
