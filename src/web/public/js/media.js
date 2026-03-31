import { state, socket } from './state.js';
import { ensureVoiceConnection, closeVoiceConnection, ensureVideoConnection, closeVideoConnection, addVideoTrack, addTrackGetSender, removeVideoTracks, removeScreenAudioTrack } from './webrtc.js';
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
    const deviceId = document.getElementById('camera-select')?.value;
    const base = val === 'native'
        ? {}
        : { width: { ideal: Number(val.split('x')[0]) }, height: { ideal: Number(val.split('x')[1]) } };
    if (deviceId) base.deviceId = { exact: deviceId };
    return Object.keys(base).length ? base : true;
}

function getAudioDeviceId() {
    return document.getElementById('mic-select')?.value || undefined;
}

// ── Web Audio pipeline (mic volume + VU meter) ────────────────────────────────
let audioCtx = null;
let gainNode = null;
let analyserNode = null;
let micSourceNode = null;
let audioDestination = null; // MediaStreamAudioDestinationNode — processed stream sent to peer

function setupAudioPipeline(rawStream) {
    audioCtx = new AudioContext();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = state.audioSettings.micVolume ?? 1.0;
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    audioDestination = audioCtx.createMediaStreamDestination();

    micSourceNode = audioCtx.createMediaStreamSource(rawStream);
    micSourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(audioDestination);

    return audioDestination.stream;
}

function teardownAudioPipeline() {
    if (micSourceNode) { micSourceNode.disconnect(); micSourceNode = null; }
    if (gainNode) { gainNode.disconnect(); gainNode = null; }
    if (analyserNode) { analyserNode.disconnect(); analyserNode = null; }
    if (audioDestination) { audioDestination.disconnect(); audioDestination = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
}

export function setMicVolume(value) {
    if (gainNode) gainNode.gain.value = value;
}

export function getMicAnalyser() {
    return analyserNode;
}

function broadcastMediaState() {
    socket.emit('media-state-change', state.roomId, state.media);
    updateControlsForMediaState();
}

function hasAnyMedia() {
    return state.media.audio || state.media.video || state.media.screen;
}

function getAudioConstraints() {
    const c = {
        noiseSuppression: state.audioSettings.noiseSuppression,
        echoCancellation: state.audioSettings.echoCancellation,
        autoGainControl: state.audioSettings.autoGainControl
    };
    const deviceId = getAudioDeviceId();
    if (deviceId) c.deviceId = { exact: deviceId };
    return c;
}

// Join audio — mic only, on dedicated voice peer connection
export async function initAudio() {
    let rawStream;
    try {
        rawStream = await navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraints(),
            video: false
        });
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert(formatMediaError('Could not access microphone', error));
        return;
    }

    state.audioStream = rawStream;
    ensureVoiceConnection();
    const processedStream = setupAudioPipeline(state.audioStream);
    processedStream.getTracks().forEach(track => {
        state.voicePC.addTrack(track, processedStream);
    });

    state.media.audio = true;
    broadcastMediaState();
}

// Leave audio — close the dedicated voice peer connection entirely
export function leaveAudio() {
    if (state.audioStream) {
        state.audioStream.getTracks().forEach(track => track.stop());
        state.audioStream = null;
    }
    teardownAudioPipeline();
    closeVoiceConnection();

    state.media.audio = false;
    broadcastMediaState();
    socket.emit('user-stopped-voice', state.roomId);
}

// Start camera — video only, on dedicated video peer connection
export async function initCamera() {
    try {
        state.isSharingSystemAudio = false;

        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.screen = false;
        }
        state.localStream = null;

        ensureVideoConnection();

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
        buildCameraProps(videoTrack);
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert(formatMediaError('Could not access camera', error));
    }
}

