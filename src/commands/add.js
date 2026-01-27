
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

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


function sanitizePhoneNumber(numberString) {
    let digits = numberString.replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
    if (digits.length < 12 || digits.length > 13) return null;
    return `${digits}@s.whatsapp.net`;
}

async function handleAddCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandText, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        const botId = await getBotJid(chatJid); 

        if (!botId) {
            await sock.sendMessage(chatJid, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
            return;
        }

        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para conseguir adicionar alguém." }, { quoted: msg });
            return;
        }
        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return;
        }

        let targetJid = null;
        const numberToParse = commandText.substring('/add'.length).trim();

        if (numberToParse) {
            targetJid = sanitizePhoneNumber(numberToParse);
            if (!targetJid) {
                await sock.sendMessage(chatJid, { text: `O número "${numberToParse}" não parece ser um número de telefone válido.` }, { quoted: msg });
                return;
            }
        } else if (msgDetails.quotedMsgInfo?.participant) {
            targetJid = msgDetails.quotedMsgInfo.participant;
        } else {
            await sock.sendMessage(chatJid, { text: "Por favor, forneça um número ou responda à mensagem de quem deseja adicionar.\n\n*Exemplo:*\n`/add 55 (22) 99266-7333`\nOu responda a uma mensagem com `/add`." }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatJid, { text: `A tentar adicionar o número \`${targetJid.split('@')[0]}\` ao grupo...` });
        const response = await sock.groupParticipantsUpdate(chatJid, [targetJid], "add");

        const result = response[0];
        if (result.status === '200') {
            await sock.sendMessage(chatJid, { text: `✅ Utilizador adicionado com sucesso!`, mentions: [targetJid] });
        } else if (result.status === '403') {
            await sock.sendMessage(chatJid, { text: `Não foi possível adicionar. O utilizador pode ter configurações de privacidade que o impedem de ser adicionado a grupos.` });
        } else if (result.status === '404') {
            await sock.sendMessage(chatJid, { text: `Não foi possível adicionar. O número não parece ter uma conta de WhatsApp.` });
        } else if (result.status === '409') {
            await sock.sendMessage(chatJid, { text: `Este utilizador já faz parte do grupo.` });
        } else {
            await sock.sendMessage(chatJid, { text: `Ocorreu um erro desconhecido (${result.status}) ao tentar adicionar o utilizador.` });
        }

    } catch (error) {
        console.error("[Add Command] Erro:", error);
        await sendJuliaError(sock, chatJid, msg, error);
    }
}

module.exports = handleAddCommand;


module.exports.commandData = {
    name: "add",
    description: "Adiciona alguém (se possível).",
    category: "admin",
    usage: "/add",
    aliases: []
};
