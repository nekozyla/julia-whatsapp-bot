
const { sendGiratinaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const config = require('../../config.js');


const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');
const BOT_NAME = config.BOT_NAME || 'Bot';


async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId] || cache['global'];
    } catch (error) {

        return null;
    }
}


async function handleGroupStateCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return true;
    }

    const action = command === '/fechar' ? 'announcement' : 'not_announcement';
    const actionText = action === 'announcement' ? 'fechado' : 'aberto';
    const actionVerb = action === 'announcement' ? 'fechar' : 'abrir';

    try {
        groupMetadataManager.invalidateCache(chatJid);
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, chatJid);



        const botId = await getBotJid(chatJid);


        if (!botId) {
            await sock.sendMessage(chatJid, { text: `Não consegui verificar minha identidade neste grupo. Por favor, execute o comando \`/sync @${BOT_NAME}\` primeiro.` }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `Apenas administradores podem ${actionVerb} o grupo.` }, { quoted: msg });
            return true;
        }


        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `Eu preciso ser administradora do grupo para conseguir ${actionVerb} o grupo.` }, { quoted: msg });
            return true;
        }

        await sock.groupSettingUpdate(chatJid, action);

        await sock.sendMessage(chatJid, { text: `✅ O grupo foi ${actionText} com sucesso!` });

    } catch (error) {
        console.error(`[${command}] Erro:`, error);
        await sendGiratinaError(sock, chatJid, msg, error);
    }

    return true;
}

module.exports = handleGroupStateCommand;

module.exports.commandData = {
    name: "grupo",
    description: "Abre/fecha grupo.",
    category: "admin",
    usage: "/grupo",
    aliases: ["/abrir", "/open", "/fechar", "/close", "/link"]
};
