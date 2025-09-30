// commands/casar.js (Versão Poligamia com /casamento individual)
const fs = require('fs').promises;
const path = require('path');
const aliases = require('../../config/aliases.js');

// --- LÓGICA DE GESTÃO DOS CASAMENTOS E PEDIDOS ---

const marriagesFilePath = path.join(__dirname, '..', '..', 'data', 'casamentos.json');
// Estrutura de dados para poligamia: { "groupJid": { "userJid": [ { partner: "partnerJid", date: "ISO_DATE" } ] } }
let marriageLog = {}; 
let pendingProposals = {}; // Armazena pedidos pendentes em memória

async function loadMarriages() {
    try {
        await fs.mkdir(path.dirname(marriagesFilePath), { recursive: true });
        const data = await fs.readFile(marriagesFilePath, 'utf-8');
        marriageLog = JSON.parse(data);
        console.log('[Casamentos] Dados de casamentos (poligamia) carregados.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Casamentos] Ficheiro de casamentos não encontrado, a iniciar um novo.');
            marriageLog = {};
        } else {
            console.error('[Casamentos] Erro ao carregar os dados:', error);
        }
    }
}

async function saveMarriages() {
    try {
        await fs.writeFile(marriagesFilePath, JSON.stringify(marriageLog, null, 2));
    } catch (error) {
        console.error('[Casamentos] Erro ao salvar os dados:', error);
    }
}

