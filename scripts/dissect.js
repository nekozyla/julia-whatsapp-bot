const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const axios = require('axios');

async function downloadFromURL(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}

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

async function processLine(line) {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        if (obj.messageType === 'stickerPackMessage') {
            const spMsg = obj.rawMessage.stickerPackMessage;
            
            // Build the URL from directPath
            let downloadUrl;
            if (spMsg.directPath.startsWith('http')) downloadUrl = spMsg.directPath;
            else downloadUrl = 'https://mmg.whatsapp.net' + spMsg.directPath;
            
            console.log("Downloading from", downloadUrl);
            const encBuf = await downloadFromURL(downloadUrl);
            console.log("Downloaded bytes:", encBuf.length);
            
            const mediaKey = Buffer.from(spMsg.mediaKey, 'base64');
            
            const types = ['Sticker Pack', 'StickerPack', 'Sticker', 'Document', 'Image'];
            let decrypted = null;
            
            for (const type of types) {
                const info = `WhatsApp ${type} Keys`;
                const keys = extractHKDF(mediaKey, info);
                
                try {
                    // media payload has MAC attached at the end (10 bytes usually for AES encrypt then MAC, actually in WhatsApp it's Mac at the end of the file)
                    // The encrypted data is everything aside from last 10 bytes
                    const encData = encBuf.slice(0, encBuf.length - 10);
                    const macData = encBuf.slice(encBuf.length - 10);
                    
                    // Decode AES
                    const decipher = crypto.createDecipheriv('aes-256-cbc', keys.cipherKey, keys.iv);
                    decipher.setAutoPadding(true);
                    const result = Buffer.concat([decipher.update(encData), decipher.final()]);
                    
                    // It didn't throw bad decrypt
                    console.log(`Success decrypting with info '${info}'! Decrypted length: ${result.length}`);
                    if (result.length === parseInt(spMsg.fileLength)) {
                        decrypted = result;
                        fs.writeFileSync('sticker_pack_payload.bin', result);
                        console.log(`Saved as sticker_pack_payload.bin`);
                        break;
                    }
                } catch (e) {
                    // Bad decrypt, try next
                }
            }
        }
    } catch(e) {
        console.error("Error", e);
    }
}

async function main() {
    const fileStream = fs.createReadStream('super_admin_messages_dump.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
        await processLine(line);
    }
}

main().catch(console.error);
