const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');

const MY_NUMBER = '917985341275@c.us'; // 🚨 APNA WHATSAPP NUMBER DAALEIN (e.g. 919876543210@c.us)
const DB_FILE = 'castings.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    console.log('--- SCAN THIS QR CODE ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot is online and monitoring all groups!');
    
    // Har subah 8:00 AM IST par check karega
    cron.schedule('0 8 * * *', () => {
        checkAndSendReminders();
    }, { timezone: "Asia/Kolkata" });
});

client.on('message', async msg => {
    try {
        const chat = await msg.getChat();

        if (chat.isGroup) {
            const text = msg.body.toLowerCase();
            
            if (text.includes('m³') || text.includes('m3') || text.includes('concrete') || text.includes('casting')) {
                
                const qtyMatch = msg.body.match(/(\d+(?:\.\d+)?)\s*(?:m³|m3)/i);
                const structureMatch = msg.body.match(/for\s+([a-zA-Z0-9\s]+)/i);
                const gradeMatch = msg.body.match(/M-?\d{2}/i);

                if (qtyMatch && structureMatch) {
                    const quantity = qtyMatch[1];
                    const structure = structureMatch[1].trim();
                    const grade = gradeMatch ? gradeMatch[0].toUpperCase() : 'N/A';

                    const newRecord = {
                        id: Date.now(),
                        groupName: chat.name,
                        date: new Date().toISOString(),
                        quantity: quantity,
                        structure: structure,
                        grade: grade,
                        originalMessage: msg.body
                    };

                    let data = JSON.parse(fs.readFileSync(DB_FILE));
                    data.push(newRecord);
                    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

                    console.log(`Saved from group [${chat.name}]: ${quantity}m3 for ${structure}`);
                }
            }
        }
    } catch (err) {
        console.error('Error processing message:', err);
    }
});

function checkAndSendReminders() {
    let data = JSON.parse(fs.readFileSync(DB_FILE));
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    data.forEach(record => {
        let castDate = new Date(record.date);
        castDate.setHours(0, 0, 0, 0);

        let diffTime = Math.abs(today - castDate);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 7 || diffDays === 28) {
            const formattedDate = castDate.toLocaleDateString('en-IN');
            
            const message = `🚨 *CUBE TESTING REMINDER* (${diffDays}th Day) 🚨\n\n` +
                            `👥 *Group/Site:* ${record.groupName || 'Unknown Group'}\n` +
                            `🏗️ *Structure:* ${record.structure}\n` +
                            `📈 *Grade:* ${record.grade}\n` +
                            `📦 *Quantity:* ${record.quantity} m³\n` +
                            `📅 *Casting Date:* ${formattedDate}`;

            client.sendMessage(MY_NUMBER, message);
        }
    });
}

client.initialize();
