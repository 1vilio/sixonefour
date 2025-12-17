import { app, ipcMain } from 'electron';
import { readFileSync, existsSync, readdirSync, statSync, watch } from 'fs';
import { join, basename, extname } from 'path';
import type ElectronStore from 'electron-store';
import { EventEmitter } from 'events';
import { extractThemeColors, type ThemeColors } from '../utils/colorExtractor';
import { log } from '../utils/logger';

export interface CustomTheme {
    name: string;
    filePath: string;
    css: string;
    videoBackground?: string;
    logo?: string;
}

export class ThemeService {
    private store: ElectronStore;
    private customThemes: Map<string, CustomTheme> = new Map();
    private currentCustomTheme: string | null = null;
    private themesPath: string;
    private emitter = new EventEmitter();
    private stopWatching?: () => void;

    constructor(store: ElectronStore) {
        this.store = store;
        this.themesPath = app.isPackaged
            ? join(app.getPath('userData'), 'themes')
            : join(__dirname, '..', '..', 'themes'); // Go up from tsc/services to project root
        this.ensureThemesDirectory();
        this.loadCustomThemes();
        this.setupIpcHandlers();
        this.startWatchingThemesFolder();

        const savedTheme = this.store.get('customTheme') as string;
        if (savedTheme && this.customThemes.has(savedTheme)) {
            this.currentCustomTheme = savedTheme;
        }
    }

    private ensureThemesDirectory(): void {
        try {
            if (!existsSync(this.themesPath)) {
                require('fs').mkdirSync(this.themesPath, { recursive: true });
                log(`[Themes] Created themes directory at: ${this.themesPath}`);
            }
        } catch (error) {
            log('[ERROR] [Themes] Failed to create themes directory:', error);
        }
    }

    private loadCustomThemes(): void {
        try {
            if (!existsSync(this.themesPath)) {
                return;
            }

            const files = readdirSync(this.themesPath);

            for (const file of files) {
                const filePath = join(this.themesPath, file);
                const stat = statSync(filePath);

                if (stat.isFile() && extname(file).toLowerCase() === '.css') {
                    try {
                        const css = readFileSync(filePath, 'utf-8');
                        const themeName = basename(file, '.css');

                        // Parse metadata from CSS comments
                        const metadata = this.parseThemeMetadata(css);

                        const theme: CustomTheme = {
                            name: themeName,
                            filePath,
                            css,
                        };

                        if (metadata['video-background']) {
                            const videoPath = join(this.themesPath, metadata['video-background']);
                            if (existsSync(videoPath)) {
                                theme.videoBackground = videoPath;
                            }
                        }

                        if (metadata['logo']) {
                            const logoPath = join(this.themesPath, metadata['logo']);
                            if (existsSync(logoPath)) {
                                theme.logo = logoPath;
                            }
                        }

                        this.customThemes.set(themeName, theme);

                        log(`[Themes] Loaded custom theme: ${themeName}`);
                    } catch (error) {
                        log(`[ERROR] [Themes] Failed to load theme ${file}:`, error);
                    }
                }
            }
        } catch (error) {
            log('[ERROR] [Themes] Failed to load custom themes:', error);
        }
    }

    private startWatchingThemesFolder(): void {
        try {
            if (!existsSync(this.themesPath)) return;

            // Close any previous watcher
            if (this.stopWatching) {
                this.stopWatching();
                this.stopWatching = undefined;
            }

            const watcher = watch(this.themesPath, { persistent: true }, (eventType, filename) => {
                if (!filename || extname(filename).toLowerCase() !== '.css') return;

                // Debounce rapid events per file
                const themeName = basename(filename, '.css');
                const filePath = join(this.themesPath, filename);

                const handleChange = () => {
                    try {
                        if (eventType === 'rename') {
                            // File added or removed or renamed – refresh all
                            this.refreshThemes();
                            // If current theme was removed, clear it
                            if (this.currentCustomTheme && !this.customThemes.has(this.currentCustomTheme)) {
                                this.currentCustomTheme = null;
                                this.store.delete('customTheme');
                                this.emitter.emit('custom-theme-updated', null);
                                return;
                            }
                        } else if (eventType === 'change') {
                            // Update just this file
                            if (existsSync(filePath)) {
                                const css = readFileSync(filePath, 'utf-8');
                                this.customThemes.set(themeName, { name: themeName, filePath, css });
                            }
                        }

                        // If the changed/added file is the current theme, notify listeners
                        if (this.currentCustomTheme && this.currentCustomTheme === themeName) {
                            this.emitter.emit('custom-theme-updated', themeName);
                        }
                    } catch (err) {
                        log('[ERROR] [Themes] Error handling theme file change:', err);
                    }
                };

                // Minimal debounce using microtask queue (avoids extra timers and still coalesces bursts)
                Promise.resolve().then(handleChange);
            });

            this.stopWatching = () => {
                try {
                    watcher.close();
                } catch { }
            };
        } catch (error) {
            log('[ERROR] [Themes] Failed to watch themes folder:', error);
        }
    }

