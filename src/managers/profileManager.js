const fs = require('fs').promises;
const path = require('path');

const settingsPath = path.join(__dirname, '..', '..', 'data', 'profile_settings.json');
let settingsCache = {};

async function loadSettings() {
    try {
        await fs.mkdir(path.dirname(settingsPath), { recursive: true });
        const data = await fs.readFile(settingsPath, 'utf8');
        settingsCache = JSON.parse(data);
    } catch (e) {
        settingsCache = {};
    }
}

const backgroundsDir = path.join(__dirname, '..', '..', 'data', 'user_backgrounds');

async function ensureBackgroundsDir() {
    try {
        await fs.mkdir(backgroundsDir, { recursive: true });
    } catch (e) {
        console.error('Error creating backgrounds directory:', e);
    }
}

async function saveSettings() {
    try {
        await fs.writeFile(settingsPath, JSON.stringify(settingsCache, null, 2));
    } catch (e) {
        console.error('Error saving profile settings:', e);
    }
}


loadSettings();


function normalizeJid(jid) {
    if (!jid) return '';
    return jid.split(':')[0];
}

module.exports = {
    getTheme: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.theme || 'default';
    },
    setTheme: async (jid, themeName) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].theme = themeName;
        await saveSettings();
    },
    getMusica: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.musica || null;
    },
    setMusica: async (jid, songData) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].musica = songData;
        await saveSettings();
    },
    getTags: (jid) => {
        const key = normalizeJid(jid);

        const rawTags = settingsCache[key]?.tags || [];
        return rawTags.map(tag => {
            if (typeof tag === 'string') {
                return { text: tag, color: '#25D366' };
            }
            return tag;
        });
    },
    addTag: async (jid, tagText, tagColor = '#25D366') => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        if (!settingsCache[key].tags) settingsCache[key].tags = [];


        const exists = settingsCache[key].tags.some(t => {
            const existingText = typeof t === 'string' ? t : t.text;
            return existingText.toLowerCase() === tagText.toLowerCase();
        });

        if (!exists) {
            settingsCache[key].tags.push({ text: tagText, color: tagColor });
            await saveSettings();
            return true;
        }
        return false;
    },
    removeTag: async (jid, tagText) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key] || !settingsCache[key].tags) return false;

        const index = settingsCache[key].tags.findIndex(t => {
            const existingText = typeof t === 'string' ? t : t.text;
            return existingText.toLowerCase() === tagText.toLowerCase();
        });

        if (index > -1) {
            settingsCache[key].tags.splice(index, 1);
            await saveSettings();
            return true;
        }
        if (index > -1) {
            settingsCache[key].tags.splice(index, 1);
            await saveSettings();
            return true;
        }
        return false;
    },
    setCustomBackground: async (jid, imageBuffer) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};

        try {
            await ensureBackgroundsDir();
            const filename = `${key}_bg.jpg`;
            const filePath = path.join(backgroundsDir, filename);


            await fs.writeFile(filePath, imageBuffer);


            const Vibrant = require('node-vibrant');
            const v = new Vibrant(imageBuffer);
            const palette = await v.getPalette();

            const colors = {
                cardBg: palette.DarkMuted?.hex || palette.DarkVibrant?.hex || '#000000',
                textColor: palette.LightVibrant?.hex || '#ffffff',
                subTextColor: palette.Vibrant?.hex || '#dddddd',
                accentColor: palette.LightVibrant?.hex || '#ffffff',
                borderColor: palette.Vibrant?.hex || '#dddddd'
            };

            settingsCache[key].customTheme = {
                backgroundPath: filePath,
                colors: colors
            };


            settingsCache[key].theme = 'custom';

            await saveSettings();
            return true;
        } catch (e) {
            console.error('Error setting custom background:', e);
            return false;
        }
    },
    getCustomTheme: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.customTheme || null;
    },
    setCustomHtml: async (jid, htmlString) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};

        settingsCache[key].customHtml = htmlString;
        settingsCache[key].theme = 'builder';

        await saveSettings();
        return true;
    },
    getCustomHtml: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.customHtml || null;
    },
    setCustomHtmlBackground: async (jid, imageBuffer) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};

        try {
            await ensureBackgroundsDir();
            const filename = `${key}_html_bg.jpg`;
            const filePath = path.join(backgroundsDir, filename);

            await fs.writeFile(filePath, imageBuffer);
            settingsCache[key].customHtmlBg = filePath;
            await saveSettings();
            return true;
        } catch (e) {
            console.error('Error saving custom HTML background:', e);
            return false;
        }
    },
    getCustomHtmlBackground: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.customHtmlBg || null;
    },

    setBio: async (jid, text) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].bio = text;
        await saveSettings();
    },
    getBio: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.bio || null;
    },

    setBirthday: async (jid, dateStr) => {

        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};


        const parts = dateStr.split('/');
        if (parts.length !== 2) return false;

        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);

        if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return false;

        settingsCache[key].birthday = { day, month };


        const signs = [
            { name: 'Capricórnio', icon: '♑', end: 19 },
            { name: 'Aquário', icon: '♒', end: 18 },
            { name: 'Peixes', icon: '♓', end: 20 },
            { name: 'Áries', icon: '♈', end: 19 },
            { name: 'Touro', icon: '♉', end: 20 },
            { name: 'Gêmeos', icon: '♊', end: 20 },
            { name: 'Câncer', icon: '♋', end: 22 },
            { name: 'Leão', icon: '♌', end: 22 },
            { name: 'Virgem', icon: '♍', end: 22 },
            { name: 'Libra', icon: '♎', end: 22 },
            { name: 'Escorpião', icon: '♏', end: 21 },
            { name: 'Sagitário', icon: '♐', end: 21 },
            { name: 'Capricórnio', icon: '♑', end: 31 }
        ];
















        let sign = '';
        const m = month;
        const d = day;

        if ((m == 1 && d <= 19) || (m == 12 && d >= 22)) sign = '♑ Capricórnio';
        else if ((m == 1 && d >= 20) || (m == 2 && d <= 18)) sign = '♒ Aquário';
        else if ((m == 2 && d >= 19) || (m == 3 && d <= 20)) sign = '♓ Peixes';
        else if ((m == 3 && d >= 21) || (m == 4 && d <= 19)) sign = '♈ Áries';
        else if ((m == 4 && d >= 20) || (m == 5 && d <= 20)) sign = '♉ Touro';
        else if ((m == 5 && d >= 21) || (m == 6 && d <= 20)) sign = '♊ Gêmeos';
        else if ((m == 6 && d >= 21) || (m == 7 && d <= 22)) sign = '♋ Câncer';
        else if ((m == 7 && d >= 23) || (m == 8 && d <= 22)) sign = '♌ Leão';
        else if ((m == 8 && d >= 23) || (m == 9 && d <= 22)) sign = '♍ Virgem';
        else if ((m == 9 && d >= 23) || (m == 10 && d <= 22)) sign = '♎ Libra';
        else if ((m == 10 && d >= 23) || (m == 11 && d <= 21)) sign = '♏ Escorpião';
        else if ((m == 11 && d >= 22) || (m == 12 && d <= 21)) sign = '♐ Sagitário';

        settingsCache[key].sign = sign;
        await saveSettings();
        return { success: true, sign };
    },
    getBirthday: (jid) => {
        const key = normalizeJid(jid);
        return {
            birthday: settingsCache[key]?.birthday,
            sign: settingsCache[key]?.sign
        };
    },

    giveRep: async (senderJid, targetJid) => {
        const senderKey = normalizeJid(senderJid);
        const targetKey = normalizeJid(targetJid);

        if (senderKey === targetKey) return { success: false, reason: 'self_rep' };

        if (!settingsCache[senderKey]) settingsCache[senderKey] = {};
        if (!settingsCache[targetKey]) settingsCache[targetKey] = {};

        const now = Date.now();
        const lastRepTime = settingsCache[senderKey].lastRepGiven || 0;
        const cooldown = 12 * 60 * 60 * 1000; // 12 horas
        if (now - lastRepTime < cooldown) {
            const remaining = cooldown - (now - lastRepTime);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            return { success: false, reason: 'cooldown', time: `${hours}h ${minutes}m` };
        }


        settingsCache[senderKey].lastRepGiven = now;


        if (!settingsCache[targetKey].reputation) settingsCache[targetKey].reputation = 0;
        settingsCache[targetKey].reputation += 1;

        await saveSettings();
        return { success: true, newRep: settingsCache[targetKey].reputation };
    },
    getRep: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.reputation || 0;
    },

    addDonation: async (jid, amount) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};

        const current = settingsCache[key].donation || 0;
        const newVal = current + amount;

        settingsCache[key].donation = newVal;




        await saveSettings();
        return newVal;
    },
    getDonation: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.donation || 0;
    },
    getTopDonors: (limit = 10) => {

        const donors = Object.entries(settingsCache)
            .map(([jid, data]) => ({
                id: jid.includes('@') ? jid : `${jid}@s.whatsapp.net`,
                amount: data.donation || 0
            }))
            .filter(d => d.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, limit);

        return donors;
    }
};
