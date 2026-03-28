import { state, socket } from './state.js';
import { createChatEditor, sanitizeHtml, highlightCodeBlocks } from './chat-editor.js';

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

// ── Reaction picker (shared global instance) ──
const QUICK_REACTIONS = ['👍','❤️','😂','🔥','😮','😢','👎','🎉'];
let rxTargetMsgId = null;

function setupReactionPicker() {
    // Quick popover
    const popover = document.createElement('div');
    popover.id = 'rx-popover';
    popover.className = 'rx-popover';
    popover.style.display = 'none';

    for (const emoji of QUICK_REACTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-quick-btn';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (rxTargetMsgId) socket.emit('react-message', { roomId: state.roomId, msgId: rxTargetMsgId, emoji });
            closeRxPicker();
        });
        popover.appendChild(btn);
    }

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'rx-more-btn';
    moreBtn.textContent = '···';
    moreBtn.title = 'More reactions';
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelClose();
        popover.style.display = 'none';
        openFullPicker();
    });
    popover.appendChild(moreBtn);

    // Full emoji picker — appended directly to body (no wrapper div) so the
    // picker's internal scroll/pointer-events are never clipped by a parent container.
    const picker = document.createElement('emoji-picker');
    picker.id = 'rx-full-picker';
    picker.className = 'rx-full-picker';
    picker.style.display = 'none';
    picker.addEventListener('emoji-click', (e) => {
        e.stopPropagation();
        if (rxTargetMsgId) socket.emit('react-message', { roomId: state.roomId, msgId: rxTargetMsgId, emoji: e.detail.unicode });
        closeRxPicker();
    });

    document.body.appendChild(popover);
    document.body.appendChild(picker);

    // Close when mouse leaves both the popover and the trigger (with a short grace period)
    let rxLeaveTimer = null;
    function scheduleClose() { rxLeaveTimer = setTimeout(closeRxPicker, 200); }
    function cancelClose()   { clearTimeout(rxLeaveTimer); }

    popover.addEventListener('mouseenter', cancelClose);
    popover.addEventListener('mouseleave', () => {
        if (picker.style.display !== 'none') return; // full picker is open — don't close
        scheduleClose();
    });
    picker.addEventListener('mouseenter', cancelClose);
    picker.addEventListener('mouseleave', scheduleClose);

    // Expose so attachReactionTrigger can use them
    setupReactionPicker._scheduleClose = scheduleClose;
    setupReactionPicker._cancelClose   = cancelClose;

    // Close on outside click — use composedPath() to correctly detect clicks
    // inside shadow DOM elements (e.target retargeting makes closest() unreliable).
    document.addEventListener('click', (e) => {
        const path = e.composedPath();
        const inside = path.some(el => el.id === 'rx-popover' || el.id === 'rx-full-picker' ||
            (el.classList && el.classList.contains('msg-rx-trigger')));
        if (!inside) closeRxPicker();
    });

    function openFullPicker() {
        const trigger = rxTargetMsgId
            ? document.querySelector(`.msg-rx-trigger[data-msg-id="${CSS.escape(rxTargetMsgId)}"]`)
            : null;
        if (trigger) positionNear(picker, trigger);
        picker.style.display = 'block';
    }
}

function closeRxPicker() {
    document.getElementById('rx-popover')?.style.setProperty('display', 'none');
    document.getElementById('rx-full-picker')?.style.setProperty('display', 'none');
}

function openRxPopover(msgId, triggerEl) {
    const popover = document.getElementById('rx-popover');
    if (!popover) return;
    rxTargetMsgId = msgId;
    positionNear(popover, triggerEl);
    popover.style.display = 'flex';
}

function positionNear(el, anchor) {
    // Show briefly off-screen to measure
    el.style.visibility = 'hidden';
    el.style.display = el.id === 'rx-full-picker' ? 'block' : 'flex';
    const ew = el.offsetWidth  || 260;
    const eh = el.offsetHeight || 44;
    el.style.visibility = '';
    el.style.display = 'none';

    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    let top  = rect.top - eh - 6;

    // Flip below if not enough space above
    if (top < 8) top = rect.bottom + 6;
    // Clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - ew - 8));

    el.style.position = 'fixed';
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
}

