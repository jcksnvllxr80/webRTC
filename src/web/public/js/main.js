import { initCamera, shareScreen, initAudio, leaveAudio, stopVideo, reapplyAudioSettings, populateDeviceSelects, refreshDeviceLabels } from './media.js';
import { setupSignalingListeners } from './webrtc.js';
import { setupChatListeners } from './chat.js';
import { setupUIListeners } from './ui.js';
import { setupFriendsListeners } from './friends.js';
import { setupRoomUI, isInRoom } from './room.js';
import { showOnboarding } from './onboarding.js';
import { state, saveAudioSettings } from './state.js';

// Always set up room UI (lobby or call view)
setupRoomUI();
setupUIListeners();

// Only initialize call features when inside a room
if (isInRoom()) {
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

    // Start Camera — shows picker if multiple cameras available
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

    function showCameraPickerPopup(cameras) {
        // Remove any existing popup
        document.getElementById('camera-picker-popup')?.remove();

        const popup = document.createElement('div');
        popup.id = 'camera-picker-popup';
        popup.className = 'camera-picker-popup';
        popup.style.position = 'fixed';

        const title = document.createElement('h6');
        title.textContent = 'Select Camera';
        popup.appendChild(title);

        for (const cam of cameras) {
            const btn = document.createElement('button');
            btn.className = 'camera-picker-option';
            btn.textContent = cam.label || `Camera ${cameras.indexOf(cam) + 1}`;
            btn.addEventListener('click', () => {
                const sel = document.getElementById('camera-select');
                if (sel) sel.value = cam.deviceId;
                popup.remove();
                launchCamera();
            });
            popup.appendChild(btn);
        }

        document.body.appendChild(popup);

        // Position above button
        const rect = startCameraBtn.getBoundingClientRect();
        const pw = popup.offsetWidth || 180;
        const ph = popup.offsetHeight || 80;
        let left = rect.left + rect.width / 2 - pw / 2;
        let top  = rect.top - ph - 8;
        if (top < 8) top = rect.bottom + 8;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
        popup.style.left = left + 'px';
        popup.style.top  = top  + 'px';

        // Close on outside click
        function onOutside(e) {
            if (!popup.contains(e.target) && e.target !== startCameraBtn) {
                popup.remove();
                document.removeEventListener('click', onOutside, true);
            }
        }
        setTimeout(() => document.addEventListener('click', onOutside, true), 0);
    }

    startCameraBtn.addEventListener('click', async () => {
        let cameras = [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cameras = devices.filter(d => d.kind === 'videoinput');
        } catch { /* fall through to direct start */ }

        if (cameras.length > 1) {
            showCameraPickerPopup(cameras);
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

    // Settings panel
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const toggleNS = document.getElementById('toggle-ns');
    const toggleEC = document.getElementById('toggle-ec');
    const toggleAGC = document.getElementById('toggle-agc');

    // Init checkboxes from saved state
    toggleNS.checked = state.audioSettings.noiseSuppression;
    toggleEC.checked = state.audioSettings.echoCancellation;
    toggleAGC.checked = state.audioSettings.autoGainControl;

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (settingsPanel.style.display !== 'none' && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
            settingsPanel.style.display = 'none';
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsPanel.style.display !== 'none') {
            settingsPanel.style.display = 'none';
        }
    });

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

    setupSignalingListeners();
    setupChatListeners();
}

// Friends are always available
setupFriendsListeners();

// Show onboarding for first-time users
showOnboarding();
