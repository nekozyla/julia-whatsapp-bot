const bbbManager = require('../managers/bbbManager');
const authManager = require('../managers/authManager');

async function handleBBB(sock, msg, msgDetails) {
    const { sender, args, isSuperAdmin, mentionedJidList, userJid } = msgDetails;

    
    if (!args[0]) {
        return sendMenu(sock, msg, sender);
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
        

        case 'status':
            await showStatus(sock, msg, sender);
            break;

        case 'inscrever':
        case 'entrar':
            await enrollUser(sock, msg, sender, userJid);
            break;

        case 'votar':
            await voteUser(sock, msg, sender, userJid, mentionedJidList);
            break;

        

        case 'abrir': 
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            const openRes = await bbbManager.openRegistration();
            await reply(sock, msg, sender, openRes.success ? '📝 Inscrições para o BBB abertas! Usem /bbb inscrever para participar.' : `❌ Erro: ${openRes.msg}`);
            break;

        case 'iniciar': 
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            const startRes = await bbbManager.startGame();
            await reply(sock, msg, sender, startRes.success ? '🎬 O BBB COMEÇOU! As inscrições foram encerradas.' : `❌ Erro: ${startRes.msg}`);
            break;

        case 'reset':
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            await bbbManager.resetGame();
            await reply(sock, msg, sender, '🔄 O jogo BBB foi reiniciado. Todos os dados foram apagados.');
            break;

        case 'lider':
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            await setRole(sock, msg, sender, mentionedJidList, 'leader');
            break;

        case 'anjo':
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            await setRole(sock, msg, sender, mentionedJidList, 'angel');
            break;

        case 'paredao':
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            await createParedao(sock, msg, sender, mentionedJidList);
            break;

        case 'eliminar':
            if (!checkAdmin(sock, msg, sender, isSuperAdmin)) return;
            await processElimination(sock, msg, sender);
            break;

        default:
            await reply(sock, msg, sender, '❓ Comando desconhecido. Use /bbb para ver o menu.');
    }
}



async function sendMenu(sock, msg, sender) {
    const text = `👁️ *Big Brother Bot* 👁️\n\n` +
        `*Participantes:*\n` +
        `📝 */bbb inscrever*: Entrar no jogo (se inscrições abertas)\n` +
        `📊 */bbb status*: Ver estado atual do jogo\n` +
        `🗳️ */bbb votar @usuario*: Votar no paredão atual\n\n` +
        `*Admin:*\n` +
        `🔓 */bbb abrir*: Abrir inscrições\n` +
        `🎬 */bbb iniciar*: Começar o jogo\n` +
        `👑 */bbb lider @u*: Definir Líder\n` +
        `👼 */bbb anjo @u*: Definir Anjo\n` +
        `🧱 */bbb paredao @u1 @u2...*: Criar Paredão\n` +
        `💀 */bbb eliminar*: Eliminar o mais votado\n` +
        `🔄 */bbb reset*: Reiniciar tudo`;
    await sock.sendMessage(sender, { text }, { quoted: msg });
}

async function reply(sock, msg, sender, text) {
    await sock.sendMessage(sender, { text }, { quoted: msg });
}

function checkAdmin(sock, msg, sender, isSuperAdmin) {
    if (!isSuperAdmin) {
        reply(sock, msg, sender, '⛔ Apenas admins podem controlar o jogo.');
        return false;
    }
    return true;
}