// ── Add reaction trigger button to a reactions bar ──
function attachReactionTrigger(bar, id) {
    const trigger = document.createElement('button');
    trigger.className = 'msg-rx-trigger';
    trigger.type = 'button';
    trigger.title = 'Add reaction';
    trigger.textContent = '😊';
    trigger.dataset.msgId = id;
    trigger.addEventListener('mouseenter', () => {
        if (setupReactionPicker._cancelClose) setupReactionPicker._cancelClose();
        openRxPopover(id, trigger);
    });
    trigger.addEventListener('mouseleave', () => {
        if (setupReactionPicker._scheduleClose) setupReactionPicker._scheduleClose();
    });
    bar.appendChild(trigger);
}

// ── Update reaction pills on a message ──
function applyReactions(msgId, reactions) {
    const msg = document.querySelector(`.msg[data-msg-id="${CSS.escape(msgId)}"]`);
    if (!msg) return;
    const bar = msg.querySelector('.msg-reactions');
    if (!bar) return;

    // Remove existing pills, keep trigger
    bar.querySelectorAll('.msg-rx-pill').forEach(p => p.remove());
    const trigger = bar.querySelector('.msg-rx-trigger');

    for (const [emoji, { count, users }] of Object.entries(reactions)) {
        if (count === 0) continue;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'msg-rx-pill' + (users.includes(currentUsername) ? ' active' : '');
        pill.dataset.emoji = emoji;
        pill.title = users.join(', ');
        const countEl = document.createElement('span');
        countEl.className = 'rx-count';
        countEl.textContent = count;
        pill.append(emoji, ' ', countEl);
        pill.addEventListener('click', () => {
            socket.emit('react-message', { roomId: state.roomId, msgId, emoji });
        });
        bar.insertBefore(pill, trigger);
    }
}

// ── Message controls (edit / delete) ──
const SVG_EDIT = `<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a.75.75 0 0 1-.34.19l-3.25.75a.75.75 0 0 1-.906-.906l.75-3.25a.75.75 0 0 1 .19-.34zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.439 1.263-1.263a.25.25 0 0 0 0-.354zM11.19 5.25 9.75 3.811 3.44 10.121l-.245 1.062 1.062-.245z"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75M4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15M6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25"/></svg>`;

function buildControls(id, canEdit) {
    const wrap = document.createElement('div');
    wrap.className = 'msg-controls';

    if (canEdit) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'msg-ctrl-btn';
        editBtn.title = 'Edit';
        editBtn.innerHTML = SVG_EDIT;
        editBtn.addEventListener('click', () => startEdit(id));
        wrap.appendChild(editBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'msg-ctrl-btn msg-ctrl-delete';
    delBtn.title = 'Delete';
    delBtn.innerHTML = SVG_TRASH;
    delBtn.addEventListener('click', () => {
        socket.emit('delete-message', { roomId: state.roomId, msgId: id });
    });
    wrap.appendChild(delBtn);
    return wrap;
}

function startEdit(msgId) {
    const msg = document.querySelector(`.msg[data-msg-id="${CSS.escape(msgId)}"]`);
    if (!msg) return;
    const body = msg.querySelector('.msg-body');
    if (!body || msg.classList.contains('editing')) return;
    msg.classList.add('editing');

    const originalHtml = body.innerHTML;
    // Clone so we can strip the "(edited)" marker without touching the live DOM
    const bodyClone = body.cloneNode(true);
    bodyClone.querySelector('.msg-edited')?.remove();
    const plainText = bodyClone.innerText.trim();

    // Capture any embedded images (GIFs, inline images) so we can re-attach after save
    const imageSrcs = Array.from(body.querySelectorAll('img')).map(img => img.src);

    body.innerHTML = '';

    // Show images as a read-only preview above the textarea while editing
    if (imageSrcs.length) {
        const preview = document.createElement('div');
        preview.className = 'msg-edit-img-preview';
        for (const src of imageSrcs) {
            const img = document.createElement('img');
            img.src = src;
            img.className = 'msg-edit-preview-img';
            preview.appendChild(img);
        }
        body.appendChild(preview);
    }

    const ta = document.createElement('textarea');
    ta.className = 'msg-edit-input';
    ta.value = plainText;
    ta.rows = Math.max(1, (plainText.match(/\n/g) || []).length + 1);

    const actions = document.createElement('div');
    actions.className = 'msg-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'msg-edit-save';
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'msg-edit-cancel';
    cancelBtn.textContent = 'Cancel';

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    body.appendChild(ta);
    body.appendChild(actions);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    function save() {
        const newText = ta.value.trim();
        if (newText && (newText !== plainText || imageSrcs.length)) {
            socket.emit('edit-message', { roomId: state.roomId, msgId, text: newText, images: imageSrcs });
        } else {
            cancel();
        }
    }

    function cancel() {
        msg.classList.remove('editing');
        body.innerHTML = originalHtml;
        highlightCodeBlocks(msg);
    }

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
        if (e.key === 'Escape') cancel();
    });
}

