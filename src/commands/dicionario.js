const axios = require('axios');

async function handleDicionarioCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const word = commandText.split(' ').slice(1).join(' ').trim().toLowerCase();

    if (!word) {
        const text = `┏━━❪ 📖 𝗗𝗜𝗖𝗜𝗢𝗡𝗔𝗥𝗜𝗢 ❫━━\n┃\n┃ ➢ Encontre o significado de uma palavra!\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <palavra>\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} saudade\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} love (inglês)\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(sender, { react: { text: '📖', key: msg.key } });

    // Try Portuguese first, then English
    let result = await searchDicio(word);
    let lang = 'pt';

    if (!result) {
        result = await searchEnglish(word);
        lang = 'en';
    }

    if (!result) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 📖 𝗗𝗜𝗖𝗜𝗢𝗡𝗔𝗥𝗜𝗢 ❫━━\n┃\n┃ ➢ Palavra "*${word}*" não encontrada!\n┃ ➢ Verifique a ortografia.\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const langLabel = lang === 'pt' ? '🇧🇷 Português' : '🇺🇸 English';

    let text = `┏━━❪ 📖 𝗗𝗜𝗖𝗜𝗢𝗡𝗔𝗥𝗜𝗢 ❫━━\n┃\n`;
    text += `┃ ➢ 𝗣𝗮𝗹𝗮𝘃𝗿𝗮 › *${result.word}*\n`;
    if (result.phonetic) text += `┃ ➢ 𝗙𝗼𝗻𝗲𝘁𝗶𝗰𝗮 › ${result.phonetic}\n`;
    text += `┃ ➢ 𝗜𝗱𝗶𝗼𝗺𝗮 › ${langLabel}\n`;
    text += `┃\n┣━━❪ 📝 𝗦𝗜𝗚𝗡𝗜𝗙𝗜𝗖𝗔𝗗𝗢𝗦 ❫━━\n┃\n`;

    result.meanings.slice(0, 4).forEach((m, i) => {
        if (m.partOfSpeech) text += `┃ ➢ _${m.partOfSpeech}_\n`;
        m.definitions.slice(0, 2).forEach((d) => {
            text += `┃ ${i + 1}. ${d.definition}\n`;
            if (d.example) text += `┃   📎 _"${d.example}"_\n`;
        });
    });

    if (result.synonyms && result.synonyms.length > 0) {
        text += `┃\n┣━━❪ 🔗 𝗦𝗜𝗡𝗢𝗡𝗜𝗠𝗢𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ ${result.synonyms.slice(0, 6).join(', ')}\n`;
    }

    text += `┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

async function searchEnglish(word) {
    try {
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 8000 });
        if (!data || !data[0]) return null;

        const entry = data[0];
        const synonyms = [];

        const meanings = entry.meanings.map(m => {
            m.definitions.forEach(d => {
                if (d.synonyms) synonyms.push(...d.synonyms);
            });
            if (m.synonyms) synonyms.push(...m.synonyms);

            return {
                partOfSpeech: m.partOfSpeech,
                definitions: m.definitions.slice(0, 3).map(d => ({
                    definition: d.definition,
                    example: d.example || null
                }))
            };
        });

        return {
            word: entry.word,
            phonetic: entry.phonetic || entry.phonetics?.[0]?.text || null,
            meanings,
            synonyms: [...new Set(synonyms)]
        };
    } catch {
        return null;
    }
}

async function searchDicio(word) {
    try {
        const { data } = await axios.get(`https://api.dicionario-aberto.net/word/${encodeURIComponent(word)}`, { timeout: 8000 });
        if (!data || !data[0]) return null;

        const entry = data[0];
        // Parse XML-like content from the API
        const rawDef = entry.xml || '';

        // Extract definitions from the XML content
        const defMatches = rawDef.match(/<def>([\s\S]*?)<\/def>/g);
        if (!defMatches || defMatches.length === 0) return null;

        const definitions = defMatches.map(d => {
            return d.replace(/<[^>]*>/g, '').trim();
        }).filter(d => d.length > 0);

        if (definitions.length === 0) return null;

        return {
            word: entry.word || word,
            phonetic: null,
            meanings: [{
                partOfSpeech: null,
                definitions: definitions.slice(0, 5).map(d => ({
                    definition: d.length > 200 ? d.substring(0, 200) + '...' : d,
                    example: null
                }))
            }],
            synonyms: []
        };
    } catch {
        return null;
    }
}

module.exports = handleDicionarioCommand;

module.exports.commandData = {
    name: "dicionario",
    description: "Encontra o significado de uma palavra.",
    category: "util",
    usage: "/dicionario <palavra>",
    aliases: ["/dict", "/definicao", "/significado", "/dic"]
};
