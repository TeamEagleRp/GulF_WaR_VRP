require('dotenv').config();
const express = require('express');
const session = require('express-session'); // <--- أضف هذا السطر هنا
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// استدعاء البوت لتشغيله مع السيرفر بنفس الوقت (اختياري)
require('./bot.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'gulf_war_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
const DATA_FILE = path.join(__dirname, 'achievements.json');

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));

function getAchievements() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } 
    catch { return []; }
}

// Routes
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: { ...req.session.user, isAdmin: ADMIN_IDS.includes(req.session.user.id) } });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/api/login', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    res.json({ url: discordAuthUrl });
});

app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenRes.json();
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });
        const userData = await userRes.json();

        req.session.user = {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png'
        };

        res.redirect('/');
    } catch (err) {
        console.error('OAuth Error:', err);
        res.redirect('/');
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/achievements', (req, res) => {
    res.json(getAchievements());
});

app.post('/api/achievements', upload.single('imageFile'), (req, res) => {
    if (!req.session.user || !ADMIN_IDS.includes(req.session.user.id)) {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    const achievements = getAchievements();
    const newAch = {
        id: Date.now().toString(),
        title: req.body.title || 'إنجاز جديد',
        emoji: req.body.emoji || '🏆',
        imageUrl: req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || ''),
        author: req.session.user.username,
        createdAt: new Date().toLocaleDateString('ar-EG')
    };
    achievements.unshift(newAch);
    fs.writeFileSync(DATA_FILE, JSON.stringify(achievements, null, 2));
    res.json({ success: true, achievement: newAch });
});

app.listen(PORT, () => {
    console.log(`🌐 Web Server running on: http://localhost:${PORT}`);
});