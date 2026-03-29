import { state, socket } from './state.js';
import { isInRoom } from './room.js';

let remoteUsername = null;
let onlineSet = new Set();
let recentInvites = []; // { fromUsername, roomId, roomLink, ts }
let unreadInviteCount = 0;

export function getRemoteUsername() {
    return remoteUsername;
}

export function setupFriendsListeners() {
    const addFriendBtn = document.getElementById('add-friend-btn');

    // Listen for online/offline events
    socket.on('user-online', (username) => {
        onlineSet.add(username);
        updateStatusDots(username, true);
        updateInviteButtons(username, true);
    });

    socket.on('user-offline', (username) => {
        onlineSet.delete(username);
        updateStatusDots(username, false);
        updateInviteButtons(username, false);
    });

    // Incoming room invite
    socket.on('room-invite', ({ fromUsername, roomId, roomLink }) => {
        const invite = { fromUsername, roomId, roomLink, ts: Date.now() };
        recentInvites.unshift(invite);
        if (recentInvites.length > 10) recentInvites.pop();
        unreadInviteCount++;
        updateInviteBadge();
        renderInviteList();
        showInviteToast(invite);
    });

    // Bell toggle
    const bellBtn = document.getElementById('invite-bell-btn');
    const invitePanel = document.getElementById('invite-panel');
    if (bellBtn) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            invitePanel.hidden = !invitePanel.hidden;
            if (!invitePanel.hidden) {
                unreadInviteCount = 0;
                updateInviteBadge();
            }
        });
        document.addEventListener('click', () => { invitePanel.hidden = true; });
    }

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
                addFriendBtn.disabled = true;
                addFriendBtn.textContent = 'Adding...';
                try {
                    const res = await fetch('/api/friends', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ friendUsername: remoteUsername })
                    });
                    if (res.ok) {
                        addFriendBtn.textContent = 'Added!';
                        loadFriendsList();
                    } else {
                        const data = await res.json();
                        addFriendBtn.textContent = 'Add Friend';
                        addFriendBtn.disabled = false;
                        alert(data.error || 'Could not add friend');
                    }
                } catch (err) {
                    console.error('Add friend error:', err);
                    addFriendBtn.textContent = 'Add Friend';
                    addFriendBtn.disabled = false;
                }
            });
        }
    }

    loadOnlineUsers().then(() => loadFriendsList());
}

async function loadOnlineUsers() {
    try {
        const res = await fetch('/api/online');
        const usernames = await res.json();
        onlineSet = new Set(usernames);
    } catch (err) {
        console.error('Load online users error:', err);
    }
}

function updateInviteButtons(username, isOnline) {
    document.querySelectorAll(`.invite-friend-btn[data-username="${CSS.escape(username)}"]`).forEach(btn => {
        btn.disabled = !isOnline;
        btn.title = isOnline ? '' : 'User is offline';
    });
}

