<div align="center">

# 🤖 Julia WhatsApp Bot

### Bot inteligente e completo para WhatsApp com dezenas de comandos e funcionalidades

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-v7.0-blue.svg)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/license-ISC-purple.svg)](LICENSE)

[Características](#-características) • [Instalação](#-instalação) • [Comandos](#-comandos) • [Configuração](#%EF%B8%8F-configuração)

</div>

---

## ✨ Características

- 🎨 **Sistema de perfis customizáveis** com temas (Minecraft, LCD, Neon e mais)
- 🎵 **Reprodução de áudio e música** com integração Spotify e YouTube Music
- 🎮 **Jogos interativos** (Jogo da Velha, Dados, Sorteios, BBB)
- 💑 **Sistema de relacionamentos** (Casamento, Adoção, Família)
- ⚔️ **Sistema de combate e lutas** entre membros
- 🏆 **Sistema de ranking e reputação** com pontos de aura
- 🎭 **Geração de memes e stickers** customizados
- 🛡️ **Moderação completa** (Ban, Kick, Advertências, VoteBan)
- 🔊 **550+ efeitos sonoros** com comando aleatório
- 🎨 **Edição de imagens** (RemoveBG, DeepFry, LowRes)
- 📊 **Sistema de estatísticas** e atividade de membros
- 🤝 **Interações sociais** (Abraço, Beijo, Soco, Tapa)

---

## 📦 Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [FFmpeg](https://ffmpeg.org/) instalado no sistema
- Uma conta do WhatsApp

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/nekozyla/julia-whatsapp-bot.git
cd julia-whatsapp-bot
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o arquivo `.env`**
```bash
cp .env.example .env
nano .env
```

Adicione suas credenciais:
```env
# Last.fm API (para comando /np - mostra música tocando)
LASTFM_API_KEY=sua_lastfm_api_key
LASTFM_USERNAME=seu_usuario_lastfm

# Spotify API (opcional - para letras e informações de músicas)
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret

# Outras configurações
BOT_NAME=Julia
PREFIX=/
```

4. **Inicie o bot**
```bash
node src/main.js
```

5. **Escaneie o QR Code** que aparecerá no terminal com seu WhatsApp

---

## 🎮 Comandos

### 🎨 Mídia e Stickers

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/sticker` | `/f`, `/fig`, `/s` | Converte imagem/vídeo em sticker |
| `/toimage` | `/toimg`, `/img` | Converte sticker em imagem |
| `/removebg` | `/bg`, `/nobg` | Remove fundo de imagens |
| `/fritar` | `/deepfry`, `/frita` | Aplica efeito deep fry |
| `/lowres` | `/low`, `/qualidade` | Reduz qualidade da imagem |
| `/gif` | - | Busca GIFs animados |
| `/meme` | - | Gera memes customizados |
| `/brat` | `/bratgreen`, `/charli` | Cria imagem estilo Brat |

### 🎵 Áudio e Música

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/audio` | `/musica`, `/mp3`, `/play` | Baixa áudio do YouTube |
| `/video` | `/vid`, `/mp4` | Baixa vídeo do YouTube |
| `/audioaleatorio` | `/fx`, `/sfx`, `/raudio` | Toca efeito sonoro aleatório (550+ sons!) |
| `/np` | `/music`, `/tocando`, `/lastfm` | Mostra música tocando no Last.fm/Spotify com letras |

### 👤 Perfil e Social

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/perfil` | `/eu`, `/profile` | Exibe seu perfil customizável |
| `/nick` | - | Define apelido personalizado |
| `/aura` | `/vibe`, `/pontos` | Mostra seus pontos de aura |
| `/auracard` | `/cardaura`, `/pontoscard` | Mostra seus pontos de aura em um card premium |
| `/rep` | `/reputacao`, `/moral` | Dá reputação para alguém |
| `/rank` | `/atividade`, `/stats`, `/xp` | Ranking de atividade |
| `/dna` | - | Teste de DNA entre dois membros |

### 💑 Relacionamentos

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/relacionamentos` | `/casar`, `/familia` | Sistema completo de relacionamentos |
| - | `/divorcio` | Divorciar-se |
| - | `/adotar`, `/filhos` | Adotar membros como filhos |
| - | `/pais`, `/casados` | Ver relacionamentos |
| `/shipp` | `/ship`, `/casal`, `/love` | Calcula compatibilidade |

### ⚔️ Combate e Interações

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/lutar` | - | Desafia alguém para luta |
| `/aceitarluta` | - | Aceita desafio de luta |
| `/soco` | `/punch`, `/socar` | Dá um soco em alguém |
| `/tapa` | - | Dá um tapa em alguém |
| `/abraco` | - | Abraça alguém |
| `/beijo` | - | Beija alguém |

### 🎮 Jogos e Diversão

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/velha` | `/jogodavelha`, `/ttt` | Joga o jogo da velha |
| `/dado` | `/d`, `/dice`, `/rolar` | Rola um dado |
| `/moeda` | `/coin`, `/cara`, `/coroa` | Cara ou coroa |
| `/sortear` | `/sorteio`, `/participar` | Sistema de sorteios |
| `/gadometro` | `/gado`, `/boi`, `/corno` | Mede o nível de gado |
| `/bbb` | - | Sistema BBB (Big Brother Brasil) |
| `/fakequote` | `/citacao`, `/quote` | Cria citações falsas |

### 🛡️ Moderação (Apenas Admins)

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/remover` | `/ban`, `/kick`, `/expulsar` | Remove membro do grupo |
| `/promote` | `/promover`, `/up` | Promove a admin |
| `/demote` | `/rebaixar`, `/down` | Remove admin |
| `/grupo` | `/abrir`, `/fechar`, `/link` | Gerencia configurações do grupo |
| `/alerta` | `/warn`, `/advertencia` | Sistema de advertências |
| `/apagar` | `/del`, `/delete` | Apaga mensagens |
| `/todos` | `/everyone`, `/marcar` | Marca todos os membros |
| `/banvote` | `/voteban`, `/vb` | Votação para banir |
| `/cabum` | `/nuke`, `/destruir` | Remove todos os membros |
| `/palavrao` | `/badwords` | Filtro de palavrões |
| `/antidelete` | `/ad` | Anti-delete de mensagens |
| `/boasvindas` | `/welcome`, `/bv` | Mensagens de boas-vindas |
| `/modotomate` | `/tomate` | Modo tomate (anti-spam) |
| `/modosticker` | `/autofig` | Auto-sticker |

### ℹ️ Utilidades

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/help` | `/ajuda`, `/comandos`, `/menu` | Lista de comandos |
| `/ping` | `/latencia`, `/ms`, `/status` | Verifica latência |
| `/jid` | `/id`, `/myid` | Mostra seu JID |
| `/hora` | `/tempo`, `/relogio` | Mostra hora atual |
| `/report` | `/reportar`, `/bug` | Reporta bugs |
| `/doacao` | - | Informações de doação |

### 👑 Admin do Bot

| Comando | Aliases | Descrição |
|---------|---------|-----------|
| `/broadcast` | `/bc`, `/anuncio` | Transmite mensagem para todos |
| `/adicionar` | `/permitir`, `/whitelist` | Adiciona grupo à whitelist |
| `/sincronizar` | `/sync`, `/sinc` | Sincroniza dados |
| `/restart` | `/reiniciar`, `/reset` | Reinicia o bot |

### 🎮 Integração Minecraft (Plugin WhatsAppBridge)

Comandos para gerenciar e interagir com o servidor de Minecraft vinculado (Paper 1.21).

| Comando | Aliases | Descrição | Requisito |
|---------|---------|-----------|-----------|
| `/minecraft info` | - | Status geral do servidor (TPS, RAM, Uptime) | Todos |
| `/minecraft players` | - | Lista de jogadores online no momento | Todos |
| `/minecraft player <nome>`| - | Visualiza a skin premium e status do jogador | Todos |
| `/minecraft timeline` | `/online` | Gráfico de atividade recente em imagem (HTML) | Todos |
| `/minecraft mapa <nome>` | `/map` | Minimapa do grid de blocos em volta do jogador | Todos |
| `/minecraft chat` | `/batepapo` | Mostra as mensagens recentes do chat in-game | Todos |
| `/minecraft vincular <nick>`| `/link` | Inicia o processo de vínculo de conta com o jogo | Todos |
| `/minecraft seed` | - | Exibe a seed do mapa atual do servidor | Todos |
| `/minecraft mundos` | - | Informações de dimensões carregadas | Todos |
| `/minecraft plugins` | - | Lista os plugins ativos no servidor | Todos |
| `/minecraft mods` | - | Lista os mods do modpack recomendados | Todos |
| `/minecraft perf` | `/hardware` | Gráficos de TPS e uso de memória RAM do Java | Todos |
| `/minecraft definirchat`| - | Integra o grupo do WhatsApp ao chat do jogo | Super Admin |
| `/minecraft config` | - | Habilita/desabilita logs (chat/join/quit) no grupo | Admin |
| `/minecraft tag` | - | Cria/atribui tags coloridas para o chat do jogo | Admin |
| `/minecraft cmd <comando>`| - | Executa comandos no console do Minecraft | Super Admin |

---

## 🛠️ Tecnologias

- **[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)** - Biblioteca para WhatsApp Web
- **[Node.js](https://nodejs.org/)** - Runtime JavaScript
- **[Puppeteer](https://pptr.dev/)** - Geração de imagens HTML
- **[FFmpeg](https://ffmpeg.org/)** - Processamento de mídia
- **[Last.fm API](https://www.last.fm/api)** - Integração com Last.fm para música tocando
- **[Spotify API](https://developer.spotify.com/)** - Integração com Spotify
- **[ytmusic-api](https://github.com/nickp10/youtube-music-api)** - Letras de músicas do YouTube Music
- **[Handlebars](https://handlebarsjs.com/)** - Templates HTML

---

## ⚙️ Configuração

### Sistema de Perfis

O bot possui um sistema completo de perfis customizáveis com múltiplos temas:
- 🎮 Minecraft
- 📺 LCD/Digital
- 🌊 Neon
- 🎨 E mais!

Use `/perfil` para acessar e customizar seu perfil.

### Efeitos Sonoros

O bot inclui **mais de 550 efeitos sonoros**! Use `/fx` para tocar um som aleatório da biblioteca.

> **Nota**: Os arquivos de áudio não estão incluídos no repositório. Adicione seus próprios arquivos `.mp3` em `src/assets/audio/`

### Background Customizado

Adicione imagens de fundo personalizadas em `data/user_backgrounds/[numero].jpg`

---

## 📝 Estrutura do Projeto

```
julia-whatsapp-bot/
├── src/
│   ├── commands/          # Comandos do bot
│   ├── managers/          # Gerenciadores (perfil, luta, BBB, etc)
│   ├── helpers/           # Funções auxiliares
│   ├── assets/            # Recursos (fontes, áudio, imagens)
│   └── config/            # Configurações e achievements
├── config/                # Arquivos de configuração
├── data/                  # Dados persistentes
├── tools/                 # Ferramentas de desenvolvimento
└── temp/                  # Arquivos temporários
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abrir um Pull Request

---

## 📄 Licença

Este projeto está sob a licença ISC.

---

## 🙏 Agradecimentos

- [Baileys](https://github.com/WhiskeySockets/Baileys) pela incrível biblioteca
- Comunidade open-source pelos pacotes utilizados
- Todos que contribuíram com ideias e feedback

---

<div align="center">

**Feito com ❤️ por [nekozyla](https://github.com/nekozyla)**

⭐ Dê uma estrela se este projeto te ajudou!

</div>
