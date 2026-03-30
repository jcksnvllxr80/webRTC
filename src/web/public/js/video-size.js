// Video size preset management
const LOCAL_SIZES = {
    S: 'minmax(0, 0.5fr)',
    M: 'minmax(0, 1fr)',
    L: 'minmax(0, 1.5fr)'
};

const REMOTE_SIZES = {
    S: 'minmax(0, 0.75fr)',
    M: 'minmax(0, 1.5fr)',
    L: 'minmax(0, 3fr)'
};

const LS_KEY_LOCAL = 'videoSizeLocal';
const LS_KEY_REMOTE = 'videoSizeRemote';

// Apply saved sizes from localStorage
export function applyVideoSizes() {
    const videosEl = document.getElementById('videos');
    if (!videosEl) return;

    const localSize = localStorage.getItem(LS_KEY_LOCAL) || 'M';
    const remoteSize = localStorage.getItem(LS_KEY_REMOTE) || 'M';

    videosEl.style.setProperty('--local-col', LOCAL_SIZES[localSize]);
    videosEl.style.setProperty('--remote-col', REMOTE_SIZES[remoteSize]);
}

// Create a size preset button group [S] [M] [L]
export function createSizeGroup(isLocal) {
    const SIZES = isLocal ? LOCAL_SIZES : REMOTE_SIZES;
    const LS_KEY = isLocal ? LS_KEY_LOCAL : LS_KEY_REMOTE;
    const currentSize = localStorage.getItem(LS_KEY) || 'M';

    const group = document.createElement('span');
    group.className = 'video-size-group';

    Object.keys(SIZES).forEach(size => {
        const btn = document.createElement('button');
        btn.className = 'video-size-btn';
        btn.textContent = size;
        btn.title = `${isLocal ? 'Local' : 'Remote'} video size: ${size}`;

        if (size === currentSize) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            const videosEl = document.getElementById('videos');
            if (!videosEl) return;

            // Save preference
            localStorage.setItem(LS_KEY, size);

            // Apply size
            const cssVar = isLocal ? '--local-col' : '--remote-col';
            videosEl.style.setProperty(cssVar, SIZES[size]);

            // Update active state
            group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        group.appendChild(btn);
    });

    return group;
}
