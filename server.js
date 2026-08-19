require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// استدعاء البوت لتشغيله مع السيرفر
const client = require('./bot.js');

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

// إعداد المجلدات والملفات للتخزين
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
const DATA_FILE = path.join(__dirname, 'data.json');

// دالة قراءة وتمرير البيانات التخزينية
function getStoredData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initialData = { achievements: [], serverInfo: {} };
            fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return { achievements: [], serverInfo: {} };
    }
}

// ----------------- مسارات المستخدم والتوثيق (Auth) -----------------
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: { ...req.session.user, isAdmin: ADMIN_IDS.includes(req.session.user.id) } });
    } else {
        res.json({ loggedIn: false });
    }
});

// مسار تسجيل الدخول عبر ديسكورد
app.get('/api/login', (req, res) => {
    let hostUri = process.env.REDIRECT_URI || `${req.get('host')}/api/auth/callback`;
    hostUri = hostUri.trim().replace(/^https?:\/\//, '');
    
    const fullRedirectUrl = `https://${hostUri}`;
    const clientId = process.env.DISCORD_CLIENT_ID ? process.env.DISCORD_CLIENT_ID.trim() : '';

    if (!clientId) {
        return res.status(500).json({ error: 'DISCORD_CLIENT_ID is not configured.' });
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(fullRedirectUrl)}&response_type=code&scope=identify`;
    
    res.json({ url: discordAuthUrl });
});

// مسار استقبال التوكن (Callback)
app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    let hostUri = process.env.REDIRECT_URI || `${req.get('host')}/api/auth/callback`;
    hostUri = hostUri.trim().replace(/^https?:\/\//, '');
    const fullRedirectUrl = `https://${hostUri}`;

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID.trim(),
                client_secret: process.env.DISCORD_CLIENT_SECRET.trim(),
                grant_type: 'authorization_code',
                code,
                redirect_uri: fullRedirectUrl,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('Failed to obtain access token:', tokenData);
            return res.redirect('/');
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });

        const userData = await userRes.json();

        req.session.user = {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/0.png`
        };

        res.redirect('/');
    } catch (err) {
        console.error('OAuth Error:', err);
        res.redirect('/');
    }
});

// مسار تسجيل الخروج
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// ----------------- مسارات الإنجازات (Achievements) -----------------
app.get('/api/achievements', (req, res) => {
    const data = getStoredData();
    res.json(data.achievements || []);
});

app.post('/api/achievements', upload.single('image'), (req, res) => {
    if (!req.session.user || !ADMIN_IDS.includes(req.session.user.id)) {
        return res.status(403).json({ error: 'غير مصرح لك بالإضافة' });
    }

    const { title, description } = req.body;
    const data = getStoredData();
    
    const newAchievement = {
        id: Date.now().toString(),
        title,
        description,
        image: req.file ? `/uploads/${req.file.filename}` : null
    };

    data.achievements.push(newAchievement);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, achievement: newAchievement });
});

app.delete('/api/achievements/:id', (req, res) => {
    if (!req.session.user || !ADMIN_IDS.includes(req.session.user.id)) {
        return res.status(403).json({ error: 'غير مصرح لك بالحذف' });
    }

    const data = getStoredData();
    data.achievements = (data.achievements || []).filter(a => a.id !== req.params.id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// ----------------- مسارات معلومات السيرفر -----------------
app.get('/api/server-info', (req, res) => {
    const data = getStoredData();
    res.json(data.serverInfo || {});
});

app.post('/api/server-info', (req, res) => {
    if (!req.session.user || !ADMIN_IDS.includes(req.session.user.id)) {
        return res.status(403).json({ error: 'غير مصرح لك بالتحديث' });
    }

    const data = getStoredData();
    data.serverInfo = req.body;

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, serverInfo: data.serverInfo });
});

// ----------------- مسار إحصائيات السيرفر (Stats) -----------------
app.get('/api/server-stats', async (req, res) => {
    try {
        const guildId = process.env.DISCORD_GUILD_ID;
        let guild = client.guilds.cache.get(guildId);

        if (!guild && client.guilds) {
            guild = await client.guilds.fetch(guildId).catch(() => null);
        }

        if (!guild) {
            return res.json({ totalMembers: 0, onlineMembers: 0 });
        }

        const members = await guild.members.fetch().catch(() => null);
        const totalMembers = guild.memberCount;
        let onlineMembers = 0;

        if (members) {
            onlineMembers = members.filter(m => m.presence && m.presence.status !== 'offline').size;
        }

        res.json({
            totalMembers: totalMembers || 0,
            onlineMembers: onlineMembers || totalMembers || 0
        });
    } catch (err) {
        console.error('Error fetching guild stats:', err);
        res.json({ totalMembers: 0, onlineMembers: 0 });
    }
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});