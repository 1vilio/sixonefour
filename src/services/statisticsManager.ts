import { BrowserView, BrowserWindow } from 'electron';
import * as path from 'path';

export class StatisticsManager {
    private view: BrowserView;
    private isVisible = false;
    private parentWindow: BrowserWindow;

    constructor(parentWindow: BrowserWindow) {
        this.parentWindow = parentWindow;
        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                devTools: process.argv.includes('--dev'),
            },
        });

        this.parentWindow.addBrowserView(this.view);
        this.view.setBounds({ x: 0, y: -10000, width: 0, height: 0 });
        this.view.webContents.loadFile(path.join(__dirname, '..', 'statistics', 'statistics.html'));

        this.parentWindow.on('resize', () => {
            if (this.isVisible) {
                this.updateBounds();
            }
        });
    }

    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private updateBounds(): void {
        const bounds = this.parentWindow.getBounds();
        const width = Math.min(600, Math.floor(bounds.width * 0.5));
        const HEADER_HEIGHT = 32;

        this.view.setBounds({
            x: bounds.width - width,
            y: HEADER_HEIGHT,
            width,
            height: bounds.height - HEADER_HEIGHT,
        });
    }

    private show(): void {
        this.isVisible = true;
        this.updateBounds();
        this.parentWindow.setTopBrowserView(this.view);
        this.view.webContents.executeJavaScript(`
            document.body.style.opacity = '0';
            document.body.style.transform = 'translateX(20px)';
            document.body.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            requestAnimationFrame(() => {
                document.body.style.opacity = '1';
                document.body.style.transform = 'translateX(0)';
            });
        `);
    }

    public hide(): void {
        this.isVisible = false;
        this.view.webContents.executeJavaScript(`
            document.body.style.opacity = '0';
            document.body.style.transform = 'translateX(20px)';
        `);
        setTimeout(() => {
            // Check if it's still hidden before moving it
            if (!this.isVisible) {
                this.view.setBounds({ x: 0, y: -10000, width: 0, height: 0 });
            }
        }, 300);
    }

    public getView(): BrowserView {
        return this.view;
    }
}
