
const { downloadContentFromMessage, downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec, execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const crypto = require('crypto');
const { createHash } = require('crypto');
const { Image } = require('node-webpmux');
const { getTempDir } = require('../utils/utils');
const config = require('../../config.js');

const userPresetManager = require('../managers/userPresetManager.js');
const stickerPresetCommand = require('./stickerpreset.js');



const videoQueue = [];
let isProcessing = false;
let currentlyProcessingJid = null;
const recentMediaHashes = new Map();
const DUPLICATE_TTL_MS = 2 * 60 * 1000;
const BOT_NAME = config.BOT_NAME || 'Bot';

function scheduleMessageDelete(sock, chatJid, messageKey, delayMs = 3000) {
    if (!chatJid || !messageKey) return;

    setTimeout(async () => {
        try {
            await sock.sendMessage(chatJid, { delete: messageKey });
        } catch (err) {
            console.warn('[Sticker] Falha ao apagar mensagem temporária:', err?.message || err);
        }
    }, delayMs);
}

function resolvePrivateRecipientJids(msg, commandSenderJid) {
    const candidates = [];
    const participantJid = msg?.key?.participant;

    if (participantJid) candidates.push(participantJid);
    if (commandSenderJid) candidates.push(commandSenderJid);

    const base = (participantJid || commandSenderJid || '').split('@')[0];
    if (base) {
        candidates.push(`${base}@s.whatsapp.net`);
        candidates.push(`${base}@lid`);
    }

    return [...new Set(candidates.filter(Boolean))];
}

async function sendStickerWithOptionalAutoDelete(sock, destinationJids, stickerBuffer, quoteMsg, shouldAutoDelete, sourceMessageKey, sourceDeletePlan) {
    const targets = Array.isArray(destinationJids) ? destinationJids : [destinationJids];
    let sentStickerMsg = null;
    let deliveredJid = null;
    let lastError = null;

    for (const target of targets) {
        try {
            sentStickerMsg = await sock.sendMessage(target, { sticker: stickerBuffer }, { quoted: quoteMsg });
            deliveredJid = target;
            break;
        } catch (err) {
            lastError = err;
        }
    }

    if (!sentStickerMsg || !deliveredJid) {
        throw lastError || new Error('Falha ao enviar figurinha.');
    }

    if (sourceDeletePlan?.chatJid && sourceDeletePlan?.key?.id) {
        try {
            await sock.sendMessage(sourceDeletePlan.chatJid, { delete: sourceDeletePlan.key });
        } catch (err) {
            console.warn('[Sticker] Falha ao apagar mídia original no modo privado:', err?.message || err);
        }
    }

    if (!shouldAutoDelete) {
        return sentStickerMsg;
    }

    if (sentStickerMsg?.key) {
        scheduleMessageDelete(sock, deliveredJid, sentStickerMsg.key, 3000);
    }

    if (sourceMessageKey?.id) {
        scheduleMessageDelete(sock, sourceDeletePlan?.chatJid || deliveredJid, sourceMessageKey, 3000);
    }

    return sentStickerMsg;
}

async function downloadMediaBufferWithFallback(sock, mediaMessage, forceRobustDownload = false) {
    if (forceRobustDownload) {
        try {
            const robustBuffer = await downloadMediaMessage(
                mediaMessage,
                'buffer',
                {},
                {
                    logger: undefined,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (robustBuffer?.length) {
                return robustBuffer;
            }
        } catch (err) {
            console.warn('[Sticker] downloadMediaMessage falhou, usando fallback:', err?.message || err);
        }
    }

    const mediaType = getContentType(mediaMessage.message);
    const stream = await downloadContentFromMessage(mediaMessage.message[mediaType], mediaType.replace('Message', ''));
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function getOptionValue(args, key) {
    const rx = new RegExp(`${key}:(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'i');
    const match = args.match(rx);
    return match ? (match[1] || match[2] || match[3] || '').trim() : null;
}

function parseIntegerOption(value, min, max, fallback) {
    if (value == null) return fallback;
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function parseFloatOption(value, min, max, fallback) {
    if (value == null) return fallback;
    const n = parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function parseColorToken(value) {
    if (!value) return null;
    const named = {
        branca: '#ffffff',
        branco: '#ffffff',
        preta: '#000000',
        preto: '#000000',
        vermelha: '#ff3b30',
        vermelho: '#ff3b30',
        azul: '#007aff',
        verde: '#34c759',
        amarela: '#ffcc00',
        amarelo: '#ffcc00'
    };

    const low = value.toLowerCase();
    if (named[low]) return named[low];
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    return null;
}

function removeBackgroundLocal(inputBuffer) {
    return new Promise(async (resolve, reject) => {
        const random = crypto.randomBytes(6).toString('hex');
        const tempRoot = await getTempDir('removebg');
        const inputPath = path.join(tempRoot, `${random}.jpg`);
        const outputPath = path.join(tempRoot, `${random}.png`);
        const scriptPath = path.join(__dirname, '..', 'scripts', 'remove_bg.py');

        try {
            await fsp.writeFile(inputPath, inputBuffer);
            exec(`python "${scriptPath}" "${inputPath}" "${outputPath}"`, async (error) => {
                try {
                    if (error) return reject(error);
                    const out = await fsp.readFile(outputPath);
                    resolve(out);
                } catch (ioErr) {
                    reject(ioErr);
                } finally {
                    await fsp.unlink(inputPath).catch(() => {});
                    await fsp.unlink(outputPath).catch(() => {});
                }
            });
        } catch (err) {
            await fsp.unlink(inputPath).catch(() => {});
            await fsp.unlink(outputPath).catch(() => {});
            reject(err);
        }
    });
}

function cleanupDuplicateCache() {
    const now = Date.now();
    for (const [k, ts] of recentMediaHashes.entries()) {
        if ((now - ts) > DUPLICATE_TTL_MS) recentMediaHashes.delete(k);
    }
}

function registerMediaHash(buffer) {
    cleanupDuplicateCache();
    const hash = createHash('sha256').update(buffer).digest('hex');
    const existing = recentMediaHashes.get(hash);
    if (existing && (Date.now() - existing) <= DUPLICATE_TTL_MS) return true;
    recentMediaHashes.set(hash, Date.now());
    return false;
}


async function processQueue() {
    if (videoQueue.length === 0) {
        isProcessing = false;
        currentlyProcessingJid = null;
        console.log('[Sticker Queue] Fila vazia. Processador a dormir.');
        return;
    }

    isProcessing = true;

    const job = videoQueue.shift();
    const {
        sock,
        msg,
        msgDetails,
        mediaToProcess,
        downloadedFilePath,
        isDownloadedFromUrl,
        options,
        msgToQuote,
        shouldAutoDelete,
        sourceMessageKey,
        isViewOnceMedia,
        destinationJids,
        sourceDeleteKey,
        shouldSendToPrivate
    } = job;
    const { sender, commandSenderJid } = msgDetails;

    const deliveryTargets = destinationJids || [sender];
    const shouldQuote = deliveryTargets.length === 1 && deliveryTargets[0] === sender;

    currentlyProcessingJid = commandSenderJid;

    if (shouldQuote) {
        await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });
    }

    const progressMsg = shouldQuote
        ? await sock.sendMessage(sender, { text: '┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › Iniciando...\n┃\n┗━━━━━━━━━━━━━━' }, { quoted: msgToQuote || msg })
        : null;

    const updateProgress = async (status) => {
        if (!progressMsg) return;
        try {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › ${status}\n┃\n┗━━━━━━━━━━━━━━`, edit: progressMsg.key });
        } catch (e) { }
    };

    const tempDirStickers = await getTempDir('stickers');
    const randomId = crypto.randomBytes(8).toString('hex');


    const inputPath = isDownloadedFromUrl ? downloadedFilePath : path.join(tempDirStickers, `${randomId}_in`);

    const outputPath = path.join(tempDirStickers, `${randomId}_out.webp`);

    try {
        if (!isDownloadedFromUrl) {
            try {
                await updateProgress('📥 Baixando a mídia...');
                const mediaBuffer = await downloadMediaBufferWithFallback(sock, mediaToProcess, isViewOnceMedia);

                if (registerMediaHash(mediaBuffer)) {
                    throw new Error('⚠️ Essa mídia já foi convertida recentemente. Aguarde um pouco para repetir.');
                }

                await fsp.writeFile(inputPath, mediaBuffer);

            } catch (downloadErr) {
                console.error('[Sticker Queue] Erro no downloadContentFromMessage:', downloadErr);
                if (downloadErr?.message?.includes('já foi convertida recentemente')) {
                    throw downloadErr;
                }
                throw new Error("Falha ao baixar a mídia. Tente reenviar a imagem/vídeo.");
            }
        } else {
            const mediaBuffer = await fsp.readFile(inputPath);
            if (registerMediaHash(mediaBuffer)) {
                throw new Error('⚠️ Essa mídia já foi convertida recentemente. Aguarde um pouco para repetir.');
            }
        }


        await optimizeAnimatedSticker(inputPath, outputPath, options, updateProgress);

        await updateProgress('📝 Adicionando pacote e exif...');
        let finalBuffer = await fsp.readFile(outputPath);
        finalBuffer = await addExif(finalBuffer, options);

        await updateProgress('✅ Saindo do forno!');
        if (shouldQuote) {
            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        }
        const sourceDeletePlan = shouldSendToPrivate && sourceDeleteKey?.id ? { chatJid: sender, key: sourceDeleteKey } : null;
        
        if (!shouldSendToPrivate && msgDetails.isGroup) {
            const farmManager = require('../managers/stickerFarmManager.js');
            await farmManager.addSticker(sender, commandSenderJid, finalBuffer);
        }

        await sendStickerWithOptionalAutoDelete(sock, deliveryTargets, finalBuffer, shouldQuote ? (msgToQuote || msg) : undefined, shouldAutoDelete, sourceMessageKey, sourceDeletePlan);
        if (shouldSendToPrivate && options.shouldReplyConfirmation && msgDetails.isGroup) {
            await sock.sendMessage(sender, { text: '✅ Figurinha enviada no privado.' }, { quoted: msg });
        }

    } catch (err) {
        console.error('[Sticker Queue] Erro ao processar item da fila:', err);
        if (shouldQuote) {
            await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        }
        if (updateProgress) await updateProgress(`❌ ${err.message}`);
    } finally {

        await fsp.unlink(inputPath).catch(() => { });
        await fsp.unlink(inputPath + "_fixed.mp4").catch(() => { });
        await fsp.unlink(outputPath).catch(() => { });

        if (isDownloadedFromUrl && downloadedFilePath) {
            await fsp.unlink(downloadedFilePath).catch(() => { });
        }

        currentlyProcessingJid = null;
        processQueue();
    }
}



async function addExif(buffer, options) {
    const stickerPackId = crypto.randomBytes(16).toString('hex');
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': options.pack || '',
        'sticker-pack-publisher': options.author || '',
        'emojis': options.categories || [],
    };

    if (options.description) {
        json['sticker-description'] = options.description;
    }

    const jsonStr = JSON.stringify(json);
    const jsonBuffer = Buffer.from(jsonStr, 'utf-8');
    const jsonLen = jsonBuffer.length;

    // Constrói o buffer EXIF manualmente (formato TIFF little-endian)
    const exif = Buffer.alloc(22 + jsonLen);
    let offset = 0;
    exif.write('II', offset, 2, 'ascii'); offset += 2;           // Byte order
    exif.writeUInt16LE(0x002A, offset); offset += 2;              // TIFF magic
    exif.writeUInt32LE(0x00000008, offset); offset += 4;          // IFD offset
    exif.writeUInt16LE(0x0001, offset); offset += 2;              // entry count = 1
    // IFD entry: tag=0x5741, type=0x0007 (UNDEFINED), count=jsonLen, valueOffset=22
    exif.writeUInt16LE(0x5741, offset); offset += 2;              // tag (WA sticker metadata)
    exif.writeUInt16LE(0x0007, offset); offset += 2;              // type UNDEFINED
    exif.writeUInt32LE(jsonLen, offset); offset += 4;             // count = tamanho do JSON
    exif.writeUInt32LE(0x00000016, offset); offset += 4;          // value offset = 22
    jsonBuffer.copy(exif, offset);

    const image = new Image();
    await image.load(buffer);
    image.exif = exif;

    // Correção agressiva: Forçar os quadros de vídeo transparente a limparem o fundo antes de se desenharem
    // Isso conserta o temido bug do Android no WhatsApp de não limpar o rastro do GIF/WEBP
    if (image.hasAnim && image.anim && image.anim.frames) {
        for (const frame of image.anim.frames) {
            frame.blend = false;
            frame.dispose = true;
        }
    }

    return await image.save(null);
}


