
const fs = require('fs').promises;
const path = require('path');
const aliases = require('../../config/aliases.js');


const relationshipsFilePath = path.join(__dirname, '..', '..', 'data', 'relacionamentos.json');

let relationshipLog = {};
let pendingProposals = {}; 

async function loadRelationships() {
    try {
        await fs.mkdir(path.dirname(relationshipsFilePath), { recursive: true });
        const data = await fs.readFile(relationshipsFilePath, 'utf-8');
        relationshipLog = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            relationshipLog = {};
        } else {
            console.error('[Relacionamentos] Erro ao carregar dados:', error);
        }
    }
}

async function saveRelationships() {
    try {
        await fs.writeFile(relationshipsFilePath, JSON.stringify(relationshipLog, null, 2));
    } catch (error) {
        console.error('[Relacionamentos] Erro ao salvar dados:', error);
    }
}

function initUser(groupJid, userJid) {
    if (!relationshipLog[groupJid]) relationshipLog[groupJid] = {};
    if (!relationshipLog[groupJid][userJid]) {
        relationshipLog[groupJid][userJid] = { parents: [], children: [], spouses: [] };
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
        return false;
    }
}


function isIncest(groupJid, user1, user2) {
    const groupData = relationshipLog[groupJid];
    if (!groupData) return false;

    const u1Data = groupData[user1] || { parents: [], children: [] };
    const u2Data = groupData[user2] || { parents: [], children: [] };

    
    if (u1Data.parents.includes(user2)) return "Você não pode casar com seu pai/mãe!";
    if (u1Data.children.includes(user2)) return "Você não pode casar com seu filho(a)!";

    
    const siblings = u1Data.parents.some(p => u2Data.parents.includes(p));
    if (siblings) return "Você não pode casar com seu irmão/irmã!";

    
    
    const u1Grandparents = u1Data.parents.flatMap(p => groupData[p]?.parents || []);
    if (u1Grandparents.includes(user2)) return "Você não pode casar com seu avô/avó!";

    
    const u1Grandchildren = u1Data.children.flatMap(c => groupData[c]?.children || []);
    if (u1Grandchildren.includes(user2)) return "Você não pode casar com seu neto(a)!";

    return false; 
}

loadRelationships();



