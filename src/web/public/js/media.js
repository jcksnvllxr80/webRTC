import { state, socket } from './state.js';
import { createOffer } from './webrtc.js';

function formatMediaError(prefix, error) {
    const name = error?.name || 'Error';
    const message = error?.message || 'Unknown error';
    return `${prefix}: ${name} - ${message}`;
}

function isElectronDesktop() {
    return typeof window !== 'undefined' && !!window.electronAPI?.pickDisplaySource;
}

function getElectronDesktopConstraints(sourceId) {
    const baseConstraints = {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
        }
    };

    const selection = document.getElementById('resolution-select').value;
    if (selection !== 'native') {
        const [width, height] = selection.split('x').map(Number);
        baseConstraints.mandatory.maxWidth = width;
        baseConstraints.mandatory.maxHeight = height;
    }

    return baseConstraints;
}

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
        alert(formatMediaError('Could not access camera and/or microphone', error));
    }
}

export async function shareScreen() {
    try {
        if (state.localStream) {
            stopCamera();
        }

        if (isElectronDesktop()) {
            const source = await window.electronAPI.pickDisplaySource();
            if (!source) {
                return;
            }

            state.localStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: getElectronDesktopConstraints(source.id)
            });
        } else {
            state.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: getVideoConstraints(),
                audio: true
            });
        }

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
        alert(formatMediaError('Could not share screen', error));
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
