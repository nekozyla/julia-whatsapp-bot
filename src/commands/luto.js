const { generateImage } = require('../helpers/imageGenerator');
const { lutoTemplate } = require('../helpers/htmlTemplates');
const path = require('path');
const fs = require('fs');
const contactManager = require('../managers/contactManager');

function randomBirthYear() {
    const min = 1995;
    const max = 2005;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveBirthYear(arg) {
    if (!arg) return randomBirthYear();
    const parsed = Number.parseInt(arg, 10);
    if (!Number.isInteger(parsed)) return randomBirthYear();
    if (parsed < 1900 || parsed > 2026) return randomBirthYear();
    return parsed;
}

async function resolveDisplayName(sock, msgDetails, targetJid, msg) {
    const nickname = contactManager.getNickname(targetJid);
    if (nickname && nickname.trim()) return nickname.trim();

    if (targetJid === msgDetails.commandSenderJid && msgDetails.pushName) {
        const ownName = String(msgDetails.pushName).trim();
        if (ownName) return ownName;
    }

    if (msgDetails.sender?.endsWith('@g.us')) {
        try {
            const groupMeta = await sock.groupMetadata(msgDetails.sender);
            const participant = groupMeta?.participants?.find(p => p.id === targetJid);
            const participantName = participant?.name || participant?.notify;
            if (participantName && String(participantName).trim()) {
                return String(participantName).trim();
            }
        } catch (e) { }
    }

    const quotedName = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.pushName;
    if (quotedName && String(quotedName).trim()) return String(quotedName).trim();

    return targetJid.split('@')[0];
}

async function luto(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args = [] } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    } else if (quotedParticipant) {
        targetJid = quotedParticipant;
    }

    const birthYear = resolveBirthYear(args[0]);
    const deathYear = 2026;

    await sock.sendMessage(sender, { react: { text: '🕯️', key: msg.key } });

    try {
        let avatarUrl;
        try {
            avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
        }

        let name = await resolveDisplayName(sock, msgDetails, targetJid, msg);
        if (name.length > 26) {
            name = `${name.slice(0, 26)}...`;
        }

        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const outputPath = path.join(tempDir, `luto_${Date.now()}_${targetJid.split('@')[0]}.png`);

        await generateImage(lutoTemplate, outputPath, {
            avatarUrl,
            name,
            birthYear,
            deathYear
        }, { width: 700, height: 900 });

        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `🕯️ *LUTO*\n\n@${targetJid.split('@')[0]}\n${birthYear} - ${deathYear}`,
            mentions: [targetJid]
        }, { quoted: msg });

        setTimeout(() => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }, 30000);

    } catch (error) {
        console.error('[LUTO] Erro ao gerar imagem:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao gerar imagem de luto.' }, { quoted: msg });
    }
}

module.exports = luto;

module.exports.commandData = {
    name: 'luto',
    description: 'Gera uma imagem de luto com a foto da pessoa.',
    category: 'midia',
    usage: '/luto [anoNascimento] [@usuario]',
    aliases: []
};
