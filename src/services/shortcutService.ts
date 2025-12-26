import { BrowserWindow, globalShortcut } from 'electron';
import { log } from '../utils/logger';

interface Shortcut {
    accelerator: string;
    action: () => void;
    description: string;
    enabled?: boolean;
    global?: boolean;
}

export class ShortcutService {
    private shortcuts: Map<string, Shortcut> = new Map();
    private window: BrowserWindow | null = null;
    private registered: boolean = false;

    constructor(window?: BrowserWindow) {
        if (window) {
            this.window = window;
        }
    }

    setWindow(window: BrowserWindow) {
        this.window = window;
    }

    register(
        id: string,
        accelerator: string,
        description: string,
        action: () => void,
        enabled: boolean = true,
        global: boolean = false,
    ) {
        // If already registered and accelerator changed, unregister the old one first
        const existing = this.shortcuts.get(id);
        if (existing && this.registered && existing.accelerator !== accelerator) {
            try {
                globalShortcut.unregister(existing.accelerator);
                log(`[Shortcuts] Unregistered old accelerator for '${id}': ${existing.accelerator}`);
            } catch (e) {
                log(`[ERROR] [Shortcuts] Failed to unregister old accelerator for '${id}':`, e);
            }
        }

        this.shortcuts.set(id, { accelerator, action, description, enabled, global });

        // If we are already in 'live' mode, register the new one immediately
        if (this.registered && enabled && accelerator) {
            this.registerWithElectron(id, this.shortcuts.get(id)!);
        }
    }

    unregister(id: string) {
        const shortcut = this.shortcuts.get(id);
        if (shortcut && this.registered && shortcut.accelerator) {
            try {
                globalShortcut.unregister(shortcut.accelerator);
                log(`[Shortcuts] Unregistered shortcut '${id}': ${shortcut.accelerator}`);
            } catch (e) {
                log(`[ERROR] [Shortcuts] Failed to unregister shortcut '${id}':`, e);
            }
        }
        this.shortcuts.delete(id);
    }

    setEnabled(id: string, enabled: boolean) {
        const shortcut = this.shortcuts.get(id);
        if (shortcut) {
            const wasEnabled = shortcut.enabled !== false;
            shortcut.enabled = enabled;

            if (this.registered) {
                if (enabled && !wasEnabled) {
                    this.registerWithElectron(id, shortcut);
                } else if (!enabled && wasEnabled) {
                    globalShortcut.unregister(shortcut.accelerator);
                }
            }
        }
    }

    private registerWithElectron(id: string, shortcut: Shortcut) {
        if (!shortcut.accelerator) return;

        try {
            // Unregister first to be safe (no-op if not registered)
            globalShortcut.unregister(shortcut.accelerator);

            const success = globalShortcut.register(shortcut.accelerator, () => {
                if (!shortcut.global && (!this.window || !this.window.isFocused())) return;

                try {
                    shortcut.action();
                } catch (error) {
                    log(`[ERROR] [Shortcuts] Error executing shortcut '${id}':`, error);
                }
            });

            if (success) {
                log(`[Shortcuts] Registered shortcut '${id}' (${shortcut.accelerator}) [Global: ${!!shortcut.global}]`);
            } else {
                log(
                    `[WARN] [Shortcuts] Failed to register shortcut '${id}' (${shortcut.accelerator}). It might be in use by another application.`,
                );
            }
        } catch (error) {
            log(`[ERROR] [Shortcuts] Exception during registration of '${id}' (${shortcut.accelerator}):`, error);
        }
    }

    setup() {
        log(`[Shortcuts] Setting up ${this.shortcuts.size} shortcuts...`);

        // Use a clean slate
        globalShortcut.unregisterAll();

        for (const [id, shortcut] of this.shortcuts) {
            if (shortcut.enabled === false) continue;
            this.registerWithElectron(id, shortcut);
        }

        this.registered = true;
    }

    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([id, shortcut]) => ({
            id,
            accelerator: shortcut.accelerator,
            description: shortcut.description,
            enabled: shortcut.enabled ?? true,
        }));
    }

    clear() {
        globalShortcut.unregisterAll();
        this.registered = false;
        this.shortcuts.clear();
        log('[Shortcuts] Cleared and unregistered all shortcuts.');
    }

    get count(): number {
        return this.shortcuts.size;
    }

    destroy() {
        globalShortcut.unregisterAll();
        this.registered = false;
        this.shortcuts.clear();
        this.window = null;
        log('[Shortcuts] Service destroyed.');
    }
}
