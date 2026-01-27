async function dna(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let parent, child;

    if (mentionedJids.length === 0) {
        return sock.sendMessage(chatJid, { text: '🧬 Mencione alguém para fazer o teste de DNA!\nEx: `/dna @usuario` (você é o pai/mãe)\nOu: `/dna @pai @filho`' }, { quoted: msg });
    } else if (mentionedJids.length === 1) {
        parent = commandSenderJid;
        child = mentionedJids[0];
    } else {
        parent = mentionedJids[0];
        child = mentionedJids[1];
    }

    

    
    
    const botJid = msgDetails.botJid || sock.user?.id?.replace(/:.*@/, '@') || '';

    const parentClean = parent.replace(/:.*@/, '@');
    const childClean = child.replace(/:.*@/, '@');
    const botClean = botJid.replace(/:.*@/, '@');

    let percentage = Math.floor(Math.random() * 101);
    let extraMessage = "";

    if (parentClean === botClean || childClean === botClean) {
        if (msgDetails.isSuperAdmin) {
            percentage = 100;
            extraMessage = "\n👑 *Nota:* Claro que é 100%! Você é minha criadora, afinal. ❤️";
        } else {
            percentage = 0;
            extraMessage = "\n🤖 *Nota:* Eu sou um robô! Meu DNA é feito de 0s e 1s. Não tenho filhos biológicos (ainda).";
        }
    }

    const text = `🧬 *TESTE DE DNA* 🧬\n\n` +
        `🔬 *Pai/Mãe:* @${parent.split('@')[0]}\n` +
        `👶 *Filho(a):* @${child.split('@')[0]}\n\n` +
        `📊 *Resultado:* ${percentage}% de chance de ser filho(a)!${extraMessage}`;

    await sock.sendMessage(chatJid, { text, mentions: [parent, child] }, { quoted: msg });
}

module.exports = dna;


module.exports.commandData = {
    name: "dna",
    description: "Teste de paternidade.",
    category: "diversao",
    usage: "/dna",
    aliases: []
};
