// commands/help.js

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    const helpText = `
*Guia de Comandos da Julia* ✨

Aqui está uma lista completa de tudo que eu posso fazer!

*--- 🎨 Mídia e Criação ---*

*/sticker [opções]*
_Cria uma figurinha a partir de uma imagem ou GIF._
- Opção \`quadrado\`: Corta a imagem para caber num quadrado.
- Opção \`esticado\`: Estica a imagem para caber num quadrado.
- Opção \`pack:"nome"\`: Define o nome do pacote.
Ex: \`/sticker esticado pack:"Memes"\`

*/renomear [opções]*
_Renomeia o pacote e/ou autor de uma figurinha respondida._
Ex: \`/renomear pack:"Meu Pack" autor:"Emily"\`

*/toimage*
_Converte uma figurinha de volta para uma imagem._
Ex: (responda a uma figurinha com \`/toimage\`)

*/meme <número> "[texto1]" "[texto2]"*
_Cria um meme com base numa lista de templates populares._
- Use \`/meme\` para ver a lista completa de templates.
Ex: \`/meme 1 "Texto de cima" "Texto de baixo"\`

*/brat [predefinição] [texto]*
_Cria uma figurinha no estilo "Brat" com o seu texto._
Ex: \`/brat deluxe club classics\`

*/patpat*
_Cria um meme 'pat-pat' com uma imagem ou figurinha._
Ex: (responda a uma imagem com \`/patpat\`)

\`/lowres [1-100]\`
_Distorce uma imagem ou figurinha estática, reduzindo drasticamente a qualidade._
Ex: (responda a uma imagem com \`/lowres 1\`)

\`/capa\`
_Adiciona o selo "Parental Advisory" a uma imagem ou figurinha estática._
Ex: (responda a uma imagem com \`/capa\`)


*--- 📥 Downloads ---*

*/audio <link>*
_Baixa o áudio de um link (YouTube, Spotify, etc.)._
Ex: \`/audio https://youtu.be/...\`

*/video <link>*
_Baixa um vídeo de um link (YouTube, etc.)._
Ex: \`/video https://youtu.be/...\`


*--- 🎉 Diversão e Interação ---*

*/casar | /casamento | /aceitar | /divorcio | /casados*
_Sistema de casamento poliamoroso do grupo._
- \`/casar @pessoa\`: Pede alguém em casamento.
- \`/casamento\`: Mostra com quem você está casado(a).
- \`/aceitar\`: Aceita um pedido pendente.
- \`/divorcio @pessoa\`: Termina o seu casamento com uma pessoa específica.
- \`/casados\`: Mostra a lista de todos os casamentos do grupo.
- \`/casar --force @p1 @p2\`: (Admin) Casa dois membros à força.

*/np [usuário]*
_Mostra o que você ou outro usuário está a ouvir no Last.fm._
- Use \`/np set <seu_nick>\` para definir o seu perfil.
Ex: \`/np nekozylajs\` ou simplesmente \`/np\`

*/top [assunto]*
_Cria um ranking aleatório com 10 pessoas do grupo._
Ex: \`/top mais legais do grupo\`

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
_Muda a minha personalidade (opções: julia, emilia, maria)._
Ex: \`/persona emilia\`

*/pergunta [texto]*
_Faz uma pergunta direta à minha base de conhecimento._
Ex: \`/pergunta qual a capital da Mongólia\`

*/transcrever*
_Transcreve o conteúdo de uma mensagem de áudio respondida._

*/report [mensagem]*
_Envia uma mensagem de sugestão ou bug para meu desenvolvedor._
Ex: \`/report o comando /sticker não funciona com vídeos\`


*--- ⚙️ Utilidades e Modos ---*
_(Alguns modos só podem ser ativados por admins em grupos)_

*/modosticker [on/off]*
_Converte toda imagem/gif enviado no chat em figurinha._

*/modomeme [on/off]*
_Reage a todas as mensagens com emojis aleatórios._

*/modotomate [on/off]*
_Reage com um 🍅 a mensagens consideradas polémicas._

*/fiscalizar [on/off]*
_Envia uma figurinha de "fiscalização" aleatoriamente no grupo._


*--- 👑 Comandos de Admin de Grupo ---*


\`/restrict [opção]\`
_Gere as restrições de comandos e de chat no grupo._
- \`/restrict chat on|off\`: Ativa/desativa a restrição de chat (só comandos).
- \`/restrict chat on --reinforced\`: Ativa o modo que apaga todas as mensagens de não-admins (exceto comandos, imagens e stickers).
- \`/restrict command add|remove </comando>\`: Bloqueia/libera um comando.
- \`/restrict view\`: Mostra as restrições atuais.

*/todos [mensagem]*
_Menciona todos os membros do grupo._

*/remover [@pessoa]*
_Remove um membro do grupo._

*/jid*
_Mostra o JID (ID) do grupo ou do usuário._
`;

    try {
        await sock.sendMessage(sender, { text: helpText.trim() });
    } catch (error) {
        console.error("[Help] Erro ao enviar a mensagem de ajuda:", error);
    }

    return true;
}

module.exports = handleHelpCommand;
