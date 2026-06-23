const archiver = require('archiver');
const crypto = require('crypto');
const fs = require('fs');
const { generateMessageIDV2, getWAUploadToServer } = require('@whiskeysockets/baileys/lib/Utils/index.js');
const { getHttpStream } = require('@whiskeysockets/baileys/lib/Utils/messages-media.js');
const { enc } = require('crypto-js');

// Our custom hkdf implementation
function extractHKDF(mediaKey, info) {
    const salt = Buffer.alloc(32);
    const prk = crypto.createHmac('sha256', salt).update(mediaKey).digest();
    
    // Expand
    const infoBuf = Buffer.from(info);
    let okm = Buffer.alloc(0);
    let t = Buffer.alloc(0);
    
    for (let i = 1; okm.length < 112; i++) {
        t = crypto.createHmac('sha256', prk).update(Buffer.concat([t, infoBuf, Buffer.from([i])])).digest();
        okm = Buffer.concat([okm, t]);
    }
    const derived = okm.slice(0, 112);
    return {
        iv: derived.slice(0, 16),
        cipherKey: derived.slice(16, 48),
        macKey: derived.slice(48, 80)
    };
}

/**
 * Detect if a WebP buffer is animated
 */
async function isAnimatedWebp(buffer) {
    try {
        const { Image } = require('node-webpmux');
        const image = new Image();
        await image.load(buffer);
        return !!(image.hasAnim && image.anim);
    } catch {
        return false;
    }
}

/**
 * Zips WebP stickers mapped by their base64 SHA256 sum
 * @param {Buffer[]} stickersBufferArray - array of webp buffers (static or animated)
 * @param {Buffer} trayIconBuffer - PNG tray icon
 * @param {boolean|null} forceAnimated - force all stickers as animated (null = auto-detect)
 */
async function buildStickerPackZip(packId, packName, publisher, stickersBufferArray, trayIconBuffer, forceAnimated = null) {
    return new Promise(async (resolve, reject) => {
        const bufs = [];
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('data', d => bufs.push(d));
        archive.on('end', () => resolve({ zipBuffer: Buffer.concat(bufs), stickersMeta }));
        archive.on('error', err => reject(err));

        const stickersMeta = [];

        // Append stickers
        for (const stickerBuf of stickersBufferArray) {
            const sha256 = crypto.createHash('sha256').update(stickerBuf).digest('base64');
            const sanitizedFileName = sha256.replace(/\//g, '-');
            const fileName = `${sanitizedFileName}.webp`;

            archive.append(stickerBuf, { name: fileName });

            const animated = forceAnimated !== null ? forceAnimated : await isAnimatedWebp(stickerBuf);

            stickersMeta.push({
                fileName: fileName,
                isAnimated: animated,
                accessibilityLabel: "",
                isLottie: false,
                mimetype: "image/webp"
            });
        }

        // Append tray icon
        if (trayIconBuffer) {
            archive.append(trayIconBuffer, { name: `${packId}.png` });
        }

        archive.finalize();
    });
}

/**
 * Manually encrypt and upload the ZIP stream using WA Media constraints
 */
async function encryptAndUploadPack(sock, zipBuffer) {
    const mediaKey = crypto.randomBytes(32);
    const { cipherKey, iv, macKey } = extractHKDF(mediaKey, 'WhatsApp Sticker Pack Keys');

    const aes = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    const hmac = crypto.createHmac('sha256', macKey).update(iv);
    
    // Encrypt
    const encBuf = Buffer.concat([aes.update(zipBuffer), aes.final()]);
    
    // Calculate MAC
    hmac.update(encBuf);
    const mac = hmac.digest().slice(0, 10);
    
    // Final concatenated blob
    const finalBlobToUpload = Buffer.concat([encBuf, mac]);
    
    // calculate Hashes
    const fileSha256 = crypto.createHash('sha256').update(zipBuffer).digest();
    const fileEncSha256 = crypto.createHash('sha256').update(finalBlobToUpload).digest();
    const fileLength = zipBuffer.length;

    // Use Baileys helper to fetch hosts
    const { mediaUrl, directPath, meta_hmac } = await uploadToWAMediaNative(sock, finalBlobToUpload, fileEncSha256.toString('base64'), "sticker");

    return {
        mediaKey: mediaKey.toString('base64'),
        fileSha256: fileSha256.toString('base64'),
        fileEncSha256: fileEncSha256.toString('base64'),
        fileLength: fileLength,
        directPath: directPath,
    };
}

async function uploadToWAMediaNative(sock, buffer, encSha256B64, mediaType = "document") {
    return new Promise(async (resolve, reject) => {
        try {
            // Write temp file
            const tempFile = require('path').join(require('os').tmpdir(), `up-${generateMessageIDV2()}`);
            fs.writeFileSync(tempFile, buffer);
            
            // Upload to server using Baileys handler
            // we patch WA Uploader directly
            const uploadHandler = getWAUploadToServer({
               customUploadHosts: [],
               fetchAgent: sock.fetchAgent,
               logger: sock.logger,
               options: {} 
            }, sock.refreshMediaConn);
            
            const result = await uploadHandler(tempFile, { mediaType, fileEncSha256B64: encSha256B64, timeoutMs: 30000 });
            
            fs.unlinkSync(tempFile);
            resolve(result);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Native relay mechanism
 */
async function sendStickerPack(sock, jid, packData, metadata) {
    const {
        mediaKey,
        fileSha256,
        fileEncSha256,
        fileLength,
        directPath
    } = packData;

    const {
        packId,
        packName,
        publisher,
        stickersMeta,
        trayHash,   // sha256 of icon
        trayEncHash // ? no need for enc hashing, standard hashing
    } = metadata;

    const message = {
        stickerPackMessage: {
            stickerPackId: packId,
            name: packName || 'Pack',
            publisher: publisher || '',
            stickers: stickersMeta,
            fileLength: fileLength.toString(),
            fileSha256: Buffer.from(fileSha256, 'base64'),
            fileEncSha256: Buffer.from(fileEncSha256, 'base64'),
            mediaKey: Buffer.from(mediaKey, 'base64'),
            directPath: directPath,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000).toString(),
            trayIconFileName: `${packId}.png`,
            thumbnailDirectPath: directPath, // Same path, WA native client usually has a custom thumbPath but same direct works
            stickerPackSize: fileLength.toString(),
            stickerPackOrigin: 1 // USER_CREATED
        }
    };

    return await sock.relayMessage(jid, message, {});
}

module.exports = {
    buildStickerPackZip,
    encryptAndUploadPack,
    sendStickerPack
};