async function optimizeAnimatedSticker(inputPath, outputPath, options, updateProgress) {
    const MAX_SIZE_BYTES = 1000 * 1000;
    const maxDuration = parseFloatOption(options?.videoDuration, 1, 10, 10);
    const startAt = parseFloatOption(options?.videoStart, 0, 120, 0);
    const requestedFps = null;
    const requestedQuality = null;

    // Steps ordenados do melhor (maior qualidade) ao pior — índice menor = melhor
    const optimizationSteps = [
        { quality: requestedQuality ?? 75, fps: requestedFps ?? 30 },
        { quality: Math.max(20, (requestedQuality ?? 60) - 5), fps: requestedFps ?? 30 },
        { quality: Math.max(20, (requestedQuality ?? 50) - 8), fps: requestedFps ?? 24 },
        { quality: Math.max(20, (requestedQuality ?? 40) - 10), fps: requestedFps ?? 24 },
        { quality: Math.max(20, (requestedQuality ?? 30) - 12), fps: requestedFps ?? 24 },
        { quality: 20, fps: requestedFps ?? 24 },
        { quality: 20, fps: Math.min(requestedFps ?? 15, 15) }
    ];

    const fixedInputPath = inputPath + "_fixed.mp4";

    // ── Fast path para vídeos leves ──
    let isFastPathEligible = false;
    try {
        const inputStats = await fsp.stat(inputPath);
        if (inputStats.size < 250000 && options.effect === 'none' && options.format === 'original') {
            isFastPathEligible = true;
        }
    } catch (e) { }

    if (isFastPathEligible) {
        if (updateProgress) await updateProgress('🚀 Vídeo leve detectado! Tentando atalho rápido limitando proporção...');
        const fastFilter = "scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba";
        const fastFfmpegCommand = `ffmpeg -y -ss ${startAt} -i "${inputPath}" -t ${maxDuration} -vf "${fastFilter}" -c:v libwebp -lossless 0 -compression_level 4 -q:v ${requestedQuality ?? 50} -loop 0 -preset default -an -fps_mode passthrough "${outputPath}"`;

        try {
            await new Promise((resolve, reject) => {
                exec(fastFfmpegCommand, (error) => {
                    if (error) return reject(error);
                    resolve();
                });
            });
            const outStats = await fsp.stat(outputPath);
            if (outStats.size < MAX_SIZE_BYTES) {
                return;
            }
        } catch (e) {
            console.warn("[Sticker] Atalho rápido falhou, iniciando otimização...");
        }
    }

    // ── Sanitizar vídeo (Preservando Transparência) ──
    if (updateProgress) await updateProgress('🎬 Sanitizando formato do vídeo...');
    
    // Vamos usar cópia ou formato que não perca alpha se não for necessário. Na verdade, para
    // manter tudo com alpha sem usar arquivos intermediários gigantes, pularemos a recodificação opaca
    // e setaremos o fixedInputPath para o inputPath, lendo diretamente dele nos steps com -ss e -t.
    const directInput = inputPath;

    // ── Montar filtro base ──
    const format = options?.format;
    let baseFilter;

    if (format === 'stretch') {
        baseFilter = "scale=512:512:flags=lanczos";
    } else if (format === 'square') {
        baseFilter = "crop='min(iw\\,ih)':'min(iw\\,ih)',scale=512:512:flags=lanczos";
    } else {
        baseFilter = "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0";
    }

    if (options.effect === 'boom') {
        baseFilter += ",eq=contrast=2.0:saturation=4.0:brightness=0.1,unsharp=7:7:2.5:7:7:0.0";
    } else if (options.effect === 'reverse') {
        baseFilter += ",reverse";
    }

    // ── Otimização paralela com early-exit ──
    if (updateProgress) await updateProgress('⚡ Otimizando em paralelo...');

    const tempDirStickers = path.dirname(outputPath);
    const baseId = path.basename(outputPath, '.webp');

    const result = await new Promise((resolveMain) => {
        const totalSteps = optimizationSteps.length;
        const results = new Array(totalSteps).fill(null); // null = pendente
        const childProcesses = [];
        let settled = false;
        let completedCount = 0;

        // Tenta decidir: checa prefixo contíguo resolvido a partir do index 0
        function tryDecide() {
            for (let i = 0; i < totalSteps; i++) {
                if (results[i] === null) return; // Slot pendente — não pode decidir ainda
                if (results[i].valid) {
                    // Encontrou o melhor válido no prefixo contíguo
                    settle(results[i]);
                    return;
                }
                // results[i] é resolvido mas inválido (grande demais ou erro) — continua
            }
            // Todos resolvidos, nenhum válido
            settle(null);
        }

        function settle(best) {
            if (settled) return;
            settled = true;
            // Mata processos restantes
            childProcesses.forEach(cp => { try { cp.kill('SIGKILL'); } catch (e) {} });
            resolveMain(best);
        }

        optimizationSteps.forEach((params, index) => {
            const attemptOutput = path.join(tempDirStickers, `${baseId}_attempt${index}.webp`);

            const videoFilter = `${baseFilter},fps=${params.fps},format=rgba`;

            const ffmpegCommand = `ffmpeg -ss ${startAt} -i "${directInput}" -t ${maxDuration} -y ` +
                `-vf "${videoFilter}" ` +
                `-c:v libwebp -lossless 0 -compression_level 6 -q:v ${params.quality} -loop 0 -preset default -an "${attemptOutput}"`;

            const child = exec(ffmpegCommand, async (error) => {
                if (settled) return;

                let entry = { index, valid: false, path: attemptOutput, quality: params.quality, fps: params.fps, size: 0 };

                if (!error) {
                    try {
                        const stats = await fsp.stat(attemptOutput);
                        entry.size = stats.size;
                        entry.valid = stats.size < MAX_SIZE_BYTES;
                        console.log(`[Sticker] Paralelo #${index + 1} (${params.quality}q, ${params.fps}fps): ${(stats.size / 1024).toFixed(2)} KB ${entry.valid ? '✅' : '❌'}`);
                    } catch (e) { }
                }

                results[index] = entry;
                completedCount++;
                tryDecide();
            });

            childProcesses.push(child);
        });
    });

    // ── Limpar arquivos temporários das tentativas ──
    const cleanupFiles = optimizationSteps.map((_, index) => {
        const attemptPath = path.join(tempDirStickers, `${baseId}_attempt${index}.webp`);
        if (result && result.path === attemptPath) return Promise.resolve(); // Não apagar o escolhido
        return fsp.unlink(attemptPath).catch(() => {});
    });

    if (result) {
        await fsp.rename(result.path, outputPath);
        console.log(`[Sticker] ✅ Melhor resultado: #${result.index + 1} (${result.quality}q, ${result.fps}fps, ${(result.size / 1024).toFixed(2)} KB)`);
        await Promise.all(cleanupFiles);
        return;
    }

    // Nenhum coube
    await Promise.all(cleanupFiles);
    throw new Error("O vídeo é muito complexo para virar sticker (mesmo com qualidade baixa).");
}


