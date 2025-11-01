import { BrowserWindow, screen } from 'electron';
import path from 'path';
import type { TrackInfo } from '../types';
import type { ThemeColors } from '../utils/colorExtractor';

export class WidgetManager {
    private window: BrowserWindow | null = null;
    private isVisible = false;

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
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            hasShadow: false,
            webPreferences: {
                backgroundThrottling: false, // Keep video playing smoothly
                preload: path.join(__dirname, '..', 'preload-widget.js'),
                contextIsolation: true,
                webSecurity: false, // To allow local file loading
            },
        });

        // Open DevTools for debugging
        // this.window.webContents.openDevTools({ mode: 'detach' });

        const widgetPath = path.join(__dirname, '..', 'widget', 'widget.html');
        this.window.loadFile(widgetPath);

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

        const newState = !this.window.isAlwaysOnTop();
        this.window.setAlwaysOnTop(newState);
        this.window.webContents.send('widget-pin-state-changed', newState);
    }
}