async function showStatus(sock, msg, sender) {
    const data = bbbManager.getData();
    let text = `📊 *Status do BBB*\n\n`;

    if (!data.gameActive && !data.registrationOpen) {
        text += `⚪ Jogo não iniciado.`;
    } else if (data.registrationOpen) {
        text += `📝 Inscrições Abertas!\n👥 Participantes: ${data.participants.length}`;
    } else {
        text += `🟢 Jogo em Andamento\n`;
        text += `👥 Participantes Restantes: ${data.participants.length}\n`;
        text += `💀 Eliminados: ${data.eliminated.length}\n\n`;

        if (data.leader) text += `👑 Líder: @${data.leader.split('@')[0]}\n`;
        if (data.angel) text += `👼 Anjo: @${data.angel.split('@')[0]}\n`;

        if (data.paredao.active) {
            text += `\n🔥 *PAREDÃO ATIVO* 🔥\n`;
            text += `Vote para ELIMINAR:\n`;
            data.paredao.nominees.forEach(jid => {
                text += `- @${jid.split('@')[0]}\n`;
            });
            text += `\nUse /bbb votar @usuario`;
        } else {
            text += `\n🕊️ Casa em paz (sem paredão).`;
        }
    }

    
    const mentions = [...data.participants, ...data.eliminated];
    if (data.leader) mentions.push(data.leader);
    if (data.angel) mentions.push(data.angel);

    await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
}

async function enrollUser(sock, msg, sender, userJid) {
    const res = await bbbManager.enrollUser(userJid);
    if (res.success) {
        await reply(sock, msg, sender, `✅ Inscrito com sucesso! Total: ${res.count}`);
    } else {
        await reply(sock, msg, sender, `❌ ${res.msg}`);
    }
}

async function voteUser(sock, msg, sender, voterJid, mentionedJidList) {
    if (!mentionedJidList || mentionedJidList.length === 0) {
        return reply(sock, msg, sender, '⚠️ Mencione quem você quer eliminar do paredão.');
    }
    const target = mentionedJidList[0];
    const res = await bbbManager.vote(voterJid, target);

    if (res.success) {
        
        await reply(sock, msg, sender, `🗳️ Voto computado em @${target.split('@')[0]}!`);
    } else {
        await reply(sock, msg, sender, `❌ ${res.msg}`);
    }
}

async function setRole(sock, msg, sender, mentionedJidList, role) {
    if (!mentionedJidList || mentionedJidList.length === 0) return reply(sock, msg, sender, '⚠️ Mencione o usuário.');
    const target = mentionedJidList[0];

    const res = role === 'leader' ? await bbbManager.setLeader(target) : await bbbManager.setAngel(target);
    const roleName = role === 'leader' ? '👑 Líder' : '👼 Anjo';

    if (res.success) {
        await sock.sendMessage(sender, { text: `✅ Novo ${roleName}: @${target.split('@')[0]}`, mentions: [target] }, { quoted: msg });
    } else {
        await reply(sock, msg, sender, `❌ ${res.msg}`);
    }
}

async function createParedao(sock, msg, sender, mentionedJidList) {
    if (!mentionedJidList || mentionedJidList.length < 1) return reply(sock, msg, sender, '⚠️ Mencione pelo menos 1 participante para o paredão.');

    const res = await bbbManager.createParedao(mentionedJidList);
    if (res.success) {
        const mentions = mentionedJidList;
        let text = `🔥 *PAREDÃO FORMADO!* 🔥\n\nQuem deve sair?\n`;
        mentionedJidList.forEach(jid => text += `- @${jid.split('@')[0]}\n`);
        text += `\nUse /bbb votar @usuario para eliminar!`;
        await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    } else {
        await reply(sock, msg, sender, `❌ ${res.msg}`);
    }
}

async function processElimination(sock, msg, sender) {
    const res = await bbbManager.eliminate();
    if (res.success) {
        const text = `🚪 *ELIMINAÇÃO* 🚪\n\nCom ${res.votes} votos...\n\nQuem sai hoje é...\n\n@${res.eliminatedJid.split('@')[0]}! 😱`;
        await sock.sendMessage(sender, { text, mentions: [res.eliminatedJid] }, { quoted: msg });
    } else {
        await reply(sock, msg, sender, `❌ ${res.msg}`);
    }
}

module.exports = handleBBB;


module.exports.commandData = {
    name: "bbb",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/bbb",
    aliases: []
};
