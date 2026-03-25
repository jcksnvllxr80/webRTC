import { initCamera, shareScreen, stopCamera } from './media.js';
import { setupSignalingListeners } from './webrtc.js';
import { setupChatListeners } from './chat.js';
import { setupUIListeners } from './ui.js';
import { setupFriendsListeners } from './friends.js';
import { setupRoomUI, isInRoom } from './room.js';
import { showOnboarding } from './onboarding.js';

// Always set up room UI (lobby or call view)
setupRoomUI();
setupUIListeners();

// Only initialize call features when inside a room
if (isInRoom()) {
    const startCameraBtn = document.getElementById('start-camera');
    const shareScreenBtn = document.getElementById('share-screen');
    const stopCameraBtn = document.getElementById('stop-camera');

    startCameraBtn.addEventListener('click', async () => {
        startCameraBtn.disabled = true;
        startCameraBtn.textContent = 'Starting...';
        try {
            await initCamera();
            startCameraBtn.textContent = 'Start Camera';
            startCameraBtn.disabled = false;
        } catch {
            startCameraBtn.textContent = 'Start Camera';
            startCameraBtn.disabled = false;
        }
    });

    shareScreenBtn.addEventListener('click', async () => {
        shareScreenBtn.disabled = true;
        shareScreenBtn.textContent = 'Sharing...';
        try {
            await shareScreen();
            shareScreenBtn.textContent = 'Share Screen';
            shareScreenBtn.disabled = false;
        } catch {
            shareScreenBtn.textContent = 'Share Screen';
            shareScreenBtn.disabled = false;
        }
    });

    stopCameraBtn.addEventListener('click', () => {
        stopCamera();
    });

    setupSignalingListeners();
    setupChatListeners();
}

// Friends are always available
setupFriendsListeners();

// Show onboarding for first-time users
showOnboarding();
