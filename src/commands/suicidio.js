
const fs = require('fs').promises;
const path = require('path');
const { sendJuliaError } = require('../utils/utils.js');

const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');

async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId] || cache['global'];
    } catch (error) {
        return null;
    }
}

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, pushName } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const botJid = await getBotJid(sender);

        if (!botJid) {
            await sock.sendMessage(sender, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
            return;
        }

        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Para poder remover membros eu preciso ser administradora do grupo. Peça para tornar a Julia admin e tente novamente." }, { quoted: msg });
            return;
        }

        
        if (commandSenderJid === botJid) {
            await sock.sendMessage(sender, { text: "Eu não posso remover a mim mesma." }, { quoted: msg });
            return;
        }

        
        await sock.sendMessage(sender, { text: `Ok ${pushName}, atendendo ao pedido...` }, { quoted: msg });

        try {
            await sock.groupParticipantsUpdate(sender, [commandSenderJid], 'remove');
            
            await sock.sendMessage(sender, { text: `✅ Pedido concluído. ${pushName} foi removid${pushName.endsWith('a') ? 'a' : 'o'} do grupo.` });
            return;
        } catch (innerErr) {
            
            console.warn('[Suicidio] Remoção direta falhou, tentando demover antes de remover:', innerErr.message);
            try {
                await sock.groupParticipantsUpdate(sender, [commandSenderJid], 'demote');
                await sock.groupParticipantsUpdate(sender, [commandSenderJid], 'remove');
                await sock.sendMessage(sender, { text: `✅ Pedido concluído após demote. ${pushName} foi removid${pushName.endsWith('a') ? 'a' : 'o'} do grupo.` });
                return;
            } catch (secondErr) {
                console.error('[Suicidio] Falha ao demover/remover participante:', secondErr);
                await sendJuliaError(sock, sender, msg, secondErr);
                return;
            }
        }

    } catch (error) {
        console.error('[Suicidio] Erro ao processar o comando /suicidio:', error);
        await sendJuliaError(sock, sender, msg, error);
    }
};


module.exports.commandData = {
    name: "suicidio",
    description: "Sai do grupo.",
    category: "diversao",
    usage: "/suicidio",
    aliases: ["/sair","/adeus","/kickme"]
};
