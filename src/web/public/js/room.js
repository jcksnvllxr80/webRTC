import { state, socket } from './state.js';
import { addFriendForParticipant } from './friends.js';
import { createSizeGroup } from './video-size.js';

export function isInRoom() {
    return !!state.roomId;
}

export function renderParticipants() {
    const ul = document.getElementById('participants');
    if (!ul) return;

    ul.innerHTML = '';
    for (const [socketId, data] of state.participants) {
        const li = document.createElement('li');

        // Pick dot class based on highest active media
        const m = data.media || {};
        let dotClass = 'state-chat';
        if (m.video || m.screen) dotClass = 'state-video';
        else if (m.audio) dotClass = 'state-audio';

        const dot = document.createElement('span');
        dot.className = `media-state-dot ${dotClass}`;

        const name = document.createElement('span');
        name.className = 'participant-name';
        name.textContent = data.username;

        const controls = document.createElement('div');
        controls.className = 'participant-controls';

        li.appendChild(dot);
        li.appendChild(name);
        li.appendChild(controls);

        // Add video size controls
        const isLocal = socketId === socket.id;
        controls.appendChild(createSizeGroup(isLocal));

        if (socketId === socket.id) {
            // Local user: show a live mic input-level bar in place of the Add Friend button
            const vuWrap = document.createElement('div');
            vuWrap.className = 'participant-vu';
            const vuBar = document.createElement('div');
            vuBar.className = 'participant-vu-bar';
            vuWrap.appendChild(vuBar);
            controls.appendChild(vuWrap);
        } else {
            // Remote user: Add Friend button
            const btn = document.createElement('button');
            btn.className = 'participant-add-friend-btn';
            btn.textContent = 'Add Friend';
            btn.addEventListener('click', () => addFriendForParticipant(data.username, btn));
            controls.appendChild(btn);

            // Async check if already friends
            fetch(`/api/friends/check/${encodeURIComponent(data.username)}`)
                .then(r => r.json())
                .then(({ isFriend }) => {
                    if (isFriend) {
                        btn.textContent = 'Already Friends';
                        btn.disabled = true;
                    }
                })
                .catch(() => {});
        }

        ul.appendChild(li);
    }

    // Sync all name columns to the widest natural width
    const nameEls = ul.querySelectorAll('.participant-name');
    nameEls.forEach(el => { el.style.width = ''; }); // reset so scrollWidth is natural
    const widest = Math.max(100, ...[...nameEls].map(el => el.scrollWidth));
    nameEls.forEach(el => { el.style.width = widest + 'px'; });
}

export function updateControlsForMediaState() {
    const joinAudio = document.getElementById('join-audio-btn');
    const leaveAudio = document.getElementById('leave-audio-btn');
    const startCamera = document.getElementById('start-camera');
    const shareScreen = document.getElementById('share-screen');
    const stopVideo = document.getElementById('stop-video-btn');
    const resSelect = document.getElementById('resolution-select');

    const { audio, video, screen } = state.media;
    const hasVideo = video || screen;

    // Audio: toggle join/leave
    joinAudio.style.display = audio ? 'none' : '';
    leaveAudio.style.display = audio ? '' : 'none';

    // Video/Screen: toggle start/stop
    startCamera.style.display = hasVideo ? 'none' : '';
    shareScreen.style.display = hasVideo ? 'none' : '';
    stopVideo.style.display = hasVideo ? '' : 'none';
    resSelect.style.display = '';
}

export function setupRoomUI() {
    const lobby = document.getElementById('lobby');
    const callUI = document.getElementById('call-ui');

    if (isInRoom()) {
        // In a room — show call UI, hide lobby
        lobby.style.display = 'none';
        callUI.style.display = 'flex';
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
            const res = await fetch('/api/rooms', { method: 'POST', headers: { 'X-Requested-With': 'FreeRTC' } });
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
