
import fetch from 'cross-fetch';
import fs from 'fs';
import FormData from 'form-data';
import { log } from '../utils/logger';

export interface TelegramOptions {
    botToken: string;
    chatId: string;
    userId?: string;
}

export class TelegramService {
    private botToken: string = '';
    private userId: string = '';
    private channelId: string = '';

    constructor() { }

    public setCredentials(token: string, userId: string = '', channelId: string = '') {
        this.botToken = token.trim();
        this.userId = userId.trim();
        this.channelId = channelId.trim();
        log(`[TelegramService] Credentials set. Bot Token length: ${this.botToken.length}, User ID: '${this.userId}', Channel ID: '${this.channelId}'`);
    }

    private get targetChatId(): string {
        return this.channelId ? this.channelId : this.userId;
    }

    public hasCredentials(): boolean {
        return !!this.botToken && !!this.userId;
    }

    public getUserId(): string {
        return this.userId;
    }

    private get baseUrl(): string {
        return `https://api.telegram.org/bot${this.botToken}`;
    }

    public async validateToken(token: string): Promise<boolean> {
        try {
            const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            const data = await response.json();
            return data.ok;
        } catch (error) {
            log(`[TelegramService] Token validation failed: ${error}`);
            return false;
        }
    }

    public async sendMessage(text: string, options: { parse_mode?: 'Markdown' | 'HTML', disable_web_page_preview?: boolean } = {}): Promise<boolean> {
        if (!this.hasCredentials()) return false;

        log(`[TelegramService] Sending message to Chat ID: '${this.targetChatId}'`);

        try {
            const response = await fetch(`${this.baseUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.targetChatId,
                    text: text,
                    ...options
                })
            });

            const data = await response.json();
            if (!data.ok) {
                log(`[TelegramService] Send message failed: ${data.description}`);
            }
            return data.ok;
        } catch (error) {
            log(`[TelegramService] Error sending message: ${error}`);
            return false;
        }
    }

    public async sendPhoto(photoUrl: string, caption?: string): Promise<boolean> {
        if (!this.hasCredentials()) return false;

        log(`[TelegramService] Sending photo to Chat ID: '${this.targetChatId}'`);

        try {
            const response = await fetch(`${this.baseUrl}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.targetChatId,
                    photo: photoUrl,
                    caption: caption,
                    parse_mode: 'HTML'
                })
            });

            const data = await response.json();
            if (!data.ok) {
                log(`[TelegramService] Send photo failed: ${data.description}`);
            }
            return data.ok;
        } catch (error) {
            log(`[TelegramService] Error sending photo: ${error}`);
            return false;
        }
    }

    public async sendAudio(filePath: string, caption?: string, performer?: string, title?: string, thumbPath?: string): Promise<boolean> {
        if (!this.hasCredentials()) return false;

        log(`[TelegramService] Sending audio to Chat ID: '${this.targetChatId}'`);

        try {
            const form = new FormData();
            form.append('chat_id', this.targetChatId);
            form.append('parse_mode', 'HTML');
            form.append('audio', fs.createReadStream(filePath));

            if (caption) form.append('caption', caption);
            if (performer) form.append('performer', performer);
            if (title) form.append('title', title);
            if (thumbPath && fs.existsSync(thumbPath)) {
                form.append('thumb', fs.createReadStream(thumbPath));
            }

            const response = await fetch(`${this.baseUrl}/sendAudio`, {
                method: 'POST',
                body: form as any,
                headers: form.getHeaders() // Important for multipart/form-data
            });

            const data = await response.json();
            if (!data.ok) {
                log(`[TelegramService] Send audio failed: ${data.description} (Error Code: ${data.error_code})`);
                console.error(`[TelegramService] Send audio failed: ${data.description}`);
            }
            return data.ok;
        } catch (error) {
            log(`[TelegramService] Error sending audio: ${error}`);
            console.error(`[TelegramService] Error sending audio: ${error}`);
            return false;
        }
    }
}
