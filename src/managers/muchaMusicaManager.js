
const fs = require('fs').promises;
const path = require('path');
const contactManager = require('./contactManager.js');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'mucha_musica.json');

// Estado em memória: { "groupJid": { ...groupState } }
let state = {};

// ── Persistência ──────────────────────────────────────

// Regex para detectar links de música
const LINK_REGEX = /(https?:\/\/(?:open\.spotify\.com\/(?:track|album|intl-[a-z]+\/track)\/[^\s?]+(?:\?[^\s]*)?|(?:www\.|m\.)?youtube\.com\/watch\?[^\s]+|youtu\.be\/[^\s]+|music\.youtube\.com\/watch\?[^\s]+|spotify\.link\/[^\s]+))/i;

async function loadState() {
    try {
        const raw = await fs.readFile(DATA_PATH, 'utf-8');
        state = JSON.parse(raw);
        console.log(`[MuchaMusica] Estado carregado para ${Object.keys(state).length} grupo(s).`);

        // Migração: extrair links de músicas já salvas
        let migrated = 0;
        for (const groupJid of Object.keys(state)) {
            const gs = state[groupJid];
            if (!gs?.songs) continue;
            for (const song of gs.songs) {
                if (song.link) continue; // já tem link, pula
                // Verifica se tem link no track ou artist
                for (const field of ['track', 'artist']) {
                    const match = song[field]?.match(LINK_REGEX);
                    if (match) {
                        song.link = match[1];
                        song[field] = song[field].replace(match[0], '').trim() || song[field];
                        migrated++;
                        break;
                    }
                }
            }
        }
        if (migrated > 0) {
            console.log(`[MuchaMusica] Migração: ${migrated} música(s) tiveram links extraídos.`);
            await saveState();
        }
    } catch (e) {
        if (e.code !== 'ENOENT') console.error('[MuchaMusica] Erro ao carregar estado:', e.message);
        state = {};
    }
}

async function saveState() {
    try {
        await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
        await fs.writeFile(DATA_PATH, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[MuchaMusica] Erro ao salvar estado:', e.message);
    }
}

// ── Helpers de data ───────────────────────────────────

function todayStr() {
    // Retorna data no fuso de Brasília (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().split('T')[0];
}

function nowISO() {
    return new Date().toISOString();
}

// ── API Pública ───────────────────────────────────────

function getGroupState(groupJid) {
    return state[groupJid] || null;
}

function isActive(groupJid) {
    return !!state[groupJid]?.active;
}

/**
 * Ativa o modo para um grupo, criando a rotação com os membros fornecidos.
 * @param {string} groupJid
 * @param {Array<{jid: string, name: string}>} members - Lista de membros com jid e pushName
 */
async function activate(groupJid, members) {
    // Ordena por número de telefone (JID)
    const sorted = [...members].sort((a, b) =>
        a.jid.localeCompare(b.jid)
    );

    state[groupJid] = {
        active: true,
        startedAt: todayStr(),
        rotation: sorted.map(m => m.jid),
        rotationNames: Object.fromEntries(sorted.map(m => [m.jid, m.name || m.jid.split('@')[0]])),
        currentIndex: 0,
        currentDay: todayStr(),
        lastNotifiedDay: null,
        songs: [],
        pending: {}
    };

    await saveState();
    return state[groupJid];
}

async function deactivate(groupJid) {
    if (state[groupJid]) {
        state[groupJid].active = false;
        await saveState();
    }
}

async function resetGroup(groupJid) {
    delete state[groupJid];
    await saveState();
}

/**
 * Retorna o membro da vez (jid e nome)
 */
function getCurrentMember(groupJid) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return null;

    const jid = gs.rotation[gs.currentIndex];
    const name = gs.rotationNames[jid] || jid.split('@')[0];
    return { jid, name, index: gs.currentIndex };
}

