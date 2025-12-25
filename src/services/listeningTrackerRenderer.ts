// This script will be injected into the SoundCloud renderer process.

// Expose a way to send messages to the main process.
// This assumes 'ipcRenderer' is exposed via contextBridge in preload.ts
// window.electronAPI.send('channel', data)

const LISTENING_STAT_CHANNEL = 'listening-stats-update';

interface CurrentTrackState {
    trackId: string;
    title: string;
    artist: string;
    lastKnownTime: number; // The audio.currentTime when we last checked
    isPlaying: boolean;
    duration: number; // total duration of the track in seconds
    durationPlayed: number; // accumulated duration played for the current segment
}

let currentTrackState: CurrentTrackState | null = null;
let intervalId: NodeJS.Timeout | null = null;

function getTrackMetadata(): { trackId: string; title: string; artist: string; duration: number } | null {
    const titleLink = document.querySelector('.playbackSoundBadge__titleLink');
    const artistLink = document.querySelector('.playbackSoundBadge__lightLink');
    const durationSpan = document.querySelector('.playbackTimeline__duration span[aria-hidden="true"]');

    if (titleLink && artistLink && durationSpan) {
        const fullTrackUrl = (titleLink as HTMLAnchorElement).href;
        // The track ID is likely the numerical part at the end of the URL, or the full path
        const trackIdMatch = fullTrackUrl.match(/\/(\d+)$/);
        let trackId = '';
        if (trackIdMatch) {
            trackId = trackIdMatch[1];
        } else {
            // Fallback: use the relative URL as ID if numerical ID not found
            trackId = (titleLink as HTMLAnchorElement).pathname;
        }

        const title = titleLink.getAttribute('title') || (titleLink as HTMLElement).innerText.trim();
        const artist = artistLink.getAttribute('title') || (artistLink as HTMLElement).innerText.trim();

        // Parse duration from 'mm:ss' to seconds
        const durationText = durationSpan.textContent;
        let durationSeconds = 0;
        if (durationText) {
            const parts = durationText.split(':');
            if (parts.length === 2) {
                durationSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
        }

        return {
            trackId: trackId,
            title: title,
            artist: artist,
            duration: durationSeconds, // in seconds
        };
    }
    return null;
}

function sendListeningRecord(record: {
    trackId: string;
    title: string;
    artist: string;
    timestamp: number;
    durationPlayed: number;
}) {
    if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send(LISTENING_STAT_CHANNEL, record);
    } else {
        console.warn('electronAPI not available in renderer process. Cannot send listening record.');
    }
}

function stopTrackingInterval() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('Tracking interval stopped.');
    }
}

