const contactManager = require('../managers/contactManager');

const cancelReasons = [
    // ── CLASSICOS ──
    'usou emoji de joinha sem ironia',
    'mandou áudio de 5 minutos no grupo',
    'respondeu "ok" numa declaração de amor',
    'coloca leite antes do cereal',
    'spoilou o final de uma série',
    'ri do próprio meme',
    'manda "oi, tudo bem?" e some por 3 dias',
    'passa 2 horas escolhendo filme e dorme no começo',
    'coloca "empreendedor" na bio sem ter empresa',

    // ── PESADOS ──
    'tem crush no melhor amigo do parceiro e todo mundo sabe menos o parceiro',
    'já fingiu que o celular morreu pra não pagar o Uber',
    'come a pizza dos outros na geladeira e finge que não sabe de nada',
    'stalkeia o ex do ex da namorada às 3 da manhã',
    'já mandou "te amo" pra pessoa errada e fingiu que era zoeira',
    'tem 14 conversas no WhatsApp com "vou te pagar semana que vem"',
    'usa o WiFi do vizinho e ainda reclama que tá lento',
    'pede comida no prato do amigo depois de dizer que não queria nada',
    'já traiu no jogo da velha',
    'finge que tá dormindo quando pedem ajuda pra lavar louça',
    'já printou conversa e mandou pro grupo errado',
    'segura a porta do elevador e aperta o botão de fechar na cara dos outros',
    'come miojo cru no escuro às 4 da manhã como um goblin',
    'já foi ao banheiro e "esqueceu" a carteira na hora de pagar',
    'manda "kkk" com 3 K e não tem noção do que parece',
    'empresta carregador e leva embora de propósito',
    'já chamou a professora de mãe e GOSTOU do resultado',
    'bebe direto da garrafa de suco da geladeira alheia',
    'já pediu o número do crush pelo "trabalho da faculdade"',
    'assiste reels no volume máximo no ônibus lotado sem vergonha nenhuma',
    'diz "tô chegando" e nem saiu do banho ainda',
    'já deu ghost em alguém depois de 3 meses de conversa firme',
    'coloca ketchup no feijão e defende com unhas e dentes',
    'entra no grupo e já pede PIX sem nem dar boa noite',
    'já fingiu que caiu a ligação pra não continuar conversando',

    // ── DESTRUIDORES ──
    'come o bolo antes de cantarem parabéns, MONSTRO',
    'pega o lugar do cinema que não é dele e finge que não viu',
    'já salvou áudio da pessoa rindo pra usar como alarme, DOENTE',
    'segue o crush de conta fake e curte foto de 2019 SEM QUERER',
    'já falou "posso ser sincero?" e destruiu a autoestima de alguém',
    'dorme de meia na cama dos outros',
    'faz barulho mastigando e não aceita que faz',
    'pega o último pedaço de pizza sem perguntar e ainda olha nos olhos',
    'já respondeu "foda-se" quando pediram pra parar de roncar',
    'usa perfil de anime e acha que intimidou alguém',
    'manda "precisamos conversar" e vai dormir',
    'stalkeia tanto que já sabe a senha do Wi-Fi da casa do crush',
    'print de tudo, guarda tudo, chantagem emocional ambulante',
    'põe música triste nos stories quando tá feliz só pra chamar atenção',
    'já bloqueou alguém e mandou msg de outro número DOIS MINUTOS DEPOIS',
    'lê a mensagem, ignora, e 3 horas depois manda "ui tava ocupado"',
    'come pastel na feira e entrega o guardanapo usado pra outra pessoa segurar',
    'assina Netflix dos outros e muda o perfil de lugar',
    'já mandou nude pro grupo da família em vez do PV',
    'entra na call mudo "só pra ouvir" e fica respirando',
    'já tentou pagar com PIX de R$0,01 pra "testar se funciona"',
    'faz textão de término no Facebook e volta com a pessoa no dia seguinte',
    'coloca alarm pras 6h e aperta soneca até meio-dia',
    'já chamou o garçom de "tio" com 22 anos de idade',
    'marca de sair e cancela 10 minutos antes TODO SANTO FIM DE SEMANA',
    'pede review de 5 estrelas pro proprio negócio com contas fake',
    'já comeu a marmita alheia na geladeira do trabalho e deixou um bilhete "desculpa 😅"',
    'tem o costume NOJENTO de chupar os dedos antes de virar a página',
    'já mandou "boa noite" e ficou online até as 4 da manhã',
    'assiste vídeo de gente espremendo espinha no almoço',
];

async function handleCancelarCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let targetJid = commandSenderJid;
    let targetName = pushName || 'Alguém';

    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
        targetName = contactManager.getNickname(targetJid) || `@${targetJid.split('@')[0]}`;
    }

    const reason = cancelReasons[Math.floor(Math.random() * cancelReasons.length)];
    const hashtag = `#${targetName.replace(/[^a-zA-Z0-9À-ÿ]/g, '')}IsOverParty`;

    const reactions = [
        '🔥 Trending topic no Brasil',
        '📢 1.2M tweets em 30 minutos',
        '💀 As pessoas estão chocadas',
        '🗣️ Todo mundo comentando',
        '📱 Viralizou no TikTok',
        '💅 A internet não perdoa'
    ];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    const mentions = targetJid === commandSenderJid ? [] : [targetJid];

    const text = `┏━━❪ 🚫 𝗖𝗔𝗡𝗖𝗘𝗟𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗠𝗼𝘁𝗶𝘃𝗼 › _${reason}_\n┃\n┣━━❪ 𝗥𝗘𝗣𝗘𝗥𝗖𝗨𝗦𝗦𝗔𝗢 ❫━━\n┃\n┃ ➢ ${reaction}\n┃ ➢ ${hashtag}\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    return true;
}

module.exports = handleCancelarCommand;

module.exports.commandData = {
    name: "cancelar",
    description: "Cancele alguém no estilo Twitter!",
    category: "diversao",
    usage: "/cancelar [@user]",
    aliases: ["/cancel", "/cancelamento", "/cancelled"]
};
