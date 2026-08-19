require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences 
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

// في نهاية ملف bot.js تأكد من تصدير client
module.exports = client;