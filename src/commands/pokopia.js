const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const { sendGiratinaError, getChromiumPath } = require('../utils/utils');

const GENERATOR_URL = 'https://pixelframe.design/pokopia-font-logo-generator/';

const MODE_ALIASES = new Map([
    ['screenshot', 'screenshot'],
    ['print', 'screenshot'],
    ['ss', 'screenshot'],
    ['sky', 'sky'],
    ['ceu', 'sky'],
    ['céu', 'sky'],
    ['standard', 'standard'],
    ['white', 'standard'],
    ['branco', 'standard'],
    ['alternate', 'alternate'],
    ['black', 'alternate'],
    ['preto', 'alternate']
]);

const MODE_SELECTOR = {
    screenshot: '#screenshot-option',
    sky: '#sky-option',
    standard: '#standard-option',
    alternate: '#alternate-option'
};

const BLOCKED_HOST_PATTERNS = [
    'googlesyndication.com',
    'doubleclick.net',
    'googletagmanager.com',
    'google-analytics.com',
    'nitropay.com',
    'monu.delivery',
    'adtarget.biz',
    'prebid'
];

function parseModeAndText(args = []) {
    if (!args.length) {
        return { mode: 'screenshot', text: '' };
    }

    const firstArg = (args[0] || '').toLowerCase();
    const parsedMode = MODE_ALIASES.get(firstArg);

    if (parsedMode) {
        return {
            mode: parsedMode,
            text: args.slice(1).join(' ').trim()
        };
    }

    return {
        mode: 'screenshot',
        text: args.join(' ').trim()
    };
}

async function configurePage(page) {
    await page.setViewport({ width: 1440, height: 1600, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        const url = request.url();
        const shouldBlock = BLOCKED_HOST_PATTERNS.some((pattern) => url.includes(pattern));

        if (shouldBlock) {
            request.abort().catch(() => { });
            return;
        }

        request.continue().catch(() => { });
    });
}

async function generatePokopiaImage(text, mode = 'screenshot') {
    const localBratChromiumPath = path.resolve('./chromium_arm_final/chrome-linux/chrome');
    const executablePath = fs.existsSync(localBratChromiumPath)
        ? localBratChromiumPath
        : await getChromiumPath();

    if (!executablePath) {
        throw new Error('Não encontrei Chrome/Chromium instalado para abrir o gerador.');
    }

    const selector = MODE_SELECTOR[mode] || MODE_SELECTOR.screenshot;
    let browser;

    try {
        browser = await puppeteer.launch({
            executablePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(60000);

        await configurePage(page);
        await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#input-text', { visible: true, timeout: 60000 });

        await page.$eval('#input-text', (input, value) => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, text);

        await page.click(selector);
        await page.click('#generate-button');

        await page.waitForFunction(() => {
            const image = document.querySelector('#cover-image');
            return image && typeof image.src === 'string' && image.src.startsWith('data:image/');
        }, { timeout: 60000 });

        const src = await page.$eval('#cover-image', (image) => image.src);
        const base64 = src.split(',')[1];

        if (!base64) {
            throw new Error('O site não retornou a imagem gerada.');
        }

        return Buffer.from(base64, 'base64');
    } finally {
        if (browser) {
            await browser.close().catch(() => { });
        }
    }
}

module.exports = async (sock, msg, msgDetails) => {
    const { sender, args = [], prefix, commandName } = msgDetails;
    const { mode, text } = parseModeAndText(args);

    if (!text) {
        const helpText = [
            '🎨 *Gerador Pokopia*',
            '',
            `*Uso:* ${prefix}${commandName} [modo] <texto>`,
            '',
            '*Modos:*',
            '- `screenshot` (padrão)',
            '- `sky`',
            '- `white` / `branco`',
            '- `black` / `preto`',
            '',
            '*Exemplos:*',
            `- ${prefix}${commandName} Emily`,
            `- ${prefix}${commandName} sky Emily`,
            `- ${prefix}${commandName} preto Emily`
        ].join('\n');

        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎮', key: msg.key } });

        const imageBuffer = await generatePokopiaImage(text, mode);
        const modeLabel = {
            screenshot: 'Screenshot',
            sky: 'Sky',
            standard: 'White',
            alternate: 'Black'
        }[mode] || 'Screenshot';

        await sock.sendMessage(sender, {
            image: imageBuffer,
            caption: `Pokopia gerado • modo ${modeLabel}`
        }, { quoted: msg });

        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (error) {
        console.error('[Pokopia] Erro ao gerar imagem:', error);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } }).catch(() => { });
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
};

module.exports.generatePokopiaImage = generatePokopiaImage;

module.exports.commandData = {
    name: 'pokopia',
    description: 'Gera uma imagem estilo Pokopia usando o site Pixelframe.',
    category: 'midia',
    usage: '/pokopia [modo] <texto>',
    aliases: ['/pokopialogo']
};