/**
 * Avança para o próximo dia/membro.
 * Se o membro atual não mandou música, marca como pendente.
 * Retorna o novo membro da vez.
 */
async function advanceDay(groupJid) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return null;

    const today = todayStr();
    if (gs.currentDay === today) return getCurrentMember(groupJid); // Já está no dia atual

    const prevJid = gs.rotation[gs.currentIndex];
    const prevDay = gs.currentDay;

    // Verifica se o membro anterior já mandou música para o dia dele
    const alreadySent = gs.songs.some(s => s.day === prevDay && s.memberJid === prevJid);
    if (!alreadySent) {
        // Marca como pendente
        if (!gs.pending[prevJid]) gs.pending[prevJid] = [];
        gs.pending[prevJid].push({
            day: prevDay,
            originalIndex: gs.currentIndex
        });
    }

    // Avança o índice ciclicamente
    gs.currentIndex = (gs.currentIndex + 1) % gs.rotation.length;
    gs.currentDay = today;

    await saveState();
    return getCurrentMember(groupJid);
}

/**
 * Registra uma música enviada.
 * @returns {{ success: boolean, message: string, song?: object }}
 */
async function submitSong(groupJid, memberJid, track, artist, link) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return { success: false, message: 'Modo Mucha Música não está ativo neste grupo.' };

    const today = todayStr();
    const current = getCurrentMember(groupJid);

    // Caso 1: É o membro da vez e é hoje
    if (current.jid === memberJid && gs.currentDay === today) {
        // Verifica se já mandou hoje
        const alreadySent = gs.songs.some(s => s.day === today && s.memberJid === memberJid);
        if (alreadySent) return { success: false, message: 'Você já mandou a música do dia! 🎵' };

        const song = {
            day: today,
            memberJid,
            track,
            artist,
            link: link || null,
            submittedAt: nowISO(),
            late: false
        };
        gs.songs.push(song);
        await saveState();
        return { success: true, message: 'Música do dia registrada! 🎵', song };
    }

    // Caso 2: Tem pendências
    const memberPending = gs.pending[memberJid];
    if (memberPending && memberPending.length > 0) {
        const oldest = memberPending.shift(); // Pega a pendência mais antiga
        if (memberPending.length === 0) delete gs.pending[memberJid];

        const song = {
            day: oldest.day,
            memberJid,
            track,
            artist,
            link: link || null,
            submittedAt: nowISO(),
            late: true
        };
        gs.songs.push(song);
        await saveState();

        const remaining = gs.pending[memberJid]?.length || 0;
        const extra = remaining > 0 ? `\nVocê ainda tem *${remaining}* pendência(s).` : '';
        return { success: true, message: `Música registrada para o dia ${oldest.day} (atrasada)! 🎵${extra}`, song };
    }

    // Caso 3: Não é a vez e não tem pendências
    return { success: false, message: `Não é o seu dia! Hoje é o dia de *${current.name}*. 🎶` };
}

/**
 * Pula a vez do membro atual (admin)
 */
async function skipCurrent(groupJid) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return null;

    const skippedJid = gs.rotation[gs.currentIndex];
    const skippedName = gs.rotationNames[skippedJid] || skippedJid.split('@')[0];

    // Marca como pendente
    if (!gs.pending[skippedJid]) gs.pending[skippedJid] = [];
    gs.pending[skippedJid].push({
        day: gs.currentDay,
        originalIndex: gs.currentIndex
    });

    // Avança
    gs.currentIndex = (gs.currentIndex + 1) % gs.rotation.length;

    await saveState();
    return { skippedJid, skippedName, newMember: getCurrentMember(groupJid) };
}

/**
 * Marca que a notificação do dia foi enviada
 */
async function markNotified(groupJid) {
    if (!state[groupJid]) return;
    state[groupJid].lastNotifiedDay = todayStr();
    await saveState();
}

