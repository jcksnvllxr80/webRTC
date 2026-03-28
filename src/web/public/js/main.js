import { initCamera, shareScreen, initAudio, leaveAudio, stopVideo, reapplyAudioSettings } from './media.js';
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
    // Join Audio
    document.getElementById('join-audio-btn').addEventListener('click', async () => {
        const btn = document.getElementById('join-audio-btn');
        btn.disabled = true;
        btn.textContent = 'Joining...';
        try {
            await initAudio();
        } catch { /* handled in initAudio */ }
        btn.textContent = 'Join Audio';
        btn.disabled = false;
    });

    // Leave Audio
    document.getElementById('leave-audio-btn').addEventListener('click', () => {
        leaveAudio();
    });

    // Start Camera
    const startCameraBtn = document.getElementById('start-camera');
    startCameraBtn.addEventListener('click', async () => {
        startCameraBtn.disabled = true;
        startCameraBtn.textContent = 'Starting...';
        try {
            await initCamera();
        } catch { /* handled in initCamera */ }
        startCameraBtn.textContent = 'Start Camera';
        startCameraBtn.disabled = false;
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
