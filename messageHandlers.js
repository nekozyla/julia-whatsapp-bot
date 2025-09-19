// messageHandlers.js (Sem speechGenerator)
const { getContentType } = require('@whiskeysockets/baileys');
const { model, startChat } = require('./geminiClient'); 
const { saveSessionHistory, clearSession } = require('./sessionManager');
const { sendJuliaError } = require('./utils');
const settingsManager = require('./groupSettingsManager');

function parseCommandFromResponse(responseText) {
    const commandRegex = /\[DO_COMMAND\](.*?)\[\/DO_COMMAND\]/;
    const match = responseText.match(commandRegex);
    if (match && match[1]) {
        return {
            commandName: match[1].trim().toLowerCase(),
            cleanedText: responseText.replace(commandRegex, '').trim()
        };
    }
    return null;
}

async function processAIResponse(sock, originalMsg, responseText, chatSession, commandMap) {
    const commandInfo = parseCommandFromResponse(responseText);
    const chatJid = originalMsg.key.remoteJid;

    if (commandInfo && commandMap['!' + commandInfo.commandName]) {
        if (commandInfo.cleanedText) {
            await sock.sendMessage(chatJid, { text: commandInfo.cleanedText }, { quoted: originalMsg });
        }
        await commandMap['!' + commandInfo.commandName](sock, originalMsg, { 
            sender: chatJid, 
            command: '!' + commandInfo.commandName,
            isGroup: chatJid.endsWith('@g.us')
        });
    } else {
        // Lógica de speechGenerator removida. Envia sempre como texto.
        await sock.sendMessage(chatJid, { text: responseText }, { quoted: originalMsg });
    }
}

async function handleAnyMessage(sock, msg, chatSession, msgDetails, sessionManager, commandMap) {
    const text = msgDetails.currentMessageText || "";
    const senderJid = msgDetails.sender;

    if (text.toLowerCase() === '/limpar' || text.toLowerCase() === '!limpar') {
        await clearSession(senderJid);
        await sock.sendMessage(senderJid, { text: "✨ Histórico de conversa limpo! Podemos começar de novo." }, { quoted: msg }); 
        return;
    }
    
    let contextForAI = "[CONTEXTO: TEXTO]";
    if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        contextForAI = "[CONTEXTO: RESPOSTA A OUTRA MENSAGEM]";
    } else if (msgDetails.messageType === 'imageMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UMA IMAGEM]";
    } else if (msgDetails.messageType === 'videoMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UM VÍDEO]";
    } else if (msgDetails.messageType === 'stickerMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UMA FIGURINHA]";
    }

    try {
        const userMessageForGemini = `${contextForAI} (${msgDetails.pushName}): ${text}`;
        const result = await chatSession.sendMessage(userMessageForGemini);
        const responseText = result.response.text();
        
        await processAIResponse(sock, msg, responseText, chatSession, commandMap);
        
        const currentHistory = await chatSession.getHistory();
        await saveSessionHistory(senderJid, currentHistory);

    } catch (error) {
        await sendJuliaError(sock, senderJid, msg, error);
    }
}

module.exports = {
    handleAnyMessage
};
