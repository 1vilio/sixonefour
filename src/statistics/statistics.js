// src/statistics/statistics.js
const { ipcRenderer } = require('electron');

let playsPerHourChart; // To store the Chart.js instance

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelector('.tabs');
    const statsContent = document.getElementById('stats-content');
    const closeButton = document.getElementById('close-statistics');
    const topTracksList = document.getElementById('top-tracks-list');
    const topArtistsList = document.getElementById('top-artists-list');
    const playsPerHourChartCanvas = document.getElementById('playsPerHourChart');

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

    // Handle opening internal links
    document.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
            event.preventDefault();
            ipcRenderer.send('navigate-in-app', event.target.href);
        }
    });

    async function loadStats(period) {
        statsContent.innerHTML = '<div class="loader"></div>';
        
        // Hide other sections while loading
        document.getElementById('top-tracks-section').style.display = 'none';
        document.getElementById('top-artists-section').style.display = 'none';
        document.getElementById('plays-per-hour-section').style.display = 'none';

        try {
            const stats = await ipcRenderer.invoke('get-listening-stats', period);
            renderStats(stats);
        } catch (error) {
            console.error('Failed to load statistics:', error);
            statsContent.innerHTML = '<p>Error loading statistics.</p>';
        }
    }

    function renderStats(stats) {
        statsContent.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Tracks Played:</span>
                <span class="stat-value">${stats.totalTracksPlayed}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Most Played Track:</span>
                <span class="stat-value">
                    ${stats.mostPlayedTrack ? `<a href="${stats.mostPlayedTrack.url}">${stats.mostPlayedTrack.title}</a> by ${stats.mostPlayedTrack.artist} (${stats.mostPlayedTrack.playCount} plays)` : 'N/A'}
                </span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Listening Time:</span>
                <span class="stat-value">${stats.totalListeningTime.hours}h ${stats.totalListeningTime.minutes}m ${stats.totalListeningTime.seconds}s</span>
            </div>
        `;

        // Render Top Tracks
        if (stats.topTracks && stats.topTracks.length > 0) {
            document.getElementById('top-tracks-section').style.display = 'block';
            topTracksList.innerHTML = stats.topTracks.map(track => `
                <li><a href="${track.url}">${track.title}</a> by ${track.artist} (${track.playCount} plays)</li>
            `).join('');
        } else {
            document.getElementById('top-tracks-section').style.display = 'none';
        }

        // Render Top Artists
        if (stats.topArtists && stats.topArtists.length > 0) {
            document.getElementById('top-artists-section').style.display = 'block';
            topArtistsList.innerHTML = stats.topArtists.map(artist => `
                <li>${artist.name} (${artist.playCount} plays)</li>
            `).join('');
        } else {
            document.getElementById('top-artists-section').style.display = 'none';
        }

        // Render Plays per Hour Chart
        if (stats.playsPerHour && playsPerHourChartCanvas) {
            document.getElementById('plays-per-hour-section').style.display = 'block';
            const ctx = playsPerHourChartCanvas.getContext('2d');

            if (playsPerHourChart) {
                playsPerHourChart.destroy(); // Destroy existing chart instance
            }

            // Generate a color palette for the doughnut chart
            const backgroundColors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FFCD56', '#C9CBCF',
                '#7CFC00', '#ADD8E6', '#F08080', '#20B2AA', '#BA55D3', '#8B0000', '#008080', '#DDA0DD',
                '#6A5ACD', '#FFD700', '#A9A9A9', '#B0C4DE', '#FFB6C1', '#87CEEB', '#32CD32', '#DA70D6'
            ];
            const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));

            playsPerHourChart = new Chart(ctx, {
                type: 'doughnut', // Changed to doughnut chart
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    datasets: [{
                        label: 'Plays',
                        data: stats.playsPerHour,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true, // Set to true to respect container aspect ratio
                    plugins: {
                        legend: {
                            position: 'right', // Position legend to the right for better readability
                            labels: {
                                color: '#fff'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed !== null) {
                                        label += context.parsed + ' plays';
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            document.getElementById('plays-per-hour-section').style.display = 'none';
        }
    }

    // Load initial stats
    loadStats('weekly');
});
