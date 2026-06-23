const path = require('path');
const fs = require('fs').promises;
const contactManager = require('../managers/contactManager');
const joinDateManager = require('../managers/joinDateManager');
const rankManager = require('../managers/rankManager');
const { getStats, ESPECIES } = require('../managers/dueloManager');
const axios = require('axios');
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const { generateImage } = require('../helpers/imageGenerator');

const handlebars = require('handlebars');
const { profileCardTemplate } = require('../helpers/htmlTemplates');
const config = require('../../config');
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
    console.log(`[PERFIL] Iniciando perfil | sender=${sender} | commandSenderJid=${commandSenderJid} | isGroup=${isGroup} | args=${JSON.stringify(args)}`);


    if (args && args.length > 0 && (args[0].toLowerCase() === 'help' || args[0].toLowerCase() === 'ajuda')) {
        let helpText = `┏━━❪ 𝗛𝗘𝗟𝗣 ❫━━\n┃\n`;
        helpText += `┃ ➢ 🔧 𝗖𝗼𝗺𝗮𝗻𝗱𝗼𝘀\n┃\n`;
        helpText += `┃ ➢ ${prefix}${commandName} bio [Texto]\n`;
        helpText += `┃ ➢ ${prefix}${commandName} niver [DD/MM]\n`;
        helpText += `┃ ➢ ${prefix}${commandName} musica [Nome]\n`;
        helpText += `┃ ➢ ${prefix}${commandName} pronome [opção]\n`;
        helpText += `┃ ➢ ${prefix}${commandName} genero [opção]\n`;
        helpText += `┃ ➢ ${prefix}${commandName} animado\n`;
        helpText += `┃ ➢ ${prefix}${commandName} social add/remove/list\n`;
        helpText += `┃ ➢ ${prefix}${commandName} tema\n`;
        helpText += `┃ ➢ ${prefix}${commandName} tema custom [Img]\n┃\n`;
        helpText += `┣━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n`;
        helpText += `┃ ➢ 𝗚𝗮𝗹𝗲𝗿𝗶𝗮 › nekozyla.com.br/themes.html\n`;
        helpText += `┃ ➢ 𝗖𝗿𝗶𝗮𝗱𝗼𝗿 𝗱𝗲 𝘁𝗲𝗺𝗮𝘀 › https://nekozyla.com.br/criador.html\n`;
        helpText += `┃ ➢ 𝗜𝗻𝘁𝗲𝗿𝗮𝗰𝗼𝗲𝘀 › ${prefix}rep @user\n┃\n`;
        helpText += `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return;
    }


    if (args && args.length > 0 && (args[0].toLowerCase() === 'tema' || args[0].toLowerCase() === 'theme')) {
        const availableThemes = Object.keys(themes);
        const subArg = args.slice(1).join(' ').toLowerCase() || null;

        // AUTO-DETECT .GIRATINA / .ZIP FILE
        // If user sends ".perfil tema" with a file, we treat it as import
        let docMessage = msg.message?.documentMessage;
        if (!docMessage && msg.message?.documentWithCaptionMessage) {
            docMessage = msg.message.documentWithCaptionMessage.message.documentMessage;
        }

        if (docMessage) {
            const filename = docMessage.fileName?.toLowerCase() || '';
            if (filename.endsWith('.giratina') || filename.endsWith('.zip')) {
                // Forward to import-file logic
                await importGiratinaTheme(sock, msg, docMessage, sender, commandSenderJid);
                return;
            }
        }

        if (!subArg) {
            let text = `┏━━❪ 𝗧𝗛𝗘𝗠𝗘𝗦 ❫━━\n┃\n`;
            availableThemes.forEach(t => {
                text += `┃ ➢ ${t.toUpperCase()} › ${themes[t].name}\n`;
            });
            text += `┃ ➢ 𝗖𝗨𝗦𝗧𝗢𝗠 › ${prefix}${commandName} tema custom\n┃\n`;
            text += `┣━━❪ 𝗜𝗠𝗣𝗢𝗥𝗧 ❫━━\n┃\n`;
            text += `┃ ➢ Envie arquivo .giratina ou .zip\n`;
            text += `┃ ➢ Legenda: ${prefix}${commandName} tema\n┃\n`;
            text += `┣━━❪ 𝗟𝗜𝗡𝗞𝗦 ❫━━\n┃\n`;
            text += `┃ ➢ 𝗚𝗮𝗹𝗲𝗿𝗶𝗮 › nekozyla.com.br/themes.html\n`;
            text += `┃ ➢ 𝗖𝗿𝗶𝗮𝗱𝗼𝗿 𝗱𝗲 𝘁𝗲𝗺𝗮𝘀 › https://nekozyla.com.br/criador.html\n┃\n`;
            text += `┗━━━━━━━━━━━━━━`;
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

            await importGiratinaTheme(sock, msg, docMessage, sender, commandSenderJid);
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
            // Tenta buscar tema da comunidade
            await sock.sendMessage(sender, { text: `🔍 Buscando tema *"${subArg}"* na comunidade...` }, { quoted: msg });
            const result = await profileManager.applyCommunityTheme(commandSenderJid, subArg);

            if (result.success) {
                await sock.sendMessage(sender, { text: `✅ ${result.message}` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `❌ Tema *"${subArg}"* não encontrado (Local ou Comunidade).\nUse *${prefix}${commandName} tema* para ver a lista ou crie o seu em https://nekozyla.com.br/criador.html` }, { quoted: msg });
            }
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
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Digite o texto da tag\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} ${subCmd} @user Tag\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        if (subCmd === 'addtag') {
            const success = await profileManager.addTag(targetUser, tagText);
            if (success) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Tag Adicionada\n┃ ➢ 𝗧𝗮𝗴 › ${tagText}\n┃ ➢ 𝗨𝘀𝗲𝗿 › @${targetUser.split('@')[0]}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao adicionar\n┃ ➢ 𝗜𝗻𝗳𝗼 › Usuário já possui ou erro interno\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
        } else {
            const success = await profileManager.removeTag(targetUser, tagText);
            if (success) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗗𝗘𝗟𝗘𝗧𝗘𝗗 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Tag Removida\n┃ ➢ 𝗧𝗮𝗴 › ${tagText}\n┃ ➢ 𝗨𝘀𝗲𝗿 › @${targetUser.split('@')[0]}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Tag não encontrada\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
        }
        return;

    }



    if (args && args.length > 0 && args[0].toLowerCase() === 'animado') {
        const currentTheme = profileManager.getTheme(commandSenderJid);
        if (currentTheme !== 'builder') {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Requer tema .giratina\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }
        const current = profileManager.isAnimatedProfile(commandSenderJid);
        await profileManager.setAnimatedProfile(commandSenderJid, !current);
        if (!current) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗔𝗖𝗧𝗜𝗢𝗡 ❫━━\n┃\n┃ ➢ 𝗠𝗼𝗱𝗼 › Animado [ON]\n┃ ➢ 𝗔𝘃𝗶𝘀𝗼 › Geração pode demorar 15s\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗜𝗠𝗔𝗚𝗘 ❫━━\n┃\n┃ ➢ 𝗠𝗼𝗱𝗼 › Estático [ON]\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }
        return;
    }


    if (args && args.length > 0 && args[0].toLowerCase() === 'bio') {
        const bioText = args.slice(1).join(' ');
        if (!bioText) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗘𝗗𝗜𝗧 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} bio [Frase]\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        if (bioText.length > 100) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Limite de 100 caracteres\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        await profileManager.setBio(commandSenderJid, bioText);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗕𝗶𝗼 › Atualizada com sucesso\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return;
    }


    if (args && args.length > 0 && (args[0].toLowerCase() === 'niver' || args[0].toLowerCase() === 'aniversario')) {
        const dateStr = args[1];
        if (!dateStr) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗕𝗜𝗥𝗧𝗛𝗗𝗔𝗬 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} niver DD/MM\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        const result = await profileManager.setBirthday(commandSenderJid, dateStr);
        if (result && result.success) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗗𝗮𝘁𝗮 › ${dateStr}\n┃ ➢ 𝗦𝗶𝗴𝗻𝗼 › ${result.sign}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Formato inválido (DD/MM)\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }
        return;
    }


    // --- PRONOMES ---
    if (args && args.length > 0 && (args[0].toLowerCase() === 'pronome' || args[0].toLowerCase() === 'pronomes' || args[0].toLowerCase() === 'pronouns')) {
        const chosen = args.slice(1).join(' ').toLowerCase().trim();
        const validPronouns = profileManager.VALID_PRONOUNS;

        if (!chosen) {
            // Mostrar opções
            let text = `┏━━❪ 🏳️‍🌈 𝗣𝗥𝗢𝗡𝗢𝗠𝗘𝗦 ❫━━\n┃\n`;
            for (const [key, info] of Object.entries(validPronouns)) {
                text += `┃ ➢ ${info.emoji} *${key}* › ${info.display}\n`;
            }
            const currentPronoun = profileManager.getPronouns(commandSenderJid);
            if (currentPronoun && validPronouns[currentPronoun]) {
                text += `┃\n┃ ➢ 𝗔𝘁𝘂𝗮𝗹 › ${validPronouns[currentPronoun].emoji} ${validPronouns[currentPronoun].display}\n`;
            }
            text += `┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} pronome [opção]\n`;
            text += `┃ ➢ 𝗥𝗲𝗺𝗼𝘃𝗲𝗿 › ${prefix}${commandName} pronome remover\n┃\n`;
            text += `┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return;
        }

        if (chosen === 'remover' || chosen === 'remove' || chosen === 'limpar') {
            await profileManager.setPronouns(commandSenderJid, '');
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗣𝗿𝗼𝗻𝗼𝗺𝗲 › Removido\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        if (!validPronouns[chosen]) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Pronome inválido\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use ${prefix}${commandName} pronome\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        await profileManager.setPronouns(commandSenderJid, chosen);
        const info = validPronouns[chosen];
        await sock.sendMessage(sender, { text: `┏━━❪ 🏳️‍🌈 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗣𝗿𝗼𝗻𝗼𝗺𝗲 › ${info.emoji} ${info.display}\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Definido com sucesso\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return;
    }


    // --- IDENTIDADE DE GÊNERO ---
    if (args && args.length > 0 && (args[0].toLowerCase() === 'genero' || args[0].toLowerCase() === 'gênero' || args[0].toLowerCase() === 'gender')) {
        const chosen = args.slice(1).join(' ').toLowerCase().trim();
        const validGenders = profileManager.VALID_GENDERS;

        if (!chosen) {
            // Mostrar opções
            let text = `┏━━❪ ⚧️ 𝗚𝗘𝗡𝗘𝗥𝗢 ❫━━\n┃\n`;
            for (const [key, info] of Object.entries(validGenders)) {
                text += `┃ ➢ ${info.emoji} *${key}* › ${info.display}\n`;
            }
            const currentGender = profileManager.getGender(commandSenderJid);
            if (currentGender && validGenders[currentGender]) {
                text += `┃\n┃ ➢ 𝗔𝘁𝘂𝗮𝗹 › ${validGenders[currentGender].emoji} ${validGenders[currentGender].display}\n`;
            }
            text += `┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} genero [opção]\n`;
            text += `┃ ➢ 𝗥𝗲𝗺𝗼𝘃𝗲𝗿 › ${prefix}${commandName} genero remover\n┃\n`;
            text += `┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return;
        }

        if (chosen === 'remover' || chosen === 'remove' || chosen === 'limpar') {
            await profileManager.setGender(commandSenderJid, '');
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗚ê𝗻𝗲𝗿𝗼 › Removido\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        if (!validGenders[chosen]) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Identidade não encontrada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use ${prefix}${commandName} genero\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        await profileManager.setGender(commandSenderJid, chosen);
        const info = validGenders[chosen];
        await sock.sendMessage(sender, { text: `┏━━❪ ⚧️ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗚ê𝗻𝗲𝗿𝗼 › ${info.emoji} ${info.display}\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Definido com sucesso\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return;
    }


    if (args && args.length > 0 && (args[0].toLowerCase() === 'social' || args[0].toLowerCase() === 'redes')) {
        const subCmd = args[1] ? args[1].toLowerCase() : 'list';
        const validPlatforms = ['instagram', 'twitter', 'tiktok', 'github', 'linkedin', 'linktree'];

        if (subCmd === 'add') {
            const platform = args[2] ? args[2].toLowerCase() : null;
            const user = args[3];

            if (!platform || !validPlatforms.includes(platform) || !user) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Uso incorreto\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} social add [rede] [user]\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
                return;
            }

            await profileManager.setSocial(commandSenderJid, platform, user);
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗥𝗲𝗱𝗲 › ${platform}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${user}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            return;
        }

        if (subCmd === 'remove') {
            const platform = args[2] ? args[2].toLowerCase() : null;

            if (!platform || !validPlatforms.includes(platform)) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Especifique a rede\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
                return;
            }

            const success = await profileManager.removeSocial(commandSenderJid, platform);
            if (success) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗗𝗘𝗟𝗘𝗧𝗘𝗗 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Rede removida: ${platform}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Rede não encontrada\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
            return;
        }

        if (subCmd === 'list') {
            const socials = profileManager.getSocials(commandSenderJid);
            const platforms = Object.keys(socials);

            if (platforms.length === 0) {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗢𝗖𝗜𝗔𝗟𝗦 ❫━━\n┃\n┃ ➢ 𝗜𝗻𝗳𝗼 › Nenhuma rede vinculada\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
                return;
            }

            let text = `┏━━❪ 𝗦𝗢𝗖𝗜𝗔𝗟𝗦 ❫━━\n┃\n`;
            platforms.forEach(p => {
                text += `┃ ➢ ${p.toUpperCase()} › ${socials[p]}\n`;
            });
            text += `┃\n┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text: text }, { quoted: msg });
            return;
        }
    }


    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    }
    console.log(`[PERFIL] targetJid=${targetJid}`);


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
    console.log(`[PERFIL] ppUrl obtido`);

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
    let spousesData = [];
    try {
        const relPath = path.join(__dirname, '..', '..', 'data', 'relacionamentos.json');


        const relData = JSON.parse(await fs.readFile(relPath, 'utf8').catch(() => '{}'));
        const groupRels = relData[sender] || {};
        const userRels = groupRels[targetJid];

        if (userRels && userRels.spouses && userRels.spouses.length > 0) {
            const spouseJid = userRels.spouses[0].partner;

            spouseName = contactManager.getNickname(spouseJid) || spouseJid.split('@')[0];

            spousesData = userRels.spouses.map(sp => {
                const p = sp.partner;
                return {
                    name: contactManager.getNickname(p) || p.split('@')[0],
                    avatarUrl: null
                };
            });
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
    console.log(`[PERFIL] Buscando info de musica...`);
    console.log(`[PERFIL] Buscando info de musica...`);
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
    console.log(`[PERFIL] Tudo pronto, iniciando geracao da imagem...`);
    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });
        console.log(`[PERFIL] React enviado, gerando imagem...`);



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
            spouses: spousesData,
            hasSpouses: spousesData.length > 0,
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
            specie: ESPECIES[getStats(targetJid)?.specie] || null,

            customBackground: customHtmlBgBase64,

            donation: profileManager.getDonation(targetJid) > 0 ? Math.floor(profileManager.getDonation(targetJid)) : null,
            socials: profileManager.getSocials(targetJid),
            hasSocials: Object.keys(profileManager.getSocials(targetJid)).length > 0,

            // Pronomes & Gênero
            pronouns: (() => {
                const pKey = profileManager.getPronouns(targetJid);
                if (!pKey) return null;
                const pInfo = profileManager.VALID_PRONOUNS[pKey];
                return pInfo ? { key: pKey, display: pInfo.display, color: pInfo.color, emoji: pInfo.emoji } : null;
            })(),
            gender: (() => {
                const gKey = profileManager.getGender(targetJid);
                if (!gKey) return null;
                const gInfo = profileManager.VALID_GENDERS[gKey];
                return gInfo ? { key: gKey, display: gInfo.display, emoji: gInfo.emoji } : null;
            })()
        };




        const timeoutMs = 5000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tempo limite de geração excedido (${timeoutMs / 1000}s).`)), timeoutMs)
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


        const caption = `┏━━❪ 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗳𝗶𝗹 › @${targetJid.split('@')[0]}${(() => {
            const socials = profileManager.getSocials(targetJid);
            const platforms = Object.keys(socials);
            if (platforms.length === 0) return '\n┃\n┗━━━━━━━━━━━━━━';
            let sTxt = '\n┃\n┣━━❪ 📱 ❫━━\n┃';
            platforms.forEach(p => sTxt += `\n┃ ➢ ${p.charAt(0).toUpperCase() + p.slice(1)} › ${socials[p]}`);
            sTxt += '\n┃\n┗━━━━━━━━━━━━━━';
            return sTxt;
        })()}`;

        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption,
            mentions: [targetJid]
        }, { quoted: msg });


        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

    } catch (error) {
        console.error('[PERFIL] Error creating profile card:', error);
        await sock.sendMessage(sender, { text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar perfil\n┃\n┗━━━━━━━━━━━━━━' });
    }
}

// Helper to import .giratina theme files
async function importGiratinaTheme(sock, msg, docMessage, sender, commandSenderJid) {
    try {
        const stream = await downloadContentFromMessage(docMessage, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        let htmlEntry = null;
        let backgroundEntry = null;
        const assetsMap = {};

        // 1. First Pass: Identify files
        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const entryName = entry.entryName;
            const lowerName = entryName.toLowerCase();

            // Main HTML
            if (lowerName === 'theme.html') {
                htmlEntry = entry;
                continue;
            }

            // Assets (Decorations)
            if (lowerName.startsWith('assets/')) {
                const ext = path.extname(lowerName).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                    // Store as Base64 for hydration
                    const mime = ext === '.png' ? 'image/png' :
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                            ext === '.gif' ? 'image/gif' : 'image/webp';

                    assetsMap[entryName] = `data:${mime};base64,${entry.getData().toString('base64')}`;
                }
                continue;
            }

            // Background (Root level image)
            // Explicitly ignore assets folder and ensure it is an image
            if (!lowerName.includes('/') && ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(lowerName).toLowerCase())) {
                backgroundEntry = entry;
            }
        }

        if (!htmlEntry) {
            await sock.sendMessage(sender, { text: `❌ Arquivo inválido: 'theme.html' não encontrado no arquivo .giratina.` }, { quoted: msg });
            return;
        }

        // 2. Hydrate HTML
        let htmlContent = htmlEntry.getData().toString('utf8');

        // Replace asset references in HTML with Base64
        let hydratedCount = 0;
        for (const [assetPath, base64Data] of Object.entries(assetsMap)) {
            // Create regex to replace src="assets/filename.ext" or url('assets/filename.ext')
            // We handle both quotes, and ensure we match the exact path
            const regex = new RegExp(assetPath.replace(/\./g, '\\.'), 'g');
            if (htmlContent.match(regex)) {
                htmlContent = htmlContent.replace(regex, base64Data);
                hydratedCount++;
            }
        }
        console.log(`[ThemeImport] Hydrated ${hydratedCount} assets into HTML.`);

        // 3. Check for animated flag in state.json
        let isAnimated = false;
        const stateEntry = zip.getEntries().find(e => e.entryName.toLowerCase() === 'state.json');
        if (stateEntry) {
            try {
                const stateData = JSON.parse(stateEntry.getData().toString('utf8'));
                isAnimated = !!stateData.animated;
            } catch (e) { }
        }

        // 4. Save Everything
        await profileManager.setCustomHtml(commandSenderJid, htmlContent);
        await profileManager.setAnimatedProfile(commandSenderJid, isAnimated);

        if (backgroundEntry) {
            console.log(`[ThemeImport] Background found: ${backgroundEntry.entryName}`);
            await profileManager.setCustomHtmlBackground(commandSenderJid, backgroundEntry.getData());
        }

        let successMsg = `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Tema Importado`;
        if (isAnimated) successMsg += `\n┃ ➢ 𝗠𝗼𝗱𝗼 › Animado`;
        if (backgroundEntry) successMsg += `\n┃ ➢ 𝗕𝗚 › Aplicado`;
        if (hydratedCount > 0) successMsg += `\n┃ ➢ 𝗔𝘀𝘀𝗲𝘁𝘀 › ${hydratedCount}`;
        successMsg += `\n┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text: successMsg }, { quoted: msg });

    } catch (e) {
        console.error('Error importing .giratina file:', e);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha na importação\n┃ ➢ 𝗜𝗻𝗳𝗼 › ${e.message}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
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
