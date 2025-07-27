// commands/transcrever.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { model } = require('../geminiClient');
const { sendJuliaError, convertAudioToWav } = require('../utils');

/**
 * Lógica principal que baixa, converte e transcreve um áudio.
 */
async function transcribeAudio(sock, msgToTranscribe, originalMsgToQuote) {
    const chatJid = originalMsgToQuote.key.remoteJid;

    try {
        await sock.sendPresenceUpdate('composing', chatJid);

        const audioBuffer = await downloadMediaMessage(msgToTranscribe, 'buffer', {}, { logger: undefined });
        
        // --- CORREÇÃO DE SEGURANÇA 1 ---
        // Verifica se o download do áudio funcionou
        if (!audioBuffer) {
            throw new Error("Não foi possível baixar o áudio. Pode ter sido apagado.");
        }

        const wavBuffer = await convertAudioToWav(audioBuffer);

        // --- CORREÇÃO DE SEGURANÇA 2 ---
        // Verifica se a conversão para .wav funcionou
        if (!wavBuffer || wavBuffer.length === 0) {
            throw new Error("A conversão do áudio resultou em um arquivo vazio. O formato pode não ser suportado.");
        }

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
 * Handler para o comando !transcrever.
 */
async function handleTranscriptionCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const quotedMsgInfo = contextInfo?.quotedMessage;

    if (!quotedMsgInfo || !quotedMsgInfo.audioMessage) {
        if ((commandText || '').toLowerCase().trim() === '!transcrever') {
            await sock.sendMessage(sender, { text: "Para transcrever um áudio, por favor, responda à mensagem de áudio com o comando `!transcrever`." }, { quoted: msg });
        }
        return true;
    }
    
    if (!contextInfo.stanzaId || !contextInfo.participant) {
        await sock.sendMessage(sender, { text: "Não consegui identificar a mensagem de áudio corretamente. Tente responder novamente." }, { quoted: msg });
        return true;
    }

    console.log(`[Transcrever] Usuário em ${sender} solicitou a transcrição de um áudio via comando.`);
    
    const messageToTranscribe = {
        key: {
            remoteJid: sender,
            id: contextInfo.stanzaId,
            fromMe: contextInfo.participant === (sock.user.id.split(':')[0] + '@s.whatsapp.net'),
            participant: contextInfo.participant
        },
        message: quotedMsgInfo
    };

    await transcribeAudio(sock, messageToTranscribe, msg);
    
    return true;
}

module.exports = handleTranscriptionCommand;
module.exports.transcribeAudio = transcribeAudio;