async function handleRelationshipCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid, commandText } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só funciona em grupos." }, { quoted: msg });
        return;
    }

    
    if (!relationshipLog[chatJid]) relationshipLog[chatJid] = {};
    if (!pendingProposals[chatJid]) pendingProposals[chatJid] = {};

    
    let currentParticipantJids = new Set();
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        currentParticipantJids = new Set(groupMeta.participants.map(p => p.id));
    } catch (e) {
        
    }

    
    
    

    if (command === '/casar') {
        const args = commandText.split(' ');
        const force = args.includes('--force');

        
        if (force) {
            if (!await isGroupAdmin(sock, chatJid, commandSenderJid)) {
                return sock.sendMessage(chatJid, { text: "🚫 Apenas admins podem forçar casamento." });
            }
            if (mentionedJids.length !== 2) {
                return sock.sendMessage(chatJid, { text: "Uso forçado: `/casar --force @pessoa1 @pessoa2`" });
            }
            const [user1, user2] = mentionedJids;
            initUser(chatJid, user1);
            initUser(chatJid, user2);

            
            const incestError = isIncest(chatJid, user1, user2);
            if (incestError) {
                return sock.sendMessage(chatJid, { text: `🚫 *INCESTO:* ${incestError}` });
            }

            
            if (relationshipLog[chatJid][user1].spouses.length > 0 || relationshipLog[chatJid][user2].spouses.length > 0) {
                return sock.sendMessage(chatJid, { text: "🚫 Poligamia proibida! Um dos dois já é casado." });
            }

            const date = new Date().toISOString();
            relationshipLog[chatJid][user1].spouses.push({ partner: user2, date });
            relationshipLog[chatJid][user2].spouses.push({ partner: user1, date });
            await saveRelationships();

            return sock.sendMessage(chatJid, { text: `⚖️ *UNIÃO FORÇADA!* \n\n@${user1.split('@')[0]} e @${user2.split('@')[0]} agora são casados por decreto!`, mentions: [user1, user2] });
        }

        
        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione quem você quer pedir em casamento!\nEx: `/casar @amor`" });
        }

        const proposer = commandSenderJid;
        const proposed = mentionedJids[0];

        if (proposer === proposed) return sock.sendMessage(chatJid, { text: "Amor próprio é tudo, mas casamento exige dois." });

        initUser(chatJid, proposer);
        initUser(chatJid, proposed);

        
        if (relationshipLog[chatJid][proposer].spouses.length > 0) {
            return sock.sendMessage(chatJid, { text: "Você já é casado(a)! Divorcie-se primeiro. 💍" });
        }
        if (relationshipLog[chatJid][proposed].spouses.length > 0) {
            return sock.sendMessage(chatJid, { text: `O alvo @${proposed.split('@')[0]} já é casado(a)!`, mentions: [proposed] });
        }

        
        const incestError = isIncest(chatJid, proposer, proposed);
        if (incestError) {
            return sock.sendMessage(chatJid, { text: `🚫 *PROIBIDO:* ${incestError}` });
        }

        
        if (pendingProposals[chatJid][proposed]) {
            return sock.sendMessage(chatJid, { text: "Essa pessoa já tem um pedido pendente (de casamento ou adoção). Espere ela responder." });
        }

        
        pendingProposals[chatJid][proposed] = { type: 'marriage', requester: proposer };

        const text = `💍 *PEDIDO DE CASAMENTO* 💍\n\n@${proposer.split('@')[0]} está pedindo a mão de @${proposed.split('@')[0]}!\n\n@${proposed.split('@')[0]}, você aceita? \nResponda com \`/aceitar\` em 60 segundos.`;
        await sock.sendMessage(chatJid, { text, mentions: [proposer, proposed] });

        setTimeout(() => {
            if (pendingProposals[chatJid][proposed]?.requester === proposer && pendingProposals[chatJid][proposed]?.type === 'marriage') {
                delete pendingProposals[chatJid][proposed];
                sock.sendMessage(chatJid, { text: `O pedido de casamento para @${proposed.split('@')[0]} expirou. 🥀`, mentions: [proposed] });
            }
        }, 60000);
        return;
    }

    if (command === '/divorcio') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const userSpouses = relationshipLog[chatJid][commandSenderJid].spouses;

            if (userSpouses.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não é casado(a) com ninguém." });
            }

            
            for (const spouse of userSpouses) {
                const partner = spouse.partner;
                initUser(chatJid, partner);
                const partnerSpouses = relationshipLog[chatJid][partner].spouses;
                const pIdx = partnerSpouses.findIndex(s => s.partner === commandSenderJid);
                if (pIdx > -1) partnerSpouses.splice(pIdx, 1);
            }

            
            relationshipLog[chatJid][commandSenderJid].spouses = [];
            await saveRelationships();

            return sock.sendMessage(chatJid, { text: `💔 *DIVÓRCIO EM MASSA!* \n\n@${commandSenderJid.split('@')[0]} se divorciou de TODOS os seus cônjuges.`, mentions: [commandSenderJid] });
        }

        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione de quem você quer se divorciar ou use `/divorcio @all` para divorciar de todos." });
        }
        const partner = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        const userSpouses = relationshipLog[chatJid][commandSenderJid].spouses;
        const idx = userSpouses.findIndex(s => s.partner === partner);

        if (idx === -1) {
            return sock.sendMessage(chatJid, { text: "Vocês não são casados." });
        }

        
        relationshipLog[chatJid][commandSenderJid].spouses.splice(idx, 1);

        initUser(chatJid, partner);
        const partnerSpouses = relationshipLog[chatJid][partner].spouses;
        const pIdx = partnerSpouses.findIndex(s => s.partner === commandSenderJid);
        if (pIdx > -1) partnerSpouses.splice(pIdx, 1);

        await saveRelationships();
        return sock.sendMessage(chatJid, { text: `💔 *DIVÓRCIO!* \n\nO casamento entre @${commandSenderJid.split('@')[0]} e @${partner.split('@')[0]} acabou.`, mentions: [commandSenderJid, partner] });
    }

    if (command === '/casamento' || command === '/casados') {
        
        const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
        initUser(chatJid, target);

        const spouses = relationshipLog[chatJid][target].spouses.filter(s => currentParticipantJids.has(s.partner));

        if (spouses.length === 0) {
            return sock.sendMessage(chatJid, { text: `💍 @${target.split('@')[0]} não está casado(a) com ninguém neste grupo.`, mentions: [target] });
        }

        let text = `*💍 Casamentos de @${target.split('@')[0]}*\n\n`;
        const mentions = [target];

        spouses.forEach(s => {
            text += `❤️ @${s.partner.split('@')[0]} _(${calculateDuration(s.date)})_\n`;
            mentions.push(s.partner);
        });

        return sock.sendMessage(chatJid, { text: text.trim(), mentions });
    }


    
    
    

    if (command === '/adotar') {
        const args = commandText.split(' ');
        const force = args.includes('--force');

        if (force) {
            if (!await isGroupAdmin(sock, chatJid, commandSenderJid)) return sock.sendMessage(chatJid, { text: "🚫 Apenas admins." });
            if (mentionedJids.length !== 2) return sock.sendMessage(chatJid, { text: "Uso: `/adotar --force @pai @filho`" });

            const [parent, child] = mentionedJids;
            initUser(chatJid, parent);
            initUser(chatJid, child);

            
            if (relationshipLog[chatJid][parent].spouses.some(s => s.partner === child)) {
                return sock.sendMessage(chatJid, { text: "🚫 Eles são casados! Divorcie-os antes de adotar." });
            }

            if (!relationshipLog[chatJid][parent].children.includes(child)) relationshipLog[chatJid][parent].children.push(child);
            if (!relationshipLog[chatJid][child].parents.includes(parent)) relationshipLog[chatJid][child].parents.push(parent);

            await saveRelationships();
            return sock.sendMessage(chatJid, { text: `⚖️ *ADOÇÃO FORÇADA!* \n\n@${parent.split('@')[0]} agora é responsável por @${child.split('@')[0]}.`, mentions: [parent, child] });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione quem você quer adotar." });

        const parent = commandSenderJid;
        const child = mentionedJids[0];

        if (parent === child) return sock.sendMessage(chatJid, { text: "Não pode se adotar." });

        initUser(chatJid, parent);
        initUser(chatJid, child);

        if (relationshipLog[chatJid][parent].children.includes(child)) return sock.sendMessage(chatJid, { text: "Já é seu filho(a)!" });

        
        if (relationshipLog[chatJid][parent].spouses.some(s => s.partner === child)) {
            return sock.sendMessage(chatJid, { text: "🚫 Você não pode adotar seu cônjuge! Divorcie-se primeiro." });
        }

        if (pendingProposals[chatJid][child]) return sock.sendMessage(chatJid, { text: "Essa pessoa já tem um pedido pendente." });

        pendingProposals[chatJid][child] = { type: 'adoption', requester: parent };

        const text = `📜 *PEDIDO DE ADOÇÃO* 📜\n\n@${parent.split('@')[0]} quer te adotar, @${child.split('@')[0]}!\n\nAceita? Responda \`/aceitar\` em 60s.`;
        await sock.sendMessage(chatJid, { text, mentions: [parent, child] });

        setTimeout(() => {
            if (pendingProposals[chatJid][child]?.requester === parent && pendingProposals[chatJid][child]?.type === 'adoption') {
                delete pendingProposals[chatJid][child];
                sock.sendMessage(chatJid, { text: `O pedido de adoção para @${child.split('@')[0]} expirou.`, mentions: [child] });
            }
        }, 60000);
        return;
    }

    if (command === '/deserdar') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const children = relationshipLog[chatJid][commandSenderJid].children;

            if (children.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não tem filhos para deserdar." });
            }

            
            for (const child of children) {
                initUser(chatJid, child);
                relationshipLog[chatJid][child].parents = relationshipLog[chatJid][child].parents.filter(p => p !== commandSenderJid);
            }

            
            relationshipLog[chatJid][commandSenderJid].children = [];
            await saveRelationships();

            return sock.sendMessage(chatJid, { text: `💔 *DESERDADOS!* @${commandSenderJid.split('@')[0]} deserdou TODOS os seus filhos.`, mentions: [commandSenderJid] });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione o filho para deserdar ou use `/deserdar @all`." });
        const child = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        if (!relationshipLog[chatJid][commandSenderJid].children.includes(child)) return sock.sendMessage(chatJid, { text: "Não é seu filho." });

        relationshipLog[chatJid][commandSenderJid].children = relationshipLog[chatJid][commandSenderJid].children.filter(c => c !== child);

        initUser(chatJid, child);
        relationshipLog[chatJid][child].parents = relationshipLog[chatJid][child].parents.filter(p => p !== commandSenderJid);

        await saveRelationships();
        return sock.sendMessage(chatJid, { text: `💔 *DESERDADO!* @${child.split('@')[0]} não é mais filho de @${commandSenderJid.split('@')[0]}.`, mentions: [commandSenderJid, child] });
    }

    if (command === '/abandonar') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const parents = relationshipLog[chatJid][commandSenderJid].parents;

            if (parents.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não tem pais para abandonar." });
            }

            
            for (const parent of parents) {
                initUser(chatJid, parent);
                relationshipLog[chatJid][parent].children = relationshipLog[chatJid][parent].children.filter(c => c !== commandSenderJid);
            }

            
            relationshipLog[chatJid][commandSenderJid].parents = [];
            await saveRelationships();

            return sock.sendMessage(chatJid, { text: `🏃‍♂️ *FUGIU DE TODOS!* @${commandSenderJid.split('@')[0]} abandonou TODOS os seus pais.`, mentions: [commandSenderJid] });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione o pai/mãe para abandonar ou use `/abandonar @all`." });
        const parent = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        if (!relationshipLog[chatJid][commandSenderJid].parents.includes(parent)) return sock.sendMessage(chatJid, { text: "Não é seu pai/mãe." });

        relationshipLog[chatJid][commandSenderJid].parents = relationshipLog[chatJid][commandSenderJid].parents.filter(p => p !== parent);

        initUser(chatJid, parent);
        relationshipLog[chatJid][parent].children = relationshipLog[chatJid][parent].children.filter(c => c !== commandSenderJid);

        await saveRelationships();
        return sock.sendMessage(chatJid, { text: `🏃‍♂️ *FUGIU!* @${commandSenderJid.split('@')[0]} abandonou @${parent.split('@')[0]}.`, mentions: [commandSenderJid, parent] });
    }

    if (command === '/familia') {
        const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
        initUser(chatJid, target);
        const data = relationshipLog[chatJid][target];

        const parents = data.parents.filter(p => currentParticipantJids.has(p));
        const children = data.children.filter(c => currentParticipantJids.has(c));
        const spouses = data.spouses.filter(s => currentParticipantJids.has(s.partner));

        if (parents.length === 0 && children.length === 0 && spouses.length === 0) {
            return sock.sendMessage(chatJid, { text: `🏚️ @${target.split('@')[0]} não tem família (presente) neste grupo.`, mentions: [target] });
        }

        let text = `*👨‍👩‍👧‍👦 Família de @${target.split('@')[0]}*\n\n`;
        const mentions = [target];

        if (parents.length > 0) {
            text += `👑 *Pais:* \n`;
            parents.forEach(p => { text += `  @${p.split('@')[0]}\n`; mentions.push(p); });
        }
        if (spouses.length > 0) {
            text += `💍 *Cônjuges:* \n`;
            spouses.forEach(s => { text += `  @${s.partner.split('@')[0]}\n`; mentions.push(s.partner); });
        }
        if (children.length > 0) {
            text += `👶 *Filhos:* \n`;
            children.forEach(c => { text += `  @${c.split('@')[0]}\n`; mentions.push(c); });
        }

        return sock.sendMessage(chatJid, { text: text.trim(), mentions });
    }

    
    
    

    if (command === '/aceitar' || command === '/aceitaradocao') {
        const proposal = pendingProposals[chatJid][commandSenderJid];

        if (!proposal) {
            return sock.sendMessage(chatJid, { text: "Não há pedidos pendentes para você." });
        }

        const requester = proposal.requester;
        if (!currentParticipantJids.has(requester)) {
            delete pendingProposals[chatJid][commandSenderJid];
            return sock.sendMessage(chatJid, { text: "Quem fez o pedido saiu do grupo. Cancelado." });
        }

        if (proposal.type === 'marriage') {
            initUser(chatJid, requester);
            initUser(chatJid, commandSenderJid);

            
            const incestError = isIncest(chatJid, requester, commandSenderJid);
            if (incestError) {
                delete pendingProposals[chatJid][commandSenderJid];
                return sock.sendMessage(chatJid, { text: `🚫 Pedido cancelado! ${incestError}` });
            }

            const date = new Date().toISOString();
            relationshipLog[chatJid][requester].spouses.push({ partner: commandSenderJid, date });
            relationshipLog[chatJid][commandSenderJid].spouses.push({ partner: requester, date });

            await saveRelationships();
            delete pendingProposals[chatJid][commandSenderJid];

            return sock.sendMessage(chatJid, { text: `🎉 *CASADOS!* 🎉\n\n@${requester.split('@')[0]} e @${commandSenderJid.split('@')[0]} agora estão oficialmente casados!`, mentions: [requester, commandSenderJid] });
        }

        if (proposal.type === 'adoption') {
            
            const parent = requester;
            const child = commandSenderJid;

            initUser(chatJid, parent);
            initUser(chatJid, child);

            if (!relationshipLog[chatJid][parent].children.includes(child)) relationshipLog[chatJid][parent].children.push(child);
            if (!relationshipLog[chatJid][child].parents.includes(parent)) relationshipLog[chatJid][child].parents.push(parent);

            await saveRelationships();
            delete pendingProposals[chatJid][child];

            return sock.sendMessage(chatJid, { text: `🎉 *FAMÍLIA CRESCEU!* 🎉\n\n@${parent.split('@')[0]} adotou @${child.split('@')[0]}!`, mentions: [parent, child] });
        }
    }
}

module.exports = handleRelationshipCommand;


module.exports.commandData = {
    name: "relacionamentos",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/relacionamentos",
    aliases: ["/relacionamentos", "/casar", "/casamento", "/divorcio", "/casados", "/aceitar", "/adotar", "/adot", "/familia", "/aceitaradocao", "/deserdar", "/abandonar", "/filhos", "/pais"]
};
