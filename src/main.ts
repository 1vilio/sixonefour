import { app, BrowserWindow, Menu, ipcMain, BrowserView, Tray, nativeImage, protocol, dialog, shell } from 'electron';
// ... other imports

// ... inside init() function, or after other ipcMain.on handlers
ipcMain.on('open-external-link', (_event, url: string) => {
    shell.openExternal(url);
});
import { ElectronBlocker, fullLists } from '@ghostery/adblocker-electron';
import * as fs from 'fs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import fetch from 'cross-fetch';
import { setupDarwinMenu } from './macos/menu';
import { NotificationManager } from './notifications/notificationManager';
import { SettingsManager } from './settings/settingsManager';
import { StatisticsManager } from './services/statisticsManager';
import { ProxyService } from './services/proxyService';
import { PresenceService } from './services/presenceService';
import { TranslationService } from './services/translationService';
import { ThumbarService } from './services/thumbarService';
import { WebhookService } from './services/webhookService';
import { ThemeService } from './services/themeService';
import { ShortcutService } from './services/shortcutService';
import { DownloadService } from './services/downloadService';
import { WidgetManager } from './services/WidgetManager';
import { FansBoostingService } from './services/fansBoostingService';
import { ZapretService } from './services/zapretService';
import { UrlInterceptorService } from './services/urlInterceptorService';
import { audioMonitorScript } from './services/audioMonitorService';
import { TelegramService } from './services/telegramService';
import { LikesScraperService, ScrapedTrack } from './services/likesScraperService';
import type { TrackInfo, TrackUpdateMessage } from './types';
import { listeningStatsService, StatsTrackInfo } from './services/listeningStatsService';
import { databaseService } from './services/databaseService';
import { log, logFilePath } from './utils/logger';
import path = require('path');

import { platform } from 'os';

const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const windowStateManager = require('electron-window-state');

export const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');
console.log(`Resources path: ${RESOURCES_PATH}`);

// Store configuration
const store = new Store({
    defaults: {
        adBlocker: false,
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: '',
        proxyData: { user: '', password: '' },
        webhookEnabled: false,
        webhookUrl: '',
        webhookTriggerPercentage: 50,
        displayWhenIdling: false,
        displaySCSmallIcon: false,
        discordRichPresence: true,
        displayButtons: false,
        statusDisplayType: 1,
        theme: 'dark',
        backgroundBlur: 0,
        minimizeToTray: false,
        navigationControlsEnabled: false,
        trackParserEnabled: true,
        richPresencePreviewEnabled: false,
        autoUpdaterEnabled: true,
        themeAlwaysActive: false, // Keep theme animations active in background
        bypassMode: 'none', // 'none', 'dns', 'zapret'
        dnsAddress: '',
        widgetEnabled: false,
        openAtLogin: false,
        startInTray: false,
        telegramBotToken: '',
        telegramChannelId: '',
        telegramLiveFeedEnabled: false,
    },
    clearInvalidConfig: true,
    encryptionKey: 'sixonefour-config',
});

let isDarkTheme = store.get('theme') !== 'light';

// Global variables
let mainWindow: BrowserWindow;
let widgetManager: WidgetManager;
let notificationManager: NotificationManager;
let settingsManager: SettingsManager;
let statisticsManager: StatisticsManager;
let proxyService: ProxyService;
let presenceService: PresenceService;
let webhookService: WebhookService;
let translationService: TranslationService;
let thumbarService: ThumbarService;
let themeService: ThemeService;
let shortcutService: ShortcutService;
let downloadService: DownloadService;
let zapretService: ZapretService;
let fansBoostingService: FansBoostingService;
let urlInterceptorService: UrlInterceptorService;
let telegramService: TelegramService;
let likesScraperService: LikesScraperService;
let scraperView: BrowserView;
let liveFeedInterval: NodeJS.Timeout | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const devMode = process.argv.includes('--dev');
// Header height for header BrowserView
const HEADER_HEIGHT = 32;
// macOS check
const isMas = process.mas === true;

// Add missing property to app
declare global {
    namespace NodeJS {
        interface Global {
            app: any;
        }
    }
}

// Multiple startup check
if (!isMas) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        process.exit(0);
    }
}

// Extend app with custom property
Object.defineProperty(app, 'isQuitting', {
    value: false,
    writable: true,
    configurable: true,
});

// Display settings
let displayWhenIdling = store.get('displayWhenIdling') as boolean;
let displaySCSmallIcon = store.get('displaySCSmallIcon') as boolean;

// Update handling
function setupUpdater() {
    if (!store.get('autoUpdaterEnabled', true)) {
        log('[Updater] Auto-updater disabled by user setting.');
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
        log('[Updater] Update available.');
        queueToastNotification('Update Available');
    });

    autoUpdater.on('update-downloaded', () => {
        log('[Updater] Update downloaded.');
        queueToastNotification('Update Completed');
    });

    autoUpdater.on('error', (err: any) => {
        log('[ERROR] [Updater] ', err);
    });

    autoUpdater.checkForUpdates();
}

// Tray setup
function setupTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }

    // Create tray icon
    const iconPath = path.join(
        RESOURCES_PATH,
        'icons',
        process.platform === 'win32' ? 'soundcloud-win.ico' : 'soundcloud.png',
    );
    const icon = nativeImage.createFromPath(iconPath);

    // Resize icon for tray (16x16 is standard for most systems)
    const trayIcon = icon.resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('sixonefour');

    // Create tray menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'SoundCloud',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        {
            label: 'Settings',
            click: () => {
                if (settingsManager) {
                    settingsManager.toggle();
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);

    // Handle tray icon click (show window)
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();

            // Force re-apply theme after a short delay to ensure view is ready
            setTimeout(() => {
                applyThemeToContent(isDarkTheme);
            }, 100); // 100ms delay
        }
    });

    // Handle tray icon double-click (show window)
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// Update the language when retrieved from the web page
async function getLanguage() {
    if (!contentView) return;
    const langInfo = await contentView.webContents.executeJavaScript(`
        const langEl = document.querySelector('html');
        new Promise(resolve => {
            resolve({
                lang: langEl ? langEl.getAttribute('lang') : 'en',
            });
        })
    `);

    translationService.setLanguage(langInfo.lang);
}

// Browser window configuration
function createBrowserWindow(windowState: any): BrowserWindow {
    const window = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        frame: process.platform === 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
        trafficLightPosition: process.platform === 'darwin' ? { x: 10, y: 10 } : undefined,
        show: !store.get('startInTray', false),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            javascript: true,
            images: true,
            plugins: true,
            experimentalFeatures: false,
            devTools: devMode,
        },
        backgroundColor: isDarkTheme ? '#121212' : '#ffffff',
    });

    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

    window.webContents.setUserAgent(userAgent);

    const session = window.webContents.session;
    session.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('google') || details.url.includes('icloud') || details.url.includes('apple')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }

        const headers = {
            ...details.requestHeaders,
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': userAgent,
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        };
        callback({ requestHeaders: headers });
    });

    return window;
}

