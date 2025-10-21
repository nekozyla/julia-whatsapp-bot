// src/commands/tomatada.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp'); // Necessário para converter stickers WebP
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils/utils.js');

// Link para um GIF de tomate a espirrar, com fundo transparente
const TOMATO_GIF_URL = 'https://media.tenor.com/nl0g0XTwQdQAAAAj/tomato-throw.gif';
let tomatoGifBuffer = null;

/**
 * Descarrega e guarda em cache (memória) o GIF do tomate para não ter de o baixar sempre.
 */
async function loadTomatoGif() {
    if (tomatoGifBuffer) return tomatoGifBuffer;
    try {
        const response = await axios.get(TOMATO_GIF_URL, { responseType: 'arraybuffer' });
        tomatoGifBuffer = Buffer.from(response.data);
        console.log('[Tomatada] GIF do tomate carregado com sucesso.');
        return tomatoGifBuffer;
    } catch (e) {
        console.error("[Tomatada] Erro fatal ao carregar o GIF do tomate:", e.message);
        return null;
    }
}

// Carrega o GIF assim que o bot inicia
loadTomatoGif();

/**
 * Função principal do comando /tomatada
 */
module.exports = async (sock, msg, msgDetails) => {
    const { sender, messageType, quotedMsgInfo } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const usageText = "Para usar, envie ou responda a uma imagem/figurinha com `/tomatada`, ou mencione alguém com `/tomatada @pessoa` para atirar um tomate na foto de perfil dela.";

    if (!tomatoGifBuffer) {
        await sock.sendMessage(sender, { text: "Desculpe, o meu stock de tomates estragou-se. 🍅 Tente novamente mais tarde." }, { quoted: msg });
        return;
    }

    let baseImageBuffer = null;
    let isStickerInput = false;
    let targetMessage = null;

    try {
        // Prioridade 1: Menção
        if (mentionedJids.length > 0) {
            const targetJid = mentionedJids[0];
            await sock.sendMessage(sender, { react: { text: '🎯', key: msg.key } });
            try {
                const pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
                const response = await axios.get(pfpUrl, { responseType: 'arraybuffer' });
                baseImageBuffer = Buffer.from(response.data);
            } catch (pfpError) {
                await sock.sendMessage(sender, { text: `Não consegui encontrar a foto de perfil de @${targetJid.split('@')[0]}. Talvez ela seja privada ou não exista.`, mentions: [targetJid] }, { quoted: msg });
                return;
            }
        }
        // Prioridade 2: Mídia respondida
        else if (quotedMsgInfo) {
            const quotedType = getContentType(quotedMsgInfo);
            if (quotedType === 'imageMessage') {
                targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
            } else if (quotedType === 'stickerMessage') {
                if (quotedMsgInfo.stickerMessage?.isAnimated) {
                    await sock.sendMessage(sender, { text: "Não consigo atirar um tomate numa figurinha animada. Envie uma imagem ou figurinha estática." }, { quoted: msg });
                    return;
                }
                targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
                isStickerInput = true;
            }
        }
        // Prioridade 3: Mídia enviada com o comando
        else if (messageType === 'imageMessage') {
            targetMessage = msg;
        }

        // Se encontrámos uma mídia (mas não uma pfp), faz o download
        if (!baseImageBuffer && targetMessage) {
            baseImageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });
        }

        // Se não houver nenhuma base para a imagem, envia a ajuda
        if (!baseImageBuffer) {
            await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { react: { text: '🍅', key: msg.key } });

        // Se a base for uma figurinha, converte-a para PNG para o ffmpeg
        if (isStickerInput) {
            baseImageBuffer = await sharp(baseImageBuffer).toFormat('png').toBuffer();
        }

        // Define caminhos temporários
        const tempDir = path.join(__dirname, '..', '..', 'temp', 'tomatada');
        await fs.mkdir(tempDir, { recursive: true });
        const randomId = crypto.randomBytes(8).toString('hex');
        const baseImagePath = path.join(tempDir, `${randomId}_base.png`);
        const tomatoGifPath = path.join(tempDir, `${randomId}_tomato.gif`);
        const outputPath = path.join(tempDir, `${randomId}_output.gif`);

        // Salva os ficheiros temporários no disco
        await fs.writeFile(baseImagePath, baseImageBuffer);
        await fs.writeFile(tomatoGifPath, tomatoGifBuffer);

        // Comando FFmpeg para sobrepor o GIF sobre a imagem estática
        const ffmpegCommand = `ffmpeg -i "${baseImagePath}" -i "${tomatoGifPath}" -filter_complex "[0:v]scale=512:512:force_original_aspect_ratio=increase,crop=512:512[base]; [1:v]scale=512:512[overlay]; [base][overlay]overlay=x=0:y=0:shortest=1" -f gif "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Tomatada FFmpeg Error]:', stderr);
                    return reject(new Error('Falha ao processar a tomatada com FFmpeg.'));
                }
                resolve(stdout);
            });
        });

        // Lê o resultado final
        const outputBuffer = await fs.readFile(outputPath);
        
        // Envia como GIF (gifPlayback: true)
        await sock.sendMessage(sender, { 
            video: outputBuffer, 
            gifPlayback: true,
            caption: "TOMATADA! 🍅"
        }, { quoted: msg });

    } catch (error) {
        console.error('[Tomatada] Erro:', error);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sendJuliaError(sock, sender, msg, error);
    } finally {
        // Limpa todos os ficheiros temporários
        const filesToClean = [baseImagePath, tomatoGifPath, outputPath];
        for (const file of filesToClean) {
            if (file) await fs.unlink(file).catch(() => {});
        }
    }
    
    return true;
};
