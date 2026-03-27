import { state, servers, socket } from './state.js';
import { renderParticipants } from './room.js';

let makingOffer = false;
let pendingCandidates = [];

export function ensurePeerConnection() {
    if (state.peerConnection) return;

    state.peerConnection = new RTCPeerConnection(servers);

    state.remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = state.remoteStream;

    // Add existing audio tracks
    if (state.audioStream) {
        state.audioStream.getTracks().forEach((track) => {
            state.peerConnection.addTrack(track, state.audioStream);
        });
    }

    // Add existing video/screen tracks
    if (state.localStream) {
        state.localStream.getTracks().forEach((track) => {
            state.peerConnection.addTrack(track, state.localStream);
        });
    }

    state.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            if (track.kind === 'video') {
                // Only one video source at a time — remove any stale video tracks.
                state.remoteStream.getTracks()
                    .filter(t => t.kind === 'video' && t.id !== track.id)
                    .forEach(t => state.remoteStream.removeTrack(t));
            } else {
                // For audio, keep all live tracks; only purge ended ones to avoid
                // accumulation (mic + screen audio can coexist).
                state.remoteStream.getTracks()
                    .filter(t => t.kind === 'audio' && t.readyState === 'ended' && t.id !== track.id)
                    .forEach(t => state.remoteStream.removeTrack(t));
            }
            if (!state.remoteStream.getTrackById(track.id)) {
                state.remoteStream.addTrack(track);
            }
        });
        // srcObject may have been nulled by user-stopped-stream; always reassign.
        document.getElementById('user-2').srcObject = state.remoteStream;
    };

    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, state.roomId);
        }
    };

    // Monitor ICE connection health and trigger restart on failure/prolonged disconnect
    state.peerConnection.oniceconnectionstatechange = () => {
        const s = state.peerConnection?.iceConnectionState;
        if (s === 'failed') {
            console.warn('ICE failed — restarting');
            state.peerConnection?.restartIce();
        } else if (s === 'disconnected') {
            setTimeout(() => {
                if (state.peerConnection?.iceConnectionState === 'disconnected') {
                    console.warn('ICE still disconnected after 3s — restarting');
                    state.peerConnection?.restartIce();
                }
            }, 3000);
        }
    };

    state.peerConnection.onnegotiationneeded = async () => {
        if (makingOffer) return;
        try {
            makingOffer = true;
            await state.peerConnection.setLocalDescription();
            socket.emit('offer', state.peerConnection.localDescription, state.roomId);
        } catch (err) {
            console.error('Negotiation error:', err);
        } finally {
            makingOffer = false;
        }
    };
}

// ISSUE-002: guard createOffer with makingOffer to prevent race with onnegotiationneeded
export async function createOffer() {
    if (makingOffer) return;
    ensurePeerConnection();

    try {
        makingOffer = true;
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, state.roomId);
    } catch (err) {
        console.error('createOffer error:', err);
    } finally {
        makingOffer = false;
    }
}

export async function createAnswer(offer) {
    ensurePeerConnection();

    await state.peerConnection.setRemoteDescription(offer);

    // Add any ICE candidates that arrived before the remote description was set
    for (const candidate of pendingCandidates) {
        try {
            await state.peerConnection.addIceCandidate(candidate); // ISSUE-004
        } catch (err) {
            console.warn('addIceCandidate (buffered) failed:', err);
        }
    }
    pendingCandidates = [];

    const answer = await state.peerConnection.createAnswer();
    await state.peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer, state.roomId);
}

export function addVideoTrack(track, stream) {
    if (!state.peerConnection) return;
    state.peerConnection.addTrack(track, stream);
}

export function addTrackGetSender(track, stream) {
    if (!state.peerConnection) return null;
    return state.peerConnection.addTrack(track, stream);
}

export function removeScreenAudioTrack() {
    if (!state.peerConnection || !state.screenAudioSender) return;
    try {
        state.peerConnection.removeTrack(state.screenAudioSender);
    } catch (e) {
        console.warn('removeScreenAudioTrack:', e);
    }
    state.screenAudioSender = null;
}

export function removeVideoTracks() {
    if (!state.peerConnection) return;
    const senders = state.peerConnection.getSenders();
    for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
            state.peerConnection.removeTrack(sender);
        }
    }
}

export function closePeerConnection() {
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }
    pendingCandidates = [];
    makingOffer = false;
    state.screenAudioSender = null;
    state.remoteStream = null;
    document.getElementById('user-2').srcObject = null;
}

export function setupSignalingListeners() {
    socket.on('user-connected', (userId, username) => {
        console.log('User connected:', userId, username);
        // Only auto-offer if we have any active media
        const { audio, video, screen } = state.media;
        if (audio || video || screen) {
            createOffer();
        }
    });

    socket.on('offer', async (offer) => {
        await createAnswer(offer);
    });

    socket.on('answer', async (answer) => {
        if (!state.peerConnection) return;
        const sigState = state.peerConnection.signalingState;
        if (sigState === 'have-local-offer') {
            await state.peerConnection.setRemoteDescription(answer);
            // Drain any ICE candidates buffered before remote description arrived
            for (const candidate of pendingCandidates) {
                try {
                    await state.peerConnection.addIceCandidate(candidate); // ISSUE-004
                } catch (err) {
                    console.warn('addIceCandidate (buffered answer) failed:', err);
                }
            }
            pendingCandidates = [];
        }
    });

    socket.on('ice-candidate', async (candidate) => {
        if (state.peerConnection) {
            if (state.peerConnection.remoteDescription) {
                try {
                    await state.peerConnection.addIceCandidate(candidate); // ISSUE-004
                } catch (err) {
                    console.warn('addIceCandidate failed:', err);
                }
            } else {
                pendingCandidates.push(candidate);
            }
        }
    });

    // When the remote side stops all media, reset the remote stream to a clean empty
    // MediaStream so incoming tracks from the next start-up land in a fresh container.
    socket.on('user-stopped-stream', () => {
        state.remoteStream = new MediaStream();
        document.getElementById('user-2').srcObject = state.remoteStream;
    });

    socket.on('room-full', () => {
        alert('This room is full (max 2 people).');
        window.location.href = '/';
    });

    // Participant tracking
    socket.on('room-participants', (participants) => {
        const hadRemotePeer = state.participants.size > 1 ||
            [...state.participants.keys()].some(sid => sid !== socket.id);

        state.participants.clear();
        for (const [sid, data] of Object.entries(participants)) {
            state.participants.set(sid, data);
        }
        renderParticipants();

        // ISSUE-001: if we had a remote peer and they're now gone, tear down the
        // peer connection so the next user-connected can start a clean negotiation.
        const hasRemotePeer = [...state.participants.keys()].some(sid => sid !== socket.id);
        if (hadRemotePeer && !hasRemotePeer && state.peerConnection) {
            console.log('Remote peer left — closing peer connection');
            closePeerConnection();
        }
    });

    socket.on('participant-updated', (socketId, data) => {
        const prev = state.participants.get(socketId);
        const hadVideo = prev?.media?.video || prev?.media?.screen;
        const hasVideo = data.media?.video || data.media?.screen;

        state.participants.set(socketId, data);
        renderParticipants();

        // When a remote peer stops all video/screen, clear the video element
        // immediately rather than waiting for WebRTC track events (which are unreliable).
        if (socketId !== socket.id && hadVideo && !hasVideo) {
            document.getElementById('user-2').srcObject = null;
        }
    });

    socket.emit('join-room', state.roomId, socket.id);
}
