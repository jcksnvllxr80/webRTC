import { state, servers, socket } from './state.js';
import { renderParticipants } from './room.js';
import { refreshInviteButtonStates } from './friends.js';

// ── per-connection state ──────────────────────────────────────────────────────
let voiceMakingOffer = false;
let voicePending = [];
let voiceIgnoreOffer = false;

let videoMakingOffer = false;
let videoPending = [];
let videoIgnoreOffer = false;
let videoSender = null; // RTCRtpSender — reused via replaceTrack to avoid renegotiation

function setConnectionStatus(message) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    if (message) { el.textContent = message; el.hidden = false; }
    else { el.hidden = true; }
}

// Perfect Negotiation: the "polite" peer yields on glare (simultaneous offers).
// Lower socket.id is polite.
function isPolite() {
    const remotePeer = [...state.participants.keys()].find(sid => sid !== socket.id);
    if (!remotePeer) return true; // no remote peer, be polite by default
    return socket.id < remotePeer;
}

// ── Voice PC ──────────────────────────────────────────────────────────────────

export function ensureVoiceConnection() {
    if (state.voicePC) return;

    state.voicePC = new RTCPeerConnection(servers);
    state.remoteAudioStream = new MediaStream();
    document.getElementById('user-2-audio').srcObject = state.remoteAudioStream;

    state.voicePC.ontrack = (event) => {
        const track = event.track;
        if (!state.remoteAudioStream.getTrackById(track.id)) {
            state.remoteAudioStream.addTrack(track);
        }
        document.getElementById('user-2-audio').srcObject = state.remoteAudioStream;
    };

    state.voicePC.onicecandidate = (event) => {
        if (event.candidate) socket.emit('voice-ice', event.candidate, state.roomId);
    };

    state.voicePC.oniceconnectionstatechange = () => {
        const s = state.voicePC?.iceConnectionState;
        if (s === 'connected' || s === 'completed') setConnectionStatus(null);
        else if (s === 'failed') {
            setConnectionStatus('Voice connection failed — retrying…');
            state.voicePC?.restartIce();
        } else if (s === 'disconnected') {
            setTimeout(() => {
                if (state.voicePC?.iceConnectionState === 'disconnected') {
                    state.voicePC?.restartIce();
                }
            }, 3000);
        }
    };

    state.voicePC.onnegotiationneeded = async () => {
        if (voiceMakingOffer) return;
        try {
            voiceMakingOffer = true;
            await state.voicePC.setLocalDescription();
            socket.emit('voice-offer', state.voicePC.localDescription, state.roomId);
        } catch (err) {
            console.error('Voice negotiation error:', err);
        } finally {
            voiceMakingOffer = false;
        }
    };
}

export function closeVoiceConnection() {
    state.voicePC?.close();
    state.voicePC = null;
    voiceMakingOffer = false;
    voicePending = [];
    voiceIgnoreOffer = false;
    state.remoteAudioStream = null;
    document.getElementById('user-2-audio').srcObject = null;
}

async function createVoiceOffer() {
    if (voiceMakingOffer) return;
    ensureVoiceConnection();
    try {
        voiceMakingOffer = true;
        await state.voicePC.setLocalDescription();
        socket.emit('voice-offer', state.voicePC.localDescription, state.roomId);
    } catch (err) {
        console.error('createVoiceOffer error:', err);
    } finally {
        voiceMakingOffer = false;
    }
}

async function createVoiceAnswer(offer) {
    ensureVoiceConnection();
    await state.voicePC.setRemoteDescription(offer);
    for (const c of voicePending) {
        try { await state.voicePC.addIceCandidate(c); } catch (e) { console.warn('voice ICE (buffered):', e); }
    }
    voicePending = [];
    const answer = await state.voicePC.createAnswer();
    await state.voicePC.setLocalDescription(answer);
    socket.emit('voice-answer', answer, state.roomId);
}

// ── Video PC ──────────────────────────────────────────────────────────────────

