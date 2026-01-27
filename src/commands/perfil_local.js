const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); 
const puppeteer = require('puppeteer-core');
const handlebars = require('handlebars');
const contactManager = require('../managers/contactManager');
const joinDateManager = require('../managers/joinDateManager');
const rankManager = require('../managers/rankManager');
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const { profileCardTemplate } = require('../helpers/htmlTemplates');
const config = require('../../config/config');
const themes = require('../helpers/themes');
const Vibrant = require('node-vibrant');
const { getSpotifyData } = require('../helpers/spotifyHelper');
const authManager = require('../managers/authManager');
const profileManager = require('../managers/profileManager');


async function generateProfileImageLocal(html, outputPath, content = {}, options = { width: 600, height: 600 }) {
    let browser = null;
    try {
        
        const template = handlebars.compile(html);
        const compiledHtml = template(content);

        
        const executablePath = path.resolve('./chromium_arm_final/chrome-linux/chrome');

        if (!fsSync.existsSync(executablePath)) {
            throw new Error('Navegador local não encontrado! Verifique se a pasta "chromium_arm_final" existe.');
        }

        browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--font-render-hinting=none'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({
            width: options.width,
            height: options.height,
            deviceScaleFactor: 2
        });

        
        await page.setContent(compiledHtml, { waitUntil: 'networkidle0' });

        
        await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });

    } catch (err) {
        console.error('[PerfilLocal] Erro na geração local:', err);
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}


