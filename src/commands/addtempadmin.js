const authManager = require('../managers/authManager.js');
const tempAdminManager = require('../managers/tempAdminManager.js');
const { sendJuliaError, normalizeText } = require('../utils/utils.js');

async function handleAddTempAdminCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;

    try {
        
        
        
        if (!authManager.isSuperAdmin(commandSenderJid)) {
            await sock.sendMessage(sender, { text: "🚫 Sem permissão. Apenas Super Admins podem usar este comando." }, { quoted: msg });
            return;
        }

        
        const args = commandText.split(' ').slice(1);
        const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let targetJid = mentionedJids[0];
        let durationStr = args.find(arg => !arg.includes('@')); 

        
        if (!targetJid && args.length > 0) {
            const potentialNumber = args[0].replace(/\D/g, '');
            if (potentialNumber.length >= 10) {
                targetJid = potentialNumber + '@s.whatsapp.net';
            }
        }

        if (!targetJid) {
            await sock.sendMessage(sender, { text: "⚠️ Por favor, mencione alguém ou digite o número para tornar admin temporário.\n\nUso: `/addtempadmin @usuario 2h`" }, { quoted: msg });
            return;
        }

        if (!durationStr) {
            durationStr = '1h'; 
        }

        
        const validUnits = {
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
        };

        const unitChar = durationStr.slice(-1).toLowerCase();
        const value = parseInt(durationStr.slice(0, -1));

        let durationMs = 0;
        if (!isNaN(value) && validUnits[unitChar]) {
            durationMs = value * validUnits[unitChar];
        } else {
            
            await sock.sendMessage(sender, { text: "⚠️ Formato de tempo inválido. Use m (minutos), h (horas) ou d (dias).\nExemplo: `30m`, `2h`, `1d`." }, { quoted: msg });
            return;
        }

        
        const expirationTime = await tempAdminManager.addAdmin(targetJid, durationMs);

        
        const date = new Date(expirationTime);
        const dateStr = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        await sock.sendMessage(sender, {
            text: `✅ *Sucesso!* O utilizador @${targetJid.split('@')[0]} agora é um Super Admin temporário.\n\n⏳ *Duração:* ${durationStr}\n📆 *Expira em:* ${dateStr}`,
            mentions: [targetJid]
        }, { quoted: msg });

        console.log(`[TempAdmin] ${commandSenderJid} adicionou ${targetJid} como admin por ${durationStr}. Expira: ${dateStr}`);

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }
}

module.exports = handleAddTempAdminCommand;


module.exports.commandData = {
    name: "addtempadmin",
    description: "Adiciona admin temporário.",
    category: "admin",
    usage: "/addtempadmin",
    aliases: []
};
