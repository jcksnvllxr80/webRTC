const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');

// Your SSL certificates
const options = {
    key: fs.readFileSync('private.key'),
    cert: fs.readFileSync('certificate.pem')
};

const server = https.createServer(options, app);
const io = require('socket.io')(server);
const session = require('express-session');
const path = require('path');

const PORT = process.env.PORT || 3000;
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
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        req.session.authenticated = true;
        req.session.username = username;
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

// Protect all other routes
app.use('/', (req, res, next) => {
    if (req.path === '/login.html' || req.path === '/login') {
        return next();
    }
    requireAuth(req, res, next);
});

// Serve static files after authentication check
app.use(express.static('public'));

// Users database (in memory)
const users = {
    "user1": "user123",
    "user2": "user234"
};

// Handle logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
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

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
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

