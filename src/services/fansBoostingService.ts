import { BrowserView } from 'electron';
import { log as fileLog } from '../utils/logger';
import { generateFingerprint, FingerprintFilter } from '../utils/fingerprintGenerator';

export interface SchedulingOptions {
    enabled: boolean;
    mode: 'fastest' | 'distribute';
    hours?: number;
}

export interface FingerprintOptions {
    enabled: boolean;
    mode: 'auto' | 'custom';
    filter?: FingerprintFilter;
}

export class FansBoostingService {
    private contentView: BrowserView;
    private isRunning: boolean = false;
    private targetUrl: string = '';
    private targetCount: number = 0;
    private currentCount: number = 0;
    private logCallback: (message: string) => void;
    private progressCallback: (count: number, target: number) => void;
    private trackInfoCallback: (info: any) => void;
    private stopRequested: boolean = false;
    private originalUserAgent: string = '';

    private fingerprintOptions: FingerprintOptions = { enabled: true, mode: 'auto' };
    private schedulingOptions: SchedulingOptions = { enabled: false, mode: 'fastest' };

    constructor(contentView: BrowserView) {
        this.contentView = contentView;
        this.logCallback = () => {};
        this.progressCallback = () => {};
        this.trackInfoCallback = () => {};
    }

    public get isActive(): boolean {
        return this.isRunning;
    }

    public setCallbacks(
        onLog: (msg: string) => void,
        onProgress: (current: number, total: number) => void,
        onTrackInfo: (info: any) => void,
    ) {
        this.logCallback = onLog;
        this.progressCallback = onProgress;
        this.trackInfoCallback = onTrackInfo;
    }

    public async start(
        url: string,
        count: number,
        fingerprintOptions: FingerprintOptions,
        schedulingOptions: SchedulingOptions,
    ) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.stopRequested = false;
        this.targetUrl = url;
        this.targetCount = count;
        this.currentCount = 0;
        this.fingerprintOptions = fingerprintOptions;
        this.schedulingOptions = schedulingOptions;
        this.originalUserAgent = this.contentView.webContents.getUserAgent();

        this.log('Starting Fans Boosting...');
        this.log(`Target: ${url}`);
        this.log(`Count: ${count}`);

        if (this.fingerprintOptions.enabled) {
            this.log(`Fingerprint: ${this.fingerprintOptions.mode} mode`);
        }

        if (this.schedulingOptions.enabled && this.schedulingOptions.mode === 'distribute') {
            this.log(`Scheduling: Distribute over ${this.schedulingOptions.hours} hours`);
        }

