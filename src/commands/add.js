// src/commands/add.js
const { sendJuliaError } = require('../utils/utils.js');

/**
 * Limpa e formata uma string de número de telefone para o formato JID do WhatsApp.
 * @param {string} numberString - A string do número de telefone (ex: "(22) 99266-7333").
 * @returns {string|null} O JID formatado (ex: "5522992667333@s.whatsapp.net") or null se for inválido.
 */
function sanitizePhoneNumber(numberString) {
    // Remove todos os caracteres que não são dígitos
    let digits = numberString.replace(/\D/g, '');

    // Validação básica para números brasileiros
    if (digits.length < 10) {
        return null;
    }

    // Adiciona o código do Brasil (55) se não estiver presente
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }

    // Verifica o tamanho final (55 + DDD + número)
    if (digits.length < 12 || digits.length > 13) {
        return null;
    }

    return `${digits}@s.whatsapp.net`;
}

async function handleAddCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandText, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatJid);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para conseguir adicionar alguém." }, { quoted: msg });
            return true;
        }
        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return true;
        }

        const numberToParse = commandText.substring('/add'.length).trim();
        if (!numberToParse) {
            await sock.sendMessage(chatJid, { text: "Por favor, forneça um número de telefone para adicionar.\n\n*Exemplo:*\n`/add 55 (22) 99266-7333`" }, { quoted: msg });
            return true;
        }

        const targetJid = sanitizePhoneNumber(numberToParse);

        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: `O número "${numberToParse}" não parece ser um número de telefone válido.` }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(chatJid, { text: `A tentar adicionar o número \`${targetJid.split('@')[0]}\` ao grupo...` });
        const response = await sock.groupParticipantsUpdate(chatJid, [targetJid], "add");

        // Analisa a resposta do WhatsApp para dar um feedback preciso
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

    return true;
}

module.exports = handleAddCommand;
