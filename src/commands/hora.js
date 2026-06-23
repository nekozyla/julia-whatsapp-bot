
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const localizedFormat = require('dayjs/plugin/localizedFormat');
require('dayjs/locale/pt-br');


dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.locale('pt-br');
dayjs.tz.setDefault("America/Sao_Paulo");

const commonTimezones = {
    'brasil': 'America/Sao_Paulo',
    'br': 'America/Sao_Paulo',
    'sp': 'America/Sao_Paulo',
    'sao_paulo': 'America/Sao_Paulo',
    'portugal': 'Europe/Lisbon',
    'pt': 'Europe/Lisbon',
    'lisboa': 'Europe/Lisbon',
    'japao': 'Asia/Tokyo',
    'jp': 'Asia/Tokyo',
    'tokyo': 'Asia/Tokyo',
    'eua': 'America/New_York',
    'us': 'America/New_York',
    'ny': 'America/New_York',
    'nova_york': 'America/New_York',
    'londres': 'Europe/London',
    'uk': 'Europe/London',
    'china': 'Asia/Shanghai',
    'cn': 'Asia/Shanghai',
    'russia': 'Europe/Moscow',
    'moscou': 'Europe/Moscow',
    'franca': 'Europe/Paris',
    'paris': 'Europe/Paris',
    'alemanha': 'Europe/Berlin',
    'berlim': 'Europe/Berlin',
    'angola': 'Africa/Luanda',
    'mocambique': 'Africa/Maputo',
    'argentina': 'America/Argentina/Buenos_Aires',
    'buenos_aires': 'America/Argentina/Buenos_Aires',
    'chile': 'America/Santiago',
    'santiago': 'America/Santiago',
    'mexico': 'America/Mexico_City',
    'india': 'Asia/Kolkata',
    'australia': 'Australia/Sydney',
    'sydney': 'Australia/Sydney',
    'dubai': 'Asia/Dubai',
    'utc': 'UTC',
    'gmt': 'UTC'
};

async function handleHoraCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, prefix, commandName } = msgDetails;

    try {
        let targetZone = 'America/Sao_Paulo';

        let query = '';
        if (commandText && commandText.startsWith(command)) {
            query = commandText.slice(command.length).trim().toLowerCase();
        } else {
            query = commandText ? commandText.trim().toLowerCase() : '';
        }

        if (query) {
            if (commonTimezones[query]) {
                targetZone = commonTimezones[query];
            } else {
                try {
                    dayjs().tz(query);
                    targetZone = query;
                } catch (e) {
                    const availableZones = Object.keys(commonTimezones).join(', ');
                    return sock.sendMessage(sender, {
                        text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Fuso "${query}" não encontrado\n┃\n┣━━❪ 𝗔𝗧𝗔𝗟𝗛𝗢𝗦 ❫━━\n┃\n┃ ➢ ${availableZones}\n┃\n┗━━━━━━━━━━━━━━`
                    }, { quoted: msg });
                }
            }
        }

        const now = dayjs().tz(targetZone);
        const formattedTime = now.format('dddd, D [de] MMMM [de] YYYY [às] HH:mm:ss');

        await sock.sendMessage(sender, {
            text: `┏━━❪ 🕒 𝗛𝗢𝗥𝗔 ❫━━\n┃\n┃ ➢ 𝗟𝗼𝗰𝗮𝗹 › ${targetZone}\n┃ ➢ 𝗛𝗼𝗿𝗮 › ${formattedTime}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (error) {
        console.error("[Hora] Erro ao obter a hora:", error);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Fuso horário inválido\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    return true;
}

module.exports = handleHoraCommand;


module.exports.commandData = {
    name: "hora",
    description: "Mostra hora atual.",
    category: "util",
    usage: "/hora [local]",
    aliases: ["/tempo", "/relogio", "/time"]
};