// ── Message rendering ──
function addMessageToChat(username, html, text, msgId) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.querySelector('.chat-empty')?.remove();

    const id = msgId || genMsgId();
    const isOwn = username === currentUsername;
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.dataset.msgId = id;

    const body = html ? sanitizeHtml(html) : `<p>${escapeHtml(text || '')}</p>`;

    msg.innerHTML =
        `<div class="msg-header">` +
            `<span class="msg-user">${escapeHtml(username)}</span>` +
            `<span class="msg-time">${nowTime()}</span>` +
        `</div>` +
        `<div class="msg-body">${body}</div>`;

    if (isOwn) msg.querySelector('.msg-header').appendChild(buildControls(id, true));

    embedVideoLinks(msg.querySelector('.msg-body'));

    const bar = document.createElement('div');
    bar.className = 'msg-reactions';
    attachReactionTrigger(bar, id);
    msg.appendChild(bar);

    highlightCodeBlocks(msg);
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addFileToChat(username, { filename, mimeType, data, size, msgId }) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.querySelector('.chat-empty')?.remove();

    const id = msgId || genMsgId();
    const isOwn = username === currentUsername;
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
    if (isOwn) header.appendChild(buildControls(id, false));

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

    const bar = document.createElement('div');
    bar.className = 'msg-reactions';
    attachReactionTrigger(bar, id);

    msg.appendChild(header);
    msg.appendChild(card);
    msg.appendChild(bar);
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ── Video link embedding ──
function getVideoEmbedSrc(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        // YouTube
        if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            const v = u.searchParams.get('v');
            if (v) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
        }
        if (host === 'youtu.be') {
            const v = u.pathname.slice(1).split('/')[0];
            if (v) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
        }
        // Vimeo
        if (host === 'vimeo.com') {
            const m = u.pathname.match(/^\/(\d+)/);
            if (m) return `https://player.vimeo.com/video/${m[1]}`;
        }
    } catch { /* ignore malformed URLs */ }
    return null;
}

function embedVideoLinks(bodyEl) {
    bodyEl.querySelectorAll('a[href]').forEach(a => {
        const src = getVideoEmbedSrc(a.href);
        if (!src) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-video-embed';
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        wrapper.appendChild(iframe);
        a.parentNode.insertBefore(wrapper, a.nextSibling);
    });
}

// ── Image lightbox ──
function setupImageLightbox() {
    const overlay = document.createElement('div');
    overlay.id = 'img-lightbox';
    overlay.innerHTML = '<img id="img-lightbox-img"><button id="img-lightbox-close" aria-label="Close">✕</button>';
    document.body.appendChild(overlay);

    function close() { overlay.classList.remove('open'); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#img-lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    document.getElementById('messages').addEventListener('click', (e) => {
        const img = e.target.closest('img.chat-inline-img');
        if (!img) return;
        overlay.querySelector('#img-lightbox-img').src = img.src;
        overlay.classList.add('open');
    });
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

    setupReactionPicker();
    setupImageLightbox();

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

    socket.on('message-reaction', ({ msgId, reactions, reactorUsername }) => {
        applyReactions(msgId, reactions);
        if (reactorUsername && reactorUsername !== currentUsername) {
            document.getElementById('message-receive')?.play().catch(() => {});
        }
    });

    socket.on('message-edited', ({ msgId, html }) => {
        const msg = document.querySelector(`.msg[data-msg-id="${CSS.escape(msgId)}"]`);
        if (!msg) return;
        msg.classList.remove('editing');
        const body = msg.querySelector('.msg-body');
        if (!body) return;
        body.innerHTML = sanitizeHtml(html) + '<span class="msg-edited">(edited)</span>';
        highlightCodeBlocks(msg);
    });

    socket.on('message-deleted', ({ msgId }) => {
        document.querySelector(`.msg[data-msg-id="${CSS.escape(msgId)}"]`)?.remove();
    });
}
