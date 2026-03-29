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
    media: { audio: false, video: false, screen: false },
    participants: new Map(),   // socketId -> { username, media }
    audioStream: null,         // mic-only stream (separate from localStream which holds video)
    screenAudioSender: null,   // RTCRtpSender for screen-share audio track (if any)
    audioSettings: loadAudioSettings()
};

function loadAudioSettings() {
    const defaults = { noiseSuppression: true, echoCancellation: true, autoGainControl: true, micVolume: 1.0 };
    try {
        const saved = JSON.parse(localStorage.getItem('webrtc-audio-settings'));
        if (saved) return { ...defaults, ...saved };
    } catch { /* ignore */ }
    return defaults;
}

export function saveAudioSettings() {
    localStorage.setItem('webrtc-audio-settings', JSON.stringify(state.audioSettings));
}

export const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

export async function loadRtcConfig() {
    try {
        const res = await fetch('/api/rtc-config');
        const { iceServers } = await res.json();
        if (iceServers) servers.iceServers = iceServers;
    } catch { /* fall back to STUN only */ }
}

export const socket = io(window.location.origin);
