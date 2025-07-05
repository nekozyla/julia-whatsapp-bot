// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

/**
 * Converte um vídeo para um sticker WebP animado, tentando múltiplos
 * níveis de compressão para garantir que o tamanho final seja menor que 1MB.
 *
 * @param {string} inputPath - Caminho para o vídeo de entrada.
 * @param {string} outputPath - Caminho para salvar o sticker .webp de saída.
 * @returns {Promise<void>} - Resolve se a conversão for bem-sucedida e o arquivo for < 1MB.
 * @throws {Error} - Rejeita se não for possível atingir o tamanho desejado.
 */
async function optimizeAnimatedSticker(inputPath, outputPath) {
    const MAX_SIZE_BYTES = 1024 * 1024; // 1 MB

    // Parâmetros de otimização, do melhor para o pior
    const optimizationSteps = [
        { quality: 75, fps: 20 }, // Ótima qualidade
        { quality: 65, fps: 16 }, // Boa qualidade
        { quality: 50, fps: 14 }, // Qualidade razoável
        { quality: 40, fps: 12 }, // Qualidade mais baixa
        { quality: 30, fps: 10 }  // Último recurso, bem comprimido
    ];

    console.log('[Sticker Optimizer] Iniciando processo de otimização...');

    for (let i = 0; i < optimizationSteps.length; i++) {
        const params = optimizationSteps[i];
        console.log(`[Sticker Optimizer] Tentativa ${i + 1}/${optimizationSteps.length}: Qualidade=${params.quality}, FPS=${params.fps}`);

        // Comando FFmpeg simplificado e focado em WebP
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -y -t 7 ` + // -y para sobrescrever o arquivo de saída
            `-vf "scale=512:512:force_original_aspect_ratio=decrease,fps=${params.fps},pad=512:512:-1:-1:color=black@0" ` +
            `-c:v libwebp -lossless 0 -q:v ${params.quality} -loop 0 -preset default -an "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[FFmpeg Error]:', stderr);
                    return reject(new Error('Falha na execução do FFmpeg.'));
                }
                resolve(stdout);
            });
        });

        const stats = await fsp.stat(outputPath);
        const fileSizeMb = stats.size / MAX_SIZE_BYTES;
        console.log(`[Sticker Optimizer] Tamanho gerado: ${fileSizeMb.toFixed(3)} MB`);

        if (stats.size < MAX_SIZE_BYTES) {
            console.log(`[Sticker Optimizer] Sucesso! O sticker está dentro do limite de tamanho.`);
            return; // Sucesso, finaliza a função
        }
    }

    // Se o loop terminar, significa que nenhuma tentativa funcionou
    throw new Error(`Não foi possível otimizar o sticker para menos de 1 MB.`);
}


async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText, messageType } = msgDetails;

    if (!commandText?.toLowerCase().includes('!sticker')) {
        return false;
    }

    let mediaToProcess = null;
    let isAnimated = false;

    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        mediaToProcess = msg;
        isAnimated = (messageType === 'videoMessage');
    } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedMsgContent = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        const quotedMsgType = getContentType(quotedMsgContent);

        if (quotedMsgType === 'imageMessage' || quotedMsgType === 'videoMessage') {
             mediaToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
             isAnimated = (quotedMsgType === 'videoMessage');
        }
    }

    if (!mediaToProcess) {
        await sock.sendMessage(sender, { text: 'Para usar o `!sticker`, envie o comando na legenda de uma imagem/gif ou responda a um com `!sticker`.' }, { quoted: msg });
        return true;
    }

    console.log(`[Sticker] Usuário ${pushName} solicitou criação de sticker (${isAnimated ? 'Animado' : 'Estático'}).`);

    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.mp4`);
    const outputPath = path.join(tempDir, `${randomId}.webp`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        const buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });

        let stickerBuffer;

        if (isAnimated) {
            await fsp.writeFile(inputPath, buffer);

            // --- LÓGICA DE OTIMIZAÇÃO CHAMADA AQUI ---
            await optimizeAnimatedSticker(inputPath, outputPath);

            stickerBuffer = await fsp.readFile(outputPath);
            await fsp.unlink(inputPath); // Limpa o input temporário
        } else {
            // Lógica para stickers estáticos com Sharp (fundo transparente)
            stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 90 })
                .toBuffer();
        }

        if (!stickerBuffer || stickerBuffer.length === 0) {
            console.error('[Sticker] O buffer da figurinha foi gerado vazio ou nulo.');
            throw new Error('Ocorreu um erro ao processar a imagem e o resultado foi um arquivo vazio.');
        }

        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });

    } catch (err) {
        console.error('[Erro ao gerar figurinha com !sticker]:', err.message);
        await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_Erro: ${err.message}_` }, { quoted: msg });
    } finally {
        // Tenta limpar ambos os arquivos temporários
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }

    return true;
}

module.exports = handleStickerCreationCommand;