function updateStatusDots(username, isOnline) {
    document.querySelectorAll(`.status-dot[data-username="${CSS.escape(username)}"]`).forEach(dot => {
        dot.classList.toggle('online', isOnline);
        dot.classList.toggle('offline', !isOnline);
        dot.title = isOnline ? 'Online' : 'Offline';
    });
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

    // Show loading state
    lists.forEach(list => {
        list.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'friends-loading';
        li.textContent = 'Loading...';
        list.appendChild(li);
    });

    try {
        const res = await fetch('/api/friends');
        const friends = await res.json();

        lists.forEach(list => {
            list.innerHTML = '';
            if (friends.length === 0) {
                const li = document.createElement('li');
                li.className = 'no-friends';
                li.textContent = 'No friends yet — add someone after joining a call.';
                list.appendChild(li);
                return;
            }
            friends.forEach(f => {
                const li = document.createElement('li');

                const nameWrapper = document.createElement('span');
                nameWrapper.className = 'friend-name';

                const dot = document.createElement('span');
                dot.className = 'status-dot';
                dot.dataset.username = f.friend_username;
                const isOnline = onlineSet.has(f.friend_username);
                dot.classList.add(isOnline ? 'online' : 'offline');
                dot.title = isOnline ? 'Online' : 'Offline';
                nameWrapper.appendChild(dot);

                const nameText = document.createElement('span');
                nameText.textContent = f.friend_username;
                nameWrapper.appendChild(nameText);

                li.appendChild(nameWrapper);

                const btnGroup = document.createElement('span');
                btnGroup.className = 'friend-actions';

                if (isInRoom()) {
                    const isOnline = onlineSet.has(f.friend_username);
                    const isInRoomWithYou = [...state.participants.values()].some(p => p.username === f.friend_username);
                    const inviteBtn = document.createElement('button');
                    inviteBtn.className = 'invite-friend-btn';
                    inviteBtn.textContent = 'Invite';
                    inviteBtn.dataset.username = f.friend_username;
                    if (isInRoomWithYou) {
                        inviteBtn.disabled = true;
                        inviteBtn.title = 'Already in the room with you';
                    } else if (!isOnline) {
                        inviteBtn.disabled = true;
                        inviteBtn.title = 'User is offline';
                    }
                    inviteBtn.addEventListener('click', () => {
                        if (!onlineSet.has(f.friend_username)) return;
                        inviteBtn.disabled = true;
                        socket.emit('send-room-invite', {
                            toUsername: f.friend_username,
                            roomId: state.roomId
                        });
                        inviteBtn.textContent = 'Sent!';
                        setTimeout(() => {
                            inviteBtn.textContent = 'Invite';
                            inviteBtn.disabled = false;
                        }, 2000);
                    });
                    btnGroup.appendChild(inviteBtn);
                }

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-friend-btn';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', async () => {
                    removeBtn.disabled = true;
                    removeBtn.textContent = 'Removing...';
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
        lists.forEach(list => {
            list.innerHTML = '';
            const li = document.createElement('li');
            li.className = 'no-friends';
            li.textContent = 'Failed to load friends.';
            list.appendChild(li);
        });
    }
}

function updateInviteBadge() {
    const badge = document.getElementById('invite-badge');
    if (!badge) return;
    if (unreadInviteCount > 0) {
        badge.textContent = unreadInviteCount;
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderInviteList() {
    const ul = document.getElementById('invite-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (recentInvites.length === 0) {
        const li = document.createElement('li');
        li.className = 'invite-empty';
        li.textContent = 'No recent invites';
        ul.appendChild(li);
        return;
    }
    recentInvites.forEach((invite, idx) => {
        const li = document.createElement('li');
        li.className = 'invite-item';
        const text = document.createElement('span');
        text.textContent = `${invite.fromUsername} invited you to a room`;
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Join';
        acceptBtn.addEventListener('click', () => {
            window.location.href = invite.roomLink;
        });
        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = '✕';
        dismissBtn.className = 'invite-dismiss';
        dismissBtn.addEventListener('click', () => {
            recentInvites.splice(idx, 1);
            renderInviteList();
        });
        li.appendChild(text);
        li.appendChild(acceptBtn);
        li.appendChild(dismissBtn);
        ul.appendChild(li);
    });
}

function showInviteToast(invite) {
    const container = document.getElementById('invite-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'invite-toast';
    toast.innerHTML = `
        <span><strong>${invite.fromUsername}</strong> invited you to a room</span>
        <div class="invite-toast-actions">
            <button class="invite-toast-accept">Join</button>
            <button class="invite-toast-dismiss">Dismiss</button>
        </div>
    `;
    toast.querySelector('.invite-toast-accept').addEventListener('click', () => {
        window.location.href = invite.roomLink;
    });
    toast.querySelector('.invite-toast-dismiss').addEventListener('click', () => {
        toast.remove();
    });
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 12000);
}
