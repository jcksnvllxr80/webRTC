import { state, socket } from './state.js';
import { createOffer, addVideoTrack, removeVideoTracks, closePeerConnection } from './webrtc.js';
import { updateControlsForMediaState } from './room.js';

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

// Join audio channel — mic only, establishes WebRTC peer connection
export async function initAudio() {
    try {
        state.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        state.mediaState = 'audio';
        socket.emit('join-audio', state.roomId);
        updateControlsForMediaState();

        await createOffer();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert(formatMediaError('Could not access microphone', error));
    }
}

// Start camera — adds video track to existing audio connection
export async function initCamera() {
    try {
        // Stop any existing video
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
        }

        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: false
        });

        document.getElementById('user-1').srcObject = state.localStream;

        // Add video track to peer connection
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            addVideoTrack(videoTrack, state.localStream);
        }

        state.mediaState = 'video';
        socket.emit('start-video', state.roomId);
        updateControlsForMediaState();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert(formatMediaError('Could not access camera', error));
    }
}

// Share screen — adds screen track to existing audio connection
export async function shareScreen() {
    try {
        // Stop any existing video
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
        }

        if (isElectronDesktop()) {
            const source = await window.electronAPI.pickDisplaySource();
            if (!source) return;

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

        // Add video track to peer connection
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            addVideoTrack(videoTrack, state.localStream);

            videoTrack.addEventListener('ended', () => {
                stopVideo();
            });
        }

        state.mediaState = 'screen';
        socket.emit('start-screen', state.roomId);
        updateControlsForMediaState();
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert(formatMediaError('Could not share screen', error));
    }
}

// Stop video/screen only — keeps audio running
export function stopVideo() {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        document.getElementById('user-1').srcObject = null;
        state.localStream = null;
        removeVideoTracks();

        socket.emit('user-stopped-stream', state.roomId, socket.id);
    }

    state.mediaState = 'audio';
    socket.emit('stop-media', state.roomId);
    updateControlsForMediaState();
}

// Leave audio channel — closes everything, reverts to chat-only
export function leaveAudio() {
    // Stop video
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        document.getElementById('user-1').srcObject = null;
        state.localStream = null;
    }

    // Stop audio
    if (state.audioStream) {
        state.audioStream.getTracks().forEach(track => track.stop());
        state.audioStream = null;
    }

    closePeerConnection();

    socket.emit('user-stopped-stream', state.roomId, socket.id);

    state.mediaState = 'chat';
    socket.emit('leave-audio', state.roomId);
    updateControlsForMediaState();
}

// Legacy stop — used by external callers
export function stopCamera() {
    if (state.mediaState === 'chat') return;
    leaveAudio();
}
