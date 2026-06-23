const systemStateManager = require('../managers/systemStateManager.js');
const { sendGiratinaError } = require('../utils/utils.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

async function handlePvModeCommand(sock, msg, msgDetails) {
    const { sender, isSuperAdmin, args } = msgDetails;

    if (!isSuperAdmin) {
        return sock.sendMessage(sender, { text: "🚫 *Acesso Negado*\n\nApenas Super Admins podem usar este comando." }, { quoted: msg });
    }

    if (!args || args.length === 0) {
        const isAllowed = systemStateManager.isPvAllowedForEveryone();
        const status = isAllowed ? "🔓 LIBERADO" : "🔒 RESTRITO (Whitelist)";
        return sock.sendMessage(sender, { text: `⚙️ *Modo PV*\n\nStatus atual: *${status}*\n\nUse:\n*/pvmode on* - Liberar PV para todos\n*/pvmode off* - Restringir PV (Whitelist)` }, { quoted: msg });
    }

    const mode = args[0].toLowerCase();

    try {
        if (mode === 'on' || mode === 'liberado' || mode === 'open') {
            await systemStateManager.setPvAllowedForEveryone(true);
            return sock.sendMessage(sender, { text: `✅ *PV Liberado*\n\nAgora *todos* podem interagir com a ${BOT_NAME} no privado.` }, { quoted: msg });
        } else if (mode === 'off' || mode === 'restrito' || mode === 'whitelist' || mode === 'fechado' || mode === 'close') {
            await systemStateManager.setPvAllowedForEveryone(false);
            return sock.sendMessage(sender, { text: "🔒 *PV Restrito*\n\nApenas usuários na *whitelist* e *Super Admins* podem interagir no privado." }, { quoted: msg });
        } else {
            return sock.sendMessage(sender, { text: "❌ *Opção Inválida*\nUse *on* ou *off*." }, { quoted: msg });
        }
    } catch (error) {
        console.error("Erro ao alterar modo PV:", error);
        return sock.sendMessage(sender, { text: "❌ Ocorreu um erro ao alterar o modo PV." }, { quoted: msg });
    }
}

module.exports = handlePvModeCommand;
module.exports.commandData = {
    name: "pvmode",
    description: "Controla acesso ao PV.",
    category: "admin",
    usage: "/pvmode [on/off]",
    aliases: ["/pvmode", "/pvlock"],
    isNSFW: false
};
