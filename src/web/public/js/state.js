// Extract room ID from URL path: /room/abc123 -> abc123
function getRoomIdFromUrl() {
    const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
}

export const state = {
    voicePC: null,          // RTCPeerConnection — mic audio only
    videoPC: null,          // RTCPeerConnection — camera / screen / screen audio
    localStream: null,
    remoteVideoStream: null,  // tracks from videoPC — attached to <video id="user-2">
    remoteAudioStream: null,  // tracks from voicePC — attached to <audio id="user-2-audio">
    roomId: getRoomIdFromUrl(),
    media: { audio: false, video: false, screen: false },
    participants: new Map(),  // socketId -> { username, media }
    audioStream: null,        // raw mic stream
    screenAudioSender: null,  // RTCRtpSender for screen-share audio track (if any)
    isSharingSystemAudio: false,
    audioSettings: loadAudioSettings()
};

function loadAudioSettings() {
    const defaults = { noiseSuppression: true, echoCancellation: true, autoGainControl: true, micVolume: 1.0, autoJoinAudio: true };
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
