import { contextBridge, ipcRenderer } from 'electron';
import type { TrackInfo, TrackUpdateReason } from './types';

contextBridge.exposeInMainWorld('soundcloudAPI', {
    sendTrackUpdate: (data: TrackInfo, reason: TrackUpdateReason) => {
        ipcRenderer.send('soundcloud:track-update', {
            data,
            reason,
        });
    },
});

// Video Background Handler
ipcRenderer.on('theme-set-video-background', (_event, videoUrl, blur) => {
    let videoElement = document.getElementById('theme-video-background') as HTMLVideoElement;

    if (videoUrl) {
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'theme-video-background';
            videoElement.style.position = 'fixed';
            videoElement.style.top = '0';
            videoElement.style.left = '0';
            videoElement.style.width = '100vw';
            videoElement.style.height = '100vh';
            videoElement.style.objectFit = 'cover';
            videoElement.style.zIndex = '-1';
            videoElement.style.pointerEvents = 'none'; // Ensure it doesn't block clicks

            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.loop = true;
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('preload', 'auto');

            // Resume play when window becomes visible
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && videoElement && videoElement.paused) {
                    videoElement.play().catch((err) => console.error('[Themes] Video resume failed:', err));
                }
            });

            document.body.prepend(videoElement);
        }

        // Only update src if it changed to avoid flickering/reloads
        if (videoElement.src !== videoUrl) {
            videoElement.src = videoUrl;
            videoElement.load();
            videoElement.play().catch((err) => console.error('[Themes] Video play failed:', err));
        }

        videoElement.style.filter = `blur(${blur}px)`;
    } else {
        if (videoElement) {
            videoElement.remove();
        }
    }
});

// Logo Handler
// Logo Handler
let originalLogoContent: string | null = null; // Cache for the original logo

ipcRenderer.on('theme-set-logo', (_event, logoUrl) => {
    const logoContainer = document.querySelector('.header__logo a.header__logoLink');

    if (logoContainer) {
        // Capture original content only once
        if (originalLogoContent === null) {
            originalLogoContent = logoContainer.innerHTML;
        }

        if (logoUrl) {
            // Apply custom logo
            logoContainer.innerHTML = '';
            const logoImg = document.createElement('img');
            logoImg.src = logoUrl;
            logoImg.style.height = '24px'; // Or any appropriate styling
            logoImg.style.width = 'auto';
            logoImg.style.padding = '4px';
            logoContainer.appendChild(logoImg);
        } else {
            // Restore default logo if it was cached
            if (originalLogoContent !== null) {
                logoContainer.innerHTML = originalLogoContent;
            }
        }
    }
});

// Theme Application Handler
ipcRenderer.on('theme-apply-to-content', (_event, { isDark, contentCSS }) => {
    try {
        document.documentElement.classList.toggle('theme-light', !isDark);
        document.documentElement.classList.toggle('theme-dark', isDark);
        document.body.classList.toggle('theme-light', !isDark);
        document.body.classList.toggle('theme-dark', isDark);

        if (isDark) {
            document.documentElement.style.setProperty('--background-base', '#121212');
            document.documentElement.style.setProperty('--background-surface', '#212121');
            document.documentElement.style.setProperty('--text-base', '#ffffff');
        } else {
            document.documentElement.style.setProperty('--background-base', '#ffffff');
            document.documentElement.style.setProperty('--background-surface', '#f2f2f2');
            document.documentElement.style.setProperty('--text-base', '#333333');
        }

        const scrollbarStyleId = 'custom-scrollbar-style';
        let scrollbarStyle = document.getElementById(scrollbarStyleId);
        if (!scrollbarStyle) {
            scrollbarStyle = document.createElement('style');
            scrollbarStyle.id = scrollbarStyleId;
            document.head.appendChild(scrollbarStyle);
        }

        scrollbarStyle.textContent = `
            ::-webkit-scrollbar-button {
                display: none;
            }
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
                background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
            }
            ::-webkit-scrollbar-track {
                background-color: transparent;
            }
            ::-webkit-scrollbar-thumb {
                background-color: ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
                border-radius: 4px;
                transition: background-color 0.3s;
            }
            ::-webkit-scrollbar-thumb:hover {
                background-color: ${isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
            }
            ::-webkit-scrollbar-corner {
                background-color: transparent;
            }
        `;

        const customStyleId = 'custom-theme-style';
        let customStyle = document.getElementById(customStyleId);
        if (contentCSS && contentCSS.trim()) {
            if (!customStyle) {
                customStyle = document.createElement('style');
                customStyle.id = customStyleId;
                document.head.appendChild(customStyle);
            }
            customStyle.textContent = contentCSS;
            console.log('[Themes] Applied custom theme CSS via IPC');
        } else if (customStyle) {
            customStyle.remove();
            console.log('[Themes] Removed custom theme CSS via IPC');
        }
    } catch (e) {
        console.error('[Themes] Error applying theme via IPC:', e);
    }
});
