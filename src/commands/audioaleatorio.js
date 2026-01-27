const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, '..', 'assets', 'audio');

async function audioAleatorio(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    
    fs.readdir(audioDir, (err, files) => {
        if (err) {
            console.error('[AudioAleatorio] Error reading audio directory:', err);
            sock.sendMessage(sender, { text: '❌ Erro ao acessar a biblioteca de áudios.' }, { quoted: msg });
            return;
        }

        
        const audioFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
        });

        if (audioFiles.length === 0) {
            sock.sendMessage(sender, { text: '❌ Nenhum áudio encontrado na biblioteca.' }, { quoted: msg });
            return;
        }

        
        const randomFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
        const filePath = path.join(audioDir, randomFile);

        
        try {
            sock.sendMessage(sender, {
                audio: { url: filePath },
                mimetype: 'audio/mpeg',
                ppt: true 
                
                
                
                
                
                
                
                
            }, { quoted: msg });
            console.log(`[AudioAleatorio] Sent ${randomFile} to ${sender}`);
        } catch (error) {
            console.error('[AudioAleatorio] Error sending audio:', error);
            sock.sendMessage(sender, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        }
    });
}

module.exports = audioAleatorio;


module.exports.commandData = {
    name: "audioaleatorio",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/audioaleatorio",
    aliases: ["/fx", "/audioaleatorio", "/audiorandom", "/raudio", "/sfx"]
};
