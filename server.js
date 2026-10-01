'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

// Инвайт-код разработчика
const devInvite = process.env.DEV_INVITE_CODE || 'NEXUS-DEV-MASTER-2026';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// База данных SQLite
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
        bio TEXT,
        avatar TEXT,
        banner TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, invite } = req.body;

        if (!username || !email || !password || !invite) {
            return res.status(400).json({ error: 'Заполните все поля, включая инвайт-код.' });
        }

        if (invite.trim() !== devInvite) {
            return res.status(403).json({ error: 'Неверный инвайт-код разработчика!' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, normalizedEmail);
        
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const insert = db.prepare(`
            INSERT INTO users (username, email, password, bio, avatar, banner) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        insert.run(
            username.trim(),
            normalizedEmail,
            hashedPassword,
            'NEXUS Cyber Biolink',
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop'
        );

        return res.json({ success: true, message: 'Регистрация прошла успешно!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка сервера при регистрации.' });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) {
            return res.status(400).json({ error: 'Введите логин/email и пароль.' });
        }

        const queryLogin = login.trim().toLowerCase();
        const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(queryLogin, queryLogin);

        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль.' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный логин или пароль.' });
        }

        return res.json({ 
            success: true, 
            user: { username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, banner: user.banner } 
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка сервера при входе.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
