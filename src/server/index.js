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
        socket.join(roomId);
        const username = socket.request.session.username;
        socket.to(roomId).emit('user-connected', userId, username);
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
        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
                io.emit('user-offline', username);
            }
        }
    });

    // handler for chat messages
    socket.on('chat-message', (data) => {
        const username = socket.request.session.username;
        // Broadcast to everyone in the room, including the sender
        io.in(data.roomId).emit('chat-message', {
            username: username,
            message: data.message
        });
    });

    socket.on('user-stopped-stream', (roomId, userId) => {
        socket.to(roomId).emit('user-stopped-stream', userId);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});

