class VoteManager {
    constructor() {
        this.activeVotes = new Map();
    }

    createVote(msgId, chatJid, targetJid) {
        this.activeVotes.set(msgId, {
            chatJid,
            targetJid,
            votes: {
                yes: new Set(), 
                no: new Set()   
            },
            createdAt: Date.now()
        });
    }

    getVote(msgId) {
        return this.activeVotes.get(msgId);
    }

    deleteVote(msgId) {
        this.activeVotes.delete(msgId);
    }

    handleReaction(msg) {
        

        const reactionMessage = msg.message?.reactionMessage;
        if (!reactionMessage) {
            
            return;
        }

        const targetKey = reactionMessage.key;
        const emoji = reactionMessage.text;

        if (!targetKey || !targetKey.id) {
            
            return;
        }

        const msgId = targetKey.id;
        const vote = this.activeVotes.get(msgId);

        if (vote) {
            const voterJid = msg.key.participant || msg.key.remoteJid;

            

            
            vote.votes.yes.delete(voterJid);
            vote.votes.no.delete(voterJid);

            
            
            if (emoji === '👍') {
                vote.votes.yes.add(voterJid);
                
            } else if (emoji === '👎') {
                vote.votes.no.add(voterJid);
                
            } else {
                
            }
        } else {
            
        }
    }
}

module.exports = new VoteManager();
