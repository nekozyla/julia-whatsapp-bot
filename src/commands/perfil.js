const path = require('path');
const fs = require('fs').promises;
const contactManager = require('../managers/contactManager');
const joinDateManager = require('../managers/joinDateManager');
const rankManager = require('../managers/rankManager');
const axios = require('axios');
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const { generateImage } = require('../helpers/imageGenerator');
const { profileCardTemplate } = require('../helpers/htmlTemplates');
const config = require('../../config/config');
const themes = require('../helpers/themes');
const Vibrant = require('node-vibrant');
const { getSpotifyData } = require('../helpers/spotifyHelper');
const AdmZip = require('adm-zip'); 


const authManager = require('../managers/authManager');

function adjustAlpha(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const profileManager = require('../managers/profileManager');

async function perfil(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, args, prefix, commandName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'help' || args[0].toLowerCase() === 'ajuda')) {
        let helpText = `🎨 *Personalização do Perfil*\n\n`;
        helpText += `🔧 *Comandos Disponíveis:*\n\n`;
        helpText += `• ${prefix}${commandName} bio [Texto] - *Define sua frase de bio*\n`;
        helpText += `• ${prefix}${commandName} niver [DD/MM] - *Define seu aniversário e signo*\n`;
        helpText += `• ${prefix}${commandName} musica [Nome] - *Define sua música favorita*\n`;
        helpText += `• ${prefix}${commandName} tema - *Lista os temas disponíveis*\n`;
        helpText += `• ${prefix}${commandName} tema custom [Imagem] - *Cria um tema com sua imagem*\n`;
        helpText += `• *Arquivo .julia* - *Importa tema completo (layout + fundo) auto*\n`;
        helpText += `\n🔗 *Crie seu tema aqui:*\nhttps://nekozyla.com.br/julia.html\n`;
        helpText += `🌐 *Link Reserva:* https://nekozyla.github.io/theme_julia/\n`;
        helpText += `\n👤 *Interações:*\n`;
        helpText += `• ${prefix}rep @usuario - *Dá +1 de reputação*\n`;

        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return;
    }

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'tema' || args[0].toLowerCase() === 'theme')) {
        const availableThemes = Object.keys(themes);
        const subArg = args[1] ? args[1].toLowerCase() : null;

        if (!subArg) {
            let text = `🎨 *Temas de Perfil Disponíveis:*\n\n`;
            availableThemes.forEach(t => {
                text += `• ${prefix}${commandName} tema ${t} - *${themes[t].name}*\n`;
            });
            text += `• ${prefix}${commandName} tema custom - *Customizado (Envie uma imagem)*\n`;
            text += `\n📂 *Importação Avançada:*\n`;
            text += `Envie um arquivo **.julia** (ou .zip) para aplicar um tema completo criado no site!\n`;
            text += `🔗 *Crie o seu agora:* https://nekozyla.com.br/julia.html\n`;
            text += `🌐 *Link Reserva:* https://nekozyla.github.io/theme_julia/\n`;
            text += `\nUse o comando acima para definir seu tema!`;
            await sock.sendMessage(sender, { text: text }, { quoted: msg });
            return;
        }

        if (subArg === 'import-file') {
            
            
            let docMessage = msg.message?.documentMessage;
            if (!docMessage && msg.message?.documentWithCaptionMessage) {
                docMessage = msg.message.documentWithCaptionMessage.message.documentMessage;
            }

            if (!docMessage) {
                await sock.sendMessage(sender, { text: `❌ Nenhum arquivo encontrado.` }, { quoted: msg });
                return;
            }

            try {
                const stream = await downloadContentFromMessage(docMessage, 'document');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                
                const zip = new AdmZip(buffer);
                const zipEntries = zip.getEntries();

                let foundHtml = false;
                let foundBg = false;

                for (const entry of zipEntries) {
                    const entryName = entry.entryName.toLowerCase();
                    console.log(`[ThemeImport] Found entry: ${entry.entryName}`);

                    if (entry.isDirectory) continue;

                    
                    if (entryName.endsWith('.html')) {
                        console.log('[ThemeImport] HTML found.');
                        const htmlContent = entry.getData().toString('utf8');
                        await profileManager.setCustomHtml(commandSenderJid, htmlContent);
                        foundHtml = true;
                    }

                    
                    if (entryName.endsWith('.png') || entryName.endsWith('.jpg') || entryName.endsWith('.jpeg') || entryName.endsWith('.webp')) {
                        console.log(`[ThemeImport] Image found (${entryName}), extracting...`);
                        const imageBuffer = entry.getData();
                        console.log(`[ThemeImport] Buffer size: ${imageBuffer.length} bytes`);
                        await profileManager.setCustomHtmlBackground(commandSenderJid, imageBuffer);
                        foundBg = true;
                    }
                }

                if (foundHtml) {
                    let successMsg = `✅ Tema **.julia** importado com sucesso!`;
                    if (foundBg) successMsg += `\nImagem de fundo aplicada.`;
                    await sock.sendMessage(sender, { text: successMsg }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, { text: `❌ Arquivo inválido: Nenhuma configuração HTML encontrada no arquivo .julia.` }, { quoted: msg });
                }

            } catch (e) {
                console.error('Error importing .julia file:', e);
                await sock.sendMessage(sender, { text: `❌ Erro ao ler arquivo do tema.\n${e.message}` }, { quoted: msg });
            }
            return;
        }

        if (subArg === 'import') {
            const rawConfig = args.slice(2).join(' '); 
            let htmlContent = '';

            
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg && quotedMsg.documentMessage) {
                try {
                    const stream = await downloadContentFromMessage(quotedMsg.documentMessage, 'document');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    htmlContent = buffer.toString('utf-8');
                } catch (e) {
                    await sock.sendMessage(sender, { text: `❌ Erro ao ler arquivo.` }, { quoted: msg });
                    return;
                }
            }
            
            else if (rawConfig) {
                try {
                    
                    htmlContent = Buffer.from(rawConfig, 'base64').toString('utf-8');
                    
                    if (!htmlContent.trim().startsWith('<') && !htmlContent.includes('html')) {
                        
                        
                        
                        htmlContent = rawConfig;
                    }
                } catch (e) {
                    htmlContent = rawConfig;
                }
            } else {
                await sock.sendMessage(sender, { text: `❌ Envie o código de configuração ou responda a um arquivo .txt/.html.` }, { quoted: msg });
                return;
            }

            if (!htmlContent || htmlContent.length < 10) {
                await sock.sendMessage(sender, { text: `❌ Configuração inválida ou vazia.` }, { quoted: msg });
                return;
            }

            
            
            const findImage = (m) => {
                if (!m) return null;
                if (m.imageMessage) return m.imageMessage;
                if (m.viewOnceMessage?.message?.imageMessage) return m.viewOnceMessage.message.imageMessage;
                if (m.viewOnceMessageV2?.message?.imageMessage) return m.viewOnceMessageV2.message.imageMessage;
                if (m.ephemeralMessage?.message?.imageMessage) return m.ephemeralMessage.message.imageMessage;
                if (m.documentWithCaptionMessage?.message?.imageMessage) return m.documentWithCaptionMessage.message.imageMessage;
                return null;
            };

            const directImage = findImage(msg.message);
            const quotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ?
                findImage(msg.message.extendedTextMessage.contextInfo.quotedMessage) : null;

            const bgImage = directImage || quotedImage;

            if (bgImage) {
                try {
                    const stream = await downloadContentFromMessage(bgImage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    await profileManager.setCustomHtmlBackground(commandSenderJid, buffer);
                } catch (e) {
                    console.error('Error saving custom HTML background:', e);
                    await sock.sendMessage(sender, { text: `⚠️ Erro ao salvar imagem de fundo. Tente novamente.` }, { quoted: msg });
                }
            } else if (rawConfig.includes('{{customBackground}}')) {
                
                
                
                
            }

            await profileManager.setCustomHtml(commandSenderJid, htmlContent);
            await sock.sendMessage(sender, { text: `✅ Tema *HTML Customizado* importado com sucesso!` }, { quoted: msg });
            return;
        }

        if (subArg === 'custom') {
            
            let mediaMessage = msg.message?.imageMessage ||
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

            if (!mediaMessage) {
                await sock.sendMessage(sender, { text: `❌ Para usar o tema Custom, envie o comando *${prefix}${commandName} tema custom* com uma imagem anexada ou respondendo a uma imagem.` }, { quoted: msg });
                return;
            }

            try {
                await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

                const stream = await downloadContentFromMessage(mediaMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                await profileManager.setCustomBackground(commandSenderJid, buffer);
                await sock.sendMessage(sender, { text: `✅ Tema *Custom* definido com sucesso! A imagem e as cores foram aplicadas.` }, { quoted: msg });
                return;

            } catch (e) {
                console.error('[PERFIL] Error setting custom theme:', e);
                await sock.sendMessage(sender, { text: `❌ Erro ao baixar ou processar a imagem. Tente novamente.` }, { quoted: msg });
                return;
            }
        }

        if (!availableThemes.includes(subArg)) {
            await sock.sendMessage(sender, { text: `❌ Tema *"${subArg}"* não encontrado.\nUse *${prefix}${commandName} tema* para ver a lista.` }, { quoted: msg });
            return;
        }

        await profileManager.setTheme(commandSenderJid, subArg);
        await sock.sendMessage(sender, { text: `✅ Tema do perfil alterado para: *${themes[subArg].name}*` }, { quoted: msg });
        return;
    }

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'musica' || args[0].toLowerCase() === 'music')) {
        const query = args.slice(1).join(' ');

        if (!query) {
            await sock.sendMessage(sender, { text: `🎵 *Música Favorita*\nUse: ${prefix}${commandName} musica [Nome da Música]\n\nIsso exibirá essa música no seu perfil quando você não estiver ouvindo nada no Last.fm.` }, { quoted: msg });
            return;
        }

        try {
            
            const spotifyData = await getSpotifyData(query, '');

            if (!spotifyData) {
                await sock.sendMessage(sender, { text: `❌ Música *"${query}"* não encontrada no Spotify.` }, { quoted: msg });
                return;
            }

            const songData = {
                name: spotifyData.name || query,
                artist: spotifyData.artist || 'Unknown',
                image: spotifyData.image 
            };

            await profileManager.setMusica(commandSenderJid, songData);
            await sock.sendMessage(sender, {
                image: { url: songData.image },
                caption: `✅ *Música Favorita Definida!*\n\n🎵 *${songData.name}*\n👤 *${songData.artist}*\n\nEla aparecerá no seu perfil quando você não estiver ouvindo nada.`
            }, { quoted: msg });
            return;

        } catch (e) {
            console.error('[PERFIL] Error searching music:', e);
            await sock.sendMessage(sender, { text: `❌ Erro ao buscar música.` }, { quoted: msg });
            return;
        }
    }

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'addtag' || args[0].toLowerCase() === 'removetag')) {
        const subCmd = args[0].toLowerCase();

        if (!authManager.isSuperAdmin(commandSenderJid)) {
            await sock.sendMessage(sender, { text: '❌ Apenas Super Admins podem gerenciar tags.' }, { quoted: msg });
            return;
        }

        const targetUser = mentionedJids[0] || (msg.message?.extendedTextMessage?.contextInfo?.participant) || null;
        if (!targetUser) {
            await sock.sendMessage(sender, { text: '❌ Mencione um usuário ou responda uma mensagem para gerenciar tags.' }, { quoted: msg });
            return;
        }

        
        
        
        let tagTextParts = args.slice(1);

        
        if (tagTextParts.length > 0 && tagTextParts[0].startsWith('@')) {
            tagTextParts.shift();
        }

        
        let tagColor = '#25D366'; 
        if (tagTextParts.length > 0) {
            const lastPart = tagTextParts[tagTextParts.length - 1];
            if (/^#[0-9A-Fa-f]{6}$/.test(lastPart)) {
                tagColor = lastPart;
                tagTextParts.pop(); 
            }
        }

        const tagText = tagTextParts.join(' ').trim();

        if (!tagText) {
            await sock.sendMessage(sender, { text: `❌ Digite o texto da tag.\nEx: ${prefix}${commandName} ${subCmd} @user Mestre` }, { quoted: msg });
            return;
        }

        if (subCmd === 'addtag') {
            const success = await profileManager.addTag(targetUser, tagText);
            if (success) {
                await sock.sendMessage(sender, { text: `✅ Tag *"${tagText}"* adicionada para @${targetUser.split('@')[0]}!` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `⚠️ O usuário já possui essa tag ou erro ao salvar.` }, { quoted: msg });
            }
        } else {
            const success = await profileManager.removeTag(targetUser, tagText);
            if (success) {
                await sock.sendMessage(sender, { text: `✅ Tag *"${tagText}"* removida de @${targetUser.split('@')[0]}!` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `❌ Tag *"${tagText}"* não encontrada no usuário.` }, { quoted: msg });
            }
        }
        return;

    }


    
    if (args && args.length > 0 && args[0].toLowerCase() === 'bio') {
        const bioText = args.slice(1).join(' ');
        if (!bioText) {
            await sock.sendMessage(sender, { text: `📝 *Bio do Perfil*\nUse: ${prefix}${commandName} bio [Sua Frase]\n\nEx: ${prefix}${commandName} bio O melhor bot do mundo!` }, { quoted: msg });
            return;
        }

        if (bioText.length > 100) {
            await sock.sendMessage(sender, { text: `❌ A bio deve ter no máximo 100 caracteres.` }, { quoted: msg });
            return;
        }

        await profileManager.setBio(commandSenderJid, bioText);
        await sock.sendMessage(sender, { text: `✅ Bio atualizada com sucesso!` }, { quoted: msg });
        return;
    }

    
    if (args && args.length > 0 && (args[0].toLowerCase() === 'niver' || args[0].toLowerCase() === 'aniversario')) {
        const dateStr = args[1];
        if (!dateStr) {
            await sock.sendMessage(sender, { text: `🎂 *Aniversário*\nUse: ${prefix}${commandName} niver DD/MM\n\nEx: ${prefix}${commandName} niver 20/01` }, { quoted: msg });
            return;
        }

        const result = await profileManager.setBirthday(commandSenderJid, dateStr);
        if (result && result.success) {
            await sock.sendMessage(sender, { text: `✅ Aniversário definido para *${dateStr}*! Seu signo é *${result.sign}*.` }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: `❌ Data inválida. Use o formato DD/MM (Ex: 20/01).` }, { quoted: msg });
        }
        return;
    }

    
    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    }

    
    
    let ppUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; 
    try {
        const url = await sock.profilePictureUrl(targetJid, 'image');
        console.log(`[PERFIL DEBUG] URL da foto de perfil para ${targetJid}:`, url);
        if (url) {
            ppUrl = url;
        }
    } catch (e) {
        console.log(`[PERFIL DEBUG] Erro ao obter foto de perfil de ${targetJid}:`, e.message);
        
    }

    
    const nickname = contactManager.getNickname(targetJid) || targetJid.split('@')[0];
    
    let pushName = msgDetails.pushName || 'Usuário';
    if (targetJid !== commandSenderJid) {
        
        
        pushName = nickname;
    }

    
    let msgCount = 0;
    let rankPos = '-';

    if (isGroup) {
        msgCount = rankManager.getCount(sender, targetJid);
        const rankInfo = rankManager.getRankInfo(sender, targetJid);
        if (rankInfo) {
            rankPos = rankInfo.rank;
        }
    }

    
    let joinDateStr = '...';
    try {
        const joinTimestamp = joinDateManager.getJoinDate(sender, targetJid);
        if (joinTimestamp) {
            
            const date = new Date(joinTimestamp < 100000000000 ? joinTimestamp * 1000 : joinTimestamp);
            joinDateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
    } catch (e) {
        
    }

    
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

        let foundLastFm = false;

        if (lfUser && config.LASTFM_API_KEY) {
            const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lfUser}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`;
            const { data } = await axios.get(url);
            const track = data?.recenttracks?.track?.[0];

            if (track) {
                
                if (track['@attr'] && track['@attr'].nowplaying === 'true') {
                    trackName = track.name;
                    trackArtist = track.artist['#text'];

                    
                    
                    trackImage = 'https://i.imgur.com/To2300W.png'; 

                    try {
                        const spotifyInfo = await getSpotifyData(trackName, trackArtist);
                        if (spotifyInfo && spotifyInfo.image) {
                            trackImage = spotifyInfo.image;
                        }
                    } catch (e) { }

                    isPlaying = true;
                    foundLastFm = true;
                }
            }
        }

        
        if (!isPlaying) {
            const favSong = profileManager.getMusica(targetJid);
            if (favSong) {
                trackName = favSong.name;
                trackArtist = favSong.artist;
                trackImage = favSong.image;
                isFavorite = true;

                
                if (trackImage && (trackImage.includes('last.fm') || !trackImage.includes('i.scdn.co'))) {
                    try {
                        const spotifyInfo = await getSpotifyData(trackName, trackArtist);
                        if (spotifyInfo && spotifyInfo.image) {
                            trackImage = spotifyInfo.image;
                            
                            await profileManager.setMusica(targetJid, {
                                ...favSong,
                                image: trackImage
                            });
                        }
                    } catch (e) { }
                }

            } else if (lfUser && config.LASTFM_API_KEY) {
                
                const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lfUser}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`;
                const { data } = await axios.get(url);
                const track = data?.recenttracks?.track?.[0];
                if (track) {
                    trackName = track.name;
                    trackArtist = track.artist['#text'];

                    
                    trackImage = 'https://i.imgur.com/To2300W.png';

                    try {
                        const spotifyInfo = await getSpotifyData(trackName, trackArtist);
                        if (spotifyInfo && spotifyInfo.image) {
                            trackImage = spotifyInfo.image;
                        }
                    } catch (e) { }
                }
            }
        }

    } catch (e) {
        
    }

    
    let theme = themes['default'];
    let isMinecraft = false;
    let isSkeuo = false; 
    let dirtTexture = '';
    let leatherTexture = '';
    let snowTexture = '';

    try {
        
        const userThemeKey = profileManager.getTheme(targetJid);

        
        if (userThemeKey === 'builder') {
            theme = {
                name: 'Builder Custom',
                
            };
        } else {
            theme = themes[userThemeKey] || themes['default'];
        }

        isSkeuo = (userThemeKey === 'skeuo'); 

        if (userThemeKey === 'minecraft') {
            isMinecraft = true;
            try {
                const dirtPath = path.join(__dirname, '..', 'assets', 'dirt.jpg');
                const dirtData = await fs.readFile(dirtPath);
                dirtTexture = `data:image/jpeg;base64,${dirtData.toString('base64')}`;
            } catch (e) {
                console.error('[PERFIL] Error loading dirt texture:', e);
            }
        }

        if (isSkeuo) {
            try {
                const leatherPath = path.join(__dirname, '..', 'assets', 'couro.jpg');
                const leatherData = await fs.readFile(leatherPath);
                leatherTexture = `data:image/jpeg;base64,${leatherData.toString('base64')}`;
            } catch (e) {
                console.error('[PERFIL] Error loading leather texture:', e);
            }
        }

        if (theme.backgroundImage === 'snow') {
            try {
                const snowPath = path.join(__dirname, '..', 'assets', 'snow.jpg');
                const snowData = await fs.readFile(snowPath);
                snowTexture = `data:image/jpeg;base64,${snowData.toString('base64')}`;
            } catch (e) {
                console.error('[PERFIL] Error loading snow texture:', e);
            }
        }

        if (userThemeKey === 'dynamic') {
            if (trackImage && !trackImage.includes('default_album') && !trackImage.includes('imgur')) {
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
                } catch (err) {
                    console.error('[PERFIL] Vibrant Error:', err);
                    theme = themes['default'];
                }
            } else {
                
                theme = themes['default'];
            }
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
                    if (e.code === 'ENOENT') {
                        
                    } else {
                        console.error('[PERFIL] Error loading custom background:', e);
                    }
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

    
    const outputPath = path.join('/tmp', `profile_${Date.now()}_${targetJid.split('@')[0]}.png`);

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });


        
        const customHtmlBgPath = profileManager.getCustomHtmlBackground(targetJid);
        let customHtmlBgBase64 = null;
        if (customHtmlBgPath) {
            console.log(`[DEBUG] Loading Custom BG from: ${customHtmlBgPath}`);
            try {
                const bgData = await fs.readFile(customHtmlBgPath);

                
                let mime = 'image/jpeg';
                if (bgData[0] === 0x89 && bgData[1] === 0x50 && bgData[2] === 0x4E && bgData[3] === 0x47) {
                    mime = 'image/png';
                } else if (bgData[0] === 0x52 && bgData[1] === 0x49 && bgData[2] === 0x46 && bgData[3] === 0x46) {
                    mime = 'image/webp';
                }

                console.log(`[DEBUG] Detected MIME: ${mime}, Size: ${bgData.length}`);
                customHtmlBgBase64 = `data:${mime};base64,${bgData.toString('base64')}`;
            } catch (e) {
                console.error('[DEBUG] Error loading custom html bg:', e);
            }
        } else {
            console.log('[DEBUG] No custom background path found for this user.');
        }

        const imageOptions = {
            avatarUrl: ppUrl,
            pushName: pushName,
            nickname: nickname,
            msgCount: msgCount, 
            messageCount: msgCount, 
            rank: rankPos,
            joinDate: joinDateStr,
            isAdmin: isAdmin,
            isDev: isDev,
            spouseName: spouseName,
            trackName,
            trackArtist,
            trackImage,
            isPlaying,
            level,
            bio,
            rep,
            birthday: birthdayStr,
            sign,
            
            theme: theme,
            isMinecraft: isMinecraft,
            dirtTexture: dirtTexture,
            isSkeuo: isSkeuo,
            leatherTexture: leatherTexture,
            snowTexture: snowTexture,
            isFavorite: isFavorite,
            customTags: profileManager.getTags(targetJid),
            
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
                    generateImage(safeHtml, outputPath, imageOptions, { width: 600, height: 600 }),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    generateImage(profileCardTemplate, outputPath, imageOptions, { width: 600, height: 600 }),
                    timeoutPromise
                ]);
            }
        } else {
            await Promise.race([
                generateImage(profileCardTemplate, outputPath, imageOptions, { width: 600, height: 600 }),
                timeoutPromise
            ]);
        }

        
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `👤 *Perfil de @${targetJid.split('@')[0]}*`,
            mentions: [targetJid]
        }, { quoted: msg });

        
        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

    } catch (error) {
        console.error('[PERFIL] Error creating profile card:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao gerar perfil visual.' });
    }
}

module.exports = perfil;


module.exports.commandData = {
    name: "perfil",
    description: "Mostra perfil completo.",
    category: "util",
    usage: "/perfil",
    aliases: ["/eu", "/profile"]
};