function startTrackingInterval() {
    stopTrackingInterval(); // Ensure no duplicate intervals
    console.log('Tracking interval started.');
    intervalId = setInterval(() => {
        const playButton = document.querySelector('.playControls__play');
        const playbackTimeline = document.querySelector('.playbackTimeline__timePassed span[aria-hidden="true"]');
        const currentMetadata = getTrackMetadata();

        if (!playButton || !playbackTimeline || !currentMetadata) {
            if (currentTrackState && currentTrackState.isPlaying && currentTrackState.durationPlayed > 0) {
                // If a track was playing but elements disappeared, consider its segment ended
                sendListeningRecord({
                    trackId: currentTrackState.trackId,
                    title: currentTrackState.title,
                    artist: currentTrackState.artist,
                    timestamp: Date.now() - currentTrackState.durationPlayed, // Approximate start time
                    durationPlayed: currentTrackState.durationPlayed, // In milliseconds
                });
            }
            currentTrackState = null; // Reset state
            return;
        }

        const isPlaying = playButton.classList.contains('playing'); // Assuming 'playing' class indicates playback

        // Parse current time from 'mm:ss'
        const currentTimeText = playbackTimeline.textContent;
        let currentTimeSeconds = 0;
        if (currentTimeText) {
            const parts = currentTimeText.split(':');
            if (parts.length === 2) {
                currentTimeSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
        }

        // --- Logic to handle track changes, pauses, and continuous playback ---
        const isNewTrack = !currentTrackState || currentTrackState.trackId !== currentMetadata.trackId;

        if (isNewTrack) {
            // A new track has started or first track is playing
            if (currentTrackState && currentTrackState.isPlaying && currentTrackState.durationPlayed > 0) {
                // If previous track was playing, send its final record
                sendListeningRecord({
                    trackId: currentTrackState.trackId,
                    title: currentTrackState.title,
                    artist: currentTrackState.artist,
                    timestamp: Date.now() - currentTrackState.durationPlayed,
                    durationPlayed: currentTrackState.durationPlayed,
                });
            }
            // Initialize state for the new track
            currentTrackState = {
                trackId: currentMetadata.trackId,
                title: currentMetadata.title,
                artist: currentMetadata.artist,
                lastKnownTime: currentTimeSeconds,
                isPlaying: isPlaying,
                duration: currentMetadata.duration,
                durationPlayed: 0, // Reset for new segment
            };
            console.log('New track detected and initialized:', currentTrackState.title, '-', currentTrackState.artist);
        } else {
            // Same track
            // Ensure currentTrackState is not null (it shouldn't be if isNewTrack is false, but TS needs help or we need to be safe)
            if (currentTrackState) {
                if (isPlaying && currentTimeSeconds > currentTrackState.lastKnownTime) {
                    // Track is playing and time is advancing
                    const playedThisIntervalMs = (currentTimeSeconds - currentTrackState.lastKnownTime) * 1000;
                    if (playedThisIntervalMs > 0) {
                        currentTrackState.durationPlayed += playedThisIntervalMs;
                        // Note: We are accumulating durationPlayed and sending when a segment ends (pause/skip/etc.)
                        // For now, we accumulate. We'll send when the state changes significantly.
                    }
                } else if (!isPlaying && currentTrackState.isPlaying) {
                    // Track was playing, now paused. Send accumulated duration for this segment.
                    if (currentTrackState.durationPlayed > 0) {
                        sendListeningRecord({
                            trackId: currentTrackState.trackId,
                            title: currentTrackState.title,
                            artist: currentTrackState.artist,
                            timestamp: Date.now() - currentTrackState.durationPlayed,
                            durationPlayed: currentTrackState.durationPlayed,
                        });
                    }
                    currentTrackState.durationPlayed = 0; // Reset for next segment
                } else if (isPlaying && !currentTrackState.isPlaying) {
                    // Track was paused, now playing. Start new segment accumulation.
                    currentTrackState.durationPlayed = 0; // Reset as new segment begins
                }

                // Update state regardless
                currentTrackState.lastKnownTime = currentTimeSeconds;
                currentTrackState.isPlaying = isPlaying;
            }
        }
    }, 1000); // Check every second
}

// Start tracking when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    // We need to wait for the player to be present in the DOM
    const observer = new MutationObserver((_mutations, obs) => {
        if (document.querySelector('.playControls__play')) {
            startTrackingInterval();
            obs.disconnect(); // Stop observing once player is found
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also, handle cases where player might already be present
    if (document.querySelector('.playControls__play')) {
        startTrackingInterval();
    }
});

// Stop tracking when the page unloads or before navigating away
window.addEventListener('beforeunload', () => {
    stopTrackingInterval();
    // Before unloading, send any final pending listening record
    if (currentTrackState && currentTrackState.isPlaying && currentTrackState.durationPlayed > 0) {
        sendListeningRecord({
            trackId: currentTrackState.trackId,
            title: currentTrackState.title,
            artist: currentTrackState.artist,
            timestamp: Date.now() - currentTrackState.durationPlayed,
            durationPlayed: currentTrackState.durationPlayed,
        });
    }
});

// For initial load, if the player is already there
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.querySelector('.playControls__play')) {
        startTrackingInterval();
    }
}