function wasNotifiedToday(groupJid) {
    if (!state[groupJid]) return true;
    return state[groupJid].lastNotifiedDay === todayStr();
}

/**
 * Retorna a lista de músicas enviadas (história completa)
 */
function getSongHistory(groupJid) {
    return state[groupJid]?.songs || [];
}

/**
 * Retorna pendências de um membro
 */
function getPending(groupJid, memberJid) {
    return state[groupJid]?.pending?.[memberJid] || [];
}

/**
 * Retorna todas as pendências do grupo
 */
function getAllPending(groupJid) {
    return state[groupJid]?.pending || {};
}

/**
 * Retorna a ordem de rotação
 */
function getRotation(groupJid) {
    const gs = state[groupJid];
    if (!gs) return [];
    return gs.rotation.map((jid, i) => ({
        jid,
        name: gs.rotationNames[jid] || jid.split('@')[0],
        isCurrent: i === gs.currentIndex
    }));
}

/**
 * Ranking: quem mais mandou músicas
 */
function getRanking(groupJid) {
    const songs = state[groupJid]?.songs || [];
    const gs = state[groupJid];
    if (!gs) return [];

    const counts = {};
    for (const s of songs) {
        if (!counts[s.memberJid]) counts[s.memberJid] = { total: 0, onTime: 0, late: 0 };
        counts[s.memberJid].total++;
        if (s.late) counts[s.memberJid].late++;
        else counts[s.memberJid].onTime++;
    }

    return Object.entries(counts)
        .map(([jid, data]) => ({
            jid,
            name: gs.rotationNames[jid] || jid.split('@')[0],
            ...data
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Adiciona um membro à rotação (quando alguém entra no grupo)
 */
async function addMember(groupJid, jid, name) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return;
    if (gs.rotation.includes(jid)) return;

    gs.rotation.push(jid);
    gs.rotationNames[jid] = name || jid.split('@')[0];
    await saveState();
}

/**
 * Remove um membro da rotação (quando alguém sai do grupo)
 */
async function removeMember(groupJid, jid) {
    const gs = state[groupJid];
    if (!gs || !gs.active) return;

    const idx = gs.rotation.indexOf(jid);
    if (idx === -1) return;

    // Se o membro removido é antes do currentIndex, ajusta
    if (idx < gs.currentIndex) {
        gs.currentIndex--;
    } else if (idx === gs.currentIndex) {
        // Se é o membro da vez, mantém o índice (o próximo assume)
        if (gs.currentIndex >= gs.rotation.length - 1) {
            gs.currentIndex = 0;
        }
    }

    gs.rotation.splice(idx, 1);
    delete gs.rotationNames[jid];
    delete gs.pending[jid];

    // Garante que o índice não excede o tamanho
    if (gs.rotation.length > 0) {
        gs.currentIndex = gs.currentIndex % gs.rotation.length;
    }

    await saveState();
}

/**
 * Retorna todos os grupos ativos
 */
function getActiveGroups() {
    return Object.keys(state).filter(jid => state[jid]?.active);
}

/**
 * Força o save (para cleanup)
 */
async function forceSave() {
    await saveState();
}

// Carrega ao inicializar
loadState();

/**
 * helper usado fora do escopo ou internamente 
 * onde a intenção é ter um nick ou a menção pura
 */
function getMemberMentionText(groupJid, memberJid) {
    const nick = contactManager.getNickname(memberJid);
    if (nick) return nick;
    return `@${memberJid.split('@')[0]}`;
}


module.exports = {
    loadState,
    forceSave,
    getGroupState,
    isActive,
    activate,
    deactivate,
    resetGroup,
    getCurrentMember,
    advanceDay,
    submitSong,
    skipCurrent,
    markNotified,
    wasNotifiedToday,
    getSongHistory,
    getPending,
    getAllPending,
    getRotation,
    getRanking,
    addMember,
    removeMember,
    getActiveGroups,
    todayStr,
    getMemberMentionText
};
