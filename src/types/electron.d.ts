export {};

declare global {
    interface Window {
        electronAPI?: {
            send: (channel: string, data?: any) => void;
            on?: (channel: string, callback: (...args: any[]) => void) => void;
            receive?: (channel: string, func: (...args: any[]) => void) => void;
        };
        soundcloudAPI?: {
            sendTrackUpdate: (data: any, reason: any) => void;
        };
    }
}
