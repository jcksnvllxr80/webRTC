import { initCamera, shareScreen, stopCamera } from './media.js';
import { setupSignalingListeners } from './webrtc.js';
import { setupChatListeners } from './chat.js';
import { setupUIListeners } from './ui.js';
import { setupFriendsListeners } from './friends.js';
import { setupRoomUI, isInRoom } from './room.js';

// Always set up room UI (lobby or call view)
setupRoomUI();
setupUIListeners();

// Only initialize call features when inside a room
if (isInRoom()) {
    document.getElementById('start-camera').addEventListener('click', initCamera);
    document.getElementById('stop-camera').addEventListener('click', stopCamera);
    document.getElementById('share-screen').addEventListener('click', shareScreen);

    setupSignalingListeners();
    setupChatListeners();
}

// Friends are always available
setupFriendsListeners();
