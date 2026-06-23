
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { sendGiratinaError, getRandomToken } = require('../utils/utils');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function handleRemoveBgCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message.imageMessage || quotedMsg?.imageMessage;

    if (!isImage) {
        await sock.sendMessage(sender, { text: "⚠️ Por favor, envie ou responda a uma imagem para remover o fundo." }, { quoted: msg });
        return;
    }

    const inputPath = path.join(__dirname, '../../temp', `${getRandomToken()}.jpg`);
    const outputPath = path.join(__dirname, '../../temp', `${getRandomToken()}.png`);
    const scriptPath = path.join(__dirname, '../scripts/remove_bg.py');

    try {
        await sock.sendMessage(sender, { react: { text: '✂️', key: msg.key } });

        const messageToDownload = quotedMsg ? { message: quotedMsg } : msg;

        const buffer = await downloadMediaMessage(
            messageToDownload,
            'buffer',
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
        );

        fs.writeFileSync(inputPath, buffer);

        // Execute Python script
        await new Promise((resolve, reject) => {
            exec(`python "${scriptPath}" "${inputPath}" "${outputPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                }
                resolve(stdout);
            });
        });

        if (fs.existsSync(outputPath)) {
            const outputBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(sender, {
                image: outputBuffer,
                caption: "✨ Fundo removido com sucesso!"
            }, { quoted: msg });

            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        } else {
            throw new Error("Output file not found.");
        }

    } catch (error) {
        console.error("[RemoveBG] Erro:", error);
        await sock.sendMessage(sender, { text: "⚠️ Ocorreu um erro ao remover o fundo." }, { quoted: msg });
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    } finally {
        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

module.exports = handleRemoveBgCommand;

module.exports.commandData = {
    name: "removebg",
    description: "Remove fundo da imagem (Local).",
    category: "midia",
    usage: "/removebg",
    aliases: ["/bg", "/nobg", "/rembg"]
};
