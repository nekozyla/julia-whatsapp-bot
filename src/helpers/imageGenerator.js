const axios = require('axios');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const config = require('../../config/config');


const puppeteer = require('puppeteer-core');
const path = require('path');
const fsSync = require('fs'); 


async function generateImage(html, outputPath, content = {}, options = { width: 800, height: 350 }) {

    let browser = null;
    try {
        
        const template = handlebars.compile(html);
        const compiledHtml = template(content);

        
        
        const executablePath = path.resolve('./chromium_arm_final/chrome-linux/chrome');

        if (!fsSync.existsSync(executablePath)) {
            throw new Error(`Navegador local não encontrado em: ${executablePath}`);
        }

        browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--font-render-hinting=none'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({
            width: options.width,
            height: options.height,
            deviceScaleFactor: 2
        });

        
        await page.setContent(compiledHtml, { waitUntil: 'networkidle0' });

        
        await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });

    } catch (error) {
        console.error("[ImageGenerator] Error generating image locally:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { generateImage };
