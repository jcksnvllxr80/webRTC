import { state } from './state.js';
import { isInRoom } from './room.js';

export function setupUIListeners() {
    const parsePixels = (value) => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

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
    const handle       = document.getElementById('panel-resize-handle');
    const callUi       = document.getElementById('call-ui');
    const roomBar      = document.getElementById('room-bar');
    const participantList = document.getElementById('participant-list');
    const bottomPanel  = document.getElementById('bottom-panel');
    const videoSection = document.getElementById('video-section');
    const controlsBar  = videoSection?.querySelector('.controls-bar');

    if (handle && videoSection && callUi && bottomPanel) {
        const STORAGE_KEY = 'panelSplitHeight';
        const MIN_VIDEO_CONTENT_PX = 120;

        function getSplitBounds() {
            const callHeight = callUi.getBoundingClientRect().height;
            const roomBarHeight = roomBar?.getBoundingClientRect().height ?? 0;
            const participantHeight = participantList?.getBoundingClientRect().height ?? 0;
            const handleHeight = handle.getBoundingClientRect().height;
            const splitHeight = callHeight - roomBarHeight - participantHeight - handleHeight;
            const bottomMinHeight = parsePixels(window.getComputedStyle(bottomPanel).minHeight);
            const videoStyles = window.getComputedStyle(videoSection);
            const videoPadding = parsePixels(videoStyles.paddingTop) + parsePixels(videoStyles.paddingBottom);
            const controlsHeight = controlsBar?.getBoundingClientRect().height ?? 0;
            const preferredMinHeight = Math.max(MIN_VIDEO_CONTENT_PX, Math.ceil(videoPadding + controlsHeight + 32));
            const maxVideoHeight = Math.max(0, splitHeight - bottomMinHeight);
            const minVideoHeight = Math.min(preferredMinHeight, maxVideoHeight || preferredMinHeight);

            return { minVideoHeight, maxVideoHeight };
        }

        function applyVideoHeight(nextHeight) {
            const { minVideoHeight, maxVideoHeight } = getSplitBounds();
            if (maxVideoHeight <= 0) {
                return;
            }

            const fallbackHeight = videoSection.getBoundingClientRect().height;
            const requestedHeight = Number.isFinite(nextHeight) ? nextHeight : fallbackHeight;
            const clampedHeight = Math.min(Math.max(requestedHeight, minVideoHeight), maxVideoHeight);
            const roundedHeight = Math.round(clampedHeight);

            videoSection.style.height = roundedHeight + 'px';
            return roundedHeight;
        }

        // Restore saved height
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedHeight = Number.parseInt(saved, 10);
        applyVideoHeight(Number.isFinite(savedHeight) ? savedHeight : undefined);

        window.addEventListener('resize', () => {
            const currentHeight = Number.parseInt(videoSection.style.height, 10);
            applyVideoHeight(Number.isFinite(currentHeight) ? currentHeight : undefined);
        });

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handle.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';

            const startY    = e.clientY;
            const startH    = videoSection.getBoundingClientRect().height;

            function onMove(e) {
                const delta  = e.clientY - startY;
                applyVideoHeight(startH + delta);
            }

            function onUp() {
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem(STORAGE_KEY, String(Number.parseInt(videoSection.style.height, 10)));
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
}
