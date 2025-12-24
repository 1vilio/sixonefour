import { BrowserWindow, screen } from 'electron';
import path from 'path';
import type { TrackInfo } from '../types';
import type { ThemeColors } from '../utils/colorExtractor';

export class WidgetManager {
    private window: BrowserWindow | null = null;
    private isVisible = false;
    private isPinned = true; // Default to true as set in create()

    constructor() {
        // We will initialize the window when requested
    }

    private create(): void {
        if (this.window) return;

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width } = primaryDisplay.workAreaSize;

        this.window = new BrowserWindow({
            width: 350,
            height: 120,
            x: width - 400, // Position in top right
            y: 100,
            frame: false,
            transparent: true,
            alwaysOnTop: this.isPinned,
            resizable: false,
            skipTaskbar: true,
            show: false, // Don't show immediately
            hasShadow: false,
            webPreferences: {
                backgroundThrottling: false, // Keep video playing smoothly
                preload: path.join(__dirname, '..', 'preload-widget.js'),
                contextIsolation: true,
                webSecurity: false, // To allow local file loading
            },
        });

        // Use 'screen-saver' or 'pop-up-menu' for more reliable always-on-top on Windows
        if (this.isPinned) {
            this.window.setAlwaysOnTop(true, 'screen-saver');
        }

        const widgetPath = path.join(__dirname, '..', 'widget', 'widget.html');
        this.window.loadFile(widgetPath);

        // Sync pin state when window is ready
        this.window.webContents.on('did-finish-load', () => {
            this.window?.webContents.send('widget-pin-state-changed', this.isPinned);
        });

        this.window.on('closed', () => {
            this.window = null;
            this.isVisible = false;
        });
    }

    public toggle(): void {
        this.isVisible ? this.hide() : this.show();
    }

    public show(): void {
        if (!this.window) {
            this.create();
        }
        this.window?.show();
        this.isVisible = true;

        // Ensure state is synced when shown
        if (this.window) {
            this.window.webContents.send('widget-pin-state-changed', this.isPinned);
        }
    }

    public hide(): void {
        this.window?.hide();
        this.isVisible = false;
    }

    public updateTrack(trackInfo: TrackInfo): void {
        if (this.isVisible && this.window) {
            this.window.webContents.send('widget-track-update', trackInfo);
        }
    }

    public updateTheme(colors: ThemeColors | null, video: string | null, blur: number): void {
        if (this.isVisible && this.window) {
            this.window.webContents.send('widget-theme-update', { colors, video, blur });
        }
    }

    public togglePin(): void {
        if (!this.window) return;

        this.isPinned = !this.isPinned;

        // On Windows, 'screen-saver' or 'floating' level helps stay above other windows
        this.window.setAlwaysOnTop(this.isPinned, this.isPinned ? 'screen-saver' : 'normal');
        this.window.webContents.send('widget-pin-state-changed', this.isPinned);
    }
}
