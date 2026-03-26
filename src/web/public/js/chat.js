import { state, socket } from './state.js';
import { createChatEditor, sanitizeHtml } from './chat-editor.js';

let chatEditor = null;
let currentUsername = null;

fetch('/api/me').then(r => r.json()).then(d => { currentUsername = d.username; }).catch(() => {});

function genMsgId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Utilities ──
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/'))                                  return '🖼️';
    if (mimeType.startsWith('video/'))                                  return '🎬';
    if (mimeType.startsWith('audio/'))                                  return '🎵';
    if (mimeType.includes('pdf'))                                       return '📕';
    if (mimeType.includes('zip') || mimeType.includes('tar'))           return '🗜️';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word'))     return '📝';
    return '📄';
}

// ── Message rendering ──
function addMessageToChat(username, html, text, msgId) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.querySelector('.chat-empty')?.remove();

    const id = msgId || genMsgId();
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.dataset.msgId = id;

    const body = html ? sanitizeHtml(html) : `<p>${escapeHtml(text || '')}</p>`;

    msg.innerHTML =
        `<div class="msg-header">` +
            `<span class="msg-user">${escapeHtml(username)}</span>` +
            `<span class="msg-time">${nowTime()}</span>` +
        `</div>` +
        `<div class="msg-body">${body}</div>` +
        `<div class="msg-reactions"></div>`;

    // Like button wired after innerHTML so we can set dataset cleanly
    const reactionsBar = msg.querySelector('.msg-reactions');
    const likeBtn = document.createElement('button');
    likeBtn.className = 'msg-like-btn';
    likeBtn.type = 'button';
    likeBtn.dataset.msgId = id;
    likeBtn.innerHTML = '👍 <span class="msg-like-count"></span>';
    likeBtn.addEventListener('click', () => {
        socket.emit('react-message', { roomId: state.roomId, msgId: id, emoji: '👍' });
    });
    reactionsBar.appendChild(likeBtn);

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addFileToChat(username, { filename, mimeType, data, size, msgId }) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.querySelector('.chat-empty')?.remove();

    const id = msgId || genMsgId();
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.dataset.msgId = id;

    const header = document.createElement('div');
    header.className = 'msg-header';
    const userEl = document.createElement('span');
    userEl.className = 'msg-user';
    userEl.textContent = username;
    const timeEl = document.createElement('span');
    timeEl.className = 'msg-time';
    timeEl.textContent = nowTime();
    header.appendChild(userEl);
    header.appendChild(timeEl);

    // Build file card in DOM (not innerHTML) so we can safely set data: href
    const card = document.createElement('div');
    card.className = 'file-card';

    const icon = document.createElement('span');
    icon.className = 'file-card-icon';
    icon.textContent = getFileIcon(mimeType);

    const info = document.createElement('div');
    info.className = 'file-card-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'file-card-name';
    nameEl.textContent = filename;
    const sizeEl = document.createElement('div');
    sizeEl.className = 'file-card-size';
    sizeEl.textContent = formatSize(size);
    info.appendChild(nameEl);
    info.appendChild(sizeEl);

    const dl = document.createElement('a');
    dl.className = 'file-card-dl';
    dl.textContent = '↓ Get';
    dl.href = data;
    dl.download = filename;

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(dl);

    const reactionsBar = document.createElement('div');
    reactionsBar.className = 'msg-reactions';
    const likeBtn = document.createElement('button');
    likeBtn.className = 'msg-like-btn';
    likeBtn.type = 'button';
    likeBtn.dataset.msgId = id;
    likeBtn.innerHTML = '👍 <span class="msg-like-count"></span>';
    likeBtn.addEventListener('click', () => {
        socket.emit('react-message', { roomId: state.roomId, msgId: id, emoji: '👍' });
    });
    reactionsBar.appendChild(likeBtn);

    msg.appendChild(header);
    msg.appendChild(card);
    msg.appendChild(reactionsBar);
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ── File sending ──
function sendFile(file, msgId) {
    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('file-message', {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: e.target.result,
            size: file.size,
            msgId,
            roomId: state.roomId,
        });
    };
    reader.readAsDataURL(file);
}

// ── Public API ──
export function sendMessage() {
    chatEditor?.submit();
}

export function setupChatListeners() {
    const editableEl = document.getElementById('rte-editable');
    if (!editableEl) return;

    const result = createChatEditor({
        editableEl,
        onSubmit({ html, text, files }) {
            const msgId = genMsgId();
            socket.emit('chat-message', {
                message: text,
                html,
                msgId,
                roomId: state.roomId,
            });
            for (const file of files) sendFile(file, genMsgId());
            document.getElementById('message-sent')?.play().catch(() => {});
        },
    });

    chatEditor = result;

    socket.on('chat-message', (data) => {
        addMessageToChat(data.username, data.html || null, data.message, data.msgId);
        document.getElementById('message-receive')?.play().catch(() => {});
    });

    socket.on('file-message', (data) => {
        addFileToChat(data.username, data);
        document.getElementById('message-receive')?.play().catch(() => {});
    });

    socket.on('message-reaction', ({ msgId, count, likedBy }) => {
        const msg = document.querySelector(`.msg[data-msg-id="${CSS.escape(msgId)}"]`);
        if (!msg) return;
        const btn = msg.querySelector('.msg-like-btn');
        if (!btn) return;
        const countEl = btn.querySelector('.msg-like-count');
        const liked = likedBy.includes(currentUsername);
        btn.classList.toggle('liked', liked);
        if (count > 0) {
            countEl.textContent = count;
            btn.style.display = '';
        } else {
            countEl.textContent = '';
            btn.style.display = '';
        }
    });
}
