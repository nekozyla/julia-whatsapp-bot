async function ping(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    
    let timestamp = msg.messageTimestamp;

    
    if (typeof timestamp === 'object' && timestamp !== null) {
        timestamp = timestamp.low || timestamp.toNumber?.() || Date.now() / 1000;
    }

    const msgTime = timestamp * 1000;
    const now = Date.now();
    const latency = now - msgTime;

    const text = `🏓 *Pong!* \n⚡ Latência: ${latency > 0 ? latency : 0}ms`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
}

module.exports = ping;


module.exports.commandData = {
    name: "ping",
    description: "Verifica latência.",
    category: "util",
    usage: "/ping",
    aliases: ["/latencia","/ms","/status"]
};
