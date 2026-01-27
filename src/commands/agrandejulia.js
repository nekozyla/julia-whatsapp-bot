const { addAllowedContact } = require('../managers/authManager');

async function agrandejulia(sock, msg, msgDetails) {
    const { sender, pushName } = msgDetails;

    try {
        await addAllowedContact(sender);
        const replyText = `Olá ${pushName || 'usuário'}! ✨\n\nVocê foi adicionado(a) à minha lista de contatos permitidos com sucesso! Agora você pode usar todos os meus comandos livremente. Divirta-se! 🎉`;
        await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
    } catch (error) {
        console.error("[AGrandeJulia] Erro ao adicionar contato:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar te adicionar. Por favor, tente novamente mais tarde." }, { quoted: msg });
    }
}

module.exports = agrandejulia;


module.exports.commandData = {
    name: "agrandejulia",
    description: "Entra na whitelist.",
    category: "util",
    usage: "/agrandejulia",
    hidden: true,
    aliases: ["/entrar", "/liberar"]
};
