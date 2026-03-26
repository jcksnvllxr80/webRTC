const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const db = require('./db');

const ROOT_DIR = path.resolve(__dirname, '../..');
const CERTS_DIR = path.join(ROOT_DIR, 'certs');
const CONFIG_PATH = path.join(ROOT_DIR, 'config', 'server.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'src', 'web', 'public');

const options = {
    key: fs.readFileSync(path.join(CERTS_DIR, 'private.key')),
    cert: fs.readFileSync(path.join(CERTS_DIR, 'certificate.pem'))
};

const server = https.createServer(options, app);
const io = require('socket.io')(server);
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
// Merge secrets.json if present (gitignored — put real API keys there)
const SECRETS_PATH = path.join(ROOT_DIR, 'config', 'secrets.json');
if (fs.existsSync(SECRETS_PATH)) Object.assign(config, JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')));
const PORT = process.env.PORT || config.port || 3000;
// Create the session middleware
const sessionMiddleware = session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
});

// Use session middleware
app.use(sessionMiddleware);
app.use(express.json());

const publicPaths = new Set([
    '/login.html',
    '/login',
    '/register.html',
    '/register',
    '/login.css',
    '/login.js',
    '/register.js'
]);

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login.html');
    }
    next();
};

// Login routes (unrestricted)
app.get('/login.html', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (username && password && db.verifyUser(username, password)) {
        req.session.authenticated = true;
        req.session.username = username;
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

app.get('/register.html', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (username.length < 3 || password.length < 6) {
        return res.status(400).json({ error: 'Username must be 3+ chars, password 6+ chars' });
    }
    if (db.userExists(username)) {
        return res.status(409).json({ error: 'Username already taken' });
    }
    try {
        db.createUser(username, password);
        req.session.authenticated = true;
        req.session.username = username;
        res.sendStatus(201);
    } catch (err) {
        console.error('Registration error:', err);
        res.sendStatus(500);
    }
});

// Protect all other routes
app.use('/', (req, res, next) => {
    if (publicPaths.has(req.path)) {
        return next();
    }
    requireAuth(req, res, next);
});

// Serve static files after authentication check
app.use(express.static(PUBLIC_DIR));

// Handle logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
});

// Friends API
app.post('/api/friends', (req, res) => {
    const { friendUsername } = req.body;
    const username = req.session.username;
    if (!friendUsername) {
        return res.status(400).json({ error: 'Friend username required' });
    }
    if (friendUsername === username) {
        return res.status(400).json({ error: 'Cannot add yourself' });
    }
    if (!db.userExists(friendUsername)) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (db.isFriend(username, friendUsername)) {
        return res.status(409).json({ error: 'Already a friend' });
    }
    db.addFriend(username, friendUsername);
    res.sendStatus(201);
});

app.delete('/api/friends/:friendUsername', (req, res) => {
    const username = req.session.username;
    db.removeFriend(username, req.params.friendUsername);
    res.sendStatus(200);
});

app.get('/api/friends', (req, res) => {
    const friends = db.getFriends(req.session.username);
    res.json(friends);
});

app.get('/api/friends/check/:friendUsername', (req, res) => {
    const isFriend = db.isFriend(req.session.username, req.params.friendUsername);
    res.json({ isFriend });
});

app.get('/api/me', (req, res) => {
    res.json({ username: req.session.username });
});

// ── GIPHY proxy endpoints (key stays server-side) ──
async function fetchGiphy(path) {
    const key = process.env.GIPHY_API_KEY || config.giphyApiKey;
    if (!key || key.startsWith('REPLACE_')) return { error: 'not_configured' };
    const res = await fetch(`https://api.giphy.com/v1/gifs/${path}&api_key=${key}&rating=g&limit=24`);
    if (!res.ok) throw new Error(`GIPHY ${res.status}`);
    const { data } = await res.json();
    return data.map(g => ({
        id:      g.id,
        title:   g.title,
        url:     g.images.fixed_height.url,
        preview: g.images.preview_gif?.url || g.images.fixed_height_small?.url || g.images.fixed_height.url,
        width:   Number(g.images.fixed_height.width),
        height:  Number(g.images.fixed_height.height),
    }));
}