export function ensureVideoConnection() {
    if (state.videoPC) return;

    state.videoPC = new RTCPeerConnection(servers);
    state.remoteVideoStream = new MediaStream();
    document.getElementById('user-2').srcObject = state.remoteVideoStream;

    state.videoPC.ontrack = (event) => {
        const track = event.track;
        if (track.kind === 'video') {
            // Replace any stale video track
            state.remoteVideoStream.getVideoTracks()
                .filter(t => t.id !== track.id)
                .forEach(t => state.remoteVideoStream.removeTrack(t));
        } else {
            // Screen audio — purge ended tracks only
            state.remoteVideoStream.getAudioTracks()
                .filter(t => t.readyState === 'ended' && t.id !== track.id)
                .forEach(t => state.remoteVideoStream.removeTrack(t));
        }
        if (!state.remoteVideoStream.getTrackById(track.id)) {
            state.remoteVideoStream.addTrack(track);
        }
        document.getElementById('user-2').srcObject = state.remoteVideoStream;
    };

    state.videoPC.onicecandidate = (event) => {
        if (event.candidate) socket.emit('video-ice', event.candidate, state.roomId);
    };

    state.videoPC.oniceconnectionstatechange = () => {
        const s = state.videoPC?.iceConnectionState;
        if (s === 'connected' || s === 'completed') setConnectionStatus(null);
        else if (s === 'failed') {
            setConnectionStatus('Video connection failed — retrying…');
            state.videoPC?.restartIce();
        } else if (s === 'disconnected') {
            setTimeout(() => {
                if (state.videoPC?.iceConnectionState === 'disconnected') {
                    state.videoPC?.restartIce();
                }
            }, 3000);
        }
    };

    state.videoPC.onnegotiationneeded = async () => {
        if (videoMakingOffer) return;
        try {
            videoMakingOffer = true;
            await state.videoPC.setLocalDescription();
            socket.emit('video-offer', state.videoPC.localDescription, state.roomId);
        } catch (err) {
            console.error('Video negotiation error:', err);
        } finally {
            videoMakingOffer = false;
        }
    };
}

export function closeVideoConnection() {
    state.videoPC?.close();
    state.videoPC = null;
    videoMakingOffer = false;
    videoPending = [];
    videoIgnoreOffer = false;
    videoSender = null;
    state.screenAudioSender = null;
    state.remoteVideoStream = null;
    document.getElementById('user-2').srcObject = null;
}

async function createVideoOffer() {
    if (videoMakingOffer) return;
    ensureVideoConnection();
    try {
        videoMakingOffer = true;
        await state.videoPC.setLocalDescription();
        socket.emit('video-offer', state.videoPC.localDescription, state.roomId);
    } catch (err) {
        console.error('createVideoOffer error:', err);
    } finally {
        videoMakingOffer = false;
    }
}

async function createVideoAnswer(offer) {
    ensureVideoConnection();
    await state.videoPC.setRemoteDescription(offer);
    for (const c of videoPending) {
        try { await state.videoPC.addIceCandidate(c); } catch (e) { console.warn('video ICE (buffered):', e); }
    }
    videoPending = [];
    const answer = await state.videoPC.createAnswer();
    await state.videoPC.setLocalDescription(answer);
    socket.emit('video-answer', answer, state.roomId);
}

// ── Track helpers — video PC only ─────────────────────────────────────────────

export function addVideoTrack(track, stream) {
    if (!state.videoPC) return;
    if (videoSender) {
        videoSender.replaceTrack(track);
    } else {
        videoSender = state.videoPC.addTrack(track, stream);
    }
}

export function addTrackGetSender(track, stream) {
    if (!state.videoPC) return null;
    if (state.screenAudioSender) {
        state.screenAudioSender.replaceTrack(track);
        return state.screenAudioSender;
    }
    return state.videoPC.addTrack(track, stream);
}

export function removeVideoTracks() {
    if (!videoSender) return;
    videoSender.replaceTrack(null);
}

export function removeScreenAudioTrack() {
    if (!state.screenAudioSender) return;
    try { state.screenAudioSender.replaceTrack(null); } catch (e) { console.warn('removeScreenAudioTrack:', e); }
}

// ── Signaling listeners ───────────────────────────────────────────────────────

