// Extract room ID from URL path: /room/abc123 -> abc123
function getRoomIdFromUrl() {
    const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
}

export const state = {
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    roomId: getRoomIdFromUrl(),
    mediaState: 'chat',       // 'chat' | 'audio' | 'video' | 'screen'
    participants: new Map(),   // socketId -> { username, mediaState }
    audioStream: null          // mic-only stream (separate from localStream which holds video)
};

export const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

export const socket = io(window.location.origin);