async function perfilLocal(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, args, prefix, commandName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    
    
    
    
    

    
    
    

    

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'help' || args[0].toLowerCase() === 'ajuda')) {
        let helpText = `🎨 *Personalização do Perfil (Local Mode)*\n\n`;
        helpText += `Este comando usa o gerador local de imagens (Chromium).\n\n`;
        
        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return;
    }

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'tema' || args[0].toLowerCase() === 'theme')) {
        
        
        const availableThemes = Object.keys(themes);
        const subArg = args[1] ? args[1].toLowerCase() : null;

        if (!subArg) {
            
            
            let text = `🎨 *Temas (Modo Local)*\nUse os mesmos temas do /perfil.\n`;
            availableThemes.forEach(t => {
                text += `• ${prefix}${commandName} tema ${t}\n`;
            });
            await sock.sendMessage(sender, { text: text }, { quoted: msg });
            return;
        }

        
        
        
        

        if (availableThemes.includes(subArg)) {
            await profileManager.setTheme(commandSenderJid, subArg);
            await sock.sendMessage(sender, { text: `✅ Tema alterado para: *${themes[subArg].name}*` }, { quoted: msg });
            return;
        } else if (subArg === 'custom' || subArg === 'import') {
            await sock.sendMessage(sender, { text: `⚠️ Para importar temas ou usar custom, por favor use o comando principal *${prefix}perfil tema ...*` }, { quoted: msg });
            return;
        }

        return;
    }

    
    
    if (args && args.length > 0 && args[0].toLowerCase() === 'bio') {
        const bioText = args.slice(1).join(' ');
        if (bioText) {
            await profileManager.setBio(commandSenderJid, bioText);
            await sock.sendMessage(sender, { text: `✅ Bio atualizada!` }, { quoted: msg });
            return;
        }
    }

    

    
    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    }

    
    let ppUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
    try {
        const url = await sock.profilePictureUrl(targetJid, 'image');
        if (url) ppUrl = url;
    } catch (e) { }

    
    const nickname = contactManager.getNickname(targetJid) || targetJid.split('@')[0];
    let pushName = msgDetails.pushName || 'Usuário';
    if (targetJid !== commandSenderJid) pushName = nickname;

    
    let msgCount = 0;
    let rankPos = '-';
    if (isGroup) {
        msgCount = rankManager.getCount(sender, targetJid);
        const rankInfo = rankManager.getRankInfo(sender, targetJid);
        if (rankInfo) rankPos = rankInfo.rank;
    }

    
    let joinDateStr = '...';
    try {
        const joinTimestamp = joinDateManager.getJoinDate(sender, targetJid);
        if (joinTimestamp) {
            const date = new Date(joinTimestamp < 100000000000 ? joinTimestamp * 1000 : joinTimestamp);
            joinDateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
    } catch (e) { }

    
    let spouseName = null;
    try {
        const relPath = path.join(__dirname, '..', '..', 'data', 'relacionamentos.json');
        const relData = JSON.parse(await fs.readFile(relPath, 'utf8').catch(() => '{}'));
        const groupRels = relData[sender] || {};
        const userRels = groupRels[targetJid];
        if (userRels && userRels.spouses && userRels.spouses.length > 0) {
            const spouseJid = userRels.spouses[0].partner;
            spouseName = contactManager.getNickname(spouseJid) || spouseJid.split('@')[0];
        }
    } catch (e) { }

    
    let isAdmin = false;
    if (isGroup) {
        try {
            const groupMeta = await sock.groupMetadata(sender);
            const participant = groupMeta.participants.find(p => p.id === targetJid);
            if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                isAdmin = true;
            }
        } catch (e) { }
    }

    
    let trackName = null;
    let trackArtist = null;
    let trackImage = null;
    let isPlaying = false;
    let isFavorite = false;

    
    try {
        const npUsersPath = path.join(__dirname, '..', '..', 'data', 'np_users.json');
        const npUsers = JSON.parse(await fs.readFile(npUsersPath, 'utf8').catch(() => '{}'));
        const lfUser = npUsers[targetJid];

        
        if (lfUser && config.LASTFM_API_KEY) {
            const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lfUser}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`;
            const { data } = await axios.get(url);
            const track = data?.recenttracks?.track?.[0];
            if (track && track['@attr'] && track['@attr'].nowplaying === 'true') {
                trackName = track.name;
                trackArtist = track.artist['#text'];
                trackImage = 'https://i.imgur.com/To2300W.png';
                try {
                    const spotifyInfo = await getSpotifyData(trackName, trackArtist);
                    if (spotifyInfo && spotifyInfo.image) trackImage = spotifyInfo.image;
                } catch (e) { }
                isPlaying = true;
            }
        }

        if (!isPlaying) {
            const favSong = profileManager.getMusica(targetJid);
            if (favSong) {
                trackName = favSong.name;
                trackArtist = favSong.artist;
                trackImage = favSong.image;
                isFavorite = true;
            } else if (lfUser && config.LASTFM_API_KEY) {
                
                
            }
        }
    } catch (e) { }

    
    let theme = themes['default'];
    let isMinecraft = false;
    let isSkeuo = false;
    let dirtTexture = '';
    let leatherTexture = '';
    let snowTexture = '';

    try {
        const userThemeKey = profileManager.getTheme(targetJid);
        if (userThemeKey === 'builder') {
            theme = { name: 'Builder Custom' };
        } else {
            theme = themes[userThemeKey] || themes['default'];
        }

        isSkeuo = (userThemeKey === 'skeuo');
        if (userThemeKey === 'minecraft') {
            isMinecraft = true;
            const dirtPath = path.join(__dirname, '..', 'assets', 'dirt.jpg');
            if (fsSync.existsSync(dirtPath)) {
                dirtTexture = `data:image/jpeg;base64,${(await fs.readFile(dirtPath)).toString('base64')}`;
            }
        }
        

        
        if (userThemeKey === 'dynamic' && trackImage) {
            
            
            try {
                const v = new Vibrant(trackImage);
                const palette = await v.getPalette();
                const bg = palette.DarkMuted?.hex || palette.DarkVibrant?.hex || '#000000';
                const text = palette.LightVibrant?.hex || '#ffffff';
                const subText = palette.Vibrant?.hex || '#dddddd';
                theme = {
                    ...themes['default'],
                    name: 'Dynamic',
                    cardBg: bg,
                    textColor: text,
                    subTextColor: subText,
                    borderColor: subText,
                    accentColor: text,
                    screenBg: null
                };
            } catch (e) { }
        }

        
        if (userThemeKey === 'custom') {
            const customData = profileManager.getCustomTheme(targetJid);
            if (customData && customData.backgroundPath) {
                try {
                    const bgData = await fs.readFile(customData.backgroundPath);
                    const customBgBase64 = `data:image/jpeg;base64,${bgData.toString('base64')}`;
                    theme = {
                        ...themes['default'],
                        name: 'Custom',
                        cardBg: customData.colors.cardBg,
                        textColor: customData.colors.textColor,
                        subTextColor: customData.colors.subTextColor,
                        accentColor: customData.colors.accentColor,
                        borderColor: customData.colors.borderColor,
                        screenBg: null,
                        customBackground: customBgBase64
                    };
                } catch (e) {
                    theme = themes['default'];
                }
            }
        }

    } catch (e) { }

    
    const level = Math.floor(msgCount / 100);
    const isDev = authManager.isSuperAdmin(targetJid);
    const bio = profileManager.getBio(targetJid) || 'Sem bio definida...';
    const rep = profileManager.getRep(targetJid);
    const { birthday, sign } = profileManager.getBirthday(targetJid);
    const birthdayStr = birthday ? `${birthday.day.toString().padStart(2, '0')}/${birthday.month.toString().padStart(2, '0')}` : null;


    
    const outputPath = path.join('/tmp', `profile_local_${Date.now()}_${targetJid.split('@')[0]}.png`);

    try {
        await sock.sendMessage(sender, { react: { text: '🖥️', key: msg.key } }); 

        const customHtmlBgPath = profileManager.getCustomHtmlBackground(targetJid);
        let customHtmlBgBase64 = null;
        if (customHtmlBgPath) {
            try {
                const bgData = await fs.readFile(customHtmlBgPath);
                customHtmlBgBase64 = `data:image/jpeg;base64,${bgData.toString('base64')}`;
            } catch (e) { }
        }

        const imageOptions = {
            avatarUrl: ppUrl,
            pushName, nickname, msgCount, messageCount: msgCount,
            rank: rankPos, joinDate: joinDateStr, isAdmin, isDev, spouseName,
            trackName, trackArtist, trackImage, isPlaying,
            level, bio, rep, birthday: birthdayStr, sign,
            theme, isMinecraft, dirtTexture, isSkeuo, leatherTexture, snowTexture,
            isFavorite, customTags: profileManager.getTags(targetJid),
            customBackground: customHtmlBgBase64,
            donation: profileManager.getDonation(targetJid) > 0 ? Math.floor(profileManager.getDonation(targetJid)) : null
        };



        
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tempo limite de geração excedido (5s).")), 5000)
        );

        if (theme.name === 'Builder Custom') {
            const customHtml = profileManager.getCustomHtml(targetJid);
            if (customHtml) {
                const safeHtml = customHtml.replace('{{customBackground}}', '{{{customBackground}}}');
                await Promise.race([
                    generateProfileImageLocal(safeHtml, outputPath, imageOptions, { width: 600, height: 600 }),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    generateProfileImageLocal(profileCardTemplate, outputPath, imageOptions, { width: 600, height: 600 }),
                    timeoutPromise
                ]);
            }
        } else {
            await Promise.race([
                generateProfileImageLocal(profileCardTemplate, outputPath, imageOptions, { width: 600, height: 600 }),
                timeoutPromise
            ]);
        }

        
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `👤 *Perfil (Local)*\n*@${targetJid.split('@')[0]}*`,
            mentions: [targetJid]
        }, { quoted: msg });

        
        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

    } catch (error) {
        console.error('[PERFIL LOCAL] Error:', error);
        await sock.sendMessage(sender, { text: `❌ Erro na geração local: ${error.message}` });
    }
}

module.exports = perfilLocal;
module.exports.commandData = {
    name: "perfillocal",
    description: "Versão Local do Perfil (Puppeteer)",
    category: "util",
    usage: "/perfillocal",
    aliases: ["/pl", "/perfil2"]
};
