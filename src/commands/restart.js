
const { loadCommands } = require('../loader.js');


async function handleRestartCommand(sock, msg, msgDetails) {
    const { sender, isSuperAdmin, commandMap } = msgDetails;

    if (!isSuperAdmin) {
        await sock.sendMessage(sender, { text: '⛔ Apenas o meu criador pode recarregar meus comandos.' }, { quoted: msg });
        return;
    }

    if (!commandMap) {
        await sock.sendMessage(sender, { text: '⚠️ Erro interno: Mapa de comandos não acessível para recarga.' }, { quoted: msg });
        return;
    }

    await sock.sendMessage(sender, { text: '🔄 Recarregando comandos... Por favor aguarde.' }, { quoted: msg });

    try {
        console.log('[HotReload] Iniciando recarga de comandos...');

        
        const newCommandMap = loadCommands();

        
        commandMap.clear();
        for (const [key, value] of newCommandMap) {
            commandMap.set(key, value);
        }

        console.log(`[HotReload] Sucesso! ${commandMap.size} comandos (re)carregados.`);
        await sock.sendMessage(sender, { text: `✅ *Comandos Atualizados!* \n\nTotal de comandos carregados: *${commandMap.size}*\n\nAs alterações já estão em vigor sem reiniciar a conexão! 🚀` }, { quoted: msg });

    } catch (error) {
        console.error('[HotReload] Erro fatal ao recarregar:', error);
        await sock.sendMessage(sender, { text: `❌ Erro ao recarregar comandos:\n${error.message}` }, { quoted: msg });
    }
}

module.exports = handleRestartCommand;


module.exports.commandData = {
    name: "restart",
    description: "Reinicia o bot.",
    category: "super",
    usage: "/restart",
    aliases: ["/reiniciar","/reset","/reload"]
};
