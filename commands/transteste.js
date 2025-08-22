// commands/transcrever.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { sendJuliaError } = require('../utils');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

/**
 * Lógica principal que baixa e transcreve um áudio usando o Whisper.
 */
async function transcribeAudio(sock, msgToTranscribe, originalMsgToQuote) {
    const chatJid = originalMsgToQuote.key.remoteJid;
    const tempDir = path.join(__dirname, '..', 'temp_audio');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.ogg`);

    try {
        await sock.sendMessage(chatJid, { react: { text: '✍️', key: originalMsgToQuote.key } });

        const audioBuffer = await downloadMediaMessage(msgToTranscribe, 'buffer', {}, { logger: undefined });
        
        if (!audioBuffer) {
            throw new Error("Não foi possível baixar o áudio. Pode ter sido apagado.");
        }

        await fsp.writeFile(inputPath, audioBuffer);

        // Comando para executar o Whisper. Usamos o modelo 'tiny' por ser o mais rápido.
        // O Whisper deteta o idioma automaticamente, mas especificamos para garantir.
        const whisperCommand = `whisper "${inputPath}" --model tiny --language Portuguese --output_format txt --verbose False`;

        console.log(`[Transcrever] A executar comando do Whisper para áudio de ${chatJid}`);
        
        const transcription = await new Promise((resolve, reject) => {
            exec(whisperCommand, { cwd: tempDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Whisper Error]:', stderr);
                    return reject(new Error('Falha ao processar o áudio com o Whisper.'));
                }
                // O stdout contém o texto transcrito
                resolve(stdout.trim());
            });
        });

        console.log(`[Transcrever] Transcrição recebida do Whisper.`);

        const replyText = `*Transcrição da Julia:*\n\n> ${transcription || "(Não foi possível extrair texto do áudio.)"}`;
        await sock.sendMessage(chatJid, { text: replyText }, { quoted: originalMsgToQuote });

    } catch (error) {
        console.error("[Transcrever] Erro ao transcrever áudio:", error);
        await sendJuliaError(sock, chatJid, originalMsgToQuote, error);
    } finally {
        // Limpa os ficheiros temporários
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(`${inputPath}.txt`).catch(() => {});
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

    console.log(`[Transcrever] Utilizador em ${sender} solicitou a transcrição de um áudio via comando.`);
    
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

