document.addEventListener('DOMContentLoaded', () => {
    const artworkEl = document.getElementById('widget-artwork');
    const titleEl = document.getElementById('widget-track-title');
    const authorEl = document.getElementById('widget-track-author');
    const playBtn = document.getElementById('widget-play-btn');
    const prevBtn = document.getElementById('widget-prev-btn');
    const nextBtn = document.getElementById('widget-next-btn');
    const pinBtn = document.getElementById('widget-pin-btn');
    const progressFill = document.getElementById('widget-progress-fill');
    const timeElapsedEl = document.getElementById('widget-time-elapsed');
    const timeDurationEl = document.getElementById('widget-time-duration');
    const videoBg = document.getElementById('widget-video-bg');

    // --- Helper Functions ---
    function parseTimeToMs(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const parts = timeStr.split(':').map(Number);
        let ms = 0;
        if (parts.length === 3) {
            ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        } else if (parts.length === 2) {
            ms = (parts[0] * 60 + parts[1]) * 1000;
        }
        return ms;
    }

    // Listen for track updates from main process
    window.electronAPI.on('widget-track-update', (trackInfo) => {
        if (!trackInfo || !trackInfo.title) {
            if(titleEl) titleEl.textContent = 'No track playing';
            if(authorEl) authorEl.textContent = '...';
            if(artworkEl) artworkEl.src = '';
            if(playBtn) playBtn.innerHTML = '&#9654;';
            if(progressFill) progressFill.style.width = '0%';
            if(timeElapsedEl) timeElapsedEl.textContent = '0:00';
            if(timeDurationEl) timeDurationEl.textContent = '0:00';
            return;
        }

        if (trackInfo.isPlaying) {
            if(playBtn) playBtn.innerHTML = '&#10074;&#10074;'; // Pause icon
        } else {
            if(playBtn) playBtn.innerHTML = '&#9654;'; // Play icon
        }

        if(titleEl) titleEl.textContent = trackInfo.title;
        if(authorEl) authorEl.textContent = trackInfo.author;
        if(artworkEl) artworkEl.src = trackInfo.artwork || '';

        if(timeElapsedEl) timeElapsedEl.textContent = trackInfo.elapsed || '0:00';
        if(timeDurationEl) timeDurationEl.textContent = trackInfo.duration || '0:00';

        // Calculate progress
        const elapsedMs = parseTimeToMs(trackInfo.elapsed);
        const durationMs = parseTimeToMs(trackInfo.duration);
        if (durationMs > 0) {
            const progressPercent = (elapsedMs / durationMs) * 100;
            if(progressFill) progressFill.style.width = `${progressPercent}%`;
        } else {
            if(progressFill) progressFill.style.width = '0%';
        }
    });

    // Listen for theme updates
    window.electronAPI.on('widget-theme-update', ({ video, blur }) => {
        if (video) {
            videoBg.src = video;
            if(blur) videoBg.style.filter = `blur(${blur}px)`;
            videoBg.style.display = 'block';
            videoBg.play().catch(e => console.error("Video play failed", e));
        } else {
            videoBg.style.display = 'none';
            videoBg.src = ''; // Stop loading video
        }
    });

    // Send actions to main process
    playBtn?.addEventListener('click', () => {
        window.electronAPI.send('widget-action', 'playPause');
    });

    prevBtn?.addEventListener('click', () => {
        window.electronAPI.send('widget-action', 'prevTrack');
    });

    nextBtn?.addEventListener('click', () => {
        window.electronAPI.send('widget-action', 'nextTrack');
    });

    pinBtn?.addEventListener('click', () => {
        window.electronAPI.send('widget-toggle-pin');
    });

    // Listen for pin state changes from main process
    window.electronAPI.on('widget-pin-state-changed', (isPinned) => {
        if(pinBtn) pinBtn.style.opacity = isPinned ? '1' : '0.5';
    });
});
