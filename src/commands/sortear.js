const raffleManager = require('../managers/raffleManager');
const groupMetadataManager = require('../managers/groupMetadataManager');
const { sendJuliaError } = require('../utils/utils');

async function handleSortearCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup, commandSenderJid, pushName, command, botJid } = msgDetails;
    const args = commandText.split(' ');
    const subCommand = args[1]?.toLowerCase();

    
    const isParticipar = command === '/participar';

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    try {
        
        if (isParticipar) {
            const result = raffleManager.addParticipant(sender, commandSenderJid);
            if (result.success) {
                await sock.sendMessage(sender, { text: `✅ @${commandSenderJid.split('@')[0]} confirmou presença no sorteio!`, mentions: [commandSenderJid] }, { quoted: msg });
            } else {
                
                await sock.sendMessage(sender, { text: `⚠️ ${result.message}` }, { quoted: msg });
            }
            return;
        }

        
        
        if (subCommand === 'entrar' || subCommand === 'iniciar' || subCommand === 'ativo') {
            if (raffleManager.hasActiveRaffle(sender)) {
                await sock.sendMessage(sender, { text: "Já existe um sorteio ativo! Use `/participar` para entrar." }, { quoted: msg });
                return;
            }

            raffleManager.createRaffle(sender, commandSenderJid);
            await sock.sendMessage(sender, {
                text: `🎉 *SORTEIO INICIADO!* 🎉\n\nOrganizado por: @${commandSenderJid.split('@')[0]}\n\nQuem quiser participar, digite */participar* agora!\n\nQuando estiverem prontos, o organizador pode digitar \`/sortear finalizar\`.`,
                mentions: [commandSenderJid]
            });
            return;
        }

        
        if (subCommand === 'finalizar' || subCommand === 'encerrar') {
            const raffle = raffleManager.getRaffle(sender);
            if (!raffle) {
                await sock.sendMessage(sender, { text: "Não há sorteio ativo para finalizar." }, { quoted: msg });
                return;
            }

            
            
            

            let canClose = raffle.creator === commandSenderJid;

            if (!canClose) {
                
                const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
                const participant = groupMeta.participants.find(p => p.id === commandSenderJid);
                if (participant?.admin) {
                    canClose = true;
                }
            }

            if (!canClose) {
                await sock.sendMessage(sender, { text: "Apenas o organizador do sorteio ou admins podem finalizá-lo." }, { quoted: msg });
                return;
            }

            const result = raffleManager.endRaffle(sender, commandSenderJid);
            if (result.success) {
                await sock.sendMessage(sender, {
                    text: `🎊 *TEMOS UM VENCEDOR!* 🎊\n\nEntre ${result.participantCount} participantes...\n\nO sorteado foi: @${result.winner.split('@')[0]}! 🥳 Parabéns!`,
                    mentions: [result.winner]
                });
            } else {
                await sock.sendMessage(sender, { text: `⚠️ ${result.message}` }, { quoted: msg });
            }
            return;
        }


        
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length > 0) {
            const winner = mentions[Math.floor(Math.random() * mentions.length)];
            await sock.sendMessage(sender, {
                text: `🎲 Sorteando entre os marcados...\n\nO escolhido foi: @${winner.split('@')[0]}!`,
                mentions: [winner]
            });
            return;
        }

        
        
        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
        const participants = groupMeta.participants.filter(p => p.id !== botJid); 

        if (participants.length === 0) {
            await sock.sendMessage(sender, { text: "Não consegui encontrar participantes neste grupo." }, { quoted: msg });
            return;
        }

        const winner = participants[Math.floor(Math.random() * participants.length)];

        await sock.sendMessage(sender, {
            text: `🎲 Sorteando um membro aleatório do grupo...\n\nO sortudo é: @${winner.id.split('@')[0]}!`,
            mentions: [winner.id]
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }
}

module.exports = handleSortearCommand;


module.exports.commandData = {
    name: "sortear",
    description: "Sorteia membros.",
    category: "diversao",
    usage: "/sortear",
    aliases: ["/sorteio","/participar","/sortear"]
};
