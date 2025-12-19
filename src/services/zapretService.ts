import { app } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { log } from '../utils/logger';

export interface ZapretPreset {
    name: string;
    description: string;
    filePath: string;
}

export class ZapretService {
    private zapretProcess: ChildProcess | null = null;
    private vendorPath: string;
    private binPath: string;
    private currentPreset: string | null = null;

    constructor() {
        const devVendorPath = path.join(__dirname, '..', '..', 'src', 'vendor', 'zapret');

        this.vendorPath = app.isPackaged
            ? path.join(process.resourcesPath, 'vendor', 'zapret')
            : devVendorPath;

        this.binPath = path.join(this.vendorPath, 'bin');
    }

    public isRunning(): boolean {
        return this.zapretProcess !== null && !this.zapretProcess.killed;
    }

    public async getPresets(): Promise<ZapretPreset[]> {
        try {
            const files = await fs.readdir(this.vendorPath);
            const batFiles = files.filter(f => f.startsWith('general') && f.endsWith('.bat'));

            return batFiles.map(f => ({
                name: f.replace('.bat', ''),
                description: f,
                filePath: path.join(this.vendorPath, f)
            }));
        } catch (error) {
            log('[ERROR] [ZapretService] Failed to list presets:', error);
            return [];
        }
    }

    public setPreset(presetName: string): void {
        this.currentPreset = presetName;
    }

    public async start(presetName?: string): Promise<void> {
        // Always attempt to stop any existing process before starting
        await this.stop();

        const presetToUse = presetName || this.currentPreset || 'general';
        const presets = await this.getPresets();
        let preset = presets.find(p => p.name === presetToUse);

        if (!preset) {
            log(`[ZapretService] Preset ${presetToUse} not found, falling back to general`);
            preset = presets.find(p => p.name === 'general');
        }

        if (!preset) {
            log('[ERROR] [ZapretService] No presets found.');
            return;
        }

        try {
            const winwsPath = path.join(this.binPath, 'winws.exe');
            await fs.access(winwsPath);

            const args = await this.parseBatForArgs(preset.filePath);

            if (args.length === 0) {
                log(`[ERROR] [ZapretService] Could not extract arguments from ${preset.filePath}`);
                return;
            }

            log(`[ZapretService] Starting winws.exe with preset: ${preset.name}`);
            log(`[ZapretService] Args Array: ${JSON.stringify(args)}`);

            this.zapretProcess = spawn(winwsPath, args, {
                detached: true,
                stdio: ['ignore', 'ignore', 'pipe'], // Capture stderr only
                windowsHide: true,
                cwd: this.binPath,
            });

            if (this.zapretProcess.stderr) {
                this.zapretProcess.stderr.on('data', (data) => {
                    const message = data.toString().trim();
                    if (message) {
                        log(`[ERROR] [ZapretService] [stderr]: ${message}`);
                    }
                });
            }

            this.zapretProcess.on('error', (err: Error) => {
                log('[ERROR] [ZapretService] Failed to start Zapret process:', err);
                this.zapretProcess = null;
            });

            this.zapretProcess.on('exit', (code: number | null) => {
                log(`[ZapretService] Zapret process exited with code ${code}`);
                this.zapretProcess = null;
            });

            if (this.zapretProcess.pid) {
                this.zapretProcess.unref();
                log(`[ZapretService] Zapret process started with PID: ${this.zapretProcess.pid}`);
            }

        } catch (error) {
            log(`[ERROR] [ZapretService] Failed to start Zapret: ${error}`);
        }
    }

    public async stop(): Promise<void> {
        log('[ZapretService] Stopping Zapret service...');

        // 1. Kill tracked process
        if (this.zapretProcess?.pid) {
            const pid = this.zapretProcess.pid;
            try {
                await new Promise<void>((resolve) => {
                    const kill = spawn('taskkill', ['/F', '/T', '/PID', pid.toString()]);
                    kill.on('exit', () => resolve());
                });
            } catch (e) {
                log(`[ZapretService] Error killing PID ${pid}: ${e}`);
            }
        }

        // 2. Kill any winws.exe process as fallback to ensure clean state
        try {
            await new Promise<void>((resolve) => {
                const kill = spawn('taskkill', ['/F', '/T', '/IM', 'winws.exe']);
                kill.on('exit', () => resolve());
            });
        } catch (e) {
            // Ignore error if process not found
        }

        this.zapretProcess = null;
    }

    private async parseBatForArgs(batPath: string): Promise<string[]> {
        try {
            const content = await fs.readFile(batPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            let winwsLine = '';
            let capturing = false;

            for (let line of lines) {
                line = line.trim();
                let hasContinuation = line.endsWith('^');

                // If this line has continuation, remove it before merging
                if (hasContinuation) {
                    line = line.substring(0, line.length - 1).trim();
                }

                if (line.includes('winws.exe')) {
                    winwsLine = line.split('winws.exe')[1];
                    capturing = true;
                } else if (capturing) {
                    // Add a space to avoid sticking arguments together
                    winwsLine += ' ' + line;
                }

                if (capturing && !hasContinuation) {
                    break;
                }
            }

            if (!winwsLine) return [];

            const listsPath = path.join(this.vendorPath, 'lists', path.sep);

            // IMPORTANT: If the .bat file had "%BIN%winws.exe" --args, 
            // the split might leave a trailing " at the beginning of winwsLine.
            // We must identify and remove it before further processing.
            winwsLine = winwsLine.trim();
            if (winwsLine.startsWith('"')) {
                winwsLine = winwsLine.substring(1).trim();
            }

            let processed = winwsLine
                // Replace escapes. In batch, ^ escapes the next character. 
                // Common cases are ^! becoming ! or ^^ becoming ^. 
                // We'll replace it with empty to just keep the escaped character.
                .replace(/\^/g, '')
                .replace(/%BIN%/g, this.binPath + path.sep)
                .replace(/%LISTS%/g, listsPath)
                .replace(/%GameFilter%/g, '12')
                .trim();

            // Clean up double quotes and relative path leftovers
            processed = processed.replace(/\.\.\/lists\//g, listsPath);

            const args: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < processed.length; i++) {
                const char = processed[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ' ' && !inQuotes) {
                    if (current) {
                        args.push(current);
                        current = '';
                    }
                } else {
                    current += char;
                }
            }
            if (current) args.push(current);

            return args.filter(arg => arg && !arg.startsWith('/min') && !arg.startsWith('zapret:'));
        } catch (error) {
            log(`[ERROR] [ZapretService] Failed to parse ${batPath}:`, error);
            return [];
        }
    }
}
