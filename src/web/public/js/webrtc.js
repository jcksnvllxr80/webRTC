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
            state.remoteStream.addTrack(track);
        });
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

export async function createOffer() {
    ensurePeerConnection();

    const offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer, state.roomId);
}

export async function createAnswer(offer) {
    ensurePeerConnection();

    await state.peerConnection.setRemoteDescription(offer);

    // Add any ICE candidates that arrived before the remote description was set
    for (const candidate of pendingCandidates) {
        await state.peerConnection.addIceCandidate(candidate);
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
                await state.peerConnection.addIceCandidate(candidate);
            }
            pendingCandidates = [];
        }
    });

    socket.on('ice-candidate', async (candidate) => {
        if (state.peerConnection) {
            if (state.peerConnection.remoteDescription) {
                await state.peerConnection.addIceCandidate(candidate);
            } else {
                pendingCandidates.push(candidate);
            }
        }
    });

    socket.on('user-stopped-stream', (stoppedUserId) => {
        const remoteVideo = document.getElementById('user-2');
        if (remoteVideo.getAttribute('data-sender-id') === stoppedUserId) {
            remoteVideo.srcObject = null;
        }
    });

    socket.on('room-full', () => {
        alert('This room is full (max 2 people).');
        window.location.href = '/';
    });

    // Participant tracking
    socket.on('room-participants', (participants) => {
        state.participants.clear();
        for (const [sid, data] of Object.entries(participants)) {
            state.participants.set(sid, data);
        }
        renderParticipants();
    });

    socket.on('participant-updated', (socketId, data) => {
        state.participants.set(socketId, data);
        renderParticipants();
    });

    socket.emit('join-room', state.roomId, socket.id);
}
