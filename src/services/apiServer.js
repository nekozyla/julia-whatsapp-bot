const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const rankManager = require('../managers/rankManager');
const muchaMusicaManager = require('../managers/muchaMusicaManager.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const minecraftManager = require('../managers/minecraftManager.js');
const authManager = require('../managers/authManager.js');

let sock = null;

function setApiSocket(activeSock) {
    sock = activeSock;
}

async function sendMinecraftCommand(cmd) {
    const MC_API = `http://localhost:${process.env.MC_API_PORT || 19134}`;
    const MC_SECRET = process.env.MC_API_SECRET || 'mude-esta-senha-aqui';
    try {
        const res = await fetch(`${MC_API}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: MC_SECRET, command: cmd }),
            signal: AbortSignal.timeout(5000)
        });
        return await res.json();
    } catch (e) {
        console.error(`[apiServer] Erro ao enviar comando ao Minecraft (${cmd}):`, e.message);
        return { success: false, error: e.message };
    }
}

function startApiServer() {
    const app = express();
    const PORT = process.env.PORT || 19132;

    app.use(cors());
    app.use(express.json());
    app.use('/public', express.static(path.join(__dirname, '..', '..', 'public')));

    // Servir pasta de mods do Minecraft (remota ~/modpack/mods)
    const modsDir = path.join(__dirname, '..', '..', '..', 'modpack', 'mods');
    app.use('/public/mods', express.static(modsDir));

    let modsCache = null;
    let lastModsCheck = 0;
    const fileMetadataCache = new Map();

    // Função auxiliar para detectar se o mod roda apenas no servidor (Server-only)
    const isServerOnlyMod = (filePath, fileName) => {
        const AdmZip = require('adm-zip');
        const knownServerOnlyIds = ['skinrestorer', 'dragonrespawn', 'servercore', 'incontrol', 'spark', 'ledger', 'pl3xmap', 'chunky', 'fastasyncworldedit', 'worldedit'];
        const lowerName = fileName.toLowerCase();
        
        // Se o nome do arquivo indicar de forma explícita que é do servidor
        if (lowerName.includes('-serverside') || lowerName.includes('server-side') || lowerName.includes('serveronly') || lowerName.includes('server-only')) {
            return true;
        }
        
        // Se bater com prefixos de mods conhecidos
        for (const id of knownServerOnlyIds) {
            if (lowerName.startsWith(id)) {
                return true;
            }
        }

        // Tentar ler o mods.toml ou neoforge.mods.toml
        try {
            const zip = new AdmZip(filePath);
            const entry = zip.getEntry('META-INF/mods.toml') || zip.getEntry('META-INF/neoforge.mods.toml');
            if (entry) {
                const txt = zip.readAsText(entry);
                
                // Remover comentários (#) de cada linha para evitar falsos positivos nos templates do Forge
                const cleanLines = txt.split('\n').map(line => {
                    const idx = line.indexOf('#');
                    return idx !== -1 ? line.substring(0, idx) : line;
                });
                const cleanTxt = cleanLines.join('\n');
                const lowerTxt = cleanTxt.toLowerCase();
                
                // Procurar palavras-chave na descrição limpa
                if (lowerTxt.includes('server-side') || 
                    lowerTxt.includes('server side') || 
                    lowerTxt.includes('server-only') || 
                    lowerTxt.includes('server only') || 
                    lowerTxt.includes('server-optional') || 
                    lowerTxt.includes('server optional') || 
                    lowerTxt.includes('clients not required') || 
                    lowerTxt.includes('client is not required')) {
                    return true;
                }

                // Verificar se o modId está na lista
                const modIdMatch = cleanTxt.match(/modId\s*=\s*["']([^"']+)["']/i) || cleanTxt.match(/modid\s*=\s*["']([^"']+)["']/i);
                if (modIdMatch && modIdMatch[1]) {
                    const modId = modIdMatch[1].toLowerCase();
                    if (knownServerOnlyIds.includes(modId)) {
                        return true;
                    }
                }
            }
        } catch (e) {
            console.error(`[isServerOnlyMod] Erro ao ler zip para ${fileName}:`, e.message);
        }
        
        return false;
    };

    // Endpoint: Listar mods com MD5 (filtrando server-only)
    app.get('/api/mods', async (req, res) => {
        try {
            const crypto = require('crypto');
            const fsDirect = require('fs');

            const getFileHash = (filePath) => {
                return new Promise((resolve, reject) => {
                    const hash = crypto.createHash('md5');
                    const stream = fsDirect.createReadStream(filePath);
                    stream.on('data', (data) => hash.update(data));
                    stream.on('end', () => resolve(hash.digest('hex')));
                    stream.on('error', (err) => reject(err));
                });
            };

            const now = Date.now();
            if (modsCache && (now - lastModsCheck < 300000)) { // 5 minutos de cache
                return res.json(modsCache);
            }

            // Garante que o diretório de mods existe
            try {
                await fs.access(modsDir);
            } catch (e) {
                return res.status(404).json({ success: false, message: 'Diretório de mods não encontrado no servidor.' });
            }

            const files = await fs.readdir(modsDir);
            const modsList = [];
            const activeKeys = new Set();

            for (const file of files) {
                if (!file.endsWith('.jar')) continue;
                const filePath = path.join(modsDir, file);

                try {
                    const stat = await fs.stat(filePath);
                    const cacheKey = `${file}-${stat.size}-${stat.mtimeMs}`;
                    activeKeys.add(cacheKey);

                    let meta;
                    if (fileMetadataCache.has(cacheKey)) {
                        meta = fileMetadataCache.get(cacheKey);
                    } else {
                        const isServer = isServerOnlyMod(filePath, file);
                        let hash = '';
                        if (!isServer) {
                            hash = await getFileHash(filePath);
                        }
                        meta = {
                            isServerOnly: isServer,
                            size: stat.size,
                            hash: hash
                        };
                        fileMetadataCache.set(cacheKey, meta);
                    }

                    if (meta.isServerOnly) {
                        console.log(`[API Mods] Filtrando mod server-only: ${file}`);
                        continue;
                    }

                    modsList.push({
                        name: file,
                        size: meta.size,
                        hash: meta.hash
                    });
                } catch (err) {
                    console.error(`[API Mods] Erro ao processar arquivo ${file}:`, err);
                }
            }

            // Limpar chaves antigas do cache de metadados
            for (const key of fileMetadataCache.keys()) {
                if (!activeKeys.has(key)) {
                    fileMetadataCache.delete(key);
                }
            }

            modsCache = modsList;
            lastModsCheck = now;
            res.json(modsList);
        } catch (error) {
            console.error('[API Mods] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno ao obter lista de mods.' });
        }
    });

    // Endpoint: Buscar Perfil por Nick
    app.get('/api/profile/:nickname', async (req, res) => {
        try {
            const nicknameParam = req.params.nickname.toLowerCase().replace('@', '');
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const nicknamesFile = path.join(dataDir, 'nicknames.json');
            const profilesFile = path.join(dataDir, 'profile_settings.json');

            // Ler arquivos em cada requisição para garantir dados frescos
            let nicknames = {};
            try {
                const data = await fs.readFile(nicknamesFile, 'utf-8');
                nicknames = JSON.parse(data);
            } catch (e) {
                // Se arquivo não existe, retorna vazio
            }

            let targetJid = null;
            let originalNickname = '';

            // Busca o JID pelo nickname
            for (const [jid, nick] of Object.entries(nicknames)) {
                if (nick && String(nick).toLowerCase() === nicknameParam) {
                    targetJid = jid;
                    originalNickname = nick;
                    break;
                }
            }

            if (!targetJid) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            let profileData = {};
            try {
                const data = await fs.readFile(profilesFile, 'utf-8');
                const profiles = JSON.parse(data);
                profileData = profiles[targetJid] || {};
            } catch (e) { }

            const responseData = {
                success: true,
                jid: targetJid,
                nickname: originalNickname,
                name: profileData.name || originalNickname,
                reputation: profileData.reputation || 0,
                bio: profileData.bio || '',
                birthday: profileData.birthday || '',
                sign: profileData.sign || '',
                donation: profileData.donation || 0,
                socials: profileData.socials || {},
                pronouns: profileData.pronouns || '',
                gender: profileData.gender || ''
            };

            // --- Load Relationships Data ---
            let relData = {};
            try {
                const relPath = path.join(dataDir, 'relacionamentos.json');
                relData = JSON.parse(await fs.readFile(relPath, 'utf-8').catch(() => '{}'));
            } catch (e) { }

            // --- Fetch Real-time Data from WhatsApp (Sock) ---
            if (typeof sock !== 'undefined' && sock) {
                try {
                    // 1. Avatar
                    const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                    if (ppUrl) responseData.avatarUrl = ppUrl;

                    // 2. Group Membership & Stats
                    const groups = await sock.groupFetchAllParticipating();
                    responseData.groups = [];

                    for (const g of Object.values(groups)) {
                        const participant = g.participants.find(p => p.id === targetJid);
                        if (participant) {
                            // Get Stats from RankManager
                            const count = rankManager.getCount(g.id, targetJid) || 0;
                            const rankInfo = rankManager.getRankInfo(g.id, targetJid);
                            const rank = rankInfo ? rankInfo.rank : 0;

                            // Resolve spouses with avatar
                            let groupSpouses = [];
                            try {
                                const groupRels = relData[g.id];
                                if (groupRels) {
                                    const userRels = groupRels[targetJid];
                                    if (userRels && userRels.spouses && userRels.spouses.length > 0) {
                                        groupSpouses = await Promise.all(userRels.spouses.map(async (s) => {
                                            const name = nicknames[s.partner] || s.partner.split('@')[0];
                                            let avatarUrl = '';
                                            try {
                                                avatarUrl = await sock.profilePictureUrl(s.partner, 'image').catch(() => '');
                                            } catch (e) { }
                                            return { name, avatarUrl };
                                        }));
                                    }
                                }
                            } catch (e) { }

                            responseData.groups.push({
                                jid: g.id,
                                subject: g.subject,
                                isAdmin: !!participant.admin,
                                msgCount: count,
                                rank: rank,
                                spouses: groupSpouses
                            });
                        }
                    }

                    // Fallback for previous single-group logic (optional, but good for backward compat)
                    if (responseData.groups.length > 0) {
                        const best = responseData.groups[0];
                        responseData.commonGroup = best.subject;
                        responseData.isAdmin = best.isAdmin;
                        responseData.msgCount = best.msgCount; // Provide default
                        responseData.rank = best.rank;         // Provide default
                    }

                } catch (sockErr) {
                    console.error('[API] Erro ao buscar dados do socket:', sockErr);
                }
            }

            res.json(responseData);

        } catch (error) {
            console.error('[API] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    // Endpoint: Buscar Mucha Musica por Nick ou Grupo
    app.get('/api/muchamusica/:id', async (req, res) => {
        try {
            const paramId = req.params.id;
            const lowercaseId = paramId.toLowerCase();

            // 1. Processamento se for Grupo (Termina em @g.us)
            if (lowercaseId.endsWith('@g.us')) {
                const gId = paramId;
                const gs = muchaMusicaManager.getGroupState(gId);
                
                if (!gs || !gs.rotation || gs.rotation.length === 0) {
                    return res.status(404).json({ success: false, message: 'Grupo não possui rotação ativa de Mucha Música.' });
                }

                let groupSubject = 'Grupo Desconhecido';
                if (typeof sock !== 'undefined' && sock) {
                    try {
                        const meta = await groupMetadataManager.getGroupMetadata(sock, gId);
                        if (meta && meta.subject) {
                            groupSubject = meta.subject;
                        }
                    } catch (e) {}
                }

                const currentMember = muchaMusicaManager.getCurrentMember(gId);
                const groupData = {
                    success: true,
                    isGroup: true,
                    groupId: gId,
                    groupName: groupSubject,
                    currentMember: currentMember?.jid || null,
                    rotation: gs.rotation || [],
                    songsList: muchaMusicaManager.getSongHistory(gId) || [],
                    rankingList: muchaMusicaManager.getRanking(gId) || [],
                    pending: muchaMusicaManager.getAllPending(gId) || {}
                };
                
                return res.json(groupData);
            }

            // 2. Processamento se for Usuário (Nickname)
            const nicknameParam = paramId.toLowerCase().replace('@', '');
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const nicknamesFile = path.join(dataDir, 'nicknames.json');

            // Resolve Nickname para JID
            let nicknames = {};
            try {
                const data = await fs.readFile(nicknamesFile, 'utf-8');
                nicknames = JSON.parse(data);
            } catch (e) {}

            let targetJid = null;
            for (const [jid, nick] of Object.entries(nicknames)) {
                if (nick && String(nick).toLowerCase() === nicknameParam) {
                    targetJid = jid;
                    break;
                }
            }

            if (!targetJid) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            // Busca grupos ativos de MuchaMusica e se ele participa
            const activeGroupsIds = muchaMusicaManager.getActiveGroups();
            
            let groupDetails = {};
            if (typeof sock !== 'undefined' && sock) {
                try {
                    groupDetails = await sock.groupFetchAllParticipating();
                } catch (e) {}
            }

            const stats = {
                success: true,
                isGroup: false,
                userJid: targetJid,
                nickname: nicknames[targetJid] || nicknameParam,
                groups: []
            };

            for (const gId of activeGroupsIds) {
                const gs = muchaMusicaManager.getGroupState(gId);
                if (!gs || !gs.rotation.includes(targetJid)) continue;

                const rankingData = muchaMusicaManager.getRanking(gId).find(r => r.jid === targetJid) || { total: 0, onTime: 0, late: 0 };
                const pendingList = muchaMusicaManager.getPending(gId, targetJid) || [];
                const isTurnToday = muchaMusicaManager.getCurrentMember(gId)?.jid === targetJid;
                const songsHistory = (muchaMusicaManager.getSongHistory(gId) || []).filter(s => s.memberJid === targetJid);
                const today = muchaMusicaManager.todayStr();
                const sentToday = songsHistory.some(s => s.day === today);

                stats.groups.push({
                    groupId: gId,
                    groupName: groupDetails[gId]?.subject || 'Grupo Desconhecido',
                    ranking: {
                        totalSent: rankingData.total,
                        onTime: rankingData.onTime,
                        late: rankingData.late
                    },
                    pendingDays: pendingList,
                    isTurnToday: isTurnToday,
                    sentToday: sentToday,
                    songs: songsHistory
                });
            }

            res.json(stats);

        } catch (error) {
            console.error('[API MuchaMusica] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno no Bot.' });
        }
    });

    app.get('/api/server/all', async (req, res) => {
        try {
            // 1. Chamar o info do Minecraft
            let mcInfo = { success: false, error: 'Não foi possível conectar ao servidor Minecraft' };
            try {
                const mcRes = await fetch(`http://localhost:${process.env.MC_API_PORT || 19134}/api/info`, { signal: AbortSignal.timeout(3000) });
                mcInfo = await mcRes.json();
            } catch (e) {
                mcInfo.error = e.message;
            }

            // 2. Obter informações de estado do chatbot
            let botConnected = false;
            let groupCount = 0;
            if (typeof sock !== 'undefined' && sock) {
                botConnected = true;
                try {
                    const groups = await sock.groupFetchAllParticipating();
                    groupCount = Object.keys(groups).length;
                } catch (e) {}
            }

            // 3. Obter contagem de nicknames cadastrados
            let nicknameCount = 0;
            try {
                const dataDir = path.join(__dirname, '..', '..', 'data');
                const nicknamesFile = path.join(dataDir, 'nicknames.json');
                const data = await fs.readFile(nicknamesFile, 'utf-8');
                const nicknames = JSON.parse(data);
                nicknameCount = Object.keys(nicknames).length;
            } catch (e) {}

            res.json({
                success: true,
                bot: {
                    name: process.env.BOT_NAME || 'Julia',
                    status: botConnected ? 'online' : 'offline',
                    uptimeSeconds: Math.round(process.uptime()),
                    activeGroups: groupCount,
                    registeredUsers: nicknameCount
                },
                minecraft: mcInfo
            });
        } catch (err) {
            console.error('[API Server All] Erro:', err);
            res.status(500).json({ success: false, message: 'Erro interno ao reunir informações.' });
        }
    });

    // Endpoint: Webhook de Chat e Eventos do Minecraft
    app.post('/api/webhook/minecraft', async (req, res) => {
        try {
            const { secret, type, jogador, mensagem, detalhe } = req.body;
            console.log(`[Webhook Minecraft] Recebido evento tipo: ${type}, jogador: ${jogador}, mensagem: ${mensagem}`);
            const MC_SECRET = process.env.MC_API_SECRET || 'mude-esta-senha-aqui';

            if (secret !== MC_SECRET) {
                return res.status(403).json({ success: false, error: 'Unauthorized secret' });
            }

            const chatGroupJid = minecraftManager.getChatGroupJid();
            if (!chatGroupJid) {
                return res.json({ success: true, message: 'Nenhum grupo de chat integrado configurado' });
            }

            if (typeof sock === 'undefined' || !sock) {
                return res.status(503).json({ success: false, error: 'Socket do WhatsApp indisponível' });
            }

            let text = '';
            if (type === 'chat') {
                if (!minecraftManager.isChatEnabled()) {
                    return res.json({ success: true, message: 'Mensagens de chat desativadas' });
                }
                text = `💬 *[Minecraft]* *${jogador}*: ${mensagem}`;
            } else if (type === 'join') {
                const jid = minecraftManager.getLinkedJid(jogador);
                if (jid) {
                    const isSA = authManager.isSuperAdmin(jid);
                    if (isSA) {
                        console.log(`[OP Sync] Sincronizando OP para ${jogador} (Super Admin no WhatsApp)`);
                        await sendMinecraftCommand(`op ${jogador}`);
                    } else {
                        console.log(`[OP Sync] Removendo OP de ${jogador} (Não é Super Admin no WhatsApp)`);
                        await sendMinecraftCommand(`deop ${jogador}`);
                    }
                }

                if (!minecraftManager.isJoinEnabled()) {
                    return res.json({ success: true, message: 'Mensagens de join desativadas' });
                }
                text = `🟢 *[Minecraft]* *${jogador}* entrou no jogo.`;
            } else if (type === 'quit') {
                if (!minecraftManager.isQuitEnabled()) {
                    return res.json({ success: true, message: 'Mensagens de quit desativadas' });
                }
                const suffix = detalhe ? ` ${detalhe}` : '';
                text = `🔴 *[Minecraft]* *${jogador}* saiu do jogo.${suffix}`;
            } else if (type === 'pet_death') {
                text = `💀 *[Minecraft]* ${mensagem}`;
            } else {
                return res.status(400).json({ success: false, error: 'Tipo inválido' });
            }

            await sock.sendMessage(chatGroupJid, { text });
            res.json({ success: true });
        } catch (error) {
            console.error('[API Webhook Minecraft] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    // Endpoint: Efetivação do vínculo do jogador do Minecraft
    app.post('/api/minecraft/link', async (req, res) => {
        try {
            const { secret, nickname } = req.body;
            const MC_SECRET = process.env.MC_API_SECRET || 'mude-esta-senha-aqui';

            if (secret !== MC_SECRET) {
                return res.status(403).json({ success: false, error: 'Unauthorized secret' });
            }

            if (!nickname) {
                return res.status(400).json({ success: false, error: 'Nickname obrigatório' });
            }

            const requestingJid = minecraftManager.getPendingRequest(nickname);
            if (!requestingJid) {
                return res.json({
                    success: false,
                    error: 'Nenhuma solicitação de vínculo pendente no WhatsApp para este nickname.'
                });
            }

            // Efetiva o vínculo
            await minecraftManager.linkAccount(nickname, requestingJid);
            minecraftManager.removePendingRequest(nickname);

            // Sincronizar o OP se for Super Admin no WhatsApp
            const isSA = authManager.isSuperAdmin(requestingJid);
            if (isSA) {
                console.log(`[OP Sync] Sincronizando OP no vinculo imediato para ${nickname}`);
                await sendMinecraftCommand(`op ${nickname}`);
            }

            if (typeof sock !== 'undefined' && sock) {
                // Envia confirmação no privado
                const confirmMsg = `✅ *Vínculo concluído!*\n\nSua conta do WhatsApp foi vinculada ao jogador *${nickname}* no Minecraft com sucesso!`;
                await sock.sendMessage(requestingJid, { text: confirmMsg }).catch(() => {});

                // Envia notificação no grupo de chat integrado, se configurado
                const chatGroupJid = minecraftManager.getChatGroupJid();
                if (chatGroupJid) {
                    const mentionText = `🔗 *[Minecraft]* A conta de WhatsApp de @${requestingJid.split('@')[0]} foi vinculada com sucesso ao jogador *${nickname}*.`;
                    await sock.sendMessage(chatGroupJid, {
                        text: mentionText,
                        mentions: [requestingJid]
                    }).catch(() => {});
                }
            }

            res.json({ success: true, message: `Vínculo efetuado com sucesso para ${nickname}` });
        } catch (error) {
            console.error('[API Minecraft Link] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    // Endpoint: Obter tag de um jogador do Minecraft
    app.get('/api/minecraft/tag/:nickname', async (req, res) => {
        try {
            const { nickname } = req.params;
            if (!nickname) {
                return res.status(400).json({ success: false, error: 'Nickname obrigatório' });
            }

            const jid = minecraftManager.getLinkedJid(nickname);
            if (!jid) {
                return res.json({ success: false, tag: null, message: 'Conta não vinculada' });
            }

            const tag = minecraftManager.getUserTag(jid);
            if (tag) {
                return res.json({ success: true, tag });
            }

            return res.json({ success: true, tag: null });
        } catch (error) {
            console.error('[API Minecraft Tag] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    // Endpoint: Definir ou remover tag de um jogador via Minecraft
    app.post('/api/minecraft/tag', async (req, res) => {
        try {
            const { secret, nickname, tag, color } = req.body;
            const MC_SECRET = process.env.MC_API_SECRET || 'mude-esta-senha-aqui';

            if (secret !== MC_SECRET) {
                return res.status(403).json({ success: false, error: 'Unauthorized secret' });
            }

            if (!nickname) {
                return res.status(400).json({ success: false, error: 'Nickname obrigatório' });
            }

            const jid = minecraftManager.getLinkedJid(nickname);
            if (!jid) {
                return res.json({ success: false, error: 'Este jogador não tem uma conta vinculada ao WhatsApp.' });
            }

            if (!tag || tag.toLowerCase() === 'remover') {
                await minecraftManager.removeUserTag(jid);
                return res.json({ success: true, message: `Tag removida com sucesso para o jogador ${nickname}` });
            }

            await minecraftManager.setUserTag(jid, tag, color || '&f');
            return res.json({ success: true, message: `Tag ${tag} definida com sucesso para o jogador ${nickname}` });
        } catch (error) {
            console.error('[API Minecraft Post Tag] Erro:', error);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    app.listen(PORT, () => {
        console.log(`[API HTTP] Servidor Express rodando na porta ${PORT}`);
    });
}

module.exports = { startApiServer, setApiSocket };
