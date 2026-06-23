const ticTacToeManager = require('../managers/ticTacToeManager');
const { sendGiratinaError } = require('../utils/utils');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

async function handleVelhaCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup, commandSenderJid, pushName } = msgDetails;
    const args = commandText.split(' ');
    const subCommand = args[1]?.toLowerCase();

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    const game = ticTacToeManager.getGame(sender);

    
    if (subCommand === 'aceitar') {
        if (!game || game.status !== 'pending') {
            await sock.sendMessage(sender, { text: "Não há nenhum desafio pendente." }, { quoted: msg });
            return;
        }
        if (game.playerO !== commandSenderJid) {
            await sock.sendMessage(sender, { text: "Este desafio não é para você!" }, { quoted: msg });
            return;
        }

        game.status = 'ongoing';
        await sock.sendMessage(sender, {
            text: `🎮 *Jogo da Velha Iniciado!*\n\n❌ ${game.playerX.split('@')[0]} vs ⭕ ${game.playerO.split('@')[0]}\n\nÉ a vez de @${game.turn.split('@')[0]} (❌)!\nDigite \`/velha [1-9]\` para jogar.\n\n${ticTacToeManager.renderBoard(game.board)}`,
            mentions: [game.playerX, game.playerO]
        });
        return;
    }

    
    if (subCommand === 'desistir') {
        if (!game) {
            await sock.sendMessage(sender, { text: "Não há jogo ativo para desistir." }, { quoted: msg });
            return;
        }
        if (game.playerX !== commandSenderJid && game.playerO !== commandSenderJid) {
            await sock.sendMessage(sender, { text: "Você não está jogando!" }, { quoted: msg });
            return;
        }

        const winner = commandSenderJid === game.playerX ? game.playerO : game.playerX;
        ticTacToeManager.deleteGame(sender);

        await sock.sendMessage(sender, {
            text: `🏳️ @${commandSenderJid.split('@')[0]} desistiu!\n\n🏆 O vencedor é @${winner.split('@')[0]}!`,
            mentions: [commandSenderJid, winner]
        });
        return;
    }

    
    const position = parseInt(subCommand);
    if (!isNaN(position) && position >= 1 && position <= 9) {
        if (!game || game.status !== 'ongoing') {
            await sock.sendMessage(sender, { text: "Não há jogo em andamento. Use `/velha @usuario` para desafiar." }, { quoted: msg });
            return;
        }

        const result = ticTacToeManager.makeMove(sender, commandSenderJid, position);

        if (!result.success) {
            await sock.sendMessage(sender, { text: `⚠️ ${result.message}` }, { quoted: msg });
            return;
        }

        if (result.status === 'win') {
            await sock.sendMessage(sender, {
                text: `🏆 *FIM DE JOGO!*\n\nO vencedor é @${result.winner.split('@')[0]}! 🎉\n\n${ticTacToeManager.renderBoard(result.board)}`,
                mentions: [result.winner]
            });
        } else if (result.status === 'draw') {
            await sock.sendMessage(sender, {
                text: `🤝 *EMPATE!*\n\nDeu velha! Ninguém ganhou.\n\n${ticTacToeManager.renderBoard(result.board)}`
            });
        } else {
            
            await sock.sendMessage(sender, {
                text: `🎮 *Jogo da Velha*\n\nÉ a vez de @${result.nextTurn.split('@')[0]}!\n\n${ticTacToeManager.renderBoard(result.board)}`,
                mentions: [result.nextTurn]
            });
        }
        return;
    }

    
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentionedJids.length === 1) {
        if (game) {
            await sock.sendMessage(sender, { text: "Já existe um jogo ou desafio neste grupo. Terminem ou cancelem antes." }, { quoted: msg });
            return;
        }

        const target = mentionedJids[0];
        if (target === commandSenderJid) {
            await sock.sendMessage(sender, { text: "Você não pode jogar contra si mesmo!" }, { quoted: msg });
            return;
        }

        ticTacToeManager.createGame(sender, commandSenderJid, target);

        await sock.sendMessage(sender, {
            text: `⚔️ *Desafio de Jogo da Velha*\n\n@${commandSenderJid.split('@')[0]} desafiou @${target.split('@')[0]}!\n\nDigite \`/velha aceitar\` para começar.`,
            mentions: [commandSenderJid, target]
        });
        return;
    }

    
    await sock.sendMessage(sender, {
        text: `❌⭕ *Jogo da Velha ${BOT_NAME}*\n\nUse:\n\`/velha @usuario\` - Desafiar alguém\n\`/velha aceitar\` - Aceitar desafio\n\`/velha [1-9]\` - Fazer jogada\n\`/velha desistir\` - Cancelar jogo`
    }, { quoted: msg });
}

module.exports = handleVelhaCommand;


module.exports.commandData = {
    name: "velha",
    description: "Jogo da velha.",
    category: "jogos",
    usage: "/velha",
    aliases: ["/jogodavelha","/tictactoe","/ttt"]
};
