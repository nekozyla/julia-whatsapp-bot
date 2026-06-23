const fs = require('fs');
const path = require('path');

// Caminhos básicos
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const packageJsonPath = path.join(rootDir, 'package.json');

// Mapeamentos
const allJsFiles = [];
const importGraph = {}; // key: arquivo_absoluto, value: array de arquivos importados
const importedBy = {}; // key: arquivo_absoluto, value: array de arquivos que o importam

// Mapear recursivamente arquivos JS
function walkDir(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            // Ignorar pastas temporárias e recursos de mídia
            if (file !== 'node_modules' && file !== 'temp' && file !== 'assets' && file !== '.git') {
                walkDir(filePath);
            }
        } else if (file.endsWith('.js')) {
            allJsFiles.push(filePath);
        }
    });
}

// Extrair dependências de um arquivo usando regex simples mas eficaz
function extractRequires(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const requires = [];
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        requires.push(match[1]);
    }
    return requires;
}

function resolveLocalRequire(sourceFile, requirePath) {
    if (!requirePath.startsWith('.')) return null; // Não é relativo (provavelmente pacote npm ou módulo interno do Node)
    
    const sourceDir = path.dirname(sourceFile);
    let resolved = path.resolve(sourceDir, requirePath);
    
    // Tenta resolver extensões
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
    }
    if (fs.existsSync(resolved + '.js')) {
        return resolved + '.js';
    }
    if (fs.existsSync(path.join(resolved, 'index.js'))) {
        return path.join(resolved, 'index.js');
    }
    
    return null;
}

function analyzeImports() {
    walkDir(srcDir);
    
    allJsFiles.forEach(file => {
        importGraph[file] = [];
        if (!importedBy[file]) importedBy[file] = [];
    });
    
    allJsFiles.forEach(file => {
        const reqs = extractRequires(file);
        reqs.forEach(req => {
            const resolved = resolveLocalRequire(file, req);
            if (resolved && allJsFiles.includes(resolved)) {
                importGraph[file].push(resolved);
                if (!importedBy[resolved]) importedBy[resolved] = [];
                if (!importedBy[resolved].includes(file)) {
                    importedBy[resolved].push(file);
                }
            }
        });
    });
}

function checkOrphanFiles() {
    console.log('\n🔍 [1/3] VERIFICANDO ARQUIVOS JS ÓRFÃOS...');
    
    const orphans = [];
    const commandsDir = path.join(srcDir, 'commands');
    
    allJsFiles.forEach(file => {
        const relativePath = path.relative(rootDir, file);
        
        // Pular arquivos base, loaders, manipuladores de evento e comandos que são carregados dinamicamente
        if (
            file.startsWith(commandsDir) ||
            relativePath === 'src/main.js' ||
            relativePath === 'src/loader.js' ||
            relativePath === 'src/messageHandler.js'
        ) {
            return;
        }
        
        const importers = importedBy[file] || [];
        if (importers.length === 0) {
            orphans.push(relativePath);
        }
    });
    
    if (orphans.length === 0) {
        console.log('✅ Nenhum arquivo JavaScript órfão encontrado na pasta src/. Excelente!');
    } else {
        console.log(`⚠️  Encontrado(s) ${orphans.length} arquivo(s) órfão(s) que não são importados por ninguém:`);
        orphans.forEach(file => console.log(`  - \x1b[33m${file}\x1b[0m`));
        console.log('\n💡 Dica: Verifique se esses arquivos são lixo legado e podem ser excluídos com segurança.');
    }
    return orphans;
}

function checkInvalidCommands() {
    console.log('\n🔍 [2/3] VERIFICANDO COMANDOS DA PASTA src/commands/...');
    
    const commandsDir = path.join(srcDir, 'commands');
    if (!fs.existsSync(commandsDir)) {
        console.log('❌ Pasta src/commands/ não encontrada.');
        return;
    }
    
    const invalidCommands = [];
    const files = fs.readdirSync(commandsDir);
    
    files.forEach(file => {
        if (!file.endsWith('.js')) return;
        const filePath = path.join(commandsDir, file);
        const relativePath = path.relative(rootDir, filePath);
        
        try {
            const commandModule = require(filePath);
            const errors = [];
            
            if (typeof commandModule !== 'function') {
                errors.push('O export padrão do módulo não é uma função.');
            }
            if (!commandModule.commandData) {
                errors.push('Objeto "commandData" de metadados está ausente.');
            } else {
                if (!commandModule.commandData.name) {
                    errors.push('Propriedade "commandData.name" está ausente.');
                }
            }
            
            if (errors.length > 0) {
                invalidCommands.push({ file: relativePath, errors });
            }
        } catch (err) {
            invalidCommands.push({ file: relativePath, errors: [`Erro de carregamento: ${err.message}`] });
        }
    });
    
    if (invalidCommands.length === 0) {
        console.log('✅ Todos os arquivos na pasta de comandos são válidos e exportam corretamente!');
    } else {
        console.log(`⚠️  Encontrado(s) ${invalidCommands.length} comando(s) com erros ou inoperantes:`);
        invalidCommands.forEach(cmd => {
            console.log(`  - \x1b[31m${cmd.file}\x1b[0m`);
            cmd.errors.forEach(err => console.log(`    ↳ Erro: ${err}`));
        });
    }
}

function checkUnusedDependencies() {
    console.log('\n🔍 [3/3] VERIFICANDO DEPENDÊNCIAS NÃO UTILIZADAS NO package.json...');
    
    if (!fs.existsSync(packageJsonPath)) {
        console.log('❌ package.json não encontrado na raiz.');
        return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    if (dependencies.length === 0) {
        console.log('✅ Nenhuma dependência declarada no package.json.');
        return;
    }
    
    // Mapear todos os requires de arquivos npm em todo o código-fonte
    const usedPackages = new Set();
    
    allJsFiles.forEach(file => {
        const reqs = extractRequires(file);
        reqs.forEach(req => {
            // Pega apenas a raiz do pacote (ex: "lodash/fp" vira "lodash")
            let rootPackage = req;
            if (req.startsWith('@')) {
                const parts = req.split('/');
                if (parts.length >= 2) {
                    rootPackage = `${parts[0]}/${parts[1]}`;
                }
            } else {
                rootPackage = req.split('/')[0];
            }
            
            if (!req.startsWith('.')) {
                usedPackages.add(rootPackage);
            }
        });
    });
    
    // Sempre marcar como "usados" pacotes que são executáveis ou de build
    const ignorePackages = ['nodemon', 'eslint', 'prettier', 'typescript'];
    
    const unused = dependencies.filter(dep => !usedPackages.has(dep) && !ignorePackages.includes(dep));
    
    if (unused.length === 0) {
        console.log('✅ Todas as dependências do package.json estão sendo importadas ativamente. Excelente!');
    } else {
        console.log(`⚠️  Encontradas ${unused.length} dependências instaladas que não são importadas em nenhum arquivo:`);
        unused.forEach(dep => console.log(`  - \x1b[33m${dep}\x1b[0m`));
        console.log('\n💡 Dica: Você pode desinstalá-las rodando: npm uninstall ' + unused.join(' '));
    }
}

// Rodar análises
console.log('======================================================================');
console.log('🤖  INICIANDO AUDITORIA DE CÓDIGO INÚTIL & SAÚDE DO BOT JULIA');
console.log('======================================================================');

analyzeImports();
checkOrphanFiles();
checkInvalidCommands();
checkUnusedDependencies();

console.log('\n======================================================================');
console.log('✅ Auditoria concluída com sucesso!');
console.log('======================================================================\n');
