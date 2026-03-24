import { state, socket } from './state.js';
import { isInRoom } from './room.js';

let remoteUsername = null;

export function getRemoteUsername() {
    return remoteUsername;
}

export function setupFriendsListeners() {
    const addFriendBtn = document.getElementById('add-friend-btn');

    if (isInRoom()) {
        socket.on('user-connected', (userId, username) => {
            if (username) {
                remoteUsername = username;
                updateAddFriendButton();
            }
        });

        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', async () => {
                if (!remoteUsername) return;
                try {
                    const res = await fetch('/api/friends', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ friendUsername: remoteUsername })
                    });
                    if (res.ok) {
                        addFriendBtn.textContent = 'Added!';
                        addFriendBtn.disabled = true;
                        loadFriendsList();
                    } else {
                        const data = await res.json();
                        alert(data.error || 'Could not add friend');
                    }
                } catch (err) {
                    console.error('Add friend error:', err);
                }
            });
        }
    }

    loadFriendsList();
}

async function updateAddFriendButton() {
    const btn = document.getElementById('add-friend-btn');
    const label = document.getElementById('remote-username');
    if (!btn || !label) return;

    if (!remoteUsername) {
        btn.style.display = 'none';
        label.textContent = '';
        return;
    }

    label.textContent = remoteUsername;

    try {
        const res = await fetch(`/api/friends/check/${encodeURIComponent(remoteUsername)}`);
        const { isFriend } = await res.json();
        if (isFriend) {
            btn.textContent = 'Already Friends';
            btn.disabled = true;
        } else {
            btn.textContent = 'Add Friend';
            btn.disabled = false;
        }
        btn.style.display = 'inline-block';
    } catch (err) {
        console.error('Check friend error:', err);
    }
}

function getFriendsListElements() {
    // Return whichever friends list elements exist in the current view
    const lists = [];
    const lobby = document.getElementById('friends-list');
    const call = document.getElementById('call-friends-list');
    if (lobby) lists.push(lobby);
    if (call) lists.push(call);
    return lists;
}

async function loadFriendsList() {
    const lists = getFriendsListElements();
    if (lists.length === 0) return;

    try {
        const res = await fetch('/api/friends');
        const friends = await res.json();

        lists.forEach(list => {
            list.innerHTML = '';
            if (friends.length === 0) {
                const li = document.createElement('li');
                li.className = 'no-friends';
                li.textContent = 'No friends yet';
                list.appendChild(li);
                return;
            }
            friends.forEach(f => {
                const li = document.createElement('li');

                const nameSpan = document.createElement('span');
                nameSpan.textContent = f.friend_username;
                li.appendChild(nameSpan);

                const btnGroup = document.createElement('span');
                btnGroup.className = 'friend-actions';

                if (!isInRoom()) {
                    const inviteBtn = document.createElement('button');
                    inviteBtn.className = 'invite-friend-btn';
                    inviteBtn.textContent = 'Invite';
                    inviteBtn.addEventListener('click', async () => {
                        try {
                            const res = await fetch('/api/rooms', { method: 'POST' });
                            const { roomId } = await res.json();
                            const link = `${window.location.origin}/room/${roomId}`;
                            await navigator.clipboard.writeText(link);
                            inviteBtn.textContent = 'Link Copied!';
                            setTimeout(() => { inviteBtn.textContent = 'Invite'; }, 2000);
                        } catch (err) {
                            console.error('Invite error:', err);
                        }
                    });
                    btnGroup.appendChild(inviteBtn);
                }

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-friend-btn';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', async () => {
                    await fetch(`/api/friends/${encodeURIComponent(f.friend_username)}`, { method: 'DELETE' });
                    loadFriendsList();
                    if (remoteUsername === f.friend_username) {
                        updateAddFriendButton();
                    }
                });
                btnGroup.appendChild(removeBtn);

                li.appendChild(btnGroup);
                list.appendChild(li);
            });
        });
    } catch (err) {
        console.error('Load friends error:', err);
    }
}
