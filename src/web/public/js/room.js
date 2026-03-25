import { state } from './state.js';

export function isInRoom() {
    return !!state.roomId;
}

export function renderParticipants() {
    const ul = document.getElementById('participants');
    if (!ul) return;

    ul.innerHTML = '';
    for (const [, data] of state.participants) {
        const li = document.createElement('li');

        const dot = document.createElement('span');
        dot.className = `media-state-dot state-${data.mediaState}`;

        const name = document.createElement('span');
        name.textContent = data.username;

        li.appendChild(dot);
        li.appendChild(name);
        ul.appendChild(li);
    }
}

export function updateControlsForMediaState() {
    const joinAudio = document.getElementById('join-audio-btn');
    const leaveAudio = document.getElementById('leave-audio-btn');
    const startCamera = document.getElementById('start-camera');
    const shareScreen = document.getElementById('share-screen');
    const stopVideo = document.getElementById('stop-video-btn');
    const stopCamera = document.getElementById('stop-camera');
    const resSelect = document.getElementById('resolution-select');

    // Hide all first
    joinAudio.style.display = 'none';
    leaveAudio.style.display = 'none';
    startCamera.style.display = 'none';
    shareScreen.style.display = 'none';
    stopVideo.style.display = 'none';
    stopCamera.style.display = 'none';
    resSelect.style.display = 'none';

    switch (state.mediaState) {
        case 'chat':
            joinAudio.style.display = '';
            break;
        case 'audio':
            leaveAudio.style.display = '';
            startCamera.style.display = '';
            shareScreen.style.display = '';
            resSelect.style.display = '';
            break;
        case 'video':
        case 'screen':
            leaveAudio.style.display = '';
            stopVideo.style.display = '';
            resSelect.style.display = '';
            break;
    }
}

export function setupRoomUI() {
    const lobby = document.getElementById('lobby');
    const callUI = document.getElementById('call-ui');

    if (isInRoom()) {
        // In a room — show call UI, hide lobby
        lobby.style.display = 'none';
        callUI.style.display = 'block';
        document.getElementById('room-id-display').textContent = state.roomId;
        document.getElementById('room-link').value = window.location.href;
        updateControlsForMediaState();
    } else {
        // No room — show lobby, hide call UI
        lobby.style.display = 'block';
        callUI.style.display = 'none';
    }

    // Create room button
    const createBtn = document.getElementById('create-room-btn');
    createBtn.addEventListener('click', async () => {
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        try {
            const res = await fetch('/api/rooms', { method: 'POST' });
            const { roomId } = await res.json();
            window.location.href = `/room/${roomId}`;
        } catch (err) {
            console.error('Create room error:', err);
            createBtn.textContent = 'Create Room';
            createBtn.disabled = false;
        }
    });

    // Join room form
    document.getElementById('join-room-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('join-room-input').value.trim();
        if (!input) return;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Joining...';

        // Support both bare room IDs and full URLs
        const urlMatch = input.match(/\/room\/([a-zA-Z0-9]+)/);
        const roomId = urlMatch ? urlMatch[1] : input;
        window.location.href = `/room/${roomId}`;
    });

    // Copy room link
    const copyBtn = document.getElementById('copy-room-link');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const linkInput = document.getElementById('room-link');
            navigator.clipboard.writeText(linkInput.value).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
            });
        });
    }

    // Leave room
    const leaveBtn = document.getElementById('leave-room-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            leaveBtn.disabled = true;
            leaveBtn.textContent = 'Leaving...';
            window.location.href = '/';
        });
    }
}