app.get('/api/gifs/trending', requireAuth, async (req, res) => {
    try {
        const result = await fetchGiphy('trending?');
        if (result.error) return res.status(503).json({ error: 'Add giphyApiKey to config/server.json' });
        res.json(result);
    } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/gifs/search', requireAuth, async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.redirect('/api/gifs/trending');
    try {
        const result = await fetchGiphy(`search?q=${encodeURIComponent(q)}&`);
        if (result.error) return res.status(503).json({ error: 'Add giphyApiKey to config/server.json' });
        res.json(result);
    } catch (e) { res.status(502).json({ error: e.message }); }
});

// Rooms API
app.post('/api/rooms', (req, res) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    res.json({ roomId });
});

// Serve main app for room URLs
app.get('/room/:roomId', requireAuth, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Socket.IO configuration
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

io.use((socket, next) => {
    if (socket.request.session && socket.request.session.authenticated) {
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

// Track online users: username -> Set of socket IDs
const onlineUsers = new Map();

// Track room membership: roomId -> Map<socketId, { username, mediaState }>
const rooms = new Map();
const messageReactions = new Map(); // roomId → Map<msgId, Map<emoji, Set<username>>>
const messageOwners    = new Map(); // roomId → Map<msgId, username>

// API endpoint for online status
app.get('/api/online', (req, res) => {
    const usernames = Array.from(onlineUsers.keys());
    res.json(usernames);
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    const username = socket.request.session?.username;

    // Track online status
    if (username) {
        if (!onlineUsers.has(username)) {
            onlineUsers.set(username, new Set());
        }
        onlineUsers.get(username).add(socket.id);
        io.emit('user-online', username);
    }

    socket.on('join-room', (roomId, userId) => {
        // Enforce 2-person room limit
        const room = rooms.get(roomId);
        if (room && room.size >= 2 && !room.has(socket.id)) {
            socket.emit('room-full');
            return;
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        // Add to rooms map
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        rooms.get(roomId).set(socket.id, { username, media: { audio: false, video: false, screen: false } });

        // Send full participant list to everyone in the room
        const participants = Object.fromEntries(rooms.get(roomId));
        io.in(roomId).emit('room-participants', participants);

        // Notify others that a new user connected
        socket.to(roomId).emit('user-connected', userId, username);
    });

    // Generic media-state-change: client sends { audio, video, screen } booleans
    socket.on('media-state-change', (roomId, media) => {
        const room = rooms.get(roomId);
        if (!room || !room.has(socket.id)) return;
        const participant = room.get(socket.id);
        participant.media = {
            audio: !!media.audio,
            video: !!media.video,
            screen: !!media.screen
        };
        io.in(roomId).emit('participant-updated', socket.id, participant);
    });

    socket.on('offer', (offer, roomId) => {
        socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', (answer, roomId) => {
        socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate, roomId) => {
        socket.to(roomId).emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Clean up room membership
        const roomId = socket.data.roomId;
        if (roomId && rooms.has(roomId)) {
            rooms.get(roomId).delete(socket.id);
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
                messageReactions.delete(roomId);
                messageOwners.delete(roomId);
            } else {
                const participants = Object.fromEntries(rooms.get(roomId));
                io.in(roomId).emit('room-participants', participants);
            }
        }

        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
                io.emit('user-offline', username);
            }
        }
    });

    // handler for chat messages (rich text)
    socket.on('chat-message', (data) => {
        const username = socket.request.session.username;
        if (!data.roomId) return;
        const msgId = data.msgId ? String(data.msgId).slice(0, 64) : null;
        if (msgId) {
            if (!messageOwners.has(data.roomId)) messageOwners.set(data.roomId, new Map());
            messageOwners.get(data.roomId).set(msgId, username);
        }
        io.in(data.roomId).emit('chat-message', {
            username,
            message: data.message ? String(data.message).slice(0, 4096) : '',
            html:    data.html    ? String(data.html).slice(0, 65536)    : null,
            msgId,
        });
    });

    // handler for file/image transfers (base64, max ~5 MB)
    socket.on('file-message', (data) => {
        const username = socket.request.session.username;
        if (!data.roomId) return;
        const dataStr = data.data ? String(data.data) : '';
        if (dataStr.length > 7 * 1024 * 1024) return; // reject oversized payloads
        const msgId = data.msgId ? String(data.msgId).slice(0, 64) : null;
        if (msgId) {
            if (!messageOwners.has(data.roomId)) messageOwners.set(data.roomId, new Map());
            messageOwners.get(data.roomId).set(msgId, username);
        }
        io.in(data.roomId).emit('file-message', {
            username,
            filename: String(data.filename  || 'file').slice(0, 255),
            mimeType: String(data.mimeType  || 'application/octet-stream').slice(0, 100),
            data: dataStr,
            size: Number(data.size) || 0,
            msgId,
        });
    });

    // handler for message edits (own messages only)
    socket.on('edit-message', (data) => {
        const username = socket.request.session.username;
        const { roomId, msgId } = data;
        if (!roomId || !msgId) return;
        const safeId = String(msgId).slice(0, 64);
        if (messageOwners.get(roomId)?.get(safeId) !== username) return;
        const text = String(data.text || '').slice(0, 4096);
        let html = '<p>' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'</p><p>') + '</p>';
        // Re-attach any images (GIFs, inline images) that were in the original message
        const rawImages = Array.isArray(data.images) ? data.images : [];
        for (const src of rawImages.slice(0, 10)) {
            const s = String(src);
            if (s.startsWith('data:image/') || s.startsWith('https://')) {
                html += `<img src="${s.replace(/"/g, '&quot;')}" style="max-width:100%">`;
            }
        }
        io.in(roomId).emit('message-edited', { msgId: safeId, text, html });
    });

    // handler for message deletes (own messages only)
    socket.on('delete-message', (data) => {
        const username = socket.request.session.username;
        const { roomId, msgId } = data;
        if (!roomId || !msgId) return;
        const safeId = String(msgId).slice(0, 64);
        if (messageOwners.get(roomId)?.get(safeId) !== username) return;
        messageOwners.get(roomId).delete(safeId);
        messageReactions.get(roomId)?.delete(safeId);
        io.in(roomId).emit('message-deleted', { msgId: safeId });
    });

    // handler for message reactions (any emoji, toggle per user)
    socket.on('react-message', (data) => {
        const username = socket.request.session.username;
        const { roomId, msgId, emoji } = data;
        if (!roomId || !msgId || !emoji) return;
        const safeId    = String(msgId).slice(0, 64);
        const safeEmoji = String(emoji).slice(0, 8);

        if (!messageReactions.has(roomId)) messageReactions.set(roomId, new Map());
        const roomRx = messageReactions.get(roomId);
        if (!roomRx.has(safeId)) roomRx.set(safeId, new Map());
        const msgRx = roomRx.get(safeId);
        if (!msgRx.has(safeEmoji)) msgRx.set(safeEmoji, new Set());
        const users = msgRx.get(safeEmoji);

        if (users.has(username)) users.delete(username);
        else users.add(username);
        if (users.size === 0) msgRx.delete(safeEmoji);

        // Build reactions summary: { emoji: { count, users[] } }
        const reactions = {};
        for (const [e, u] of msgRx) reactions[e] = { count: u.size, users: [...u] };

        io.in(roomId).emit('message-reaction', { msgId: safeId, reactions });
    });

    socket.on('user-stopped-stream', (roomId, userId) => {
        socket.to(roomId).emit('user-stopped-stream', userId);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});

