import { app, BrowserView } from 'electron';
import { PerformanceStats } from '../types';

export class PerformanceService {
    private headerView: BrowserView | null = null;
    private interval: NodeJS.Timeout | null = null;

    constructor() {}

    public setHeaderView(view: BrowserView) {
        this.headerView = view;
        this.startMonitoring();
    }

    public startMonitoring() {
        if (this.interval) return;

        this.interval = setInterval(() => {
            if (!this.headerView || this.headerView.webContents.isDestroyed()) {
                this.stopMonitoring();
                return;
            }

            const metrics = app.getAppMetrics();
            let totalCPU = 0;
            let totalMemory = 0;

            metrics.forEach((metric) => {
                totalCPU += metric.cpu.percentCPUUsage;
                // In some Electron versions memory is a separate object
                const memoryInfo = (metric as any).memory;
                if (memoryInfo && typeof memoryInfo.workingSetSize === 'number') {
                    totalMemory += memoryInfo.workingSetSize;
                } else if (typeof (metric as any).workingSetSize === 'number') {
                    totalMemory += (metric as any).workingSetSize;
                }
            });

            const stats: PerformanceStats = {
                cpu: Math.round(totalCPU),
                memory: Math.round(totalMemory / 1024), // Convert to MB
            };

            this.headerView.webContents.send('performance-stats', stats);
        }, 2000); // Update every 2 seconds
    }

    public stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

export const performanceService = new PerformanceService();
