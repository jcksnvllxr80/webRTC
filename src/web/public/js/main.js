import { initCamera, shareScreen, initAudio, leaveAudio, stopVideo, reapplyAudioSettings, setMicVolume, getMicAnalyser, populateDeviceSelects, refreshDeviceLabels } from './media.js';
import { setupSignalingListeners } from './webrtc.js';
import { setupChatListeners } from './chat.js';
import { setupUIListeners } from './ui.js';
import { setupFriendsListeners } from './friends.js';
import { setupRoomUI, isInRoom } from './room.js';
import { showOnboarding } from './onboarding.js';
import { state, saveAudioSettings, loadRtcConfig } from './state.js';
import { applyVideoSizes } from './video-size.js';

// Load TURN config from server before anything that creates a peer connection
await loadRtcConfig();

// Always set up room UI (lobby or call view)
setupRoomUI();
setupUIListeners();

// Only initialize call features when inside a room
if (isInRoom()) {
    // Apply saved video size preferences
    applyVideoSizes();

    // Populate device dropdowns; re-populate after first permission grant so labels appear
    populateDeviceSelects();
    navigator.mediaDevices?.addEventListener('devicechange', () => populateDeviceSelects());

    // Join Audio
    document.getElementById('join-audio-btn').addEventListener('click', async () => {
        const btn = document.getElementById('join-audio-btn');
        btn.disabled = true;
        btn.textContent = 'Joining...';
        try {
            await initAudio();
            refreshDeviceLabels();
        } catch { /* handled in initAudio */ }
        btn.textContent = 'Join Audio';
        btn.disabled = false;
    });

    // Leave Audio
    document.getElementById('leave-audio-btn').addEventListener('click', () => {
        leaveAudio();
    });

    // Start Camera — shows picker modal if multiple cameras available
    const startCameraBtn = document.getElementById('start-camera');

    async function launchCamera() {
        startCameraBtn.disabled = true;
        startCameraBtn.textContent = 'Starting...';
        try {
            await initCamera();
            refreshDeviceLabels();
        } catch { /* handled in initCamera */ }
        startCameraBtn.textContent = 'Start Camera';
        startCameraBtn.disabled = false;
    }

    function showCameraPickerModal(cameras) {
        const modal = document.getElementById('camera-picker-modal');
        const list  = document.getElementById('camera-picker-list');
        if (!modal || !list) return;

        list.innerHTML = '';
        cameras.forEach((cam, i) => {
            const btn = document.createElement('button');
            btn.className = 'camera-picker-option';
            btn.innerHTML =
                `<span class="camera-picker-option-icon">📷</span>` +
                `<span class="camera-picker-option-name">${cam.label || `Camera ${i + 1}`}</span>`;
            btn.addEventListener('click', () => {
                const sel = document.getElementById('camera-select');
                if (sel) sel.value = cam.deviceId;
                closeCameraModal();
                launchCamera();
            });
            list.appendChild(btn);
        });

        modal.style.display = 'flex';
    }

    function closeCameraModal() {
        const modal = document.getElementById('camera-picker-modal');
        if (modal) modal.style.display = 'none';
    }

    document.getElementById('camera-picker-close')?.addEventListener('click', closeCameraModal);
    document.getElementById('camera-picker-cancel')?.addEventListener('click', closeCameraModal);
    document.getElementById('camera-picker-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCameraModal(); // click backdrop
    });

    startCameraBtn.addEventListener('click', async () => {
        let cameras = [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cameras = devices.filter(d => d.kind === 'videoinput');
        } catch { /* fall through to direct start */ }

        if (cameras.length > 1) {
            showCameraPickerModal(cameras);
        } else {
            launchCamera();
        }
    });

    // Share Screen
    const shareScreenBtn = document.getElementById('share-screen');
    shareScreenBtn.addEventListener('click', async () => {
        shareScreenBtn.disabled = true;
        shareScreenBtn.textContent = 'Sharing...';
        try {
            await shareScreen();
        } catch { /* handled in shareScreen */ }
        shareScreenBtn.textContent = 'Share Screen';
        shareScreenBtn.disabled = false;
    });

    // Stop Video
    document.getElementById('stop-video-btn').addEventListener('click', () => {
        stopVideo();
    });

    // Settings panel — draggable floating
    const settingsBtn   = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const dragHandle    = document.getElementById('settings-drag-handle');
    const closeBtn      = document.getElementById('settings-close-btn');
    const toggleNS  = document.getElementById('toggle-ns');
    const toggleEC  = document.getElementById('toggle-ec');
    const toggleAGC = document.getElementById('toggle-agc');
    const micVolumeSlider = document.getElementById('mic-volume');
    const micVolumeVal    = document.getElementById('mic-volume-val');
    const micVuBar        = document.getElementById('mic-vu-bar');

    // Init checkboxes from saved state
    toggleNS.checked  = state.audioSettings.noiseSuppression;
    toggleEC.checked  = state.audioSettings.echoCancellation;
    toggleAGC.checked = state.audioSettings.autoGainControl;

    // Init volume slider from saved state
    const savedVol = state.audioSettings.micVolume ?? 1.0;
    micVolumeSlider.value = savedVol;
    micVolumeVal.textContent = Math.round(savedVol * 100) + '%';

    micVolumeSlider.addEventListener('input', () => {
        const v = Number(micVolumeSlider.value);
        micVolumeVal.textContent = Math.round(v * 100) + '%';
        setMicVolume(v);
        state.audioSettings.micVolume = v;
        saveAudioSettings();
    });

    // VU meter animation loop — drives settings panel bar + participant list bar
    const vuData = new Uint8Array(128);
    function animateVu() {
        const analyser = getMicAnalyser();
        let level = 0;
        if (analyser) {
            analyser.getByteFrequencyData(vuData);
            const avg = vuData.reduce((a, b) => a + b, 0) / vuData.length;
            level = Math.min(100, (avg / 255) * 300);
        }
        if (micVuBar) micVuBar.style.width = level + '%';
        const pVuBar = document.querySelector('.participant-vu-bar');
        if (pVuBar) pVuBar.style.width = level + '%';
        requestAnimationFrame(animateVu);
    }
    animateVu();

    function openSettingsPanel() {
        // Restore last position, or position near the gear button
        const saved = (() => { try { return JSON.parse(localStorage.getItem('settings-panel-pos')); } catch { return null; } })();
        if (saved && typeof saved.x === 'number') {
            settingsPanel.style.left = saved.x + 'px';
            settingsPanel.style.top  = saved.y + 'px';
        } else {
            settingsPanel.style.left = '';
            settingsPanel.style.top  = '';
            settingsPanel.style.right  = '16px';
            settingsPanel.style.bottom = '64px';
        }
        settingsPanel.style.display = 'block';
    }

    function closeSettingsPanel() { settingsPanel.style.display = 'none'; }

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.style.display === 'none' ? openSettingsPanel() : closeSettingsPanel();
    });

    closeBtn?.addEventListener('click', closeSettingsPanel);

    // Escape key closes it
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsPanel.style.display !== 'none') closeSettingsPanel();
    });

    // Drag
    let dragging = false, dragOX = 0, dragOY = 0;
    dragHandle?.addEventListener('mousedown', (e) => {
        if (e.target.closest('.settings-close-btn')) return;
        dragging = true;
        const r = settingsPanel.getBoundingClientRect();
        dragOX = e.clientX - r.left;
        dragOY = e.clientY - r.top;
        // Switch from right/bottom anchoring to explicit left/top once dragged
        settingsPanel.style.right  = '';
        settingsPanel.style.bottom = '';
        settingsPanel.style.left   = r.left + 'px';
        settingsPanel.style.top    = r.top  + 'px';
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup',   onDragUp);
    });
    function onDragMove(e) {
        if (!dragging) return;
        const pw = settingsPanel.offsetWidth;
        const ph = settingsPanel.offsetHeight;
        const x = Math.max(0, Math.min(e.clientX - dragOX, window.innerWidth  - pw));
        const y = Math.max(0, Math.min(e.clientY - dragOY, window.innerHeight - ph));
        settingsPanel.style.left = x + 'px';
        settingsPanel.style.top  = y + 'px';
        try { localStorage.setItem('settings-panel-pos', JSON.stringify({ x, y })); } catch { /* ignore */ }
    }
    function onDragUp() {
        dragging = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup',   onDragUp);
    }

    // Toggle handlers
    async function handleToggle(checkbox, key) {
        const prev = state.audioSettings[key];
        state.audioSettings[key] = checkbox.checked;
        saveAudioSettings();

        // Remove any previous error
        const row = checkbox.closest('.setting-row');
        const existing = row.querySelector('.setting-error');
        if (existing) existing.remove();

        try {
            await reapplyAudioSettings();
        } catch {
            // Revert on failure
            state.audioSettings[key] = prev;
            checkbox.checked = prev;
            saveAudioSettings();
            const err = document.createElement('div');
            err.className = 'setting-error';
            err.textContent = 'Could not apply setting';
            row.appendChild(err);
        }
    }

    toggleNS.addEventListener('change', () => handleToggle(toggleNS, 'noiseSuppression'));
    toggleEC.addEventListener('change', () => handleToggle(toggleEC, 'echoCancellation'));
    toggleAGC.addEventListener('change', () => handleToggle(toggleAGC, 'autoGainControl'));

    const toggleAutoJoin = document.getElementById('toggle-autojoin-audio');
    toggleAutoJoin.checked = state.audioSettings.autoJoinAudio ?? true;
    toggleAutoJoin.addEventListener('change', () => {
        state.audioSettings.autoJoinAudio = toggleAutoJoin.checked;
        saveAudioSettings();
    });

    setupSignalingListeners();
    setupChatListeners();

    // Auto-join audio on room entry if setting is enabled
    if (state.audioSettings.autoJoinAudio) {
        initAudio().catch(() => {});
    }
}

// Friends are always available
setupFriendsListeners();

// Show onboarding for first-time users
showOnboarding();
