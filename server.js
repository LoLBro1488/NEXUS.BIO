'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const devInvite = process.env.DEV_INVITE_CODE || 'NEXUS-DEV-MASTER-2026';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => next());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'database.sqlite'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        display_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        accent TEXT DEFAULT '#ff007f',
        effect TEXT DEFAULT 'glow',
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        url TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
`);

app.get('/api/csrf', (req, res) => res.json({ csrf: 'mock-csrf-token' }));

let currentUsername = null;

app.get('/api/me', (req, res) => {
    if (!currentUsername) return res.status(401).json({ error: 'Не авторизован' });
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(currentUsername);
    if (!user) return res.status(401).json({ error: 'Не найден' });
    const links = db.prepare('SELECT * FROM links WHERE user_id = ?').all(user.id);
    res.json({
        user: { username: user.username, role: user.role },
        profile: {
            display_name: user.display_name || user.username,
            bio: user.bio || '',
            avatar_url: user.avatar_url || '',
            banner_url: user.banner_url || '',
            accent: user.accent || '#ff007f',
            effect: user.effect || 'glow',
            views: user.views || 0
        },
        links: links
    });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, invite } = req.body;
        if (!username || !email || !password || !invite) return res.status(400).json({ error: 'Заполните все поля' });
        if (invite.trim() !== devInvite) return res.status(403).json({ error: 'Неверный инвайт-код разработчика!' });

        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO users (username, email, password, role, display_name, bio) VALUES (?, ?, ?, ?, ?, ?)').run(
            username.trim(), email.trim().toLowerCase(), hashedPassword, 'developer', username, 'NEXUS Creator'
        );
        currentUsername = username.trim();
        res.json({ success: true, csrf: 'mock-csrf-token' });
    } catch (e) {
        res.status(400).json({ error: 'Пользователь уже существует' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { login, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    currentUsername = user.username;
    res.json({ success: true, csrf: 'mock-csrf-token' });
});

app.post('/api/auth/logout', (req, res) => {
    currentUsername = null;
    res.json({ success: true });
});

app.put('/api/profile', (req, res) => {
    if (!currentUsername) return res.status(401).json({ error: 'Не авторизован' });
    const { displayName, bio, avatarUrl, bannerUrl, accent, effect } = req.body;
    db.prepare('UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, banner_url = ?, accent = ?, effect = ? WHERE username = ?').run(
        displayName, bio, avatarUrl, bannerUrl, accent, effect, currentUsername
    );
    res.json({ success: true });
});

app.post('/api/links', (req, res) => {
    if (!currentUsername) return res.status(401).json({ error: 'Не авторизован' });
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(currentUsername);
    const { title, url } = req.body;
    db.prepare('INSERT INTO links (user_id, title, url) VALUES (?, ?, ?)').run(user.id, title, url);
    res.json({ success: true });
});

app.delete('/api/links/:id', (req, res) => {
    if (!currentUsername) return res.status(401).json({ error: 'Не авторизован' });
    db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.get('/u/:username', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).send('Пользователь не найден');
    db.prepare('UPDATE users SET views = views + 1 WHERE id = ?').run(user.id);
    res.send(`
