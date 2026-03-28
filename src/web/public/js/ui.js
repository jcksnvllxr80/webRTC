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

    // Help menu
    const helpBtn = document.getElementById('help-btn');
    const helpMenu = document.getElementById('help-menu');
    fetch('/api/version')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('help-version');
            if (el && data.version) el.textContent = data.version;
        })
        .catch(() => {});
    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        helpMenu.hidden = !helpMenu.hidden;
    });
    document.addEventListener('click', () => { helpMenu.hidden = true; });

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

    // Minimize local preview toggle
    const videosDiv   = document.getElementById('videos');
    const minimizeBtn = document.getElementById('minimize-local-btn');
    const restoreBtn  = document.getElementById('restore-local-btn');
    const LOCAL_HIDDEN_KEY = 'localVideoHidden';

    if (localStorage.getItem(LOCAL_HIDDEN_KEY) === 'true') {
        videosDiv.classList.add('local-hidden');
        restoreBtn.style.display = '';
    }
    minimizeBtn.addEventListener('click', () => {
        videosDiv.classList.add('local-hidden');
        restoreBtn.style.display = '';
        localStorage.setItem(LOCAL_HIDDEN_KEY, 'true');
    });
    restoreBtn.addEventListener('click', () => {
        videosDiv.classList.remove('local-hidden');
        restoreBtn.style.display = 'none';
        localStorage.setItem(LOCAL_HIDDEN_KEY, 'false');
    });

    // Mute remote audio toggle
    const muteRemoteBtn = document.getElementById('mute-remote-btn');
    const SPEAKER_ON  = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
    const SPEAKER_OFF = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';

    muteRemoteBtn.addEventListener('click', () => {
        const vid = document.getElementById('user-2');
        vid.muted = !vid.muted;
        muteRemoteBtn.querySelector('svg path').setAttribute('d', vid.muted ? SPEAKER_OFF : SPEAKER_ON);
        muteRemoteBtn.title = vid.muted ? 'Unmute' : 'Mute';
        muteRemoteBtn.setAttribute('aria-label', vid.muted ? 'Unmute remote audio' : 'Mute remote audio');
    });

    // PiP popout for remote video
    const popoutBtn   = document.getElementById('popout-btn');
    const remoteVideo = document.getElementById('user-2');
    const PIP_ICON    = 'M19 11h-8v6h8v-6zm4 8V5c0-1.1-.9-2-2-2H3C1.9 3 1 3.9 1 5v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.98h18v14.04z';
    const EXIT_PIP_ICON = 'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 13h6v-2H9v2z';

    if (document.pictureInPictureEnabled) {
        popoutBtn.addEventListener('click', async () => {
            try {
                if (document.pictureInPictureElement === remoteVideo) {
                    await document.exitPictureInPicture();
                } else {
                    await remoteVideo.requestPictureInPicture();
                }
            } catch (err) {
                console.warn('PiP failed:', err);
            }
        });

        remoteVideo.addEventListener('enterpictureinpicture', () => {
            popoutBtn.querySelector('svg path').setAttribute('d', EXIT_PIP_ICON);
            popoutBtn.title = 'Exit pop out';
            document.getElementById('remote-wrapper').classList.add('pip-active');
        });
        remoteVideo.addEventListener('leavepictureinpicture', () => {
            popoutBtn.querySelector('svg path').setAttribute('d', PIP_ICON);
            popoutBtn.title = 'Pop out';
            document.getElementById('remote-wrapper').classList.remove('pip-active');
        });
    } else {
        popoutBtn.style.display = 'none';
    }

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