function calculateDuration(isoDate) {
    if (!isoDate) return "Data inválida";
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} dia(s)`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hora(s)`;
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minuto(s)`;
}

async function isGroupAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return !!participant?.admin;
    } catch (e) {
        console.error("[Casar Command] Erro ao verificar status de admin:", e);
        return false;
    }
}

loadMarriages();

// --- FIM DA GESTÃO ---


// --- HANDLER PRINCIPAL DO COMANDO ---

async function handleMarriageCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid, commandText } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    if (!marriageLog[chatJid]) marriageLog[chatJid] = {};
    if (!pendingProposals[chatJid]) pendingProposals[chatJid] = {};
    
    const groupMarriages = marriageLog[chatJid];
    const groupProposals = pendingProposals[chatJid];
    const currentDate = new Date().toISOString();

    // --- SUBCOMANDO /CASAMENTO (NOVO) ---
    if (command === '/casamento') {
        const myMarriages = Array.isArray(groupMarriages[commandSenderJid]) ? groupMarriages[commandSenderJid] : [];
        const mentions = [commandSenderJid];

        if (myMarriages.length === 0) {
            await sock.sendMessage(chatJid, { 
                text: `💍 @${commandSenderJid.split('@')[0]}, você não está casado(a) com ninguém neste grupo.`,
                mentions: mentions
            });
            return;
        }

        let responseText = `*💍 Seus Casamentos, @${commandSenderJid.split('@')[0]} 💍*\n\nVocê está casado(a) com:\n\n`;
        
        myMarriages.forEach(marriage => {
            const partnerJid = marriage.partner;
            const duration = calculateDuration(marriage.date);
            const date = marriage.date ? new Date(marriage.date).toLocaleDateString('pt-BR') : 'Data desconhecida';
            
            responseText += `❤️ @${partnerJid.split('@')[0]}\n  _(Há ${duration} • ${date})_\n`;
            mentions.push(partnerJid);
        });

        await sock.sendMessage(chatJid, { text: responseText.trim(), mentions });
        return;
    }


    // --- SUBCOMANDO /ACEITAR ---
    if (command === '/aceitar') {
        const proposerJid = groupProposals[commandSenderJid];
        if (!proposerJid) {
            await sock.sendMessage(chatJid, { text: `Não há nenhum pedido de casamento pendente para você, @${commandSenderJid.split('@')[0]}.`, mentions: [commandSenderJid] });
            return;
        }

        const user1 = proposerJid;
        const user2 = commandSenderJid;
        delete groupProposals[user2];

        if (!Array.isArray(groupMarriages[user1])) groupMarriages[user1] = [];
        if (!Array.isArray(groupMarriages[user2])) groupMarriages[user2] = [];

        groupMarriages[user1].push({ partner: user2, date: currentDate });
        groupMarriages[user2].push({ partner: user1, date: currentDate });
        await saveMarriages();

        const weddingText = `🎉 ELA DISSE SIM! 🎉\n\nO casamento entre @${user1.split('@')[0]} e @${user2.split('@')[0]} foi oficializado!\n\nFelicidades ao casal! 💍`;
        await sock.sendMessage(chatJid, { text: weddingText, mentions: [user1, user2] });
        return;
    }

    // --- SUBCOMANDO /DIVORCIO ---
    if (command === '/divorcio') {
        if (mentionedJids.length !== 1) {
            await sock.sendMessage(chatJid, { text: `💔 Para se divorciar, você precisa de mencionar de quem.\n\n*Exemplo:*\n/divorcio @ex-parceiro` });
            return;
        }
        
        const userToDivorce = mentionedJids[0];
        const userMarriages = Array.isArray(groupMarriages[commandSenderJid]) ? groupMarriages[commandSenderJid] : [];
        const marriageIndex = userMarriages.findIndex(m => m.partner === userToDivorce);

        if (marriageIndex === -1) {
            await sock.sendMessage(chatJid, { text: `Você não é casado(a) com @${userToDivorce.split('@')[0]}.`, mentions: [userToDivorce] });
            return;
        }

        userMarriages.splice(marriageIndex, 1);
        
        const partnerMarriages = Array.isArray(groupMarriages[userToDivorce]) ? groupMarriages[userToDivorce] : [];
        const partnerMarriageIndex = partnerMarriages.findIndex(m => m.partner === commandSenderJid);
        if (partnerMarriageIndex > -1) {
            partnerMarriages.splice(partnerMarriageIndex, 1);
        }
        
        await saveMarriages();

        await sock.sendMessage(chatJid, { text: `💔 O casamento entre @${commandSenderJid.split('@')[0]} e @${userToDivorce.split('@')[0]} chegou ao fim!`, mentions: [commandSenderJid, userToDivorce] });
        return;
    }

    // --- SUBCOMANDO /CASADOS ---
    if (command === '/casados') {
        const marriedUsers = Object.keys(groupMarriages).filter(jid => Array.isArray(groupMarriages[jid]) && groupMarriages[jid].length > 0);
        
        if (marriedUsers.length === 0) {
            await sock.sendMessage(chatJid, { text: "💒 Não há casais neste grupo ainda." });
            return;
        }

        let fullText = "*💒 Relações Atuais do Grupo 💒*\n\n";
        const mentions = [];

        marriedUsers.forEach(userJid => {
            const partners = groupMarriages[userJid];
            fullText += `*@${userJid.split('@')[0]}* está casado(a) com:\n`;
            mentions.push(userJid);
            
            partners.forEach(marriage => {
                const partnerJid = marriage.partner;
                const duration = calculateDuration(marriage.date);
                const date = marriage.date ? new Date(marriage.date).toLocaleDateString('pt-BR') : 'Data desconhecida';
                fullText += `  - @${partnerJid.split('@')[0]} _(há ${duration} • ${date})_\n`;
                mentions.push(partnerJid);
            });
            fullText += '\n';
        });

        await sock.sendMessage(chatJid, { text: fullText.trim(), mentions });
        return;
    }

    // --- COMANDO PRINCIPAL /CASAR ---
    if (command === '/casar') {
        const args = commandText.split(' ');
        const forceMarriage = args.includes('--force');

        // LÓGICA DE CASAMENTO FORÇADO (ADMIN)
        if (forceMarriage) {
            const isAdmin = await isGroupAdmin(sock, chatJid, commandSenderJid);
            if (!isAdmin) {
                await sock.sendMessage(chatJid, { text: "🚫 Apenas administradores do grupo podem usar o casamento forçado." }, { quoted: msg });
                return;
            }
            if (mentionedJids.length !== 2) {
                await sock.sendMessage(chatJid, { text: "Para o casamento forçado, você precisa de mencionar duas pessoas.\n\n*Exemplo:*\n`/casar --force @pessoa1 @pessoa2`" }, { quoted: msg });
                return;
            }
            
            const [user1, user2] = mentionedJids;
            
            if (!Array.isArray(groupMarriages[user1])) groupMarriages[user1] = [];
            if (!Array.isArray(groupMarriages[user2])) groupMarriages[user2] = [];

            if (groupMarriages[user1].some(m => m.partner === user2)) {
                await sock.sendMessage(chatJid, { text: "Estas duas pessoas já estão casadas uma com a outra!" });
                return;
            }

            groupMarriages[user1].push({ partner: user2, date: currentDate });
            groupMarriages[user2].push({ partner: user1, date: currentDate });
            await saveMarriages();
            
            const weddingText = `⚖️ POR ORDEM DO ADMIN ⚖️\n\nFica decretada a união matrimonial forçada entre @${user1.split('@')[0]} e @${user2.split('@')[0]}!`;
            await sock.sendMessage(chatJid, { text: weddingText, mentions: [user1, user2] });
            return;
        }

        // LÓGICA DE PEDIDO DE CASAMENTO NORMAL
        if (mentionedJids.length !== 1) {
            await sock.sendMessage(chatJid, { text: `Para casar, mencione a pessoa que você deseja pedir em casamento!\n\n*Exemplo:*\n/casar @noivo(a)` });
            return;
        }

        const proposer = commandSenderJid;
        const proposed = mentionedJids[0];
        const proposerMarriages = Array.isArray(groupMarriages[proposer]) ? groupMarriages[proposer] : [];

        if (proposer === proposed) {
            await sock.sendMessage(chatJid, { text: `Você não pode se casar consigo mesmo, @${proposer.split('@')[0]}!`, mentions: [proposer] });
            return;
        }
        if (proposerMarriages.some(m => m.partner === proposed)) {
            await sock.sendMessage(chatJid, { text: `Você já é casado(a) com @${proposed.split('@')[0]}!`, mentions: [proposer, proposed] });
            return;
        }
        if (Object.values(groupProposals).includes(proposer)) {
             await sock.sendMessage(chatJid, { text: `Você já tem um pedido pendente para outra pessoa, @${proposer.split('@')[0]}!`, mentions: [proposer] });
            return;
        }

        groupProposals[proposed] = proposer;
        
        const proposalText = `💌 Pedido de Casamento! 💌\n\n@${proposer.split('@')[0]} está a pedir a mão de @${proposed.split('@')[0]} em casamento!\n\n@${proposed.split('@')[0]}, você tem 60 segundos para aceitar usando o comando \`/aceitar\`.`;
        await sock.sendMessage(chatJid, { text: proposalText, mentions: [proposer, proposed] });

        setTimeout(() => {
            if (groupProposals[proposed] === proposer) {
                delete groupProposals[proposed];
                sock.sendMessage(chatJid, { text: `O tempo esgotou! O pedido de casamento para @${proposed.split('@')[0]} expirou.`, mentions: [proposed] });
            }
        }, 60000);
    }
}

module.exports = handleMarriageCommand;

aliases['/divorcio'] = '/casar';
aliases['/casados'] = '/casar';
aliases['/aceitar'] = '/casar';
aliases['/casamento'] = '/casar';
