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
        // Stop any existing video/screen and clear state.localStream BEFORE
        // ensurePeerConnection() so it doesn't pre-add tracks that addVideoTrack()
        // will try to add again (InvalidAccessError: sender already exists).
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.screen = false;
        }
        state.localStream = null;

        ensurePeerConnection();

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: getVideoConstraints(),
            audio: false
        });

        state.localStream = newStream;
        document.getElementById('user-1').srcObject = state.localStream;

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
        // Same ordering fix as initCamera: clear state.localStream before
        // ensurePeerConnection() to prevent the double-addTrack error.
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.video = false;
        }
        state.localStream = null;

        ensurePeerConnection();

        let newStream;
        if (isElectronDesktop()) {
            const source = await window.electronAPI.pickDisplaySource();
            if (!source) return;

            newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: getElectronDesktopConstraints(source.id)
            });
        } else {
            newStream = await navigator.mediaDevices.getDisplayMedia({
                video: getVideoConstraints(),
                audio: true
            });
        }

        state.localStream = newStream;
        document.getElementById('user-1').srcObject = state.localStream;

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

// Re-apply audio settings to a live mic stream.
// Must acquire the new stream BEFORE stopping the old track to avoid a
// silent gap that causes a static burst on the remote end.
export async function reapplyAudioSettings() {
    if (!state.audioStream) return;

    const oldTrack = state.audioStream.getAudioTracks()[0];
    if (!oldTrack) return;

    // Get a new stream with the updated constraints
    let newStream;
    try {
        newStream = await navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraints(),
            video: false
        });
    } catch (err) {
        console.error('reapplyAudioSettings: getUserMedia failed', err);
        return;
    }

    const newTrack = newStream.getAudioTracks()[0];

    // ISSUE-005: if leaveAudio() ran while getUserMedia was in flight, state.audioStream
    // was nulled out. Stop the new stream to prevent a ghost microphone and bail.
    if (state.audioStream !== null && state.audioStream.getAudioTracks()[0] !== oldTrack) {
        newStream.getTracks().forEach(t => t.stop());
        return;
    }
    if (!state.audioStream) {
        newStream.getTracks().forEach(t => t.stop());
        return;
    }

    // Swap the track in the peer connection sender (if connected)
    if (state.peerConnection) {
        const sender = state.peerConnection.getSenders().find(s => s.track === oldTrack);
        if (sender) {
            await sender.replaceTrack(newTrack);
        }
    }

    // Update the audioStream reference
    state.audioStream = newStream;

    // Now it's safe to stop the old track
    oldTrack.stop();
}

// Legacy — stop everything
export function stopCamera() {
    stopVideo();
    leaveAudio();
}
