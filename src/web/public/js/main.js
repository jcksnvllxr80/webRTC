import { initCamera, shareScreen, stopCamera, initAudio, leaveAudio, stopVideo } from './media.js';
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
    // Join Audio
    document.getElementById('join-audio-btn').addEventListener('click', async () => {
        const btn = document.getElementById('join-audio-btn');
        btn.disabled = true;
        btn.textContent = 'Joining...';
        try {
            await initAudio();
        } catch {
            // initAudio handles its own errors
        }
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
        } catch {
            // initCamera handles its own errors
        }
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
        } catch {
            // shareScreen handles its own errors
        }
        shareScreenBtn.textContent = 'Share Screen';
        shareScreenBtn.disabled = false;
    });

    // Stop Video
    document.getElementById('stop-video-btn').addEventListener('click', () => {
        stopVideo();
    });

    // Legacy stop camera (hidden but still wired)
    document.getElementById('stop-camera').addEventListener('click', () => {
        stopCamera();
    });

    setupSignalingListeners();
    setupChatListeners();
}

// Friends are always available
setupFriendsListeners();

// Show onboarding for first-time users
showOnboarding();