// Track info polling
let lastTrackInfo: TrackInfo = {
    title: '',
    author: '',
    artwork: '',
    elapsed: '',
    duration: '',
    isPlaying: false,
    url: '',
};

// Track current track for listening statistics
let currentTrackState: {
    id: string;
    totalListened: number; // Total seconds listened to this track (for 50% rule)
    accumulatedTime: number; // Seconds waiting to be flushed to DB
    loggedPlay: boolean;
    lastTimestamp: number;
    trackInfo: StatsTrackInfo;
} | null = null;

let isExporting = false;

function setupWindowControls() {
    if (!mainWindow) return;

    ipcMain.on('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    function adjustContentViews() {
        if (!mainWindow || !contentView || !headerView) return;

        const { width, height } = mainWindow.getContentBounds();

        headerView.setBounds({
            x: 0,
            y: 0,
            width,
            height: HEADER_HEIGHT,
        });

        contentView.setBounds({
            x: 0,
            y: HEADER_HEIGHT,
            width,
            height: height - HEADER_HEIGHT,
        });
    }

    ipcMain.on('title-bar-double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    mainWindow.on('maximize', () => {
        adjustContentViews();
    });

    mainWindow.on('unmaximize', () => {
        adjustContentViews();
    });

    mainWindow.on('resize', () => {
        adjustContentViews();
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) {
            const minimizeToTray = store.get('minimizeToTray', true);
            if (minimizeToTray) {
                mainWindow.hide();
            } else {
                mainWindow.close();
            }
        }
    });

    // Navigation handlers
    ipcMain.on('navigate-back', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    ipcMain.on('navigate-forward', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    ipcMain.on('refresh-page', () => {
        if (contentView) {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', true);
            }
            console.log('Manual refresh triggered - reloading page');
            contentView.webContents.reload();
        }
    });

    ipcMain.on('cancel-refresh', () => {
        if (contentView) {
            contentView.webContents.stop();
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', false);
            }
        }
    });

    ipcMain.on('toggle-theme', () => {
        isDarkTheme = !isDarkTheme;
        if (headerView && headerView.webContents) {
            headerView.webContents.send('theme-changed', isDarkTheme);
        }
        applyThemeToContent(isDarkTheme);
    });

    // Handle is-maximized requests
    ipcMain.handle('is-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    // Handle minimize to tray setting
    ipcMain.handle('get-minimize-to-tray', () => {
        return store.get('minimizeToTray', true);
    });

    // Handle navigation controls enabled setting
    ipcMain.handle('get-navigation-controls-enabled', () => {
        return store.get('navigationControlsEnabled', false);
    });

    adjustContentViews();
}

let headerView: BrowserView | null;
let contentView: BrowserView;

