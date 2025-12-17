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
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.playsInline = true;
            // Diagnostic: Log when video ends to check if loop is working
            videoElement.addEventListener('ended', () => {
                console.log('BACKGROUND VIDEO ENDED');
                // Manually loop the video
                videoElement.load();
                videoElement.play();
            });
            document.body.prepend(videoElement);
        }
        videoElement.src = videoUrl;
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
