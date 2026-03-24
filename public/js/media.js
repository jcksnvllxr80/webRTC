import { state, socket } from './state.js';
import { createOffer } from './webrtc.js';

export function getVideoConstraints() {
    const val = document.getElementById('resolution-select').value;
    if (val === 'native') {
        return true;
    }
    const [w, h] = val.split('x').map(Number);
    return { width: { ideal: w }, height: { ideal: h } };
}

export async function initCamera() {
    try {
        console.log("Requesting camera access...");
        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: true
        });
        document.getElementById('user-1').srcObject = state.localStream;

        if (state.peerConnection) {
            state.peerConnection.close();
        }
        await createOffer();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access camera and/or microphone');
    }
}

export async function shareScreen() {
    try {
        if (state.localStream) {
            stopCamera();
        }

        state.localStream = await navigator.mediaDevices.getDisplayMedia({
            video: getVideoConstraints(),
            audio: true
        });

        document.getElementById('user-1').srcObject = state.localStream;

        state.localStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopCamera();
        });

        if (state.peerConnection) {
            state.peerConnection.close();
        }
        await createOffer();
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert('Could not share screen');
    }
}

export function stopCamera() {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        document.getElementById('user-1').srcObject = null;
        state.localStream = null;

        socket.emit('user-stopped-stream', state.roomId, socket.id);
    }
}