// Main initialization
async function init() {
    setupTray(); // Call setupTray here

    if (process.platform === 'darwin') setupDarwinMenu();
    else Menu.setApplicationMenu(null);

    const windowState = windowStateManager({ defaultWidth: 800, defaultHeight: 800 });
    mainWindow = createBrowserWindow(windowState);

    windowState.manage(mainWindow);

    // Explicitly hide the window if startInTray is enabled
    if (store.get('startInTray', false)) {
        mainWindow.hide();
    }

    // Handle window close event for minimize to tray
    mainWindow.on('close', (event) => {
        const minimizeToTray = store.get('minimizeToTray', true);
        if (minimizeToTray && !isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle window minimize event
    mainWindow.on('minimize', () => {
        const minimizeToTray = store.get('minimizeToTray', true);
        if (minimizeToTray) {
            mainWindow.hide();
        }
    });

    // Handle window show event (re-apply theme if throttling is enabled)
    mainWindow.on('show', () => {
        if (!store.get('themeAlwaysActive', false)) {
            applyThemeToContent(isDarkTheme);
        }
    });

    headerView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.addBrowserView(headerView);
    headerView.setBounds({ x: 0, y: 0, width: mainWindow.getBounds().width, height: 32 });
    headerView.setAutoResize({ width: true, height: false });
    headerView.webContents.loadFile(path.join(__dirname, 'header', 'header.html'));

    contentView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: devMode,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: !store.get('themeAlwaysActive', false),
        },
    });

    mainWindow.addBrowserView(contentView);
    contentView.setBounds({
        x: 0,
        y: 32,
        width: mainWindow.getBounds().width,
        height: mainWindow.getBounds().height - 32,
    });
    contentView.setAutoResize({ width: true, height: true });

    contentView.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Initialize and set up the URL interceptor service
    urlInterceptorService = new UrlInterceptorService();
    urlInterceptorService.initialize(mainWindow, contentView);
    urlInterceptorService.setup();

    // Initialize services
    databaseService.initialize();
    translationService = new TranslationService();
    themeService = new ThemeService(store);
    widgetManager = new WidgetManager(); // Instantiate WidgetManager

    // Show widget on startup if it was enabled
    if (store.get('widgetEnabled')) {
        widgetManager.show();
    }

    // Register custom theme protocol
    const themesPath = themeService.getThemesPath();
    protocol.registerFileProtocol('theme', (request: Electron.ProtocolRequest, callback: (response: string | Electron.ProtocolResponse) => void) => {
        const url = request.url.substr('theme://'.length);
        callback({ path: path.join(themesPath, url) });
    });

    // Hot-reload custom theme CSS when files change
    themeService.onCustomThemeUpdated(() => {
        applyThemeToContent(isDarkTheme);
    });
    notificationManager = new NotificationManager(mainWindow);
    downloadService = new DownloadService(notificationManager, store);
    settingsManager = new SettingsManager(mainWindow, store, translationService);
    statisticsManager = new StatisticsManager(mainWindow);

    listeningStatsService.events.on('stats-updated', () => {
        if (statisticsManager) {
            const statsView = statisticsManager.getView();
            if (statsView && statsView.webContents) {
                statsView.webContents.send('stats-updated');
            }
        }
    });

    proxyService = new ProxyService(mainWindow, store, queueToastNotification);
    presenceService = new PresenceService(store, translationService);
    webhookService = new WebhookService(store);
    shortcutService = new ShortcutService();
    shortcutService.setWindow(mainWindow);
    zapretService = new ZapretService();
    fansBoostingService = new FansBoostingService(contentView);

    // Initialize Telegram Service
    telegramService = new TelegramService();
    telegramService.setCredentials(
        store.get('telegramBotToken', '') as string,
        store.get('telegramChannelId', '') as string
    );

    // Initialize Scraper View and Service
    scraperView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Share session with main window (default session)
        }
    });

    // Attach scraper view but keep it behind content
    mainWindow.addBrowserView(scraperView);
    scraperView.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
    // Ensure content view is on top
    mainWindow.setTopBrowserView(headerView);
    mainWindow.setTopBrowserView(contentView);
    likesScraperService = new LikesScraperService(scraperView);

    // Telegram IPC Handlers
    ipcMain.handle('telegram-save-settings', (_event, { token, channelId, username }) => {
        token = token.trim();
        channelId = channelId.trim();
        username = username.trim();
        store.set('telegramBotToken', token);
        store.set('telegramChannelId', channelId);
        store.set('telegramUsername', username);
        telegramService.setCredentials(token, channelId);
        return true;
    });

    ipcMain.handle('telegram-get-settings', () => {
        return {
            token: store.get('telegramBotToken', ''),
            channelId: store.get('telegramChannelId', ''),
            username: store.get('telegramUsername', '')
        };
    });



    ipcMain.handle('telegram-validate-token', async (_event, token) => {
        return await telegramService.validateToken(token);
    });

    ipcMain.on('telegram-mass-export-start', async () => {
        if (!telegramService.hasCredentials()) {
            queueToastNotification('Please configure Telegram settings first.');
            return;
        }

        log('[Telegram] Starting Mass Export...');
        queueToastNotification('Starting Mass Export...');
        isExporting = true;

        // Listen for stop signal
        ipcMain.once('telegram-mass-export-stop', () => {
            isExporting = false;
            console.log('[Telegram] Mass export stop signal received.');
        });

        await likesScraperService.scrapeAllLikes(
            (count, total) => {
                console.log(`[Telegram] Export progress: ${count}/${total}`);
                if (settingsManager) {
                    settingsManager.getView().webContents.send('telegram-export-progress', { count, total });
                }
            },
            async (tracks) => {
                if (!isExporting) return;
                console.log(`[Telegram] Processing batch of ${tracks.length} tracks...`);
                for (const [index, track] of tracks.entries()) {
                    if (!isExporting) break;
                    await processTrackForTelegram(track, false);

                    // Rate limiting: 2 seconds between tracks
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Pause every 20 tracks for 60 seconds
                    if ((index + 1) % 20 === 0) {
                        console.log('[Telegram] Pausing for 60s to avoid spam filter...');
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    }
                }
            },
            () => {
                if (!isExporting) console.log('[Telegram] Stop signal detected in scraper loop.');
                return !isExporting;
            }
        );

        isExporting = false;
        log('[Telegram] Mass Export finished.');
        console.log('[Telegram] Mass export finished.');
        queueToastNotification(`Mass Export finished.`); // Removed exportedCount as it's not tracked in this version
        if (settingsManager) {
            settingsManager.getView().webContents.send('telegram-export-finished');
        }
    });

    ipcMain.on('telegram-live-feed-toggle', (_event, enabled) => {
        store.set('telegramLiveFeedEnabled', enabled);
        if (enabled) {
            startLiveFeed();
        } else {
            stopLiveFeed();
        }
    });

    // Start Live Feed if enabled
    // Start Live Feed if enabled (with delay to allow app to settle)
    if (store.get('telegramLiveFeedEnabled', false)) {
        log('[Telegram] Scheduling Live Feed start in 15s...');
        setTimeout(() => {
            startLiveFeed();
        }, 15000);
    }

    fansBoostingService = new FansBoostingService(contentView);

    // Fans Boosting IPC
    ipcMain.on('fans-boost-start', (_event, { url, count, fingerprintOptions, schedulingOptions }) => {
        fansBoostingService.setCallbacks(
            (msg) => {
                if (settingsManager) {
                    settingsManager.getView().webContents.send('fans-boost-log', msg);
                }
            },
            (current, target) => {
                if (settingsManager) {
                    settingsManager.getView().webContents.send('fans-boost-progress', { current, target });
                }
            },
            (info) => {
                if (settingsManager) {
                    settingsManager.getView().webContents.send('fans-boost-info', info);
                }
            }
        );
        fansBoostingService.start(url, count, fingerprintOptions, schedulingOptions);
    });

    ipcMain.on('fans-boost-stop', () => {
        fansBoostingService.stop();
    });



    // Start Zapret service if it was enabled on last run
    if (store.get('bypassMode') === 'zapret') {
        zapretService.start();
    }

    if (platform() === 'win32') thumbarService = new ThumbarService(translationService);

    // Add settings toggle handler
    ipcMain.on('toggle-settings', () => {
        settingsManager.toggle();
    });

    ipcMain.on('open-log-file', () => {
        shell.openPath(logFilePath).catch(err => log('[ERROR] Failed to open log file:', err));
    });

    // Add statistics toggle handler
    ipcMain.on('open-statistics-window', () => {
        statisticsManager.toggle();
    });

    ipcMain.on('navigate-in-app', (_event, url: string) => {
        if (contentView) {
            contentView.webContents.loadURL(url);
        } else if (mainWindow) {
            mainWindow.loadURL(url);
        }
        // Close stats window if open
        statisticsManager.hide();
    });

    ipcMain.on('toggle-statistics', () => {
        statisticsManager.toggle();
    });

    ipcMain.handle('get-listening-stats', async (_event, period: 'weekly' | 'monthly' | 'thisYear' | 'allTime') => {
        return listeningStatsService.getStats(period);
    });

    // Handle in-app navigation from statistics links
    ipcMain.on('navigate-in-app', (_event, url: string) => {
        if (contentView) {
            contentView.webContents.loadURL(url);
            // Optionally hide the statistics panel after navigation
            if (statisticsManager) {
                statisticsManager.toggle();
            }
        }
    });

    // Handle Widget Actions
    type WidgetAction = 'playPause' | 'nextTrack' | 'prevTrack';
    const playerActions: { [key in WidgetAction]: string } = {
        playPause: 'document.querySelector(".playControls__play").click()',
        nextTrack: 'document.querySelector(".playControls__next").click()',
        prevTrack: 'document.querySelector(".playControls__prev").click()'
    };

    ipcMain.on('widget-action', (_, action: WidgetAction) => {
        if (!contentView) return;
        const code = playerActions[action];

        if (code) {
            contentView.webContents.executeJavaScript(code).catch(err => log('[ERROR] Failed to execute widget action JS:', err));
        }
    });

    ipcMain.on('widget-toggle-pin', () => {
        if (widgetManager) {
            widgetManager.togglePin();
        }
    });

    setupWindowControls();

    app.setLoginItemSettings({ openAtLogin: store.get('openAtLogin', false) });

    initializeShortcuts();
    shortcutService.setup();
    registerGlobalShortcuts();

    setupThemeHandlers();
    setupTranslationHandlers();
    setupAudioHandler();

    // Handle download request
    ipcMain.on('download-current-track', () => {
        if (lastTrackInfo && lastTrackInfo.url) {
            downloadService.downloadTrack(lastTrackInfo, (status) => {
                if (headerView) {
                    headerView.webContents.send('download-state-changed', { status });
                }
            });
        } else {
            log('[WARN] [Main] No track info available to download.');
            notificationManager.show('No track is currently playing.');
        }
    });

    // Handle artwork download request
    ipcMain.handle('download-artwork', () => {
        if (lastTrackInfo && lastTrackInfo.url) {
            downloadService.downloadArtwork(lastTrackInfo);
        } else {
            log('[WARN] [Main] No track info available to download artwork.');
            notificationManager.show('No track is currently playing.');
        }
    });

    // Provide current track info to settings preview on demand
    ipcMain.handle('get-current-track', () => {
        return lastTrackInfo;
    });

    ipcMain.handle('get-store-value', (_event, key) => {
        return store.get(key);
    });

    ipcMain.handle('get-default-download-path', () => {
        return app.getPath('downloads');
    });

    ipcMain.handle('reset-download-path', () => {
        store.delete('downloadPath');
        return app.getPath('downloads');
    });

    ipcMain.handle('select-download-directory', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });

        if (result.canceled) {
            return;
        }

        const path = result.filePaths[0];
        store.set('downloadPath', path);
        return path;
    });

    // Configure session
    const session = contentView.webContents.session;
    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    session.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('google')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }
        const headers = {
            ...details.requestHeaders,
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': userAgent,
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        };
        callback({ requestHeaders: headers });
    });

    // Apply initial settings
    await proxyService.apply();
    contentView.webContents.loadURL('https://soundcloud.com/discover');

    // Function to update navigation state in header
    function updateNavigationState() {
        if (headerView && headerView.webContents && contentView) {
            const state = {
                canGoBack: contentView.webContents.navigationHistory.canGoBack(),
                canGoForward: contentView.webContents.navigationHistory.canGoForward(),
            };
            headerView.webContents.send('navigation-state-changed', state);
        }
    }

    // Listen for navigation events to update button states and URL
    function handleNavigation(url: string) {
        updateNavigationState();
        if (headerView && headerView.webContents) {
            headerView.webContents.send('update-url', url);
        }
    }

    contentView.webContents.on('did-navigate', (_event, url) => {
        handleNavigation(url);
    });

    contentView.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
        // Only update for main frame navigations to get the clean URL
        if (isMainFrame) {
            handleNavigation(url);
        }
    });

    // Listen for page load events to manage refresh state
    contentView.webContents.on('did-start-loading', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', true);
        }
    });

    contentView.webContents.on('did-stop-loading', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', false);
        }
        updateNavigationState();
    });

    contentView.webContents.on('did-fail-load', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', false);
        }
        updateNavigationState();
    });

    // Track if this is initial load
    let isInitialLoad = true;

    // Setup event handlers
    contentView.webContents.on('did-finish-load', async () => {
        // Initialize adblocker once the page is loaded
        if (store.get('adBlocker')) {
            try {
                const blocker = await ElectronBlocker.fromLists(
                    fetch,
                    fullLists,
                    { enableCompression: true },
                    {
                        path: path.join(app.getPath('userData'), 'engine.bin'),
                        read: async (...args) => readFileSync(...args),
                        write: async (...args) => writeFileSync(...args),
                    },
                );
                blocker.enableBlockingInSession(contentView.webContents.session);
            } catch (error) {
                log('[ERROR] Failed to initialize adblocker:', error);
            }
        }

        // Get the current language from the page FIRST
        await getLanguage();

        // Defer non-essential startup tasks
        setupUpdater();

        // Show notification only on first load
        if (isInitialLoad) {
            notificationManager.show(translationService.translate('pressF1ToOpenSettings'));
            isInitialLoad = false;
        }

        // Update the language in the settings manager
        settingsManager.updateTranslations(translationService);

        // Update navigation state after page load
        updateNavigationState();

        // Initialize navigation controls visibility
        const navigationEnabled = store.get('navigationControlsEnabled', false);
        if (headerView && headerView.webContents) {
            headerView.webContents.send('navigation-controls-toggle', navigationEnabled);
        }

        // Reinitialize after page load/refresh
        await reinitializeAfterPageLoad();
    });

    // Reinitialize everything after page load/refresh
    async function reinitializeAfterPageLoad() {
        try {
            // Reapply theme to content after page reload
            applyThemeToContent(isDarkTheme);

            // Inject audio monitoring script
            await contentView.webContents.executeJavaScript(audioMonitorScript);

            if (presenceService) {
                await presenceService.updatePresence(lastTrackInfo as any);
            }
        } catch (error) {
            log('[ERROR] Failed to reinitialize after page load:', error);
        }
    }

    // Register settings related events
    ipcMain.on('setting-changed', async (_event, data) => {
        const key = proxyService.transformKey(data.key);
        store.set(key, data.value);

        log(`Setting changed: ${key} = ${data.value}`);

        if (key === 'displayWhenIdling') {
            displayWhenIdling = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        } else if (key === 'displaySCSmallIcon') {
            displaySCSmallIcon = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        } else if (key === 'displayButtons') {
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon, data.value);
            presenceService.updatePresence(lastTrackInfo as any);
        } else if (key === 'minimizeToTray') {
            // Update tray behavior when setting changes
            if (data.value === false && tray) {
                // If minimize to tray is disabled, destroy the tray
                tray.destroy();
                tray = null;
            } else if (data.value === true && !tray) {
                // If minimize to tray is enabled, create the tray
                setupTray();
            }
        } else if (key === 'webhookEnabled') {
            webhookService.setEnabled(data.value);
        } else if (key === 'webhookUrl') {
            webhookService.setWebhookUrl(data.value);
        } else if (key === 'webhookTriggerPercentage') {
            webhookService.setTriggerPercentage(data.value);
        } else if (key === 'navigationControlsEnabled') {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('navigation-controls-toggle', data.value);
            }
        } else if (key === 'autoUpdaterEnabled') {
            if (data.value) {
                setupUpdater();
            } else {
                console.log('Auto-updater disabled by user');
            }
        } else if (key === 'bypassMode') {
            const oldMode = store.get('bypassMode') as string;
            const newMode = data.value as string;

            if (oldMode === 'zapret' && newMode !== 'zapret') {
                zapretService.stop();
            }

            if (newMode === 'zapret') {
                zapretService.start();
            }

            store.set('bypassMode', newMode);

            if (newMode === 'dns' || oldMode === 'dns') {
                queueToastNotification('DNS settings changed. Please restart the app.');
            }
        } else if (key === 'dnsAddress') {
            store.set('dnsAddress', data.value);
            if (store.get('bypassMode') === 'dns') {
                queueToastNotification('DNS settings changed. Please restart the app.');
            }
        } else if (key === 'customTheme') {
            if (data.value === 'none') {
                themeService.removeCustomTheme();
            } else {
                themeService.applyCustomTheme(data.value);
            }
            // Re-apply the theme to all content
            applyThemeToContent(isDarkTheme);
        } else if (key === 'backgroundBlur') {
            applyThemeToContent(isDarkTheme);
        } else if (key === 'widgetEnabled') {
            data.value ? widgetManager.show() : widgetManager.hide();
        } else if (key === 'openAtLogin') {
            app.setLoginItemSettings({
                openAtLogin: data.value,
                openAsHidden: store.get('startInTray', false),
            });
        } else if (key === 'startInTray') {
            if (store.get('openAtLogin', false)) {
                app.setLoginItemSettings({
                    openAtLogin: true,
                    openAsHidden: data.value,
                });
            }
        } else if (key.startsWith('hotkeys.')) {
            registerGlobalShortcuts();
        }
    });

    // Handle applying all changes
    ipcMain.on('apply-changes', async () => {
        if (store.get('proxyEnabled')) {
            await proxyService.apply();
        }

        if (store.get('adBlocker')) {
            mainWindow.webContents.reload();
        }

        if (store.get('discordRichPresence')) {
            // Refresh presence using the current track info instead of reconnecting
            await presenceService.updatePresence(lastTrackInfo as any);
        } else {
            presenceService.clearActivity();
        }
    });
}