        try {
            this.contentView.webContents.setAudioMuted(true);

            // Initial Load
            await this.applyFingerprint();
            this.log('Loading track page...');
            await this.contentView.webContents.loadURL(this.targetUrl);
            await this.waitForSelector('.playControls__play');

            // Attempt to get info immediately after load
            await this.broadcastTrackInfo();

            while (this.currentCount < this.targetCount && !this.stopRequested) {
                await this.performPlayCycle();
                if (this.stopRequested) break;

                this.currentCount++;
                this.progressCallback(this.currentCount, this.targetCount);
                this.log(`COMPLETED PLAY ${this.currentCount}/${this.targetCount}`);
            }

            this.log(this.stopRequested ? 'Boosting stopped by user.' : 'Boosting completed!');
        } catch (error) {
            this.log(`Error: ${error}`);
        } finally {
            this.cleanup();
        }
    }

    public stop() {
        if (this.isRunning) {
            this.log('Stopping...');
            this.stopRequested = true;
        }
    }

    private async cleanup() {
        this.isRunning = false;
        this.contentView.webContents.setAudioMuted(false);
        this.progressCallback(this.currentCount, this.targetCount);

        // Restore State
        if (this.originalUserAgent) {
            this.contentView.webContents.setUserAgent(this.originalUserAgent);
        }

        try {
            if (this.contentView.webContents.debugger.isAttached()) {
                await this.contentView.webContents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
                this.contentView.webContents.debugger.detach();
            }
        } catch (e) {
            console.error('Error clearing emulation:', e);
        }

        // Reload to reset UI to desktop
        this.contentView.webContents.reload();
    }

    private async applyFingerprint() {
        if (!this.fingerprintOptions.enabled) return;

        // Force Desktop for Auto mode to avoid mobile UI issues
        const filter =
            this.fingerprintOptions.mode === 'auto'
                ? ({ deviceType: 'desktop' } as FingerprintFilter)
                : this.fingerprintOptions.filter;

        const fingerprint = generateFingerprint(filter);

        // Set User Agent
        this.contentView.webContents.setUserAgent(fingerprint.userAgent);

        // Emulate Device (Viewport & Scale)
        try {
            // Enable debugger to use CDP
            if (!this.contentView.webContents.debugger.isAttached()) {
                this.contentView.webContents.debugger.attach('1.3');
            }

            await this.contentView.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
                width: fingerprint.viewport.width,
                height: fingerprint.viewport.height,
                deviceScaleFactor: fingerprint.deviceScaleFactor,
                mobile: fingerprint.userAgent.includes('Mobile'),
            });

            // Override Platform and Language via script injection on load
            // Note: setUserAgent handles the HTTP header, but navigator.platform needs injection
            // We'll do a simple injection for now, but CDP is better for full spoofing

            this.log(
                `Applied Fingerprint: ${fingerprint.platform} (${fingerprint.viewport.width}x${fingerprint.viewport.height})`,
            );
        } catch (e) {
            this.log(`Fingerprint Error: ${e}`);
        }
    }

    private async performPlayCycle(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.stopRequested) return resolve();

            try {
                // Rotate fingerprint for every NEW session (if we reload)
                // But here we are in a loop. If we want to rotate fingerprint, we MUST reload page.
                // Current logic tries to stay on page.
                // For "Smart Random" rotation, we should probably reload every X plays or every play?
                // For now, let's keep the same session to avoid detection by constant reloads,
                // OR if the user wants high security, maybe we should reload?
                // Let's stick to session persistence for now, as it's faster.
                // Fingerprint is applied at start.

                // TODO: Future improvement - "Session Rotation" option to reload page with new FP every N plays.

                const reloaded = await this.ensureCorrectTrack();

                if (this.stopRequested) return resolve();

                // 2. Restart/Play Logic
                if (!reloaded) {
                    this.log('Preparing track (Replay)...');
                    await this.contentView.webContents.executeJavaScript(`
                        (function() {
                            const prevBtn = document.querySelector('.skipControl__previous');
                            if (prevBtn) prevBtn.click();
                        })();
                    `);
                    await this.wait(1000);
                }

                // 3. Ensure Playing
                await this.contentView.webContents.executeJavaScript(`
                    (function() {
                        const playBtn = document.querySelector('.playControls__play');
                        if (playBtn && !playBtn.classList.contains('playing')) {
                            playBtn.click();
                        }
                    })();
                `);

                // 4. Calculate Duration & Wait
                const durationSec = await this.getTrackDuration();
                let listenTimeMs = 0;

                // Smart Duration Logic
                if (durationSec > 0) {
                    if (Math.random() < 0.05 || durationSec < 60) {
                        // Short listen (rare)
                        listenTimeMs = (Math.random() * (60 - 35) + 35) * 1000;
                        this.log(`Mode: Short Listen (${Math.round(listenTimeMs / 1000)}s)`);
                    } else {
                        // Full listen (80-100%)
                        const percentage = Math.random() * (1.0 - 0.8) + 0.8;
                        listenTimeMs = durationSec * percentage * 1000;
                        this.log(
                            `Mode: Full Listen (${Math.round(percentage * 100)}% - ${Math.round(listenTimeMs / 1000)}s)`,
                        );
                    }

                    if (listenTimeMs > durationSec * 1000) {
                        listenTimeMs = (durationSec - 1) * 1000;
                    }
                } else {
                    listenTimeMs = (Math.random() * (120 - 45) + 45) * 1000;
                    this.log(`Mode: Fallback Listen (${Math.round(listenTimeMs / 1000)}s) - Duration not found`);
                }

                if (listenTimeMs <= 0) listenTimeMs = 10000;

                // 5. Scheduling Delay
                // If we need to distribute plays over time, we might need to wait LONGER than the listen time.
                if (
                    this.schedulingOptions.enabled &&
                    this.schedulingOptions.mode === 'distribute' &&
                    this.schedulingOptions.hours
                ) {
                    const totalTimeMs = this.schedulingOptions.hours * 60 * 60 * 1000;
                    const playsRemaining = this.targetCount - this.currentCount;

                    if (playsRemaining > 0) {
                        // Target delay per play to fill the time
                        // We calculate this dynamically each time to adjust for drift
                        const targetDelayMs = totalTimeMs / this.targetCount;

                        // If target delay is greater than listen time, we wait the difference
                        if (targetDelayMs > listenTimeMs) {
                            const extraWait = targetDelayMs - listenTimeMs;
                            // Add some jitter (+/- 10%)
                            const jitter = extraWait * 0.1 * (Math.random() - 0.5);
                            const finalWait = extraWait + jitter;

                            this.log(`Scheduling: Waiting extra ${Math.round(finalWait / 1000)}s to distribute plays`);
                            await this.wait(listenTimeMs); // Listen
                            await this.wait(finalWait); // Wait rest of the time
                            resolve();
                            return;
                        }
                    }
                }

                await this.wait(listenTimeMs);
                resolve();
            } catch (error) {
                this.log(`Cycle error: ${error}. Retrying...`);
                await this.wait(3000);
                resolve();
            }
        });
    }

    private async ensureCorrectTrack(): Promise<boolean> {
        const currentUrl = await this.contentView.webContents.getURL();
        const cleanCurrent = currentUrl.split('?')[0];
        const cleanTarget = this.targetUrl.split('?')[0];

        if (cleanCurrent !== cleanTarget) {
            this.log('Wrong track detected (Drifted). Force reloading new session...');
            await this.contentView.webContents.loadURL(this.targetUrl);
            await this.waitForSelector('.playControls__play');
            await this.broadcastTrackInfo(); // Retry info fetch
            return true;
        }
        return false;
    }

    private async broadcastTrackInfo() {
        // Retry a few times if info is missing
        let retries = 3;
        while (retries > 0) {
            const trackInfo = await this.getTrackInfo();
            if (trackInfo && trackInfo.title !== 'Unknown Track') {
                this.log(`Track found: ${trackInfo.title}`);
                this.trackInfoCallback(trackInfo);
                return;
            }
            await this.wait(1000);
            retries--;
        }
        this.log('Warning: Could not fetch track info.');
    }

    private async getTrackInfo(): Promise<{ title: string; artist: string; artwork: string } | null> {
        try {
            return await this.contentView.webContents.executeJavaScript(`
                (function() {
                    // Try multiple selectors
                    const title = 
                        document.querySelector('.soundTitle__title')?.innerText || 
                        document.querySelector('.playbackSoundBadge__titleLink')?.innerText ||
                        document.title.replace('Stream ', '').split(' by ')[0] ||
                        'Unknown Track';

                    const artist = 
                        document.querySelector('.soundTitle__username')?.innerText || 
                        document.querySelector('.playbackSoundBadge__lightLink')?.innerText ||
                        'Unknown Artist';

                    let artwork = '';
                    const artEl = document.querySelector('.listenArtworkWrapper__artwork span') || 
                                  document.querySelector('.playbackSoundBadge__avatar span');
                    
                    if (artEl) {
                        artwork = artEl.style.backgroundImage.replace(/^url\\(['"]?|['"]?\\)$/g, '');
                    } else {
                        // Try meta tag
                        const metaImg = document.querySelector('meta[property="og:image"]');
                        if (metaImg) artwork = metaImg.content;
                    }

                    return { title: title.trim(), artist: artist.trim(), artwork };
                })();
            `);
        } catch (e) {
            return null;
        }
    }

    private async getTrackDuration(): Promise<number> {
        try {
            const durationStr = await this.contentView.webContents.executeJavaScript(`
                (function() {
                    // 1. Try standard timeline duration
                    let el = document.querySelector('.playbackTimeline__duration span:last-child');
                    if (el && el.innerText) return el.innerText;
                    
                    // 2. Try aria-label or other attributes
                    el = document.querySelector('.playbackTimeline__duration');
                    if (el && el.getAttribute('aria-label')) return el.getAttribute('aria-label');
                    
                    // 3. Try finding the separator and getting next sibling
                    const separator = Array.from(document.querySelectorAll('span')).find(s => s.innerText === '/');
                    if (separator && separator.nextElementSibling) return separator.nextElementSibling.innerText;

                    return null;
                })()
            `);

            if (!durationStr) return 0;

            // Parse "3:45" or "1:05:20"
            const parts = durationStr.trim().split(':').map(Number);
            let seconds = 0;
            if (parts.length === 2) {
                seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            return seconds;
        } catch (e) {
            return 0;
        }
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => {
            if (ms <= 0) return resolve();
            let resolved = false;
            const interval = setInterval(() => {
                if (this.stopRequested && !resolved) {
                    resolved = true;
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 200);
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    clearInterval(interval);
                    resolve();
                }
            }, ms);
        });
    }

    private waitForSelector(selector: string, timeout: number = 15000): Promise<void> {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = async () => {
                if (this.stopRequested) return resolve();
                try {
                    const exists = await this.contentView.webContents.executeJavaScript(
                        `!!document.querySelector('${selector}')`,
                    );
                    if (exists) resolve();
                    else if (Date.now() - start > timeout)
                        resolve(); // Timeout but resolve anyway to try
                    else setTimeout(check, 500);
                } catch (e) {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    }

    private log(msg: string) {
        console.log(`[FansBoost] ${msg}`);
        fileLog(`[FansBoost] ${msg}`);
        this.logCallback(msg);
    }
}
