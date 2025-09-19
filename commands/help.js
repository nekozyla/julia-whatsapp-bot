// commands/help.js

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    const helpText = `
*Guia de Comandos da Julia* ✨

Aqui está uma lista completa de tudo que eu posso fazer!

*--- 🎨 Mídia e Criação ---*

*/sticker [opções]*
_Cria uma figurinha a partir de uma imagem ou GIF._
- Opção \`quadrado\`: Cria uma figurinha quadrada (apenas para imagens).
- Opção \`pack:"nome"\`: Define o nome do pacote.
Ex: \`/sticker quadrado pack:"Memes"\`

*/renomear [opções]*
_Renomeia o pacote e/ou autor de uma figurinha respondida._
Ex: \`/renomear pack:"Meu Pack" autor:"Emily"\`

*/toimage*
_Converte uma figurinha de volta para uma imagem._
Ex: (responda a uma figurinha com \`/toimage\`)

*/brat [texto]*
_Cria uma figurinha no estilo "Brat" com o seu texto._
Ex: \`/brat club classics\`

*/patpat*
_Cria um meme 'pat-pat' com uma imagem._
Ex: (responda a uma imagem com \`/patpat\`)


*--- 📥 Downloads ---*

*/audio <link>*
_Baixa o áudio de um link (YouTube, Spotify, etc.)._
Ex: \`/audio https://youtu.be/...\`

*/video <link>*
_Baixa um vídeo de um link (YouTube, etc.)._
Ex: \`/video https://youtu.be/...\`

*--- 🎉 Diversão e Interação ---*

*/top [assunto]*
_Cria um ranking aleatório com 10 pessoas do grupo._
Ex: \`/top10 mais legais do grupo\`

*/shipp [@pessoa1] [@pessoa2]*
_Calcula a compatibilidade entre duas pessoas._
Ex: \`/shipp @Amigo1 @Amiga2\`

*/gado [@pessoa]*
_Mede o seu nível de 'gado' ou o de alguém que você marcar._
Ex: \`/gado @Amigo\`


*--- 🤖 IA e Utilitários ---*

*/ia [on/off]*
_Ativa ou desativa a minha personalidade de conversa neste chat._
Ex: \`/ia on\`

*/persona [nome]*
_Muda a minha personalidade. Opções: julia, emilia, maria._
Ex: \`/personalidade emilia\`

*/pergunta [pergunta]*
_Faz uma pergunta direta à minha base de conhecimento, sem a minha persona._
Ex: \`/ask qual a capital da Mongólia\`

*/pesquisa [pergunta]*
_Realiza uma busca na internet e resume o resultado._
Ex: \`/pesquisa sobre buracos negros\`

*/transcrever*
_Transcreve o conteúdo de uma mensagem de áudio respondida._


*--- 👑 Comandos de Admin ---*

*/todos [mensagem]*
_Menciona todos os membros do grupo._

*/remover [@pessoa]*
_Remove um membro do grupo._


*--- ⚙️ Modos de Grupo ---*
_(Podem ser ativados por admins)_

*/modosticker [on/off]*
_No privado, converte toda imagem em figurinha._

*/modomeme [on/off]*
_Reage a todas as mensagens com emojis aleatórios._

*/modotomate [on/off]*
_Reage com um 🍅 a mensagens consideradas polémicas._

*/modotranscricao [on/off]*
_Transcreve todos os áudios enviados no chat._

*/fiscalizar [on/off]*
_Envia uma figurinha de "fiscalização" aleatoriamente no grupo._
`;

    try {
        await sock.sendMessage(sender, { text: helpText.trim() });
    } catch (error) {
        console.error("[Help] Erro ao enviar a mensagem de ajuda:", error);
    }

    return true;
}

module.exports = handleHelpCommand;