function registerGlobalShortcuts() {
    shortcutService.unregister('playPause');
    shortcutService.unregister('next');
    shortcutService.unregister('previous');

    const hotkeys = store.get('hotkeys', {});
    if (hotkeys.playPause) {
        shortcutService.register('playPause', hotkeys.playPause, 'Play/Pause', () => {
            contentView.webContents.executeJavaScript('document.querySelector(".playControls__play").click()');
        }, true, true);
    }
    if (hotkeys.next) {
        shortcutService.register('next', hotkeys.next, 'Next', () => {
            contentView.webContents.executeJavaScript('document.querySelector(".playControls__next").click()');
        }, true, true);
    }
    if (hotkeys.previous) {
        shortcutService.register('previous', hotkeys.previous, 'Previous', () => {
            contentView.webContents.executeJavaScript('document.querySelector(".playControls__prev").click()');
        }, true, true);
    }
    shortcutService.setup();
}

function setupThemeHandlers() {
    // Load initial theme from store
    isDarkTheme = store.get('theme', 'dark') === 'dark';
    // Send initial theme to all views
    if (headerView && headerView.webContents) {
        headerView.webContents.send('theme-changed', isDarkTheme);
    }
    if (settingsManager) {
        settingsManager.getView().webContents.send('theme-changed', isDarkTheme);
    }
    applyThemeToContent(isDarkTheme);

    // Listen for theme changes from settings or header
    ipcMain.on('setting-changed', (_, data) => {
        if (data.key === 'theme') {
            isDarkTheme = data.value === 'dark';
            store.set('theme', data.value);

            // Update all views
            if (headerView && headerView.webContents) {
                headerView.webContents.send('theme-changed', isDarkTheme);
            }
            if (settingsManager) {
                settingsManager.getView().webContents.send('theme-changed', isDarkTheme);
            }
            applyThemeToContent(isDarkTheme);
        }
    });
}

