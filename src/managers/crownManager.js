/**
 * crownManager.js — Manages artist crowns per group
 * A crown is held by the #1 listener of an artist in a group.
 * Data structure: { groupJid: { artistNameLower: { artistName, holderJid, holderUsername, plays, claimedAt, previousHolder } } }
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data/crowns.json');

class CrownManager {
    constructor() {
        this.data = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_PATH)) {
                this.data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
            }
        } catch (e) {
            console.error('[CrownManager] Error loading:', e.message);
            this.data = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[CrownManager] Error saving:', e.message);
        }
    }

    _key(artistName) {
        return artistName.toLowerCase().trim();
    }

    /**
     * Get the current crown holder for an artist in a group.
     * Returns null if no crown exists.
     */
    getCrown(groupJid, artistName) {
        const group = this.data[groupJid];
        if (!group) return null;
        return group[this._key(artistName)] || null;
    }

    /**
     * Set/update the crown for an artist in a group.
     * Returns { isNew, isStealed, previousHolder } indicating what happened.
     */
    setCrown(groupJid, artistName, holderJid, holderUsername, plays) {
        if (!this.data[groupJid]) this.data[groupJid] = {};

        const key = this._key(artistName);
        const existing = this.data[groupJid][key];

        const isNew = !existing;
        const isStealed = !isNew && existing.holderJid !== holderJid;
        const previousHolder = existing ? { ...existing } : null;

        // Only update if new holder or plays increased
        if (existing && existing.holderJid === holderJid && existing.plays >= plays) {
            return { isNew: false, isStealed: false, previousHolder: null, updated: false };
        }

        this.data[groupJid][key] = {
            artistName,
            holderJid,
            holderUsername,
            plays,
            claimedAt: Date.now(),
            previousHolder: isStealed ? { holderJid: existing.holderJid, holderUsername: existing.holderUsername, plays: existing.plays } : null
        };

        this.save();
        return { isNew, isStealed, previousHolder, updated: true };
    }

    /**
     * Get all crowns held by a user in a specific group.
     */
    getUserCrowns(groupJid, holderJid) {
        const group = this.data[groupJid];
        if (!group) return [];
        return Object.values(group)
            .filter(c => c.holderJid === holderJid)
            .sort((a, b) => b.plays - a.plays);
    }

    /**
     * Get crown leaderboard for a group (sorted by crown count).
     */
    getCrownLeaderboard(groupJid) {
        const group = this.data[groupJid];
        if (!group) return [];

        const counts = {};
        for (const crown of Object.values(group)) {
            const jid = crown.holderJid;
            if (!counts[jid]) {
                counts[jid] = { holderJid: jid, holderUsername: crown.holderUsername, count: 0, totalPlays: 0 };
            }
            counts[jid].count++;
            counts[jid].totalPlays += crown.plays;
        }

        return Object.values(counts).sort((a, b) => b.count - a.count || b.totalPlays - a.totalPlays);
    }

    /**
     * Remove crowns from a group that belong to a user no longer in the group.
     */
    removeCrown(groupJid, artistName) {
        const group = this.data[groupJid];
        if (!group) return;
        delete group[this._key(artistName)];
        this.save();
    }

    /**
     * Get total crown count for a group.
     */
    getGroupCrownCount(groupJid) {
        const group = this.data[groupJid];
        if (!group) return 0;
        return Object.keys(group).length;
    }
}

module.exports = new CrownManager();