// Share screen — on dedicated video peer connection
export async function shareScreen() {
    try {
        state.isSharingSystemAudio = false;

        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            removeVideoTracks();
            state.media.video = false;
        }
        state.localStream = null;

        ensureVideoConnection();

        let newStream;
        if (isElectronDesktop()) {
            const source = await window.electronAPI.pickDisplaySource();
            if (!source) return;

            // Try capturing system audio alongside video; fall back to video-only
            // if the platform doesn't support it (e.g. macOS without permissions).
            try {
                newStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: source.id
                        },
                        optional: [{ echoCancellation: true }]
                    },
                    video: getElectronDesktopConstraints(source.id)
                });
            } catch (_audioErr) {
                newStream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: getElectronDesktopConstraints(source.id)
                });
            }
        } else {
            const val = document.getElementById('resolution-select').value;
            const videoConstraints = val === 'native'
                ? true
                : { width: { ideal: Number(val.split('x')[0]) }, height: { ideal: Number(val.split('x')[1]) } };
            newStream = await navigator.mediaDevices.getDisplayMedia({
                video: videoConstraints,
                audio: { suppressLocalAudioPlayback: true, echoCancellation: true }
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

        // Transmit screen audio if the capture included an audio track.
        const screenAudioTrack = state.localStream.getAudioTracks()[0];
        if (screenAudioTrack) {
            state.screenAudioSender = addTrackGetSender(screenAudioTrack, state.localStream);
            state.isSharingSystemAudio = true;
        }

        state.media.screen = true;
        broadcastMediaState();
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert(formatMediaError('Could not share screen', error));
    }
}

// Stop video/screen — closes video PC entirely; voice PC is never touched
export function stopVideo() {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        document.getElementById('user-1').srcObject = null;
        state.localStream = null;
    }

    closeVideoConnection();
    state.isSharingSystemAudio = false;

    state.media.video = false;
    state.media.screen = false;

    broadcastMediaState();
    socket.emit('user-stopped-video', state.roomId);
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

    // Swap the source node in the audio pipeline so the processed track (in the
    // peer connection sender) continues without interruption.
    if (audioCtx && gainNode && micSourceNode) {
        micSourceNode.disconnect();
        micSourceNode = audioCtx.createMediaStreamSource(newStream);
        micSourceNode.connect(gainNode);
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

// ── Camera device properties (brightness, contrast, zoom, etc.) ──
const CAMERA_PROP_LABELS = {
    brightness:  'Brightness',
    contrast:    'Contrast',
    saturation:  'Saturation',
    sharpness:   'Sharpness',
    zoom:        'Zoom',
    exposureTime:'Exposure Time',
    whiteBalanceMode: null, // skip — non-numeric
    focusMode:   null,      // skip — non-numeric
};

function buildCameraProps(track) {
    const container = document.getElementById('camera-props');
    const slidersEl = document.getElementById('camera-props-sliders');
    if (!container || !slidersEl) return;

    slidersEl.innerHTML = '';

    const caps = track.getCapabilities?.();
    if (!caps) { container.style.display = 'none'; return; }

    let count = 0;
    for (const [prop, label] of Object.entries(CAMERA_PROP_LABELS)) {
        if (!label || !(prop in caps)) continue;
        const range = caps[prop];
        if (typeof range.min !== 'number' || typeof range.max !== 'number' || range.min === range.max) continue;

        const current = track.getSettings?.()?.[prop] ?? range.min;
        count++;

        const row = document.createElement('div');
        row.className = 'camera-prop-row';

        const labelRow = document.createElement('div');
        labelRow.className = 'camera-prop-label';
        const nameEl = document.createElement('span');
        nameEl.textContent = label;
        const valEl = document.createElement('span');
        valEl.textContent = Number(current).toFixed(range.step < 1 ? 2 : 0);
        labelRow.appendChild(nameEl);
        labelRow.appendChild(valEl);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'camera-prop-slider';
        slider.min = range.min;
        slider.max = range.max;
        slider.step = range.step ?? 1;
        slider.value = current;

        slider.addEventListener('input', () => {
            const v = Number(slider.value);
            valEl.textContent = v.toFixed(range.step < 1 ? 2 : 0);
            track.applyConstraints({ advanced: [{ [prop]: v }] }).catch(() => {});
        });

        row.appendChild(labelRow);
        row.appendChild(slider);
        slidersEl.appendChild(row);
    }

    container.style.display = count > 0 ? 'block' : 'none';
}

// Enumerate cameras and mics; populate the dropdowns in the settings panel
export async function populateDeviceSelects() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameraSelect = document.getElementById('camera-select');
        const micSelect = document.getElementById('mic-select');
        if (!cameraSelect || !micSelect) return;

        const cameras = devices.filter(d => d.kind === 'videoinput');
        const mics    = devices.filter(d => d.kind === 'audioinput');

        cameraSelect.innerHTML = cameras.length === 0 ? '<option value="">No cameras found</option>' : '';
        for (const cam of cameras) {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || `Camera ${cameraSelect.options.length + 1}`;
            cameraSelect.appendChild(opt);
        }

        // Detect the OS-default mic by probing getUserMedia and reading back the chosen deviceId
        let defaultMicId = null;
        try {
            const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            defaultMicId = probe.getAudioTracks()[0]?.getSettings()?.deviceId || null;
            probe.getTracks().forEach(t => t.stop());
        } catch { /* permissions not yet granted — fall back to first in list */ }

        micSelect.innerHTML = mics.length === 0 ? '<option value="">No mics found</option>' : '';
        for (const mic of mics) {
            const opt = document.createElement('option');
            opt.value = mic.deviceId;
            opt.textContent = mic.label || `Microphone ${micSelect.options.length + 1}`;
            if (defaultMicId && mic.deviceId === defaultMicId) opt.selected = true;
            micSelect.appendChild(opt);
        }
    } catch { /* permissions not yet granted — dropdowns stay empty until first use */ }
}

// After permissions granted, re-populate (labels become available)
export function refreshDeviceLabels() {
    populateDeviceSelects().catch(() => {});
}
