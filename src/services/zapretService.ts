import { app } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';

export class ZapretService {
    private zapretProcess: ChildProcess | null = null;
    private zapretPath: string;
    private configPath: string;

    constructor() {
        const devVendorPath = path.join(__dirname, '..', '..', 'src', 'vendor', 'zapret');

        const vendorPath = app.isPackaged
            ? path.join(process.resourcesPath, 'vendor', 'zapret')
            : devVendorPath;
            
        this.zapretPath = path.join(vendorPath, 'winws.exe');
        this.configPath = path.join(vendorPath, 'config.txt');
    }

    public isRunning(): boolean {
        return this.zapretProcess !== null && !this.zapretProcess.killed;
    }

    public async start(): Promise<void> {
        if (this.isRunning()) {
            console.log('[ZapretService] Zapret is already running.');
            return;
        }

        try {
            await fs.access(this.zapretPath);
            const configArgs = await this.readConfigArguments();
            
            console.log(`[ZapretService] Starting winws.exe with args: ${configArgs.join(' ')}`);

            this.zapretProcess = spawn(this.zapretPath, configArgs, {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                cwd: path.dirname(this.zapretPath),
            });

            this.zapretProcess.on('error', (err) => {
                console.error('[ZapretService] Failed to start Zapret process:', err);
                this.zapretProcess = null;
            });

            this.zapretProcess.on('exit', (code) => {
                console.log(`[ZapretService] Zapret process exited with code ${code}`);
                this.zapretProcess = null;
            });

            // Unreference the child process to allow the parent to exit independently
            if (this.zapretProcess.pid) {
                this.zapretProcess.unref();
                console.log(`[ZapretService] Zapret process started with PID: ${this.zapretProcess.pid}`);
            }

        } catch (error) {
            console.error(`[ZapretService] Could not find winws.exe at ${this.zapretPath}. Please ensure it exists.`);
        }
    }

    public stop(): void {
        if (!this.isRunning() || !this.zapretProcess?.pid) {
            console.log('[ZapretService] Zapret is not running.');
            return;
        }

        console.log(`[ZapretService] Stopping Zapret process with PID: ${this.zapretProcess.pid}`);
        
        // Use taskkill on Windows to forcefully terminate the process tree
        const pid = this.zapretProcess.pid;
        spawn('taskkill', ['/F', '/T', '/PID', pid.toString()]);
        
        this.zapretProcess = null;
    }

    private async readConfigArguments(): Promise<string[]> {
        try {
            const configFile = await fs.readFile(this.configPath, 'utf-8');
            const vendorPath = path.dirname(this.configPath);

            const replacements = {
                '{hosts}': path.join(vendorPath, 'autohosts.txt'),
                '{ignore}': path.join(vendorPath, 'ignore.txt'),
                '{youtube}': path.join(vendorPath, 'youtube.txt'),
                '{quicgoogle}': path.join(vendorPath, 'quic_initial_www_google_com.bin'),
                '{tlsgoogle}': path.join(vendorPath, 'tls_clienthello_www_google_com.bin'),
            };

            const lines = configFile.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
            
            let processedArgs = lines.join(' ');

            for (const placeholder in replacements) {
                processedArgs = processedArgs.replace(new RegExp(placeholder, 'g'), replacements[placeholder as keyof typeof replacements]);
            }

            // Split the processed string into an array of arguments
            return processedArgs.split(' ').filter(arg => arg);
        } catch (error) {
            console.error(`[ZapretService] Could not read or process config.txt at ${this.configPath}.`);
            return [];
        }
    }
}
