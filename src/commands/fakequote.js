const { sendGiratinaError } = require('../utils/utils');
const contactManager = require('../managers/contactManager');
const { generateImage } = require('../helpers/imageGenerator');
const { fakeQuoteTemplate } = require('../helpers/htmlTemplates');
const path = require('path');
const fs = require('fs').promises;


async function handleFakeQuote(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args, pushName, commandName, prefix } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    
    let targetJid;
    let quoteText;

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const reportedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (quotedMsg) {
        
        
        targetJid = reportedParticipant;

        
        if (args.length > 0) {
            quoteText = args.join(' ');
        } else {
            quoteText = quotedMsg.conversation ||
                quotedMsg.extendedTextMessage?.text ||
                quotedMsg.imageMessage?.caption ||
                quotedMsg.videoMessage?.caption ||
                "";
        }

    } else if (mentionedJids.length > 0) {
        
        targetJid = mentionedJids[0];

        
        
        
        quoteText = args.filter(arg => !arg.includes('@')).join(' ');

    } else {
        
        
        if (args.length > 0) {
            
            targetJid = commandSenderJid;
            quoteText = args.join(' ');
        } else {
            await sock.sendMessage(sender, {
                text: `❓ *Uso:* \n\n1. Responda uma mensagem com \`${prefix}${commandName}\`\n2. Use \`${prefix}${commandName} @usuario O texto aqui\`\n3. Use \`${prefix}${commandName} O seu próprio texto\``
            }, { quoted: msg });
            return true;
        }
    }

    if (!quoteText || quoteText.trim().length === 0) {
        await sock.sendMessage(sender, { text: "⚠️ Você precisa fornecer um texto para a citação!" }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        
        let avatarUrl;
        try {
            avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; 
        }

        
        const nickname = contactManager.getNickname(targetJid) || targetJid.split('@')[0];
        let displayName = nickname;

        
        
        if (targetJid === commandSenderJid && pushName) {
            displayName = pushName;
        } else {
            
            
            
            
        }

        
        const outputPath = path.join('/tmp', `quote_${Date.now()}_${targetJid.split('@')[0]}.png`);

        const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        await generateImage(fakeQuoteTemplate, outputPath, {
            avatarUrl,
            username: displayName,
            text: quoteText,
            timestamp
        }, { width: 800, height: 800 }); 

        
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `❝ ${quoteText} ❞`
        }, { quoted: msg });

        
        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

    } catch (error) {
        console.error('[FakeQuote] Error:', error);
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleFakeQuote;


module.exports.commandData = {
    name: "fakequote",
    description: "Cria uma citação falsa.",
    category: "midia",
    usage: "/fakequote",
    aliases: ["/citacao","/quote","/fake"]
};