async function handleStickerCommand(sock, msg, msgDetails) {
    const { sender, commandText, messageType, quotedMsgInfo, commandSenderJid, isGroup } = msgDetails;
    console.log(`[Sticker] Comando iniciado por ${sender} (${commandSenderJid})`);

    let msgToQuote = msg;
    if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        msgToQuote = {
            key: {
                remoteJid: msg.key.remoteJid,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant
            },
            message: msg.message.extendedTextMessage.contextInfo.quotedMessage
        };
    }

    let mediaToProcess = null;
    let isDownloadedFromUrl = false;
    let downloadedFilePath = '';

    let isViewOnce = false;
    let sourceMessageKey = null;
    let actualMessageType = messageType;
    let actualMsg = msg;
    let actualQuotedMsgInfo = quotedMsgInfo;
    let actualQuotedMsgType = quotedMsgInfo ? getContentType(quotedMsgInfo) : null;

    const wrapperTypes = new Set(['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);
    const viewOnceTypes = new Set(['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);

    const unwrapWrappedMessage = (messageObj, initialType) => {
        let workingMessage = messageObj;
        let workingType = initialType || getContentType(workingMessage);
        let foundViewOnce = false;

        while (workingType && wrapperTypes.has(workingType)) {
            if (viewOnceTypes.has(workingType)) {
                foundViewOnce = true;
            }

            const nested = workingMessage?.[workingType]?.message;
            if (!nested) break;

            workingMessage = nested;
            workingType = getContentType(workingMessage);
        }

        return { workingMessage, workingType, foundViewOnce };
    };

    const unwrappedMain = unwrapWrappedMessage(msg.message, messageType);
    actualMessageType = unwrappedMain.workingType;
    actualMsg = { ...msg, message: unwrappedMain.workingMessage };
    if (unwrappedMain.foundViewOnce) {
        isViewOnce = true;
        sourceMessageKey = msg.key;
    }

    if (quotedMsgInfo) {
        const unwrappedQuoted = unwrapWrappedMessage(quotedMsgInfo, actualQuotedMsgType);
        actualQuotedMsgInfo = unwrappedQuoted.workingMessage;
        actualQuotedMsgType = unwrappedQuoted.workingType;
        if (unwrappedQuoted.foundViewOnce) {
            isViewOnce = true;
            sourceMessageKey = sourceMessageKey || msgToQuote?.key || null;
        }
    }

    // Check internal viewOnce flags on the media payloads directly
    if (actualMsg.message?.imageMessage?.viewOnce || actualMsg.message?.videoMessage?.viewOnce) {
        isViewOnce = true;
        sourceMessageKey = sourceMessageKey || msg.key;
    }
    if (actualQuotedMsgInfo?.imageMessage?.viewOnce || actualQuotedMsgInfo?.videoMessage?.viewOnce) {
        isViewOnce = true;
        sourceMessageKey = sourceMessageKey || msgToQuote?.key || null;
    }

    const isMediaMessage = (type, msgData) => {
        if (type === 'imageMessage' || type === 'videoMessage') return true;
        if (type === 'documentMessage') {
            const mimetype = msgData?.[type]?.mimetype || '';
            return mimetype.startsWith('image/') || mimetype.startsWith('video/');
        }
        return false;
    };

    if (isMediaMessage(actualMessageType, actualMsg.message)) {
        mediaToProcess = actualMsg;
    } else if (actualQuotedMsgInfo) {
        if (isMediaMessage(actualQuotedMsgType, actualQuotedMsgInfo)) {
            mediaToProcess = { key: msgToQuote?.key, message: actualQuotedMsgInfo };
        }
    }

    const commandToken = ((commandText || '').trim().split(/\s+/)[0] || '').toLowerCase();
    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    const savedPreset = userPresetManager.getPreset(sender, commandSenderJid);
    const presetBridgeMatch = argsString.match(/^preset(?:\s+(.*))?$/i);
    if (presetBridgeMatch) {
        const presetArgs = (presetBridgeMatch[1] || '').trim();
        const bridgedCommandText = presetArgs ? `/stickerpreset ${presetArgs}` : '/stickerpreset';
        await stickerPresetCommand(sock, msg, {
            ...msgDetails,
            command: '/stickerpreset',
            commandText: bridgedCommandText
        });
        return true;
    }

    const argsLower = argsString.toLowerCase();
    let shouldSendToPrivate = /(^|\s)pv(\s|$)/i.test(argsString);
    let shouldReplyConfirmation = /(^|\s)reply(\s|$)/i.test(argsString);
    let shouldAnonymous = /(^|\s)anon(\s|$)/i.test(argsString);

    if (!shouldSendToPrivate && savedPreset?.sendToPrivate === true) shouldSendToPrivate = true;
    if (!shouldReplyConfirmation && savedPreset?.replyConfirmation === true) shouldReplyConfirmation = true;
    if (!shouldAnonymous && savedPreset?.anonymous === true) shouldAnonymous = true;

    if (/(^|\s)(nopv|grupo)(\s|$)/i.test(argsString)) shouldSendToPrivate = false;
    if (/(^|\s)noreply(\s|$)/i.test(argsString)) shouldReplyConfirmation = false;
    if (/(^|\s)noanon(\s|$)/i.test(argsString)) shouldAnonymous = false;

    const destinationJids = shouldSendToPrivate ? resolvePrivateRecipientJids(msg, commandSenderJid) : [sender];

    if (!mediaToProcess && !isDownloadedFromUrl && /^(fila|queue)$/i.test(argsString.trim())) {
        const userJobsAhead = videoQueue.filter(job => job.commandSenderJid === commandSenderJid).length;
        const isProcessingOwn = isProcessing && currentlyProcessingJid === commandSenderJid;
        const status = isProcessingOwn
            ? 'Você está sendo processado agora.'
            : userJobsAhead > 0
                ? `Você tem ${userJobsAhead} item(ns) na fila.`
                : 'Você não tem itens na fila.';
        await sock.sendMessage(sender, { text: `🎞️ *Fila de Sticker*\n- Em processamento: ${isProcessing ? 'sim' : 'não'}\n- Itens aguardando: ${videoQueue.length}\n- Seu status: ${status}` }, { quoted: msg });
        return true;
    }

    if (!mediaToProcess) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const urlMatch = argsString.match(urlRegex);
        const url = urlMatch ? urlMatch[0] : null;

        if (url) {
            try {
                await sock.sendMessage(sender, { react: { text: '🔗', key: msg.key } });
                const tempDir = await getTempDir('downloads');
                const randomId = crypto.randomBytes(8).toString('hex');
                const tempOutputPath = path.join(tempDir, `${randomId}.%(ext)s`);
                const ytdlpArgs = [
                    '-m', 'yt_dlp',
                    '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                    '-o', tempOutputPath,
                    url
                ];

                downloadedFilePath = await new Promise(async (resolve, reject) => {
                    try {
                        await execFileAsync('python3.12', ytdlpArgs, { timeout: 300000 });
                        const files = await fsp.readdir(tempDir);
                        const foundFile = files.find(f => f.startsWith(randomId));
                        if (foundFile) {
                            return resolve(path.join(tempDir, foundFile));
                        }
                    } catch (error) {
                        console.error('[YTDLP Sticker Error]:', error);
                    }
                    reject(new Error('Não foi possível baixar o vídeo do link.'));
                });
                isDownloadedFromUrl = true;
            } catch (e) {
                console.error("[Sticker URL] Erro ao baixar mídia com yt-dlp:", e.message);
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗘𝗿𝗿𝗼 › Não consegui baixar o link\n┃ ➢ 𝗗𝗲𝘁 › ${e.message}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
                return true;
            }
        }
    }

    if (!mediaToProcess && !isDownloadedFromUrl) {
        if (commandToken === '/s' && actualQuotedMsgType === 'stickerMessage') {
            await sock.sendMessage(sender, { text: 'mona vc eh burra? eh pra responder imagem e nao sticker' }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { text: '┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › /sticker [opções]\n┃ ➢ 𝗗𝗶𝗰𝗮 › Envie ou responda\n┃   imagem, vídeo ou link\n┃ ➢ 𝗘𝘀𝘁𝗶𝗹𝗼 › quadrado | esticado |\n┃   original | boom | reverso\n┃ ➢ 𝗣𝗮𝗰𝗸 › pack:"nome" | autor:"nome"\n┃   emoji:🔥😂 | anon\n┃ ➢ 𝗠í𝗱𝗶𝗮 › borda:#ffffff |\n┃   crop:rosto\n┃ ➢ 𝗩í𝗱𝗲𝗼 › duracao:1-10 |\n┃   inicio:0+\n┃ ➢ 𝗢𝘂𝘁𝗿𝗼𝘀 › preset:meme|leve|clean\n┃   /s preset view|clear|opções\n┃   pv | reply | fila\n┃ ➢ 𝗘𝘅 › /s quadrado pv\n┃\n┗━━━━━━━━━━━━━━' }, { quoted: msg });
        return true;
    }


    let pack = `Feito com ${BOT_NAME}`;
    let author = '';
    let format = 'original';
    let borderColor = null;
    let emojis = [];
    let videoDuration = null;
    let videoStart = null;
    let cropMode = null;
    let effect = 'none';

    if (savedPreset) {
        if (savedPreset.pack !== undefined) pack = savedPreset.pack ?? '';
        if (savedPreset.author !== undefined) author = savedPreset.author ?? '';
        if (savedPreset.format) format = savedPreset.format;
        if (savedPreset.effect) effect = savedPreset.effect;
        if (savedPreset.borderColor) borderColor = parseColorToken(savedPreset.borderColor);
        if (Array.isArray(savedPreset.categories)) emojis = savedPreset.categories.slice(0, 5);
        if (savedPreset.videoDuration !== undefined) videoDuration = parseFloatOption(savedPreset.videoDuration, 1, 10, videoDuration);
        if (savedPreset.videoStart !== undefined) videoStart = parseFloatOption(savedPreset.videoStart, 0, 120, videoStart);
        if (savedPreset.cropMode) cropMode = savedPreset.cropMode;
    }

    const presetName = (getOptionValue(argsString, 'preset') || '').toLowerCase();
    if (presetName === 'meme') {
        format = 'square';
    } else if (presetName === 'leve') {
        videoDuration = 6;
    } else if (presetName === 'clean') {
        format = 'original';
    }

    const packRegex = /pack:(?:"([^"]*)"|'([^']*)')/i;
    const authorRegex = /autor:(?:"([^"]*)"|'([^']*)')/i;
    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    if (packMatch) pack = (packMatch[1] ?? packMatch[2] ?? '').trim();
    if (authorMatch) author = (authorMatch[1] ?? authorMatch[2] ?? '').trim();

    const durationToken = getOptionValue(argsString, 'duracao') || getOptionValue(argsString, 'duração');
    videoDuration = parseFloatOption(durationToken, 1, 10, videoDuration);

    const startToken = getOptionValue(argsString, 'inicio') || getOptionValue(argsString, 'início');
    videoStart = parseFloatOption(startToken, 0, 120, videoStart);

    const borderToken = getOptionValue(argsString, 'borda');
    borderColor = parseColorToken(borderToken);

    const emojiToken = getOptionValue(argsString, 'emoji');
    if (emojiToken) emojis = emojiToken.split(/\s+/).filter(Boolean).slice(0, 5);

    cropMode = (getOptionValue(argsString, 'crop') || '').toLowerCase() || null;
    if (cropMode === 'rosto') {
        format = 'square';
    }

    let description = null;
    if (shouldAnonymous) {
        pack = '';
        author = '';
    } else if (!author) {
        // Adicionar "by: [nome]" se não tiver author customizado e não for anon
        const creatorName = msgDetails.pushName || 'Alguém';
        description = `by: ${creatorName}`;
    }

    const remainingArgs = argsString
        .replace(packRegex, '')
        .replace(authorRegex, '')
        .replace(/\b(?:pv|reply|anon|fila|queue)\b/gi, '')
        .replace(/(?:duracao|duração|inicio|início|borda|emoji|crop|preset):(?:"[^"]+"|'[^']+'|\S+)/gi, '')
        .trim()
        .toLowerCase();

    if (remainingArgs.includes('quadrado')) format = 'square';
    else if (remainingArgs.includes('esticado')) format = 'stretch';
    else if (remainingArgs.includes('original')) format = 'original';

    if (remainingArgs.includes('boom') || remainingArgs.includes('explosão') || remainingArgs.includes('explosao')) effect = 'boom';
    else if (remainingArgs.includes('reverso') || remainingArgs.includes('reverse')) effect = 'reverse';

    const options = {
        pack,
        author,
        description,
        format,
        effect,
        borderColor,
        categories: emojis,
        videoDuration,
        videoStart,
        cropMode,
        shouldReplyConfirmation
    };
    // --- FIM PRESETS ---

    const shouldAutoDelete = Boolean(isViewOnce && msgDetails.isGroup && !shouldSendToPrivate);

    const sourceDeleteKey = shouldSendToPrivate ? (mediaToProcess?.key || msg.key) : null;

    const isAnimatedMedia = (media) => {
        if (!media) return false;
        const type = getContentType(media.message);
        if (type === 'videoMessage') return true;
        
        const mime = media.message?.[type]?.mimetype || '';
        if (mime.startsWith('video/') || mime === 'image/gif') return true;
        
        return false;
    };

    const isAnimated = isDownloadedFromUrl || isAnimatedMedia(mediaToProcess);

    // Força formato quadrado para vídeos se estiver como original
    if (isAnimated && options.format === 'original') {
        options.format = 'square';
    }

    if (isAnimated) {
        const isUserAlreadyInQueue = (isProcessing && currentlyProcessingJid === commandSenderJid) || videoQueue.some(job => job.commandSenderJid === commandSenderJid);

        if (isUserAlreadyInQueue) {
            await sock.sendMessage(sender, { text: '┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › Você já tem uma fig\n┃   na fila! Aguarde finalizar.\n┃\n┗━━━━━━━━━━━━━━' }, { quoted: msg });
            return;
        }

        const job = { sock, msg, msgDetails, mediaToProcess, downloadedFilePath, isDownloadedFromUrl, commandSenderJid, options, msgToQuote, shouldAutoDelete, sourceMessageKey, isViewOnceMedia: isViewOnce, destinationJids, sourceDeleteKey, shouldSendToPrivate };
        videoQueue.push(job);

        if (isProcessing) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗙𝗶𝗹𝗮 › Adicionado! Posição ${videoQueue.length}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        if (!isProcessing) {
            processQueue();
        }

    } else {
        // IMAGEM ESTÁTICA
        try {
            if (!shouldSendToPrivate) {
                await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });
            }

            const buffer = await downloadMediaBufferWithFallback(sock, mediaToProcess, isViewOnce);

            const resizeOptions = {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            };
            if (options.format === 'square') resizeOptions.fit = 'cover';
            else if (options.format === 'stretch') resizeOptions.fit = 'fill';
            if (options.cropMode === 'rosto') {
                resizeOptions.fit = 'cover';
                resizeOptions.position = sharp.strategy.attention;
            }

            let sharpInstance = sharp(buffer)
                .resize(512, 512, resizeOptions);

            if (options.borderColor) {
                sharpInstance = sharpInstance
                    .resize(460, 460, resizeOptions)
                    .extend({ top: 26, bottom: 26, left: 26, right: 26, background: options.borderColor });
            }

            if (options.effect === 'boom') {
                sharpInstance = sharpInstance
                    .modulate({ brightness: 1.2, saturation: 4.0 })
                    .sharpen({ sigma: 5.0 })
                    .blur(0.8);
            } else if (options.effect === 'reverse') {
                // Reverse doesn't make sense for static images, so we'll just flip it as a fallback
                sharpInstance = sharpInstance.flop();
            }

            let finalBuffer = await sharpInstance
                .webp({ quality: 80, effort: 6 })
                .toBuffer();

            finalBuffer = await addExif(finalBuffer, options);
            if (!shouldSendToPrivate) {
                await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                if (isGroup) {
                    const farmManager = require('../managers/stickerFarmManager.js');
                    const stickerAuthor = msg.key?.participant || msg.key?.remoteJid;
                    await farmManager.addSticker(sender, stickerAuthor, finalBuffer);
                }
            }
            const shouldQuote = destinationJids.length === 1 && destinationJids[0] === sender;
            const sourceDeletePlan = shouldSendToPrivate && sourceDeleteKey?.id ? { chatJid: sender, key: sourceDeleteKey } : null;
            await sendStickerWithOptionalAutoDelete(sock, destinationJids, finalBuffer, shouldQuote ? msgToQuote : undefined, shouldAutoDelete, sourceMessageKey, sourceDeletePlan);
            if (shouldSendToPrivate && options.shouldReplyConfirmation && isGroup) {
                await sock.sendMessage(sender, { text: '✅ Figurinha enviada no privado.' }, { quoted: msg });
            }
        } catch (err) {
            console.error('[Sticker] Erro ao processar figurinha estática:', err);
            if (!shouldSendToPrivate) {
                await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            }
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗧𝗜𝗖𝗞𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗘𝗿𝗿𝗼 › ${err.message}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }
    }
}

