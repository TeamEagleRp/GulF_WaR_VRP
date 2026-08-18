require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// إنشاء كائن البوت مع الصلاحيات المطلوبة
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// عند جاهزية البوت وتأكيد الاتصال
client.once('ready', () => {
    console.log(`🤖 Bot is online! Logged in as: ${client.user.tag}`);
    
    // تعيين حالة البوت (Status)
    client.user.setActivity('GulF WaR RP | PlayStation', { type: 3 }); // Playing/Watching
});

// مثال: استجابة لأمر بسيط
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('🏓 Pong! GulF WaR Bot is active.');
    }
});

// تسجيل الدخول باستخدام التوكن من ملف .env
client.login(process.env.DISCORD_BOT_TOKEN)
    .catch(err => console.error('❌ Failed to login Discord Bot:', err));

module.exports = client;