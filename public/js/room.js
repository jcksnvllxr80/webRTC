import { state } from './state.js';

export function isInRoom() {
    return !!state.roomId;
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
    } else {
        // No room — show lobby, hide call UI
        lobby.style.display = 'block';
        callUI.style.display = 'none';
    }

    // Create room button
    document.getElementById('create-room-btn').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/rooms', { method: 'POST' });
            const { roomId } = await res.json();
            window.location.href = `/room/${roomId}`;
        } catch (err) {
            console.error('Create room error:', err);
        }
    });

    // Join room form
    document.getElementById('join-room-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('join-room-input').value.trim();
        if (!input) return;

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
            window.location.href = '/';
        });
    }
}
