



const metadataCache = new Map();
const CACHE_TTL = 60 * 1000; 


async function getGroupMetadata(sock, groupJid) {
    if (!groupJid || !groupJid.endsWith('@g.us')) return null;

    const now = Date.now();
    const cached = metadataCache.get(groupJid);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const metadata = await sock.groupMetadata(groupJid);
        metadataCache.set(groupJid, {
            data: metadata,
            timestamp: now
        });
        return metadata;
    } catch (error) {
        console.error(`[GroupMetadataManager] Erro ao obter metadata do grupo ${groupJid}:`, error);
        return null;
    }
}


function invalidateCache(groupJid) {
    metadataCache.delete(groupJid);
}

module.exports = {
    getGroupMetadata,
    invalidateCache
};
