const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('releases-container');
    const showMoreBtn = document.getElementById('show-more-btn');
    const closeBtn = document.getElementById('close-btn');

    let allReleases = [];
    let displayedCount = 3;

    // Fetch initial data
    ipcRenderer
        .invoke('get-changelog')
        .then((releases) => {
            allReleases = releases;
            renderReleases();
        })
        .catch((err) => {
            container.innerHTML = `<div class="error-msg">Failed to load updates. Please check your connection.</div>`;
        });

    function renderReleases() {
        if (!allReleases.length) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No updates found.</p>';
            return;
        }

        container.innerHTML = '';
        const toShow = allReleases.slice(0, displayedCount);

        toShow.forEach((rel) => {
            const item = document.createElement('div');
            item.className = 'release-item';
            item.innerHTML = `
                <div class="release-header">
                    <span class="version-tag">${rel.version}</span>
                    <span class="release-date">${rel.date}</span>
                </div>
                <div class="release-body">${rel.body}</div>
            `;
            container.appendChild(item);
        });

        if (allReleases.length > displayedCount) {
            showMoreBtn.style.display = 'flex';
        } else {
            showMoreBtn.style.display = 'none';
        }
    }

    showMoreBtn.addEventListener('click', () => {
        displayedCount = allReleases.length;
        renderReleases();
    });

    closeBtn.addEventListener('click', () => {
        ipcRenderer.send('close-changelog');
    });

    // Handle ESC key to close
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            ipcRenderer.send('close-changelog');
        }
    });
});
