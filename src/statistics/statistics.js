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

    // Listen for real-time updates
    ipcRenderer.on('stats-updated', () => {
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab) {
            const period = activeTab.dataset.period;
            loadStats(period);
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
                    ${stats.mostPlayedTrack ? `
                        <a href="${stats.mostPlayedTrack.url}">${stats.mostPlayedTrack.title}</a> by ${stats.mostPlayedTrack.artist} (${stats.mostPlayedTrack.playCount} plays)
                    ` : 'N/A'}
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
                <li>
                    <a href="${track.url}">${track.title}</a> by ${track.artist} (${track.playCount} plays)
                </li>
            `).join('');
        } else {
            document.getElementById('top-tracks-section').style.display = 'none';
        }

        // Render Top Artists
        if (stats.topArtists && stats.topArtists.length > 0) {
            document.getElementById('top-artists-section').style.display = 'block';
            const placeholder = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
            topArtistsList.innerHTML = stats.topArtists.map(artist => `
                <li>
                    <img src="${artist.artwork || placeholder}" class="stat-artwork" alt="Artist Artwork">
                    <a href="${artist.url}">${artist.name}</a> (${artist.playCount} plays)
                </li>
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

            const accentColor = '#1db954';
            const backgroundColors = Array.from({ length: 24 }, (_, i) => 
                `rgba(29, 185, 84, ${0.2 + (i / 36) * 0.8})` // More variance in opacity
            );
            const borderColors = Array.from({ length: 24 }, () => accentColor);
            const totalPlays = stats.playsPerHour.reduce((a, b) => a + b, 0);

            playsPerHourChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
                    datasets: [{
                        label: 'Plays',
                        data: stats.playsPerHour,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1.5,
                        hoverOffset: 8,
                        hoverBorderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '80%',
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleColor: '#ffffff',
                            bodyColor: '#b3b3b3',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 4,
                            displayColors: false,
                            callbacks: {
                                title: () => null, // Hide title
                                label: function(context) {
                                    let hour = context.label || '';
                                    let plays = context.parsed;
                                    return `${hour}: ${plays} plays`;
                                }
                            }
                        },
                        // A plugin to draw text in the center
                        customCanvasBackgroundColor: {
                            color: 'lightGreen',
                        },
                    },
                    elements: {
                        arc: {
                            borderRadius: 5,
                        }
                    }
                },
                plugins: [{
                    id: 'centerText',
                    beforeDraw: function(chart) {
                        const width = chart.width,
                              height = chart.height,
                              ctx = chart.ctx;
                        ctx.restore();
                        const fontSize = (height / 160).toFixed(2);
                        ctx.font = `${fontSize}em sans-serif`;
                        ctx.textBaseline = 'middle';

                        const text = `${totalPlays}`,
                              textX = Math.round((width - ctx.measureText(text).width) / 2),
                              textY = height / 2 - 15;
                        
                        const text2 = 'Total Plays',
                              text2X = Math.round((width - ctx.measureText(text2).width) / 2),
                              text2Y = height / 2 + 15;

                        ctx.fillStyle = '#fff';
                        ctx.fillText(text, textX, textY);
                        
                        ctx.fillStyle = '#b3b3b3';
                        ctx.font = `${(fontSize / 2).toFixed(2)}em sans-serif`;
                        ctx.fillText(text2, text2X, text2Y);

                        ctx.save();
                    }
                }]
            });
        } else {
            document.getElementById('plays-per-hour-section').style.display = 'none';
        }
    }

    // Load initial stats
    loadStats('weekly');
});
