import { state } from './state.js';
import { isInRoom } from './room.js';
import { initializeRemoteAudioControls, toggleRemoteAudioUserMute } from './remote-audio.js';

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
    initializeRemoteAudioControls();
    muteRemoteBtn.addEventListener('click', () => toggleRemoteAudioUserMute());

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
