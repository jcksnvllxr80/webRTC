const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(path.join(__dirname, 'users.db'));

db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        friend_username TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, friend_username)
    )
`);

const SALT_ROUNDS = 10;

function createUser(username, password) {
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, hash);
}

function verifyUser(username, password) {
    const stmt = db.prepare('SELECT password FROM users WHERE username = ?');
    const row = stmt.get(username);
    if (!row) return false;
    return bcrypt.compareSync(password, row.password);
}

function userExists(username) {
    const stmt = db.prepare('SELECT 1 FROM users WHERE username = ?');
    return !!stmt.get(username);
}

function addFriend(username, friendUsername) {
    const stmt = db.prepare('INSERT OR IGNORE INTO friends (username, friend_username) VALUES (?, ?)');
    return stmt.run(username, friendUsername);
}

function removeFriend(username, friendUsername) {
    const stmt = db.prepare('DELETE FROM friends WHERE username = ? AND friend_username = ?');
    return stmt.run(username, friendUsername);
}

function getFriends(username) {
    const stmt = db.prepare('SELECT friend_username, added_at FROM friends WHERE username = ? ORDER BY added_at DESC');
    return stmt.all(username);
}

function isFriend(username, friendUsername) {
    const stmt = db.prepare('SELECT 1 FROM friends WHERE username = ? AND friend_username = ?');
    return !!stmt.get(username, friendUsername);
}

module.exports = { createUser, verifyUser, userExists, addFriend, removeFriend, getFriends, isFriend };