    private setupIpcHandlers(): void {
        ipcMain.handle('get-custom-themes', () => {
            return Array.from(this.customThemes.values()).map((theme) => ({
                name: theme.name,
                filePath: theme.filePath,
            }));
        });

        ipcMain.handle('get-current-custom-theme', () => {
            return this.currentCustomTheme;
        });

        ipcMain.handle('apply-custom-theme', (_, themeName: string) => {
            return this.applyCustomTheme(themeName);
        });

        ipcMain.handle('remove-custom-theme', () => {
            return this.removeCustomTheme();
        });

        ipcMain.handle('get-themes-folder-path', () => {
            return this.themesPath;
        });

        ipcMain.handle('refresh-custom-themes', () => {
            this.customThemes.clear();
            this.loadCustomThemes();
            return Array.from(this.customThemes.values()).map((theme) => ({
                name: theme.name,
                filePath: theme.filePath,
            }));
        });

        ipcMain.handle('get-theme-colors', () => {
            return this.getCurrentThemeColors();
        });
    }

    public applyCustomTheme(themeName: string): boolean {
        try {
            if (themeName === 'none') {
                return this.removeCustomTheme();
            }

            const theme = this.customThemes.get(themeName);
            if (!theme) {
                log(`[ERROR] [Themes] Theme ${themeName} not found`);
                return false;
            }

            this.currentCustomTheme = themeName;
            this.store.set('customTheme', themeName);
            // Notify listeners so UI can update immediately
            this.emitter.emit('custom-theme-updated', themeName);

            log(`[Themes] Applied custom theme: ${themeName}`);
            return true;
        } catch (error) {
            log('[ERROR] [Themes] Failed to apply custom theme:', error);
            return false;
        }
    }

    public removeCustomTheme(): boolean {
        try {
            this.currentCustomTheme = null;
            this.store.delete('customTheme');
            // Notify listeners to remove style
            this.emitter.emit('custom-theme-updated', null);

            log('[Themes] Removed custom theme');
            return true;
        } catch (error) {
            log('[ERROR] [Themes] Failed to remove custom theme:', error);
            return false;
        }
    }

    public getCurrentCustomTheme(): CustomTheme | null {
        if (!this.currentCustomTheme) {
            return null;
        }
        return this.customThemes.get(this.currentCustomTheme) || null;
    }

    public _getCurrentCustomThemeCSS(): string | null {
        const theme = this.getCurrentCustomTheme();
        return theme ? theme.css : null;
    }

    public getCurrentThemeColors(): ThemeColors | null {
        const css = this._getCurrentCustomThemeCSS();
        if (!css) {
            return null;
        }

        return extractThemeColors(css);
    }

    public getThemesPath(): string {
        return this.themesPath;
    }

    public getAvailableThemes(): CustomTheme[] {
        return Array.from(this.customThemes.values());
    }

    public refreshThemes(): void {
        this.customThemes.clear();
        this.loadCustomThemes();
    }

    public onCustomThemeUpdated(listener: (themeName: string | null) => void): () => void {
        this.emitter.on('custom-theme-updated', listener);
        return () => this.emitter.off('custom-theme-updated', listener);
    }

    private parseThemeMetadata(css: string): { [key: string]: string } {
        const metadata: { [key: string]: string } = {};
        const metadataRegex = /\/\*\s*@([\w-]+):\s*"(.*?)";?\s*\*\//g;
        let match;
        while ((match = metadataRegex.exec(css)) !== null) {
            metadata[match[1]] = match[2];
        }
        return metadata;
    }
}