async function handleStickerPackCommand(sock, senderJid, messages, authorJid) {
    console.log(`[StickerPack] Iniciando processamento de batch com ${messages.length} mensagens para ${senderJid}`);
    const { buildStickerPackZip, encryptAndUploadPack, sendStickerPack } = require('../helpers/stickerPackHelper.js');

    try {
        await sock.sendMessage(senderJid, { text: `📦 *Fechando Sticker Pack*\nProcessando ${messages.length} mídias. Isso pode demorar alguns segundos...\n\n💡 _Dica: você não precisa salvar o pack inteiro! Abra o pacote e favorite as figurinhas que quiser individualmente._` });

        const buffers = [];
        let hasAnimated = false;
        const tempDirStickers = await getTempDir('stickers');

        for (let i = 0; i < messages.length; i++) {
            const tempMsg = messages[i];
            const isViewOnce = Boolean(tempMsg.message?.viewOnceMessage || tempMsg.message?.viewOnceMessageV2);

            try {
                const buffer = await downloadMediaBufferWithFallback(sock, tempMsg, isViewOnce);

                const mediaType = getContentType(tempMsg.message);
                const isVideo = mediaType === 'videoMessage' ||
                    (tempMsg.message?.[mediaType]?.mimetype || '').startsWith('video/') ||
                    (tempMsg.message?.[mediaType]?.mimetype || '') === 'image/gif';

                if (isVideo) {
                    // Converter vídeo para webp animado
                    const randomId = crypto.randomBytes(8).toString('hex');
                    const inputPath = path.join(tempDirStickers, `${randomId}_pack_in`);
                    const outputPath = path.join(tempDirStickers, `${randomId}_pack_out.webp`);

                    await fsp.writeFile(inputPath, buffer);

                    await new Promise(async (resolve, reject) => {
                        const ffmpegArgs = [
                            '-y',
                            '-i', inputPath,
                            '-t', '10',
                            '-vf', "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15,format=rgba",
                            '-c:v', 'libwebp',
                            '-lossless', '0',
                            '-compression_level', '4',
                            '-q:v', '50',
                            '-loop', '0',
                            '-preset', 'default',
                            '-an', outputPath
                        ];
                        try {
                            await execFileAsync('ffmpeg', ffmpegArgs);
                            const webpBuf = await fsp.readFile(outputPath);
                            if (webpBuf.length >= 1000000) {
                                // Tenta com qualidade menor
                                const ffmpegArgs2 = [
                                    '-y',
                                    '-i', inputPath,
                                    '-t', '10',
                                    '-vf', "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15,format=rgba",
                                    '-c:v', 'libwebp',
                                    '-lossless', '0',
                                    '-compression_level', '6',
                                    '-q:v', '30',
                                    '-loop', '0',
                                    '-preset', 'default',
                                    '-an', outputPath
                                ];
                                await execFileAsync('ffmpeg', ffmpegArgs2);
                                const wb2 = await fsp.readFile(outputPath);
                                resolve(wb2);
                            } else {
                                resolve(webpBuf);
                            }
                        } catch (err) {
                            reject(err);
                        }
                    });

                    const webpBuf = await fsp.readFile(outputPath);
                    buffers.push(webpBuf);
                    hasAnimated = true;

                    await fsp.unlink(inputPath).catch(() => {});
                    await fsp.unlink(outputPath).catch(() => {});
                } else {
                    // Imagem estática
                    const sharpInstance = sharp(buffer).resize(512, 512, { fit: 'contain', background: {r:0,g:0,b:0,alpha:0} });
                    const webpBuf = await sharpInstance.webp({ quality: 80, effort: 4 }).toBuffer();
                    buffers.push(webpBuf);
                }
            } catch (mediaErr) {
                console.error('[StickerPack] Erro processando mídia da fila', mediaErr);
            }
        }

        if (buffers.length === 0) throw new Error("Não consegui baixar nenhuma mídia válida pro pacote.");

        // Usa a primeira img em 96x96 pro icone
        const trayBuffer = await sharp(buffers[0]).resize(96, 96, { fit: 'cover' }).png().toBuffer();

        // Usa o preset do usuário para nome do pack e autor
        const stickerPreset = userPresetManager.getPreset(senderJid, authorJid);
        const packName = stickerPreset?.pack || `Pacote do ${BOT_NAME}`;
        const packPublisher = stickerPreset?.author || BOT_NAME;

        const packId = crypto.randomBytes(16).toString('hex');

        const packArchive = await buildStickerPackZip(packId, packName, packPublisher, buffers, trayBuffer, hasAnimated);

        const uploadMeta = await encryptAndUploadPack(sock, packArchive.zipBuffer);

        await sendStickerPack(sock, senderJid, uploadMeta, {
            packId,
            packName: packName,
            publisher: packPublisher,
            stickersMeta: packArchive.stickersMeta,
            trayHash: crypto.createHash('sha256').update(trayBuffer).digest('base64')
        });

    } catch(err) {
        console.error('[StickerPack] erro ao tentar montar:', err);
        await sock.sendMessage(senderJid, { text: `Erro no pacote: ${err.message}`});
    }
}

handleStickerCommand.commandData = {
    name: "sticker",
    description: "Cria figurinhas animadas ou estáticas (imagem/vídeo/url).",
    category: "midia",
    usage: "/sticker [pack:\"nome\"] [autor:\"nome\"] [emoji:🔥] [borda:#fff] [crop:rosto] [duracao:6] [inicio:2] [preset:meme] [anon] [pv] [reply] [fila] | /s preset [view|clear|opções]",
    aliases: ["/f", "/fig", "/s", "/stiker", "/fazerfig"]
};

handleStickerCommand.handleStickerPackCommand = handleStickerPackCommand;
module.exports = handleStickerCommand;
