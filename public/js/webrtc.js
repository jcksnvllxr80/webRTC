import { state, servers, socket } from './state.js';

export async function createPeerConnection() {
    state.peerConnection = new RTCPeerConnection(servers);

    state.remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = state.remoteStream;

    if (state.localStream) {
        state.localStream.getTracks().forEach((track) => {
            state.peerConnection.addTrack(track, state.localStream);
        });
    }

    state.peerConnection.ontrack = async (event) => {
        event.streams[0].getTracks().forEach((track) => {
            state.remoteStream.addTrack(track);
        });
    };

    state.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, state.roomId);
        }
    };
}

export async function createOffer() {
    await createPeerConnection();

    let offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer, state.roomId);
}

export async function createAnswer(offer) {
    await createPeerConnection();

    await state.peerConnection.setRemoteDescription(offer);

    let answer = await state.peerConnection.createAnswer();
    await state.peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer, state.roomId);
}

export function setupSignalingListeners() {
    socket.on('user-connected', (userId, username) => {
        console.log('User connected:', userId, username);
        createOffer();
    });

    socket.on('offer', async (offer) => {
        await createAnswer(offer);
    });

    socket.on('answer', async (answer) => {
        if (!state.peerConnection.currentRemoteDescription) {
            await state.peerConnection.setRemoteDescription(answer);
        }
    });

    socket.on('ice-candidate', async (candidate) => {
        if (state.peerConnection) {
            await state.peerConnection.addIceCandidate(candidate);
        }
    });

    socket.on('user-stopped-stream', (stoppedUserId) => {
        const remoteVideo = document.getElementById('user-2');
        if (remoteVideo.getAttribute('data-sender-id') === stoppedUserId) {
            remoteVideo.srcObject = null;
        }
    });

    socket.emit('join-room', state.roomId, socket.id);
}
