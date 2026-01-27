const { sendJuliaError } = require('../utils/utils');
const { generateImage } = require('../helpers/imageGenerator');
const { shippCardTemplate } = require('../helpers/htmlTemplates');
const contactManager = require('../managers/contactManager');
const path = require('path');
const fs = require('fs').promises;

async function handleShippCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    
    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    
    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let person1, person2;

    if (mentionedJids.length === 1) {
        
        person1 = commandSenderJid;
        person2 = mentionedJids[0];

        if (person1 === person2) {
            await sock.sendMessage(sender, { text: `Ok, ${pushName}, entendi que você se ama! Mas pra shippar, preciso de outra pessoa. 😉` }, { quoted: msg });
            return true;
        }

    } else if (mentionedJids.length === 2) {
        
        [person1, person2] = mentionedJids;
    } else {
        
        await sock.sendMessage(sender, { text: "Marque uma ou duas pessoas para shippar.\nEx: `/shipp @Amigo` ou `/shipp @A @B`" }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '💘', key: msg.key } });

        
        let avatar1, avatar2;
        try { avatar1 = await sock.profilePictureUrl(person1, 'image'); } catch { avatar1 = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; }
        try { avatar2 = await sock.profilePictureUrl(person2, 'image'); } catch { avatar2 = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; }

        
        let name1 = contactManager.getNickname(person1) || person1.split('@')[0];
        let name2 = contactManager.getNickname(person2) || person2.split('@')[0];

        
        if (person1 === commandSenderJid && pushName) name1 = pushName;
        if (person2 === commandSenderJid && pushName) name2 = pushName;

        
        
        
        
        const compatibility = Math.floor(Math.random() * 101);

        
        let message = 'Melhor serem apenas amigos...';
        if (compatibility >= 40) message = 'Existe uma chance!';
        if (compatibility >= 70) message = 'O amor está no ar! ❤️';
        if (compatibility >= 90) message = 'ALMAS GÊMEAS! 😍';
        if (compatibility === 100) message = 'PERFEIÇÃO DIVINA! 💍';
        if (compatibility <= 10) message = 'Corra! É cilada, Bino! 🏃';

        
        const outputPath = path.join('/tmp', `shipp_${Date.now()}.png`);

        await generateImage(shippCardTemplate, outputPath, {
            avatar1,
            avatar2,
            name1,
            name2,
            percentage: compatibility,
            text: message
        }, { width: 800, height: 400 });

        
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `💘 **Shipp:** ${name1} x ${name2}\n\nCompatibilidade: ${compatibility}%`,
            mentions: [person1, person2]
        }, { quoted: msg });

        
        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

    } catch (error) {
        console.error('[SHIPP] Error:', error);
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleShippCommand;


module.exports.commandData = {
    name: "shipp",
    description: "Calcula compatibilidade.",
    category: "diversao",
    usage: "/shipp",
    aliases: ["/ship","/casal","/love","/amor"]
};
