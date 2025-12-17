import { app, ipcMain } from 'electron';
import { readFileSync, existsSync, readdirSync, statSync, watch } from 'fs';
import { join, basename, extname } from 'path';
import type ElectronStore from 'electron-store';
import { EventEmitter } from 'events';
import { extractThemeColors, type ThemeColors } from '../utils/colorExtractor';
import { log } from '../utils/logger';

export interface ThemeManifest {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    style: string;
    assets?: {
        logo?: string;
        videoBackground?: string;
    };
    targetStyles?: {
        header?: string;
        settings?: string;
    };
}

export interface CustomTheme {
    name: string;
    filePath: string; // Path to the main CSS file or manifest file
    css: string;
    videoBackground?: string;
    logo?: string;
    isManifest?: boolean;
    rootPath?: string; // Root folder of the theme if manifest-based
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

            const items = readdirSync(this.themesPath);

            for (const item of items) {
                const itemPath = join(this.themesPath, item);
                const stat = statSync(itemPath);

                if (stat.isDirectory()) {
                    // Try to load as Manifest Theme
                    this.loadManifestTheme(itemPath);
                } else if (stat.isFile() && extname(item).toLowerCase() === '.css') {
                    // Load as Legacy Theme
                    this.loadLegacyTheme(itemPath, item);
                }
            }
        } catch (error) {
            log('[ERROR] [Themes] Failed to load custom themes:', error);
        }
    }

    private loadManifestTheme(themeFolderPath: string): void {
        try {
            const manifestPath = join(themeFolderPath, 'theme.json');
            if (!existsSync(manifestPath)) return;

            const manifestContent = readFileSync(manifestPath, 'utf-8');
            const manifest: ThemeManifest = JSON.parse(manifestContent);

            if (!manifest.name || !manifest.style) {
                log(`[WARN] [Themes] Invalid manifest in ${themeFolderPath}: missing name or style`);
                return;
            }

            // Load main CSS
            const stylePath = join(themeFolderPath, manifest.style);
            if (!existsSync(stylePath)) {
                log(`[WARN] [Themes] Main style file missing for theme ${manifest.name}: ${stylePath}`);
                return;
            }
            const css = readFileSync(stylePath, 'utf-8');

            const theme: CustomTheme = {
                name: manifest.name,
                filePath: manifestPath,
                css: css,
                isManifest: true,
                rootPath: themeFolderPath
            };

            // Resolve assets relative to theme folder
            if (manifest.assets?.videoBackground) {
                const videoPath = join(themeFolderPath, manifest.assets.videoBackground);
                if (existsSync(videoPath)) {
                    theme.videoBackground = videoPath;
                }
            }

            if (manifest.assets?.logo) {
                const logoPath = join(themeFolderPath, manifest.assets.logo);
                if (existsSync(logoPath)) {
                    theme.logo = logoPath;
                }
            }

            // Future: Handle targetStyles by appending them to css with markers if needed, 
            // or storing them separately in CustomTheme. For now, we assume simple migration.

            this.customThemes.set(manifest.name, theme);
            log(`[Themes] Loaded manifest theme: ${manifest.name}`);

        } catch (error) {
            log(`[ERROR] [Themes] Failed to load manifest theme from ${themeFolderPath}:`, error);
        }
    }

    private loadLegacyTheme(filePath: string, fileName: string): void {
        try {
            const css = readFileSync(filePath, 'utf-8');
            const themeName = basename(fileName, '.css');

            // Parse metadata from CSS comments
            const metadata = this.parseThemeMetadata(css);

            const theme: CustomTheme = {
                name: themeName,
                filePath,
                css,
                isManifest: false
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
            log(`[Themes] Loaded legacy theme: ${themeName}`);
        } catch (error) {
            log(`[ERROR] [Themes] Failed to load legacy theme ${fileName}:`, error);
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

            const watcher = watch(this.themesPath, { persistent: true, recursive: true }, (_eventType, filename) => {
                if (!filename) return;
                const ext = extname(filename).toLowerCase();
                const base = basename(filename);
                if (ext !== '.css' && base !== 'theme.json') return;

                // Debounce rapid events per file
                // Note: filename might be inside a subdirectory if recursive watch was supported,
                // but fs.watch on Windows/Mac usually supports recursive or we need multiple watchers.
                // However, this.themesPath watcher might only see immediate children or we need to check how it behaves.
                // If we want to support nested theme.json editing, we might need a better watcher or recursive: true.
                // For now, assuming basic structure updates or standard fs.watch behavior.

                // Actually, Node's fs.watch 'recursive' option is platform dependent (macOS/Windows yes, Linux no).
                // Let's assume we want to refresh all themes on any relevant change.

                const handleChange = () => {
                    log(`[Themes] File changed: ${filename}, refreshing themes...`);
                    this.refreshThemes();
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

            // Important: Protocol handler 'theme://' now needs to know relative paths?
            // Actually, if we use absolute paths in themeService and pass them to UI,
            // we might need to adjust how we handle video backgrounds if they rely on simple filenames.

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
