const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const settingsPath = path.join(__dirname, '..', '..', 'data', 'profile_settings.json');
let settingsCache = {};

function loadSettings() {
    try {
        fsSync.mkdirSync(path.dirname(settingsPath), { recursive: true });
        const data = fsSync.readFileSync(settingsPath, 'utf8');
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

// Helper to save base64 image
async function saveBase64Image(base64Data, filename) {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = path.join(backgroundsDir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

module.exports = {
    // ... Existing exports ...

    // Downloads and applies a community theme
    applyCommunityTheme: async (jid, themeName) => {
        const key = normalizeJid(jid);
        try {
            // 1. Fetch
            // 1. Fetch available themes to find case-insensitive match
            const listUrl = `https://nekozyla.com.br/api/themes`;
            const listResponse = await axios.get(listUrl);
            const themesList = listResponse.data;

            const matchedTheme = themesList.find(t => t.name.toLowerCase() === themeName.toLowerCase());

            if (!matchedTheme) {
                return { success: false, message: 'Tema não encontrado na comunidade.' };
            }

            // 1. Fetch the actual file
            const url = matchedTheme.url;
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            // 2. Unzip
            const zip = new AdmZip(response.data);
            const zipEntries = zip.getEntries();

            let htmlEntry = null;
            let backgroundEntry = null;
            const assetsMap = {};

            // 3. Scan entries
            for (const entry of zipEntries) {
                if (entry.isDirectory) continue;
                const entryName = entry.entryName;
                const lowerName = entryName.toLowerCase();

                if (lowerName === 'theme.html') {
                    htmlEntry = entry;
                    continue;
                }

                if (lowerName.startsWith('assets/')) {
                    const ext = path.extname(lowerName).toLowerCase();
                    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                        const mime = ext === '.png' ? 'image/png' :
                            ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                                ext === '.gif' ? 'image/gif' : 'image/webp';
                        assetsMap[entryName] = `data:${mime};base64,${entry.getData().toString('base64')}`;
                    }
                    continue;
                }

                if (!lowerName.includes('/') && ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(lowerName).toLowerCase())) {
                    backgroundEntry = entry;
                }
            }

            if (!htmlEntry) {
                return { success: false, message: 'Tema inválido (sem theme.html)' };
            }

            // 4. Hydrate HTML
            let htmlContent = zip.readAsText(htmlEntry);
            let hydratedCount = 0;

            for (const [assetPath, base64Data] of Object.entries(assetsMap)) {
                // Escape filenames for regex
                const regex = new RegExp(assetPath.replace(/\./g, '\\.'), 'g');
                if (htmlContent.match(regex)) {
                    htmlContent = htmlContent.replace(regex, base64Data);
                    hydratedCount++;
                }
            }

            // 5. Apply Settings
            if (!settingsCache[key]) settingsCache[key] = {};

            settingsCache[key].customHtml = htmlContent;
            settingsCache[key].theme = 'builder';

            // Reset background by default to avoid persistence from previous themes
            settingsCache[key].customHtmlBackground = null;
            settingsCache[key].customHtmlBg = null; // Clear legacy property

            if (backgroundEntry) {
                // Save custom background if present
                const bgExt = path.extname(backgroundEntry.entryName);
                const bgFilename = `bg_${Date.now()}_${key}${bgExt}`;
                const bgPath = path.join(backgroundsDir, bgFilename);
                await fs.writeFile(bgPath, backgroundEntry.getData());

                settingsCache[key].customHtmlBackground = bgPath;
            }

            await saveSettings();

            return { success: true, message: `Tema "${matchedTheme.name}" aplicado! (${hydratedCount} assets carregados)` };

        } catch (error) {
            console.error('Erro ao baixar tema:', error);
            return { success: false, message: `Erro ao baixar tema: ${error.message}` };
        }
    },
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
    setAnimatedProfile: async (jid, isAnimated) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].animatedProfile = !!isAnimated;
        await saveSettings();
    },
    isAnimatedProfile: (jid) => {
        const key = normalizeJid(jid);
        return !!settingsCache[key]?.animatedProfile;
    },
    setCustomHtmlBackground: async (jid, imageBuffer) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};

        try {
            await ensureBackgroundsDir();
            const filename = `bg_${Date.now()}_${key}_html_bg.jpg`;
            const filePath = path.join(backgroundsDir, filename);

            await fs.writeFile(filePath, imageBuffer);
            settingsCache[key].customHtmlBackground = filePath;
            settingsCache[key].customHtmlBg = null; // Clear legacy property
            await saveSettings();
            return true;
        } catch (e) {
            console.error('Error saving custom HTML background:', e);
            return false;
        }
    },
    getCustomHtmlBackground: (jid) => {
        const key = normalizeJid(jid);
        // Prefer new long property, fallback to old short one for migration
        return settingsCache[key]?.customHtmlBackground || settingsCache[key]?.customHtmlBg || null;
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
    },
    getSocials: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.socials || {};
    },
    setSocial: async (jid, platform, user) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        if (!settingsCache[key].socials) settingsCache[key].socials = {};

        settingsCache[key].socials[platform.toLowerCase()] = user;
        await saveSettings();
        return true;
    },
    removeSocial: async (jid, platform) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key] || !settingsCache[key].socials) return false;

        delete settingsCache[key].socials[platform.toLowerCase()];
        await saveSettings();
        return true;
    },
    getTopReputation: (limit = 10) => {
        const top = Object.entries(settingsCache)
            .map(([jid, data]) => ({
                id: jid.includes('@') ? jid : `${jid}@s.whatsapp.net`,
                reputation: data.reputation || 0
            }))
            .filter(u => u.reputation > 0)
            .sort((a, b) => b.reputation - a.reputation)
            .slice(0, limit);
        return top;
    },

    // --- Pronomes ---
    VALID_PRONOUNS: {
        'ela/dela':  { display: 'ela/dela',  color: '#FF69B4', emoji: '🏳️‍⚧️' },
        'ele/dele':  { display: 'ele/dele',  color: '#60A5FA', emoji: '🏳️‍⚧️' },
        'elu/delu':  { display: 'elu/delu',  color: '#A78BFA', emoji: '🏳️‍🌈' },
        'elx/delx':  { display: 'elx/delx',  color: '#34D399', emoji: '🏳️‍🌈' },
        'ael/del':   { display: 'ael/del',   color: '#FBBF24', emoji: '🏳️‍🌈' },
        'ile/dile':  { display: 'ile/dile',  color: '#F97316', emoji: '🏳️‍🌈' },
        'qualquer':  { display: 'qualquer pronome', color: '#F472B6', emoji: '🌈' },
        'sem':       { display: 'sem pronome', color: '#9CA3AF', emoji: '🤍' },
    },
    setPronouns: async (jid, pronounKey) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].pronouns = pronounKey.toLowerCase();
        await saveSettings();
    },
    getPronouns: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.pronouns || null;
    },

    // --- Identidade de Gênero ---
    VALID_GENDERS: {
        'mulher-cis':    { display: 'Mulher Cis',     emoji: '♀️' },
        'homem-cis':     { display: 'Homem Cis',      emoji: '♂️' },
        'mulher-trans':  { display: 'Mulher Trans',    emoji: '⚧️' },
        'homem-trans':   { display: 'Homem Trans',     emoji: '⚧️' },
        'nao-binario':   { display: 'Não-Binárie',    emoji: '⚧️' },
        'genderfluid':   { display: 'Genderfluid',    emoji: '🌊' },
        'agender':       { display: 'Agênero',        emoji: '⚪' },
        'bigender':      { display: 'Bigênero',       emoji: '💜' },
        'demimenina':    { display: 'Demimenina',     emoji: '🌸' },
        'demimenino':    { display: 'Demimenino',     emoji: '🌿' },
        'pangender':     { display: 'Pangênero',      emoji: '🌈' },
        'neutrois':      { display: 'Neutrois',       emoji: '💚' },
        'two-spirit':    { display: 'Two-Spirit',     emoji: '🪶' },
        'outro':         { display: 'Outro',          emoji: '✨' },
        'questionando':  { display: 'Questionando',   emoji: '❓' },
    },
    setGender: async (jid, genderKey) => {
        const key = normalizeJid(jid);
        if (!settingsCache[key]) settingsCache[key] = {};
        settingsCache[key].gender = genderKey.toLowerCase();
        await saveSettings();
    },
    getGender: (jid) => {
        const key = normalizeJid(jid);
        return settingsCache[key]?.gender || null;
    }
};