function applyThemeToContent(isDark: boolean) {
    if (!contentView) return;

    const theme = themeService.getCurrentCustomTheme();
    const customThemeCSS = theme ? theme.css : null;
    const themeColors = themeService.getCurrentThemeColors();

    // Handle video background and logo
    if (contentView) {
        let videoUrl = null;
        if (theme?.videoBackground) {
            const themesPath = themeService.getThemesPath();
            const relativePath = path.relative(themesPath, theme.videoBackground);
            videoUrl = `theme://${relativePath.replace(/\\/g, '/')}`;
        }
        const blur = store.get('backgroundBlur', 0);
        contentView.webContents.send('theme-set-video-background', videoUrl, blur);

        const logoPath = theme?.logo;
        let logoUrl = null;
        if (logoPath) {
            if (existsSync(logoPath)) {
                try {
                    const logoBuffer = readFileSync(logoPath);
                    logoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                    log(`[Themes] Applied logo from ${logoPath}`);
                } catch (e) {
                    log(`[ERROR] [Themes] Failed to read logo file at ${logoPath}:`, e);
                }
            } else {
                log(`[WARN] [Themes] Logo file not found at ${logoPath}`);
            }
        }
        contentView.webContents.send('theme-set-logo', logoUrl);
    }

    // Handle video background and logo for the widget
    if (widgetManager) {
        let videoUrl = null;
        if (theme?.videoBackground) {
            const themesPath = themeService.getThemesPath();
            const relativePath = path.relative(themesPath, theme.videoBackground);
            videoUrl = `theme://${relativePath.replace(/\\/g, '/')}`;
        }
        const blur = store.get('backgroundBlur', 0);
        widgetManager.updateTheme(null, videoUrl, blur);
    }

    // Update theme colors for all UI components
    if (notificationManager) {
        notificationManager.setThemeColors(themeColors);
    }
    if (settingsManager) {
        settingsManager.setThemeColors(themeColors);
    }
    if (headerView && headerView.webContents) {
        headerView.webContents.send('theme-colors-changed', themeColors);
    }

    // Split CSS into sections using comment markers in the theme file:
    // /* @target all|content|header|settings */ ... /* @end */
    const sections = (function splitSections(css: string | null) {
        const res = { all: '', content: '', header: '', settings: '' } as Record<string, string>;
        if (!css) return res;
        const regex =
            /\/\*\s*@target\s+(all|content|header|settings)\s*\*\/[\s\S]*?(?=(\/\*\s*@target\s+(?:all|content|header|settings)\s*\*\/)|$)/gi;
        let match: RegExpExecArray | null;
        let any = false;
        while ((match = regex.exec(css)) !== null) {
            any = true;
            const block = match[0];
            const targetMatch = /@target\s+(all|content|header|settings)/i.exec(block);
            const target = (targetMatch?.[1] || '').toLowerCase();
            const body = block.replace(/^[\s\S]*?\*\//, '').trim();
            res[target] += (res[target] ? '\n' : '') + body;
        }
        if (!any) {
            // No markers: treat entire CSS as content
            res.content = css;
        }
        return res;
    })(customThemeCSS);

    const themeScript = `
        (function() {
            try {
                document.documentElement.classList.toggle('theme-light', !${isDark});
                document.documentElement.classList.toggle('theme-dark', ${isDark});
                document.body.classList.toggle('theme-light', !${isDark});
                document.body.classList.toggle('theme-dark', ${isDark});
                
                if (${isDark}) {
                    document.documentElement.style.setProperty('--background-base', '#121212');
                    document.documentElement.style.setProperty('--background-surface', '#212121');
                    document.documentElement.style.setProperty('--text-base', '#ffffff');
                } else {
                    document.documentElement.style.setProperty('--background-base', '#ffffff');
                    document.documentElement.style.setProperty('--background-surface', '#f2f2f2');
                    document.documentElement.style.setProperty('--text-base', '#333333');
                }
                
                const style = document.createElement('style');
                style.id = 'custom-scrollbar-style';
                style.textContent = \`
                    ::-webkit-scrollbar-button {
                        display: none;
                    }
                    
                    ::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
                    }
                    
                    ::-webkit-scrollbar-track {
                        background-color: transparent;
                    }
                    
                    ::-webkit-scrollbar-thumb {
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
                        border-radius: 4px;
                        transition: background-color 0.3s;
                    }
                    
                    ::-webkit-scrollbar-thumb:hover {
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
                    }
                    
                    ::-webkit-scrollbar-corner {
                        background-color: transparent;
                    }
                \`;
                
                const existingStyle = document.getElementById('custom-scrollbar-style');
                if (existingStyle) {
                    existingStyle.remove();
                }
                document.head.appendChild(style);

                // Apply custom theme CSS (content section + all) if available
                const contentCSS = \`${sections.all + (sections.all && sections.content ? '\n' : '') + sections.content || ''}\`;
                if (contentCSS.trim()) {
                    const customStyle = document.createElement('style');
                    customStyle.id = 'custom-theme-style';
                    customStyle.textContent = contentCSS;
                    
                    const existingCustomStyle = document.getElementById('custom-theme-style');
                    if (existingCustomStyle) {
                        existingCustomStyle.remove();
                    }
                    document.head.appendChild(customStyle);
                    log('[Themes] Applied custom theme CSS to content view');
                } else {
                    // Remove custom theme if none is selected
                    const existingCustomStyle = document.getElementById('custom-theme-style');
                    if (existingCustomStyle) {
                        existingCustomStyle.remove();
                        log('[Themes] Removed custom theme CSS from content view');
                    }
                }
            } catch(e) {
                log('[ERROR] [Themes] Error applying theme to content view:', e);
            }
        })();
    `;

    contentView.webContents.executeJavaScript(themeScript).catch(err => log('[ERROR] [Themes] Failed to execute content view theme script:', err));

    // Also inject into header and settings views using their specific sections
    const headerCSS = sections.all + (sections.all && sections.header ? '\n' : '') + sections.header || '';
    if (headerView && headerView.webContents) {
        const headerScript = `
            (function(){
                try {
                    const css = \`${headerCSS}\`;
                    const id = 'custom-theme-style';
                    const existing = document.getElementById(id);
                    if (existing) existing.remove();
                    if (css.trim()){
                        const style = document.createElement('style');
                        style.id = id;
                        style.textContent = css;
                        document.head.appendChild(style);
                    }
                } catch(e){ log('[ERROR] [Themes] Header theme inject error:', e); }
            })();
        `;
        headerView.webContents.executeJavaScript(headerScript).catch(err => log('[ERROR] [Themes] Failed to execute header theme script:', err));
    }

    if (settingsManager) {
        const settingsCSS = sections.all + (sections.all && sections.settings ? '\n' : '') + sections.settings || '';
        const settingsScript = `
            (function(){
                try {
                    const css = \`${settingsCSS}\`;
                    const id = 'custom-theme-style';
                    const existing = document.getElementById(id);
                    if (existing) existing.remove();
                    if (css.trim()){
                        const style = document.createElement('style');
                        style.id = id;
                        style.textContent = css;
                        document.head.appendChild(style);
                    }
                } catch(e){ log('[ERROR] [Themes] Settings theme inject error:', e); }
            })();
        `;
        settingsManager.getView().webContents.executeJavaScript(settingsScript).catch(err => log('[ERROR] [Themes] Failed to execute settings theme script:', err));
    }
}

function initializeShortcuts() {
    if (!mainWindow || !contentView || !settingsManager) return;

    shortcutService.register('openSettings', 'F1', 'Open Settings', () => settingsManager.toggle());

    if (devMode) {
        shortcutService.register('devTools', 'F11', 'Open Developer Tools', () => {
            if (contentView) contentView.webContents.openDevTools();
        });
    }

    shortcutService.register('zoomIn', 'CommandOrControl+=', 'Zoom In', () => {
        if (!contentView) return;
        const zoomLevel = contentView.webContents.getZoomLevel();
        contentView.webContents.setZoomLevel(Math.min(zoomLevel + 1, 9));
    });

    shortcutService.register('zoomOut', 'CommandOrControl+-', 'Zoom Out', () => {
        if (!contentView) return;
        const zoomLevel = contentView.webContents.getZoomLevel();
        contentView.webContents.setZoomLevel(Math.max(zoomLevel - 1, -9));
    });

    shortcutService.register('zoomReset', 'CommandOrControl+0', 'Reset Zoom', () => {
        if (contentView) contentView.webContents.setZoomLevel(0);
    });

    shortcutService.register('goBack', 'CommandOrControl+B', 'Go Back', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    shortcutService.register('goBackAlt', 'CommandOrControl+P', 'Go Back (Alternative)', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    shortcutService.register('goForward', 'CommandOrControl+F', 'Go Forward', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    shortcutService.register('goForwardAlt', 'CommandOrControl+N', 'Go Forward (Alternative)', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    shortcutService.register('refresh', 'CommandOrControl+R', 'Refresh Page', () => {
        if (contentView) {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', true);
            }
            contentView.webContents.reload();
        }
    });

    console.log(`Initialized ${shortcutService.count} keyboard shortcuts`);
}

// Apply DNS settings before app is ready
if (store.get('bypassMode') === 'dns' && store.get('dnsAddress')) {
    const dnsAddress = store.get('dnsAddress') as string;
    app.commandLine.appendSwitch('host-resolver-rules', `MAP *.soundcloud.com ${dnsAddress}`);
    console.log(`[DNS] Applied custom DNS: MAP *.soundcloud.com ${dnsAddress}`);
}

// App lifecycle handlers
app.on('ready', init);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        init();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    if (headerView && headerView.webContents) {
        headerView.webContents.send('cleanup');
    }
    if (shortcutService) {
        shortcutService.destroy();
    }
    if (zapretService) {
        zapretService.stop();
    }
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on('will-quit', () => {
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

// focus the window when the second instance is opened.
app.on('second-instance', () => {
    if (!mainWindow) {
        return;
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.focus();
});

export function queueToastNotification(message: string) {
    if (mainWindow && notificationManager) {
        notificationManager.show(message);
    }
}

function setupTranslationHandlers() {
    ipcMain.handle('get-translations', () => {
        return {
            client: translationService.translate('client'),
            darkMode: translationService.translate('darkMode'),
            adBlocker: translationService.translate('adBlocker'),
            enableAdBlocker: translationService.translate('enableAdBlocker'),
            changesAppRestart: translationService.translate('changesAppRestart'),
            proxy: translationService.translate('proxy'),
            proxyHost: translationService.translate('proxyHost'),
            proxyPort: translationService.translate('proxyPort'),
            enableProxy: translationService.translate('enableProxy'),
            webhooks: translationService.translate('webhooks'),
            discord: translationService.translate('discord'),
            enableWebhooks: translationService.translate('enableWebhooks'),
            webhookUrl: translationService.translate('webhookUrl'),
            webhookTrigger: translationService.translate('webhookTrigger'),
            webhookDescription: translationService.translate('webhookDescription'),
            showWebhookExample: translationService.translate('showWebhookExample'),
            enableRichPresence: translationService.translate('enableRichPresence'),
            displayWhenPaused: translationService.translate('displayWhenPaused'),
            displaySmallIcon: translationService.translate('displaySmallIcon'),
            displayButtons: translationService.translate('displayButtons'),
            enableRichPresencePreview: translationService.translate('enableRichPresencePreview'),
            richPresencePreview: translationService.translate('richPresencePreview'),
            richPresencePreviewDescription: translationService.translate('richPresencePreviewDescription'),
            applyChanges: translationService.translate('applyChanges'),
            openAtLogin: translationService.translate('openAtLogin'),
            startInTray: translationService.translate('startInTray'),
            minimizeToTray: translationService.translate('minimizeToTray'),
            enableNavigationControls: translationService.translate('enableNavigationControls'),
            enableTrackParser: translationService.translate('enableTrackParser'),
            trackParserDescription: translationService.translate('trackParserDescription'),
            enableAutoUpdater: translationService.translate('enableAutoUpdater'),
            enableWidget: translationService.translate('enableWidget'),
            customThemes: translationService.translate('customThemes'),
            selectCustomTheme: translationService.translate('selectCustomTheme'),
            noTheme: translationService.translate('noTheme'),
            openThemesFolder: translationService.translate('openThemesFolder'),
            refreshThemes: translationService.translate('refreshThemes'),
            customThemeDescription: translationService.translate('customThemeDescription'),
            pressF1ToOpenSettings: translationService.translate('pressF1ToOpenSettings'),
            closeSettings: translationService.translate('closeSettings'),
            noActivityToShow: translationService.translate('noActivityToShow'),
            richPresencePreviewTitle: translationService.translate('richPresencePreviewTitle'),
            dns: translationService.translate('dns'),
            enableDns: translationService.translate('enableDns'),
            dnsAddress: translationService.translate('dnsAddress'),
            dnsPreset: translationService.translate('dnsPreset'),
            dnsPresetNone: translationService.translate('dnsPresetNone'),
            dnsPresetCloudflare: translationService.translate('dnsPresetCloudflare'),
            dnsPresetGoogle: translationService.translate('dnsPresetGoogle'),
            dnsPresetCustom: translationService.translate('dnsPresetCustom'),
            dnsChangesRestart: translationService.translate('dnsChangesRestart'),
            bypass: translationService.translate('bypass'),
            bypassMode: translationService.translate('bypassMode'),
            bypassNone: translationService.translate('bypassNone'),
            bypassDns: translationService.translate('bypassDns'),
            bypassZapret: translationService.translate('bypassZapret'),
            zapretDescription: translationService.translate('zapretDescription'),
        };
    });
}

function parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const parts = timeString.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

// Setup audio event handler for track updates
function setupAudioHandler() {
    ipcMain.on('soundcloud:track-update', async (_event, { data: result, reason }: TrackUpdateMessage) => {
        if (reason !== 'playback-progress') { // Avoid spamming logs
            log(`[DEBUG] Track update received: ${reason}`);
        }

        if (result.isPlaying && result.url && result.url !== lastTrackInfo.url) {
            log(`[INFO] Now playing: ${result.author} - ${result.title}`);
        }

        lastTrackInfo = result;

        // SKIP STATS IF BOOSTING
        if (fansBoostingService && fansBoostingService.isActive) {
            return;
        }

        // Logic for Listening Statistics
        const now = Date.now();

        if (result.isPlaying && result.title && result.author && result.duration && result.url) {
            const trackId = result.url;
            const parsedDuration = parseTimeToSeconds(result.duration);

            // Initialize state if new track
            if (!currentTrackState || currentTrackState.id !== trackId) {
                // Flush previous track if exists
                if (currentTrackState && currentTrackState.accumulatedTime > 0) {
                    listeningStatsService.logTime(currentTrackState.trackInfo, currentTrackState.accumulatedTime);
                }

                currentTrackState = {
                    id: trackId,
                    totalListened: 0,
                    accumulatedTime: 0,
                    loggedPlay: false,
                    lastTimestamp: now,
                    trackInfo: {
                        url: trackId,
                        title: result.title,
                        artist: result.author,
                        duration: parsedDuration,
                        artwork: result.artwork
                    }
                };
                console.log(`[Stats] New track session: ${result.title}`);
            } else {
                // Same track, update time
                const delta = (now - currentTrackState.lastTimestamp) / 1000;
                if (delta > 0 && delta < 10) { // Sanity check: ignore huge jumps
                    currentTrackState.accumulatedTime += delta;
                    currentTrackState.totalListened += delta;

                    // Check 50% rule
                    if (!currentTrackState.loggedPlay && currentTrackState.totalListened >= (parsedDuration * 0.5)) {
                        listeningStatsService.logPlay(currentTrackState.trackInfo);
                        currentTrackState.loggedPlay = true;
                    }
                }
                currentTrackState.lastTimestamp = now;
            }
        } else {
            // Not playing (Paused or Stopped)
            if (currentTrackState) {
                // Flush accumulated time
                if (currentTrackState.accumulatedTime > 0) {
                    listeningStatsService.logTime(currentTrackState.trackInfo, currentTrackState.accumulatedTime);
                    currentTrackState.accumulatedTime = 0;
                }
            }
        }

        // Update services only if track is playing
        if (result.isPlaying && result.title && result.author && result.duration) {
            await Promise.all([
                webhookService.updateTrackInfo({
                    title: result.title,
                    author: result.author,
                    duration: result.duration,
                    url: result.url,
                    artwork: result.artwork,
                    elapsed: result.elapsed,
                }),
                presenceService.updatePresence(result)
            ]);
        } else {
            await presenceService.updatePresence(result);
        }

        // Update the rich presence preview in settings
        if (settingsManager) {
            const settingsView = settingsManager.getView();
            if (settingsView && settingsView.webContents && !settingsView.webContents.isDestroyed()) {
                settingsView.webContents.send('presence-preview-update', result);
            }
        }

        // Update the widget
        if (widgetManager) {
            widgetManager.updateTrack(result);
        }

        if (thumbarService) {
            thumbarService.updateThumbarButtons(mainWindow, result.isPlaying, contentView);
        }

        if (result.isPlaying && result.title) {
            const title = `sixonefour - ${result.title} (${result.elapsed})`;
            mainWindow.setTitle(title);
            if (tray) {
                tray.setToolTip(title);
            }
        } else {
            const title = 'sixonefour';
            mainWindow.setTitle(title);
            if (tray) {
                tray.setToolTip(title);
            }
        }
    });
}

// Telegram Helper Functions

async function processTrackForTelegram(track: ScrapedTrack, isLiveFeed: boolean = false) {
    if (!telegramService.hasCredentials()) {
        log('[Telegram] Missing credentials in worker.');
        return;
    }

    const filename = sanitizeFilename(`${track.artist} - ${track.title} (sixonefour).mp3`);
    const downloadPath = path.join(store.get('downloadPath') as string || app.getPath('downloads'), 'Vilio_Telegram_Export');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

    let filePath = path.join(downloadPath, filename);
    const artworkFilename = sanitizeFilename(`${track.artist} - ${track.title} (sixonefour).jpg`);
    const artworkPath = path.join(downloadPath, artworkFilename);

    const trackInfo: TrackInfo = {
        title: track.title,
        author: track.artist,
        url: track.url,
        artwork: track.artwork,
        duration: '',
        elapsed: '0:00',
        isPlaying: false
    };

    // Helper for retrying async operations
    async function retryOperation<T>(operation: () => Promise<T>, retries: number = 3, delayMs: number = 2000): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('ETIMEDOUT') || error.message?.includes('network timeout');
                const isFetchError = error.name === 'FetchError' || error.message?.includes('fetch failed');

                if ((isTimeout || isFetchError) && i < retries - 1) {
                    log(`[Telegram] Error (attempt ${i + 1}/${retries}): ${error.message}. Retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Retries exhausted');
    }

    try {
        log(`[Telegram] Processing track: ${track.artist} - ${track.title}`);
        console.log(`[Telegram] Processing track: ${track.artist} - ${track.title}`);

        // 1. Download Track
        let downloadedFilePath: string | null = null;

        // Wrap download in race conditions for timeout
        try {
            downloadedFilePath = await Promise.race([
                downloadService.downloadTrack(trackInfo),
                new Promise<string | null>((_, reject) => setTimeout(() => reject(new Error('Download timed out after 30s')), 30000))
            ]);
        } catch (downloadError: any) {
            throw new Error(downloadError.message || 'Download timed out or failed');
        }

        if (!downloadedFilePath || !fs.existsSync(downloadedFilePath) || fs.statSync(downloadedFilePath).size === 0) {
            throw new Error('Download failed: File is missing or empty');
        }

        // 2. Download Artwork (Retryable)
        await retryOperation(async () => {
            if (!track.artwork) return;
            const response = await fetch(track.artwork.replace('-large', '-t500x500'));
            if (!response.ok) throw new Error(`Artwork fetch failed: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            fs.writeFileSync(artworkPath, Buffer.from(arrayBuffer));
        });

        // 3. Send to Telegram
        const telegramUsername = store.get('telegramUsername', '').replace('@', '');
        const sourceLine = telegramUsername
            ? `👤 Source: @${telegramUsername} (SoundCloud)`
            : `👤 Source: SoundCloud`;

        let captionPrefix = '';
        if (isLiveFeed) {
            captionPrefix = `<b>New track in library</b>\n\n`;
        }

        const caption = `${captionPrefix}<b>${track.artist} - ${track.title}</b>\n` +
            `\n` +
            `🔗 SoundCloud: <a href="${track.url}">Link</a>\n` +
            `${sourceLine}\n` +
            `\n` +
            `📥 Exported via <a href="https://github.com/1vilio/sixonefour">sixonefour</a>\n` +
            `\n` +
            `Want custom skins? Discord status? A live widget?\n` +
            `Export tracks to Telegram? Boost listens? See detailed stats?\n` +
            `Bypass region blocks? Hotkeys? Download music & covers in one tap?\n` +
            `\n` +
            `<a href="https://github.com/1vilio/sixonefour">sixonefour</a> does <b>all of it.</b>`;

        const sent = await telegramService.sendAudio(downloadedFilePath, caption, track.artist, track.title, artworkPath);

        if (sent) {
            log(`[Telegram] Sent track to Telegram: ${track.title}`);
            console.log(`[Telegram] Sent track to Telegram: ${track.title}`);
        } else {
            log(`[Telegram] Failed to send track to Telegram: ${track.title}`);
            console.log(`[Telegram] Failed to send track: ${track.title}`);
            const message = `Failed to upload MP3 for: <b>${track.artist} - ${track.title}</b>\n<a href="${track.url}">Link</a>`;
            await telegramService.sendMessage(message, { parse_mode: 'HTML' });
        }

        // Assign final path for cleanup
        if (downloadedFilePath) filePath = downloadedFilePath;

    } catch (err: any) {
        log(`[Telegram] Error processing track ${track.title}: ${err.message}`);
        console.error(`[Telegram] Error processing track ${track.title}: ${err.message}`);
        const message = `Failed to upload MP3 for: <b>${track.artist} - ${track.title}</b>\nReason: ${err.message}\n<a href="${track.url}">Link</a>`;
        await telegramService.sendMessage(message, { parse_mode: 'HTML' });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            // Only strictly delete if in temp folder? The user path is usually Downloads. 
            // The original code was using a temp folder 'Vilio_Telegram_Export'
            if (filePath.includes('Vilio_Telegram_Export')) {
                fs.unlink(filePath, (err) => {
                    if (err) log(`[Telegram] Failed to delete temp file ${filePath}: ${err}`);
                });
            }
        }
        if (artworkPath && fs.existsSync(artworkPath)) {
            fs.unlink(artworkPath, () => { });
        }
    }
}

function startLiveFeed() {
    if (liveFeedInterval) clearInterval(liveFeedInterval);

    log('[Telegram] Starting Live Feed...');
    console.log('[Telegram] Live Feed started. Checking every 15 minutes.');

    // Initial Check
    checkLiveFeed();

    // Check every 15 minutes
    liveFeedInterval = setInterval(async () => {
        await checkLiveFeed();
    }, 15 * 60 * 1000);
}

async function checkLiveFeed() {
    try {
        console.log('[Telegram] Live Feed: Checking for new likes...');
        const latestLikes = await likesScraperService.getLatestLikes(5);
        if (latestLikes.length === 0) {
            console.log('[Telegram] Live Feed: No tracks found.');
            return;
        }

        const lastLikedUrl = store.get('telegramLastLikedUrl', '');
        console.log(`[Telegram] Live Feed: Last liked URL: ${lastLikedUrl}`);

        // Find new tracks
        const newTracks = [];
        for (const track of latestLikes) {
            if (track.url === lastLikedUrl) break;
            newTracks.push(track);
        }

        if (newTracks.length > 0) {
            console.log(`[Telegram] Live Feed: Found ${newTracks.length} new tracks.`);
            // Update last liked
            store.set('telegramLastLikedUrl', latestLikes[0].url);

            // Send notifications for new tracks (reversed to be chronological)
            for (const track of newTracks.reverse()) {
                console.log(`[Telegram] Live Feed: Processing new track ${track.title}`);
                await processTrackForTelegram(track, true);
            }
        } else {
            console.log('[Telegram] Live Feed: No new tracks since last check.');
        }

    } catch (error) {
        log(`[Telegram] Live Feed error: ${error}`);
        console.error(`[Telegram] Live Feed error: ${error}`);
    }
}

function stopLiveFeed() {
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
        liveFeedInterval = null;
    }
    log('[Telegram] Live Feed stopped.');
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9 \.-]/gi, '_');
}
