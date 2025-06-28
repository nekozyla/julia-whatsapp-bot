// commands/transcrever.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { model } = require('../geminiClient');
const { sendJuliaError, convertAudioToWav } = require('../utils');

/**
 * Lógica principal que baixa, converte e transcreve um áudio.
 * @param {object} sock - A instância do socket Baileys.
 * @param {object} msgToTranscribe - Um objeto de mensagem válido que contém o áudio.
 * @param {object} originalMsgToQuote - A mensagem original do usuário para ser usada no reply.
 */
async function transcribeAudio(sock, msgToTranscribe, originalMsgToQuote) {
    const chatJid = msgToTranscribe.key.remoteJid;

    try {
        await sock.sendPresenceUpdate('composing', chatJid);

        const audioBuffer = await downloadMediaMessage(msgToTranscribe, 'buffer', {}, { logger: undefined });
        const wavBuffer = await convertAudioToWav(audioBuffer);
        const audioBase64 = wavBuffer.toString('base64');
        
        const promptParts = [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }, { text: "Transcreva este áudio na íntegra, sem adicionar nenhum texto ou comentário extra." }];

        console.log(`[Transcrever] Enviando áudio de ${chatJid} para o Gemini...`);
        const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }] });
        const transcription = result.response.text();
        console.log(`[Transcrever] Transcrição recebida.`);

        const replyText = `*Transcrição da Julia:*\n\n> ${transcription || "(Não foi possível extrair texto do áudio.)"}`;
        await sock.sendMessage(chatJid, { text: replyText }, { quoted: originalMsgToQuote });

    } catch (error) {
        console.error("[Transcrever] Erro ao transcrever áudio:", error);
        await sendJuliaError(sock, chatJid, originalMsgToQuote, error);
    }
}

/**
 * Handler para o comando !transcrever. Ele prepara os dados e chama a função principal.
 */
async function handleTranscriptionCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;

    // CORREÇÃO: Lógica mais robusta para encontrar as informações da mensagem respondida (contextInfo)
    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const quotedMsgInfo = contextInfo?.quotedMessage;

    // O comando só funciona se for um reply a uma mensagem de áudio
    if (!quotedMsgInfo || !quotedMsgInfo.audioMessage) {
        if (commandText.toLowerCase().trim() === '!transcrever') {
            await sock.sendMessage(sender, { text: "Para transcrever um áudio, por favor, responda à mensagem de áudio com o comando `!transcrever`." }, { quoted: msg });
        }
        return true;
    }
    
    // Verificação de segurança para garantir que contextInfo existe antes de usá-lo
    if (!contextInfo.stanzaId || !contextInfo.participant) {
        console.error("[Transcrever] Não foi possível obter o ID ou o participante da mensagem citada.");
        await sock.sendMessage(sender, { text: "Não consegui identificar a mensagem de áudio corretamente. Tente responder novamente." }, { quoted: msg });
        return true;
    }

    console.log(`[Transcrever] Usuário em ${sender} solicitou a transcrição de um áudio via comando.`);
    
    // REMOVIDA A MENSAGEM "Ok, ouvindo o áudio..."

    // Reconstrói um objeto de mensagem válido para a mensagem citada
    const messageToTranscribe = {
        key: {
            remoteJid: sender,
            id: contextInfo.stanzaId,
            fromMe: contextInfo.participant === (sock.user.id.split(':')[0] + '@s.whatsapp.net'),
            participant: contextInfo.participant
        },
        message: quotedMsgInfo
    };

    // Chama a função principal de transcrição
    await transcribeAudio(sock, messageToTranscribe, msg);
    
    return true;
}

// Exportamos as duas funções, mas o main.js só chamará a 'handleTranscriptionCommand'
module.exports = handleTranscriptionCommand;
module.exports.transcribeAudio = transcribeAudio;
