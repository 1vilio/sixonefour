
import { app, BrowserWindow, BrowserView } from 'electron';
import path = require('path');

export class UrlInterceptorService {
    private mainWindow: BrowserWindow | null = null;
    private contentView: BrowserView | null = null;

    public initialize(mainWindow: BrowserWindow, contentView: BrowserView) {
        this.mainWindow = mainWindow;
        this.contentView = contentView;
    }

    public setup() {
        // This is necessary to make the app a handler for URLs on macOS
        // For Windows, registry changes are needed during installation.
        // We'll add the protocol client for a custom scheme to help with registration.
        const customProtocol = 'sixonefour';
        if (process.defaultApp) {
            if (process.argv.length >= 2) {
                app.setAsDefaultProtocolClient(customProtocol, process.execPath, [path.resolve(process.argv[1])]);
            }
        } else {
            app.setAsDefaultProtocolClient(customProtocol);
        }

        app.on('open-url', (event, url) => {
            const soundCloudRegex = /^(https?:\/\/)?(www\.)?(soundcloud\.com(\/.*)?)/;
            const match = url.match(soundCloudRegex);

            if (match && this.mainWindow && this.contentView) {
                event.preventDefault();
                // Reconstruct the URL to be safe, ensuring it has https
                const properUrl = 'https://' + (match[2] || '') + match[3];

                console.log(`[UrlInterceptorService] Intercepted SoundCloud URL: ${properUrl}`);

                if (this.mainWindow.isMinimized()) {
                    this.mainWindow.restore();
                }
                this.mainWindow.show();
                this.mainWindow.focus();

                console.log(`[UrlInterceptorService] Loading URL in contentView: ${properUrl}`);
                this.contentView.webContents.loadURL(properUrl);
            }
        });
    }
}
