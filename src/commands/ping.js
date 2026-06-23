async function ping(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    let timestamp = msg.messageTimestamp;

    if (typeof timestamp === 'object' && timestamp !== null) {
        timestamp = timestamp.low || timestamp.toNumber?.() || Date.now() / 1000;
    }

    const msgTime = timestamp * 1000;
    const now = Date.now();
    const latency = now - msgTime;

    const text = `┏━━❪ 𝗣𝗢𝗡𝗚 ❫━━\n┃\n┃ ➢ 𝗟𝗮𝘁𝗲𝗻𝗰𝗶𝗮 › ${latency > 0 ? latency : 0}ms\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Online\n┃\n┗━━━━━━━━━━━━━━`;

    console.log('[DEBUG-SEND] Tentando enviar resposta no PV para', sender);
    try {
        await sock.sendMessage(sender, { text }, { quoted: msg });
        console.log('[DEBUG-SEND] Resposta enviada com sucesso para', sender);
    } catch (e) {
        console.error('[DEBUG-SEND] Erro ao enviar resposta para', sender, 'Erro:', e);
    }
}

module.exports = ping;


module.exports.commandData = {
    name: "ping",
    description: "Verifica latência.",
    category: "util",
    usage: "/ping",
    aliases: ["/latencia", "/ms", "/status"]
};
