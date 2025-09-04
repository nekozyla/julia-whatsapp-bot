// messageHandlers.js
const { getContentType } = require('@whiskeysockets/baileys');
const { model, startChat } = require('./geminiClient'); 
const { saveSessionHistory, clearSession } = require('./sessionManager');
const { sendJuliaError } = require('./utils');
const settingsManager = require('./groupSettingsManager'); // Importa o gestor de configurações
const { generateSpeech } = require('./speechGenerator'); // Importa o novo gerador de fala

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

    if (commandInfo && commandMap['!' + commandInfo.commandName]) {
        if (commandInfo.cleanedText) {
            await sock.sendMessage(originalMsg.key.remoteJid, { text: commandInfo.cleanedText }, { quoted: originalMsg });
        }
        await commandMap['!' + commandInfo.commandName](sock, originalMsg, { 
            sender: originalMsg.key.remoteJid, 
            command: '!' + commandInfo.commandName,
            isGroup: originalMsg.key.remoteJid.endsWith('@g.us')
        });
    } else {
        const chatJid = originalMsg.key.remoteJid;
        const speechMode = settingsManager.getSetting(chatJid, 'speechMode', 'off');

        if (speechMode === 'on' && responseText) {
            console.log("[Modo Fala] Gerando áudio para a resposta...");
            try {
                const oggBuffer = await generateSpeech(responseText);
                if (oggBuffer) {
                    await sock.sendMessage(chatJid, {
                        audio: oggBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true // Envia como mensagem de voz (Push-to-Talk)
                    }, { quoted: originalMsg });
                } else {
                    console.log("[Modo Fala] Falha na geração de áudio. A enviar como texto.");
                    await sock.sendMessage(chatJid, { text: responseText }, { quoted: originalMsg });
                }
            } catch (error) {
                console.error("[Modo Fala] Erro crítico na geração/envio de áudio:", error);
                await sock.sendMessage(chatJid, { text: responseText }, { quoted: originalMsg });
            }
        } else {
            await sock.sendMessage(chatJid, { text: responseText }, { quoted: originalMsg });
        }
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

