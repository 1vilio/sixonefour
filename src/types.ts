/**
 * Core type definitions for the sixonefour application
 */

/**
 * Information about the currently playing track
 */
export interface TrackInfo {
    /** Title of the track */
    title: string;
    /** Author/artist of the track */
    author: string;
    /** URL to the track's artwork image */
    artwork: string;
    /** Elapsed playback time (format: "MM:SS" or "H:MM:SS") */
    elapsed: string;
    /** Total duration of the track (format: "MM:SS" or "H:MM:SS") */
    duration: string;
    /** Whether the track is currently playing */
    isPlaying: boolean;
    /** SoundCloud URL of the track */
    url: string;
}

/**
 * Data sent to webhooks
 */
export interface WebhookTrackData {
    /** Title of the track */
    title: string;
    /** Author/artist of the track */
    author: string;
    /** Total duration of the track */
    duration: string;
    /** SoundCloud URL of the track */
    url: string;
    /** URL to the track's artwork image */
    artwork: string;
    /** Elapsed playback time (format: "MM:SS" or "H:MM:SS") */
    elapsed: string;
}

/**
 * Parsed track information with artist and track name separated
 */
export interface ParsedTrackInfo {
    /** Parsed artist name (null if not found) */
    artist: string | null;
    /** Parsed track name */
    track: string;
}

/**
 * Normalized track information for display
 */
export interface NormalizedTrackInfo {
    /** Artist name (never null, defaults to "Unknown Artist") */
    artist: string;
    /** Track name (never null, defaults to "Unknown Track") */
    track: string;
}

/**
 * Translation keys used throughout the application
 */
export interface Translations {
    client: string;
    darkMode: string;
    adBlocker: string;
    enableAdBlocker: string;
    changesAppRestart: string;
    proxy: string;
    proxyHost: string;
    proxyPort: string;
    enableProxy: string;
    webhooks: string;
    discord: string;
    enableWebhooks: string;
    webhookUrl: string;
    webhookTrigger: string;
    webhookDescription: string;
    showWebhookExample: string;
    enableRichPresence: string;
    displayWhenPaused: string;
    displaySmallIcon: string;
    displayButtons: string;
    enableRichPresencePreview: string;
    richPresencePreview: string;
    richPresencePreviewDescription: string;
    applyChanges: string;
    minimizeToTray: string;
    enableNavigationControls: string;
    enableTrackParser: string;
    trackParserDescription: string;
    enableAutoUpdater: string;
    customThemes: string;
    selectCustomTheme: string;
    noTheme: string;
    openThemesFolder: string;
    refreshThemes: string;
    customThemeDescription: string;
    pressF1ToOpenSettings: string;
    closeSettings: string;
    noActivityToShow: string;
    richPresencePreviewTitle: string;
    listenOnSoundcloud: string;
}

/**
 * Update reason for track state changes
 */
export type TrackUpdateReason = 'playback-state-change' | 'track-change' | 'seek-change' | 'initial-state' | 'playback-progress';

/**
 * Message sent from renderer to main process for track updates
 */
export interface TrackUpdateMessage {
    /** Track information */
    data: TrackInfo;
    /** Reason for the update */
    reason: TrackUpdateReason;
}

/**
 * Performance statistics for the application
 */
export interface PerformanceStats {
    /** Total CPU usage percentage across all processes */
    cpu: number;
    /** Total memory usage in MB across all processes */
    memory: number;
}
