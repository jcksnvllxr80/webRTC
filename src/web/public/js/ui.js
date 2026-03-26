import { state } from './state.js';
import { isInRoom } from './room.js';

export function setupUIListeners() {
    // Fetch and display current username
    fetch('/api/me')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('current-user');
            if (el && data.username) el.textContent = data.username;
        })
        .catch(() => {});

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        fetch('/logout', { method: 'POST' })
            .then(() => window.location.href = '/login.html')
            .catch(err => console.error('Logout error:', err));
    });

    if (!isInRoom()) return;

    // Enlarge toggle
    document.getElementById('enlarge-btn').addEventListener('click', () => {
        document.body.classList.toggle('enlarged');
    });

    // Fullscreen toggle
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        const wrapper = document.getElementById('remote-wrapper');
        const pip = document.getElementById('pip-preview');

        if (!document.fullscreenElement) {
            if (state.localStream || state.audioStream) {
                pip.srcObject = state.localStream || state.audioStream;
            }
            wrapper.requestFullscreen().catch(err => {
                console.error('Fullscreen failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const pip = document.getElementById('pip-preview');
        if (!document.fullscreenElement) {
            pip.srcObject = null;
        }
    });

    // Panel resize handle
    const handle      = document.getElementById('panel-resize-handle');
    const videoSection = document.getElementById('video-section');

    if (handle && videoSection) {
        const STORAGE_KEY = 'panelSplitHeight';
        const MIN_PX = 80;

        // Restore saved height
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) videoSection.style.height = saved + 'px';

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handle.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';

            const startY    = e.clientY;
            const startH    = videoSection.getBoundingClientRect().height;

            function onMove(e) {
                const delta  = e.clientY - startY;
                const callH  = document.getElementById('call-ui').getBoundingClientRect().height;
                const newH   = Math.max(MIN_PX, Math.min(startH + delta, callH - MIN_PX));
                videoSection.style.height = newH + 'px';
            }

            function onUp() {
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem(STORAGE_KEY, parseInt(videoSection.style.height));
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
}
