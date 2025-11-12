// src/statistics/statistics.js
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelector('.tabs');
    const statsContent = document.getElementById('stats-content');
    const closeButton = document.getElementById('close-statistics');

    tabs.addEventListener('click', (event) => {
        if (event.target.classList.contains('tab-button')) {
            const period = event.target.dataset.period;
            
            // Update active tab
            document.querySelector('.tab-button.active').classList.remove('active');
            event.target.classList.add('active');

            // Load stats for the selected period
            loadStats(period);
        }
    });

    closeButton.addEventListener('click', () => {
        ipcRenderer.send('toggle-statistics');
    });

    async function loadStats(period) {
        // Show loader
        statsContent.innerHTML = '<div class="loader"></div>';

        try {
            const stats = await ipcRenderer.invoke('get-listening-stats', period);
            renderStats(stats);
        } catch (error) {
            console.error('Failed to load listening stats:', error);
            statsContent.innerHTML = '<p>Error loading statistics.</p>';
        }
    }

    function renderStats(stats) {
        const { totalTracksPlayed, mostPlayedTrack, totalListeningTime } = stats;
        
        let mostPlayedHtml = '';
        if (mostPlayedTrack) {
            mostPlayedHtml = `
                <div class="stat-item">
                    <span class="stat-label">Most Played Track</span>
                    <span class="stat-value">
                        ${mostPlayedTrack.title} by ${mostPlayedTrack.artist} (${mostPlayedTrack.playCount} times)
                    </span>
                </div>
            `;
        } else {
            mostPlayedHtml = `
                <div class="stat-item">
                    <span class="stat-label">Most Played Track</span>
                    <span class="stat-value">N/A</span>
                </div>
            `;
        }

        statsContent.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Tracks Played</span>
                <span class="stat-value">${totalTracksPlayed}</span>
            </div>
            ${mostPlayedHtml}
            <div class="stat-item">
                <span class="stat-label">Total Listening Time</span>
                <span class="stat-value">
                    ${totalListeningTime.hours}h ${totalListeningTime.minutes}m ${totalListeningTime.seconds}s
                </span>
            </div>
        `;
    }

    // Initial load
    loadStats('weekly');
});
