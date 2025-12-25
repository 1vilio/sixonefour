// src/statistics/statistics.js
const { ipcRenderer } = require('electron');

let chartInstance; // To store the Chart.js instance

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelector('.tabs');
    const statsContent = document.getElementById('stats-content');
    const closeButton = document.getElementById('close-statistics');
    const topTracksList = document.getElementById('top-tracks-list');
    const topArtistsList = document.getElementById('top-artists-list');
    const playsPerHourChartCanvas = document.getElementById('playsPerHourChart');

    // Modal elements
    const modal = document.getElementById('artworks-modal');
    const closeModal = document.querySelector('.close-modal');
    const modalArtworksGrid = document.getElementById('modal-artworks-grid');
    const modalDateTitle = document.getElementById('modal-date-title');

    // Calendar elements
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarInfoPanel = document.getElementById('calendar-info-panel');
    const infoDate = calendarInfoPanel.querySelector('.info-date');
    const infoStats = calendarInfoPanel.querySelector('.info-stats');
    const infoArtworks = calendarInfoPanel.querySelector('.info-artworks');

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

    // Modal close handlers
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle opening internal links
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.href.startsWith('http')) {
            event.preventDefault();
            ipcRenderer.send('navigate-in-app', link.href);
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
        document.getElementById('music-calendar-section').style.display = 'none';
        // Check if rediscoveries section exists before hiding
        const rediscoveriesSection = document.getElementById('rediscoveries-section');
        if (rediscoveriesSection) rediscoveriesSection.style.display = 'none';

        try {
            const stats = await ipcRenderer.invoke('get-listening-stats', period);
            if (!stats) throw new Error('Received empty stats object');
            renderStats(stats);
        } catch (error) {
            console.error('Failed to load statistics:', error);
            statsContent.innerHTML = `<p>Error loading statistics: ${error.message}</p>`;
        }
    }

    function formatChange(change) {
        if (change === undefined || change === null) return '';
        const color = change > 0 ? '#1db954' : change < 0 ? '#e91429' : '#b3b3b3';
        const arrow = change > 0 ? '&#9650;' : change < 0 ? '&#9660;' : '';
        return `<span style="color: ${color}; font-size: 0.8em; margin-left: 5px;">${arrow} ${Math.abs(change)}%</span>`;
    }

    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function renderStats(stats) {
        try {
            const placeholder =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

            statsContent.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Total Tracks Played:</span>
                    <span class="stat-value">
                        ${stats.totalTracksPlayed}
                        ${formatChange(stats.totalTracksPlayedChange)}
                    </span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Most Played Track:</span>
                    <span class="stat-value" style="display: flex; align-items: center; justify-content: flex-end;">
                        ${
                            stats.mostPlayedTrack
                                ? `
                            <a href="${stats.mostPlayedTrack.url}">
                                <img src="${stats.mostPlayedTrack.artwork || placeholder}" class="stat-artwork" style="width: 30px; height: 30px; margin-right: 8px;" alt="Artwork">
                            </a>
                            <div>
                                <a href="${stats.mostPlayedTrack.url}">${stats.mostPlayedTrack.title}</a>&nbsp;by&nbsp;<a href="${stats.mostPlayedTrack.artistUrl || '#'}">${stats.mostPlayedTrack.artist}</a> (${stats.mostPlayedTrack.playCount} plays)
                                ${formatChange(stats.mostPlayedTrack.change)}
                            </div>
                        `
                                : 'N/A'
                        }
                    </span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Listening Time:</span>
                    <span class="stat-value">
                        ${stats.totalListeningTime.hours}h ${stats.totalListeningTime.minutes}m ${stats.totalListeningTime.seconds}s
                        ${stats.totalListeningTime.change ? `<span style="color: ${stats.totalListeningTime.change.startsWith('+') ? '#1db954' : '#e91429'}; font-size: 0.8em; margin-left: 5px;">${stats.totalListeningTime.change}</span>` : ''}
                    </span>
                </div>
            `;

            // Render Advanced Metrics
            if (document.getElementById('variety-score'))
                document.getElementById('variety-score').textContent = stats.varietyScore || 0;
            if (document.getElementById('obsession-rate'))
                document.getElementById('obsession-rate').textContent = `${stats.obsessionRate || 0}%`;

            // Max Tracks Day
            if (document.getElementById('max-tracks-day')) {
                document.getElementById('max-tracks-day').textContent = stats.maxTracksInDay
                    ? stats.maxTracksInDay.count
                    : 0;
                document.getElementById('max-tracks-date').textContent = stats.maxTracksInDay
                    ? `${stats.maxTracksInDay.date} (${formatDuration(stats.maxTracksInDay.duration || 0)})`
                    : '-';
            }

            if (stats.maxRepeats) {
                document.getElementById('max-repeats').textContent = stats.maxRepeats.count;
                if (stats.maxRepeats.track) {
                    document.getElementById('max-repeats-track').innerHTML = `
                        <a href="${stats.maxRepeats.track.url}">${stats.maxRepeats.track.title}</a>&nbsp;by&nbsp;<a href="${stats.maxRepeats.track.artistUrl || '#'}">${stats.maxRepeats.track.artist}</a>
                    `;
                } else {
                    document.getElementById('max-repeats-track').textContent = '-';
                }
            }

            // New Metrics
            if (document.getElementById('avg-track-length'))
                document.getElementById('avg-track-length').textContent = formatDuration(stats.averageTrackLength || 0);
            if (document.getElementById('avg-daily-listening'))
                document.getElementById('avg-daily-listening').textContent = formatDuration(
                    stats.averageDailyListening || 0,
                );
            if (document.getElementById('consistency-score'))
                document.getElementById('consistency-score').textContent = `${stats.consistencyScore || 0}%`;

            // Render Top Tracks (with Show More/Less)
            if (stats.topTracks && stats.topTracks.length > 0) {
                document.getElementById('top-tracks-section').style.display = 'block';
                renderListWithShowMore(
                    topTracksList,
                    stats.topTracks,
                    (track) => `
                    <a href="${track.url}">
                        <img src="${track.artwork || placeholder}" class="stat-artwork" alt="Track Artwork">
                    </a>
                    <a href="${track.url}">${track.title}</a>&nbsp;by&nbsp;<a href="${track.artistUrl || '#'}">${track.artist}</a> (${track.playCount} plays)
                    ${formatChange(track.change)}
                `,
                );
            } else {
                document.getElementById('top-tracks-section').style.display = 'none';
            }

            // Render Top Artists (with Show More/Less)
            if (stats.topArtists && stats.topArtists.length > 0) {
                document.getElementById('top-artists-section').style.display = 'block';
                renderListWithShowMore(
                    topArtistsList,
                    stats.topArtists,
                    (artist) => `
                    <a href="${artist.url}">
                        <img src="${artist.artwork || placeholder}" class="stat-artwork" alt="Artist Artwork">
                    </a>
                    <a href="${artist.url}">${artist.name}</a> (${artist.playCount} plays)
                    ${formatChange(artist.change)}
                `,
                );
            } else {
                document.getElementById('top-artists-section').style.display = 'none';
            }

            // Render Rediscoveries
            const rediscoveriesList = document.getElementById('rediscoveries-list');
            const rediscoveriesSection = document.getElementById('rediscoveries-section');
            if (rediscoveriesSection) {
                if (stats.rediscoveries && stats.rediscoveries.length > 0) {
                    rediscoveriesSection.style.display = 'block';
                    rediscoveriesList.innerHTML = stats.rediscoveries
                        .map(
                            (track) => `
                        <li>
                            <a href="${track.url}">${track.title}</a>&nbsp;by&nbsp;<a href="${track.url.split('/').slice(0, 4).join('/')}">${track.artist}</a> (Used to play ${track.playCount} times)
                        </li>
                    `,
                        )
                        .join('');
                } else {
                    rediscoveriesSection.style.display = 'none';
                }
            }

            // Render Music Calendar
            if (stats.calendar) {
                document.getElementById('music-calendar-section').style.display = 'block';
                renderCalendar(stats.calendar);
            } else {
                document.getElementById('music-calendar-section').style.display = 'none';
            }

            // Render Plays per Hour Chart
            if (stats.playsPerHour && playsPerHourChartCanvas) {
                document.getElementById('plays-per-hour-section').style.display = 'block';
                renderChart(stats.playsPerHour);
            } else {
                document.getElementById('plays-per-hour-section').style.display = 'none';
            }
        } catch (err) {
            console.error('Error in renderStats:', err);
            statsContent.innerHTML += `<p style="color:red">Error rendering stats: ${err.message}</p>`;
        }
    }

    function renderListWithShowMore(container, items, itemRenderer) {
        const initialCount = 5;
        const initialItems = items.slice(0, initialCount);
        const remainingItems = items.slice(initialCount);

        // Set max-height style for scrollability when expanded
        container.style.maxHeight = 'none';
        container.style.overflowY = 'visible';

        const renderItems = (itemList) => itemList.map((item) => `<li>${itemRenderer(item)}</li>`).join('');

        container.innerHTML = renderItems(initialItems);

        // Helper to create button
        const createBtn = (text, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'show-more-btn';
            btn.textContent = text;
            btn.style.cssText =
                'background: none; border: none; color: #1db954; cursor: pointer; padding: 10px 0; font-size: 0.9em; width: 100%; text-align: center;';
            btn.addEventListener('click', onClick);
            return btn;
        };

        const parent = container.parentElement;
        // Remove existing button
        const existingBtn = parent.querySelector('.show-more-btn');
        if (existingBtn) existingBtn.remove();

        if (remainingItems.length > 0) {
            const showMoreBtn = createBtn(`+ Show ${remainingItems.length} More`, () => {
                container.innerHTML = renderItems(items); // Show all
                // Apply scroll if list is long (e.g. > 10 items)
                if (items.length > 10) {
                    container.style.maxHeight = '400px'; // Adjust height as needed
                    container.style.overflowY = 'auto';
                }

                showMoreBtn.remove();

                const showLessBtn = createBtn('- Show Less', () => {
                    container.innerHTML = renderItems(initialItems);
                    container.style.maxHeight = 'none';
                    container.style.overflowY = 'visible';
                    showLessBtn.remove();
                    parent.appendChild(showMoreBtn); // Restore Show More
                });
                parent.appendChild(showLessBtn);
            });
            parent.appendChild(showMoreBtn);
        }
    }

    function renderCalendar(calendarData) {
        calendarGrid.innerHTML = '';

        if (!calendarData) return;

        // Show last 365 days (52 weeks * 7 days = 364)
        const today = new Date();
        const daysToShow = 364; // Multiple of 7 for full columns
        const oneDay = 24 * 60 * 60 * 1000;

        // Calculate start date (Sunday of 52 weeks ago)
        const endDate = today;
        const startDate = new Date(endDate.getTime() - daysToShow * oneDay);

        // Adjust start date to be a Sunday for proper grid alignment if desired,
        // but usually GitHub starts from 1 year ago.
        // Let's just render 365 days.

        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(startDate.getTime() + i * oneDay);
            const dateStr = d.toISOString().split('T')[0];
            const data = calendarData[dateStr] || { count: 0, artworks: [] };

            const dayEl = document.createElement('div');
            dayEl.className = `calendar-day intensity-${getIntensity(data.count)}`;
            dayEl.dataset.date = dateStr;
            dayEl.dataset.count = data.count;

            // Hover event to update Info Panel
            dayEl.addEventListener('mouseenter', () => {
                updateInfoPanel(dateStr, data);
            });

            // Click to open modal if there are tracks
            dayEl.addEventListener('click', () => {
                if (data.artworks && data.artworks.length > 0) {
                    showArtworksModal(dateStr, data.artworks);
                }
            });

            calendarGrid.appendChild(dayEl);
        }

        // Initialize info panel with today's data or empty
        updateInfoPanel('Hover over a day', { count: 0, artworks: [] });
    }

    function updateInfoPanel(dateStr, data) {
        if (dateStr === 'Hover over a day') {
            infoDate.textContent = 'Hover over a day';
            infoStats.textContent = 'to see statistics';
            infoArtworks.innerHTML = '';
            return;
        }

        infoDate.textContent = dateStr;
        infoStats.textContent = `${data.count} tracks played`;

        // Show up to 8 artworks in the panel
        const artworksToShow = data.artworks ? data.artworks.slice(0, 8) : [];
        infoArtworks.innerHTML = artworksToShow
            .map((url) => `<img src="${url.replace('large', 't500x500')}" class="info-artwork">`)
            .join('');
    }

    function showArtworksModal(dateStr, artworks) {
        modalDateTitle.textContent = `Tracks Played on ${dateStr}`;
        modalArtworksGrid.innerHTML = artworks
            .map((url) => `<img src="${url.replace('large', 't500x500')}" alt="Artwork">`)
            .join('');
        modal.style.display = 'block';
    }

    function getIntensity(count) {
        if (count === 0) return 0;
        if (count <= 5) return 1;
        if (count <= 15) return 2;
        if (count <= 30) return 3;
        return 4;
    }

    function renderChart(data) {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            document.getElementById('plays-per-hour-section').innerHTML += '<p>Error: Chart.js library not loaded.</p>';
            return;
        }

        if (chartInstance) {
            chartInstance.destroy();
        }

        // Calculate total plays for the center text plugin
        const totalPlays = data.reduce((sum, count) => sum + count, 0);

        chartInstance = new Chart(playsPerHourChartCanvas, {
            type: 'doughnut',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [
                    {
                        label: 'Plays',
                        data: data,
                        backgroundColor: [
                            '#1DB954',
                            '#1ED760',
                            '#28E06F',
                            '#32E97E',
                            '#3CF28D',
                            '#46FB9C',
                            '#50FFAA',
                            '#5AFEB9',
                            '#64FDC8',
                            '#6EFCD7',
                            '#78FBE6',
                            '#82FAF5',
                            '#8CF9FF',
                            '#96F8FF',
                            '#A0F7FF',
                            '#AAF6FF',
                            '#B4F5FF',
                            '#BEF4FF',
                            '#C8F3FF',
                            '#D2F2FF',
                            '#DCF1FF',
                            '#E6F0FF',
                            '#F0EFFF',
                            '#FAEFFF',
                        ],
                        borderColor: '#191414',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false,
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
                            title: () => null,
                            label: function (context) {
                                let hour = context.label || '';
                                let plays = context.parsed;
                                return `${hour}: ${plays} plays`;
                            },
                        },
                    },
                },
                elements: {
                    arc: {
                        borderRadius: 5,
                    },
                },
            },
            plugins: [
                {
                    id: 'centerText',
                    beforeDraw: function (chart) {
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
                    },
                },
            ],
        });
    }

    // Load initial stats
    loadStats('weekly');
});
