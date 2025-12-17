import { appendFileSync, writeFileSync } from 'fs';
import path from 'path';
import util from 'util';
import { app } from 'electron';

// Resolve path to the standard log directory
export const logFilePath = path.join(app.getPath('logs'), 'main.log');

let initialized = false;


/**
 * A simple file logger that writes messages to Log.txt in the project root.
 * @param args Arguments to log, similar to console.log.
 */
export function log(...args: any[]) {
    if (!initialized) {
        try {
            // Clear the log file on first write
            writeFileSync(logFilePath, `--- Log started at ${new Date().toISOString()} ---

`);
            initialized = true;
        } catch (err) {
            // Fallback to console if file system is not available
            console.error('Failed to initialize file logger:', err);
            console.log(...args);
            return;
        }
    }

    const message = util.format(...args);
    try {
        appendFileSync(logFilePath, message + '\n');
        // Mirror to console as requested
        console.log(message);
    } catch (err) {
        // Fallback for subsequent writes
        console.error('Failed to write to log file:', err);
        console.log(message);
    }
}
