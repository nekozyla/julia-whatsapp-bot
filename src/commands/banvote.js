const fs = require('fs').promises;
const path = require('path');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');

const { sendJuliaError } = require('../utils/utils');
const groupMetadataManager = require('../managers/groupMetadataManager');
const voteManager = require('../managers/voteManager');

async function handleBanVoteCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup, commandSenderJid } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    
    const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
    const participant = groupMeta.participants.find(p => p.id === commandSenderJid);

    if (!participant?.admin) {
        await sock.sendMessage(sender, { text: "Apenas administradores podem iniciar uma votação de banimento." }, { quoted: msg });
        return;
    }

    
    let botParticipant;
    let botJid = null; 

    
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        const cachedJid = cache[sender] || cache['global'];

        if (cachedJid) {
            console.log(`[BanVote Debug] Usando JID do cache: ${cachedJid}`);
            botParticipant = groupMeta.participants.find(p => p.id === cachedJid);
            if (botParticipant) botJid = cachedJid;
        }
    } catch (err) {
        console.error('[BanVote] Erro ao ler cache de JID:', err);
    }

    
    if (!botParticipant) {
        const rawBotJid = sock.user?.id;
        const cleanBotJid = rawBotJid?.replace(/:[0-9]+/, '');

        console.log(`[BanVote Debug] Tentando fallback. Raw: ${rawBotJid}, Clean: ${cleanBotJid}`);

        botParticipant = groupMeta.participants.find(p =>
            p.id === rawBotJid ||
            p.id === cleanBotJid ||
            (cleanBotJid && p.id.split('@')[0] === cleanBotJid.split('@')[0])
        );
        if (botParticipant) botJid = botParticipant.id;
    }

    if (!botParticipant?.admin) {
        console.log(`[BanVote] Falha na verificação de admin. Bot Participant: ${JSON.stringify(botParticipant)}`);
        await sock.sendMessage(sender, { text: "Eu preciso ser admin do grupo para banir o usuário caso a votação passe." }, { quoted: msg });
        return;
    }

    
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = mentionedJids[0];

    if (!targetJid) {
        await sock.sendMessage(sender, { text: "Você precisa marcar o usuário que deseja banir. Ex: `/banvote @usuario`" }, { quoted: msg });
        return;
    }

    
    const targetParticipant = groupMeta.participants.find(p => p.id === targetJid);
    if (targetParticipant?.admin) {
        await sock.sendMessage(sender, { text: "Não posso iniciar votação para banir um administrador." }, { quoted: msg });
        return;
    }

    try {
        
        const voteMsg = await sock.sendMessage(sender, {
            text: `🗳️ *Votação de Banimento*\n\nAlvo: @${targetJid.split('@')[0]}\n\nReaja a esta mensagem para votar:\n👍 = Banir\n👎 = Não Banir\n\n⏳ Tempo: 1 minuto`,
            mentions: [targetJid]
        });

        const voteMsgId = voteMsg.key.id;

        
        voteManager.createVote(voteMsgId, sender, targetJid);

        
        setTimeout(async () => {
            const vote = voteManager.getVote(voteMsgId);
            if (!vote) return;

            const yesVotes = vote.votes.yes.size;
            const noVotes = vote.votes.no.size;
            const totalVotes = yesVotes + noVotes;

            let resultText = `📊 *Resultado da Votação*\n\n👍 (Banir): ${yesVotes}\n👎 (Manter): ${noVotes}\nTotal: ${totalVotes}\n\n`;

            if (yesVotes > noVotes) {
                resultText += "✅ *Decisão: BANIR*\nO usuário será removido.";

                try {
                    
                    const currentGroupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
                    const botIsAdminNow = currentGroupMeta.participants.some(p =>
                        (p.id === botJid) && (p.admin === 'admin' || p.admin === 'superadmin')
                    );

                    if (botIsAdminNow) {
                        await sock.groupParticipantsUpdate(sender, [targetJid], 'remove');
                    } else {
                        resultText += "\n\n⚠️ Erro: Perdi a permissão de admin e não pude banir.";
                    }
                } catch (err) {
                    console.error("[BanVote] Erro ao banir:", err);
                    resultText += "\n\n⚠️ Erro ao tentar banir o usuário.";
                }
            } else {
                resultText += "❌ *Decisão: NÃO BANIR*\nO usuário permanece no grupo.";
            }

            await sock.sendMessage(sender, { text: resultText });

            
            voteManager.deleteVote(voteMsgId);

        }, 60000); 

    } catch (error) {
        console.error("[BanVote] Erro:", error);
        await sendJuliaError(sock, sender, msg, error);
    }
}

module.exports = handleBanVoteCommand;


module.exports.commandData = {
    name: "banvote",
    description: "Votação de banimento.",
    category: "admin",
    usage: "/banvote",
    aliases: ["/voteban","/vb","/votacao"]
};