export function setupSignalingListeners() {
    socket.on('user-connected', (userId, username) => {
        console.log('User connected:', userId, username);
        setConnectionStatus(null);
        const { audio, video, screen } = state.media;

        // Close and recreate any existing peer connections so we start from a
        // clean "stable" state.  If we leave a stale voicePC/videoPC in
        // "have-local-offer" (from an earlier offer sent to an empty room),
        // an implicit rollback on the next setLocalDescription() re-fires
        // onnegotiationneeded, producing a double-offer that breaks the
        // SDP exchange and leaves the first participant unheard.
        if (audio) {
            closeVoiceConnection();
            ensureVoiceConnection();
            if (state.processedAudioStream) {
                state.processedAudioStream.getTracks().forEach(track => {
                    state.voicePC.addTrack(track, state.processedAudioStream);
                });
            }
            // onnegotiationneeded will fire from addTrack and send the offer
        }

        if (video || screen) {
            const localStream = state.localStream;
            closeVideoConnection();
            ensureVideoConnection();
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) addVideoTrack(videoTrack, localStream);
                if (state.isSharingSystemAudio) {
                    const audioTrack = localStream.getAudioTracks()[0];
                    if (audioTrack) state.screenAudioSender = addTrackGetSender(audioTrack, localStream);
                }
            }
            // onnegotiationneeded will fire from addTrack and send the offer
        }
    });

    // Voice signaling — Perfect Negotiation glare handling
    socket.on('voice-offer', async (offer) => {
        ensureVoiceConnection();
        const offerCollision = voiceMakingOffer || state.voicePC.signalingState !== 'stable';
        voiceIgnoreOffer = !isPolite() && offerCollision;
        if (voiceIgnoreOffer) return;
        await createVoiceAnswer(offer);
    });

    socket.on('voice-answer', async (answer) => {
        if (!state.voicePC) return;
        try {
            await state.voicePC.setRemoteDescription(answer);
        } catch (e) {
            console.warn('voice-answer setRemoteDescription:', e);
            return;
        }
        for (const c of voicePending) {
            try { await state.voicePC.addIceCandidate(c); } catch (e) { console.warn('voice ICE (answer drain):', e); }
        }
        voicePending = [];
    });

    socket.on('voice-ice', async (candidate) => {
        if (!state.voicePC || voiceIgnoreOffer) return;
        if (state.voicePC.remoteDescription) {
            try { await state.voicePC.addIceCandidate(candidate); } catch (e) { console.warn('voice ICE:', e); }
        } else {
            voicePending.push(candidate);
        }
    });

    // Video signaling — Perfect Negotiation glare handling
    socket.on('video-offer', async (offer) => {
        ensureVideoConnection();
        const offerCollision = videoMakingOffer || state.videoPC.signalingState !== 'stable';
        videoIgnoreOffer = !isPolite() && offerCollision;
        if (videoIgnoreOffer) return;
        await createVideoAnswer(offer);
    });

    socket.on('video-answer', async (answer) => {
        if (!state.videoPC) return;
        try {
            await state.videoPC.setRemoteDescription(answer);
        } catch (e) {
            console.warn('video-answer setRemoteDescription:', e);
            return;
        }
        for (const c of videoPending) {
            try { await state.videoPC.addIceCandidate(c); } catch (e) { console.warn('video ICE (answer drain):', e); }
        }
        videoPending = [];
    });

    socket.on('video-ice', async (candidate) => {
        if (!state.videoPC || videoIgnoreOffer) return;
        if (state.videoPC.remoteDescription) {
            try { await state.videoPC.addIceCandidate(candidate); } catch (e) { console.warn('video ICE:', e); }
        } else {
            videoPending.push(candidate);
        }
    });

    // Stream reset events
    socket.on('user-stopped-voice', () => {
        state.remoteAudioStream = new MediaStream();
        document.getElementById('user-2-audio').srcObject = state.remoteAudioStream;
    });

    socket.on('user-stopped-video', () => {
        state.remoteVideoStream = new MediaStream();
        document.getElementById('user-2').srcObject = state.remoteVideoStream;
    });

    socket.on('room-full', () => {
        alert('This room is full (max 2 people).');
        window.location.href = '/';
    });

    socket.on('room-participants', (participants) => {
        const hadRemotePeer = [...state.participants.keys()].some(sid => sid !== socket.id);

        state.participants.clear();
        for (const [sid, data] of Object.entries(participants)) {
            state.participants.set(sid, data);
        }
        renderParticipants();
        refreshInviteButtonStates();

        const hasRemotePeer = [...state.participants.keys()].some(sid => sid !== socket.id);
        if (hadRemotePeer && !hasRemotePeer) {
            console.log('Remote peer left — closing connections');
            closeVoiceConnection();
            closeVideoConnection();
        }
        if (!hasRemotePeer) setConnectionStatus('Waiting for other participant…');
    });

    socket.on('participant-updated', (socketId, data) => {
        const prev = state.participants.get(socketId);
        const hadVideo = prev?.media?.video || prev?.media?.screen;
        const hasVideo = data.media?.video || data.media?.screen;

        state.participants.set(socketId, data);
        renderParticipants();

        if (socketId !== socket.id && hadVideo && !hasVideo) {
            if (state.remoteVideoStream) {
                state.remoteVideoStream.getVideoTracks().forEach(t => state.remoteVideoStream.removeTrack(t));
            }
        }
    });

    socket.emit('join-room', state.roomId, socket.id);
    setConnectionStatus('Waiting for other participant…');
}
