import { state, socket } from './state.js';
import { ensurePeerConnection, addVideoTrack, removeVideoTracks, closePeerConnection } from './webrtc.js';
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

function broadcastMediaState() {
    socket.emit('media-state-change', state.roomId, state.media);
    updateControlsForMediaState();
}

function hasAnyMedia() {
    return state.media.audio || state.media.video || state.media.screen;
}

function getAudioConstraints() {
    return {
        noiseSuppression: state.audioSettings.noiseSuppression,
        echoCancellation: state.audioSettings.echoCancellation,
        autoGainControl: state.audioSettings.autoGainControl
    };
}

// Join audio — mic only
export async function initAudio() {
    try {
        state.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraints(),
            video: false
        });

        ensurePeerConnection();
        state.audioStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.audioStream);
        });

        state.media.audio = true;
        broadcastMediaState();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert(formatMediaError('Could not access microphone', error));
    }
}

// Leave audio — stop mic, remove audio tracks from peer connection
export function leaveAudio() {
    if (state.audioStream) {
        state.audioStream.getTracks().forEach(track => track.stop());
        // Remove audio senders from peer connection
        if (state.peerConnection) {
            const senders = state.peerConnection.getSenders();
            for (const sender of senders) {
                if (sender.track && sender.track.kind === 'audio') {
                    state.peerConnection.removeTrack(sender);
                }
            }
        }
        state.audioStream = null;
    }

    state.media.audio = false;
    broadcastMediaState();

    // If nothing else is active, tear down the peer connection
    if (!hasAnyMedia()) {
        closePeerConnection();
        socket.emit('user-stopped-stream', state.roomId, socket.id);
    }
}

// Start camera — video only, independent of audio
export async function initCamera() {
    try {
        // Stop any existing video/screen
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.screen = false;
        }

        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: false
        });

        document.getElementById('user-1').srcObject = state.localStream;

        ensurePeerConnection();
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            addVideoTrack(videoTrack, state.localStream);
        }

        state.media.video = true;
        broadcastMediaState();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert(formatMediaError('Could not access camera', error));
    }
}

// Share screen — independent of audio
export async function shareScreen() {
    try {
        // Stop any existing video/screen
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.video = false;
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

        ensurePeerConnection();
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            addVideoTrack(videoTrack, state.localStream);

            videoTrack.addEventListener('ended', () => {
                stopVideo();
            });
        }

        state.media.screen = true;
        broadcastMediaState();
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert(formatMediaError('Could not share screen', error));
    }
}

// Stop video/screen only — keeps audio if active
export function stopVideo() {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        document.getElementById('user-1').srcObject = null;
        state.localStream = null;
        removeVideoTracks();
    }

    state.media.video = false;
    state.media.screen = false;
    broadcastMediaState();

    if (!hasAnyMedia()) {
        closePeerConnection();
        socket.emit('user-stopped-stream', state.roomId, socket.id);
    }
}

// Re-apply audio settings to a live mic stream
export async function reapplyAudioSettings() {
    if (!state.audioStream) return; // no live audio, nothing to do

    try {
        // Stop old audio tracks
        state.audioStream.getTracks().forEach(track => track.stop());

        // Get new stream with updated constraints
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraints(),
            video: false
        });

        state.audioStream = newStream;
        const newTrack = newStream.getAudioTracks()[0];

        // Replace the audio track on the peer connection
        if (state.peerConnection) {
            const senders = state.peerConnection.getSenders();
            for (const sender of senders) {
                if (sender.track && sender.track.kind === 'audio') {
                    await sender.replaceTrack(newTrack);
                }
            }
        }
    } catch (error) {
        console.error('Error reapplying audio settings:', error);
        throw error; // let the caller handle UI feedback
    }
}

// Legacy — stop everything
export function stopCamera() {
    stopVideo();
    leaveAudio();
}
