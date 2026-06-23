const axios = require('axios');

const API_BASE = 'https://pokeapi.co/api/v2';

const TYPE_EMOJI = {
    Normal: '⚪', Fire: '🔥', Water: '💧', Electric: '⚡', Grass: '🌿',
    Ice: '❄️', Fighting: '🥊', Poison: '☠️', Ground: '🏜️', Flying: '🕊️',
    Psychic: '🔮', Bug: '🐛', Rock: '🪨', Ghost: '👻', Dragon: '🐉',
    Dark: '🌑', Steel: '⚙️', Fairy: '🧚'
};

const TYPE_NAME_PT = {
    Normal: 'Normal', Fire: 'Fogo', Water: 'Agua', Electric: 'Eletrico', Grass: 'Planta',
    Ice: 'Gelo', Fighting: 'Lutador', Poison: 'Veneno', Ground: 'Terra', Flying: 'Voador',
    Psychic: 'Psiquico', Bug: 'Inseto', Rock: 'Pedra', Ghost: 'Fantasma', Dragon: 'Dragao',
    Dark: 'Sombrio', Steel: 'Aco', Fairy: 'Fada'
};

class PokeApiPokemonService {
    constructor() {
        this.http = axios.create({
            baseURL: API_BASE,
            timeout: 12000
        });

        this.pokemonById = new Map();
        this.pokemonByName = new Map();
        this.speciesCache = new Map();
        this.moveCache = new Map();
        this.typeChart = {};
        this.pokedexIndex = null;
        this.initialized = false;
    }

    normalize(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    toDisplayName(slug) {
        return slug
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    toTypeName(rawTypeName) {
        if (!rawTypeName) return 'Normal';
        return rawTypeName.charAt(0).toUpperCase() + rawTypeName.slice(1).toLowerCase();
    }

    async ensureInitialized() {
        if (this.initialized) return;
        await this.loadTypeChart();
        this.initialized = true;
    }

    async loadTypeChart() {
        if (Object.keys(this.typeChart).length > 0) return;

        const ids = Array.from({ length: 18 }, (_, i) => i + 1);
        const responses = await Promise.all(ids.map(id => this.http.get(`/type/${id}`)));

        for (const res of responses) {
            const atkType = this.toTypeName(res.data.name);
            const row = {};

            for (const t of res.data.damage_relations.double_damage_to) {
                row[this.toTypeName(t.name)] = 2;
            }
            for (const t of res.data.damage_relations.half_damage_to) {
                const key = this.toTypeName(t.name);
                row[key] = (row[key] || 1) * 0.5;
            }
            for (const t of res.data.damage_relations.no_damage_to) {
                row[this.toTypeName(t.name)] = 0;
            }

            this.typeChart[atkType] = row;
        }
    }

    getEffectiveness(atkType, defTypes) {
        let mult = 1;
        const chart = this.typeChart[atkType] || {};
        for (const d of defTypes) {
            if (chart[d] !== undefined) mult *= chart[d];
        }
        return mult;
    }

    async getSpeciesInfo(idOrName) {
        const key = String(idOrName);
        if (this.speciesCache.has(key)) return this.speciesCache.get(key);

        const res = await this.http.get(`/pokemon-species/${idOrName}`);
        const info = {
            legendary: Boolean(res.data?.is_legendary),
            mythical: Boolean(res.data?.is_mythical)
        };
        this.speciesCache.set(key, info);
        return info;
    }

    async ensurePokedexIndex() {
        if (this.pokedexIndex) return;
        const countRes = await this.http.get('/pokemon?limit=1&offset=0');
        const total = Number(countRes.data?.count || 0);
        const res = await this.http.get(`/pokemon?limit=${total}&offset=0`);

        this.pokedexIndex = (res.data.results || [])
            .map((p) => {
                const match = String(p.url || '').match(/\/pokemon\/(\d+)\/?$/);
                const id = match ? Number(match[1]) : null;
                if (!id) return null;
                return {
                    id,
                    slug: p.name,
                    name: this.toDisplayName(p.name)
                };
            })
            .filter(Boolean);
    }

    async buildPokemonFromApi(data) {
        const statsMap = new Map(data.stats.map(s => [s.stat.name, s.base_stat]));
        const orderedStats = [
            statsMap.get('hp') || 1,
            statsMap.get('attack') || 1,
            statsMap.get('defense') || 1,
            statsMap.get('special-attack') || 1,
            statsMap.get('special-defense') || 1,
            statsMap.get('speed') || 1
        ];

        const moveSet = new Set();
        for (const m of data.moves || []) {
            const moveSlug = m.move?.name;
            if (!moveSlug) continue;
            moveSet.add(this.toDisplayName(moveSlug));
        }

        const speciesRef = data.species?.name || data.id;
        const speciesInfo = await this.getSpeciesInfo(speciesRef);

        const pkm = {
            id: data.id,
            name: this.toDisplayName(data.name),
            types: (data.types || [])
                .sort((a, b) => (a.slot || 0) - (b.slot || 0))
                .map(t => this.toTypeName(t.type?.name)),
            stats: orderedStats,
            moves: Array.from(moveSet),
            legendary: speciesInfo.legendary || speciesInfo.mythical
        };

        this.pokemonById.set(pkm.id, pkm);
        this.pokemonByName.set(this.normalize(pkm.name), pkm);
        return pkm;
    }

    async fetchPokemonBySlug(slug) {
        const res = await this.http.get(`/pokemon/${slug}`);
        const pkm = await this.buildPokemonFromApi(res.data);
        return pkm;
    }

    async getPokemonById(id) {
        const num = Number(id);
        if (!Number.isInteger(num) || num < 1) return null;
        if (this.pokemonById.has(num)) return this.pokemonById.get(num);

        const pkm = await this.fetchPokemonBySlug(num);
        return pkm;
    }

    async getPokemonByListEntry(entry) {
        if (!entry) return null;

        if (entry.id && this.pokemonById.has(entry.id)) {
            return this.pokemonById.get(entry.id);
        }

        const normalizedName = this.normalize(entry.name || entry.slug);
        if (normalizedName && this.pokemonByName.has(normalizedName)) {
            return this.pokemonByName.get(normalizedName);
        }

        return this.fetchPokemonBySlug(entry.slug);
    }

    async findPokemon(query) {
        await this.ensureInitialized();

        const byId = Number(query);
        if (Number.isInteger(byId) && String(byId) === String(query).trim()) {
            return this.getPokemonById(byId);
        }

        const normalized = this.normalize(query);
        if (!normalized) return null;

        if (this.pokemonByName.has(normalized)) {
            return this.pokemonByName.get(normalized);
        }

        const asSlug = String(query || '').trim().toLowerCase().replace(/\s+/g, '-');
        try {
            const pkm = await this.fetchPokemonBySlug(asSlug);
            if (pkm) return pkm;
        } catch (_) {
            // Fall through to partial search
        }

        await this.ensurePokedexIndex();
        const partial = this.pokedexIndex.find(p => this.normalize(p.name).includes(normalized));
        if (!partial) return null;
        return this.getPokemonById(partial.id);
    }

    async getPokedexPage(page = 1, perPage = 15) {
        await this.ensureInitialized();
        await this.ensurePokedexIndex();

        const totalPages = Math.ceil(this.pokedexIndex.length / perPage);
        const clampedPage = Math.max(1, Math.min(Number(page) || 1, totalPages));
        const start = (clampedPage - 1) * perPage;
        const end = Math.min(start + perPage, this.pokedexIndex.length);

        const slice = this.pokedexIndex.slice(start, end);
        const itemsSettled = await Promise.allSettled(slice.map(p => this.getPokemonByListEntry(p)));
        const items = itemsSettled
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        return {
            page: clampedPage,
            totalPages,
            total: this.pokedexIndex.length,
            items
        };
    }

    mapTypeQueryToCanonical(typeQuery) {
        if (!typeQuery) return null;
        const normalized = this.normalize(typeQuery);

        for (const type of Object.keys(TYPE_NAME_PT)) {
            const pt = TYPE_NAME_PT[type];
            if (this.normalize(type) === normalized || this.normalize(pt) === normalized) {
                return type;
            }
        }

        return null;
    }

    async getPokemonByType(typeQuery) {
        const canonical = this.mapTypeQueryToCanonical(typeQuery);
        if (!canonical) return { type: null, list: [] };

        await this.ensurePokedexIndex();
        const all = await Promise.all(this.pokedexIndex.map(p => this.getPokemonById(p.id)));
        const filtered = all.filter(p => p && p.types.includes(canonical));

        return { type: canonical, list: filtered };
    }

    parseMoveAilment(move, parsed) {
        const ailment = move.meta?.ailment?.name;
        const chance = Number(move.effect_chance || move.meta?.ailment_chance || 0);
        if (!ailment) return;

        if (ailment === 'burn') {
            if (parsed.cat === 'status') parsed.setStatus = 'burned';
            else if (chance > 0) parsed.burn = chance;
        }
        if (ailment === 'paralysis') {
            if (parsed.cat === 'status') parsed.setStatus = 'paralyzed';
            else if (chance > 0) parsed.paralyze = chance;
        }
        if (ailment === 'sleep') {
            parsed.setStatus = 'asleep';
        }
        if (ailment === 'freeze') {
            if (parsed.cat === 'status') parsed.setStatus = 'frozen';
            else if (chance > 0) parsed.freeze = chance;
        }
        if (ailment === 'poison') {
            if (parsed.cat === 'status') parsed.setStatus = 'poisoned';
            else if (chance > 0) parsed.poison = chance;
        }
        if (ailment === 'bad-poison') {
            parsed.setStatus = 'badly_poisoned';
        }
    }

    parseMoveStatChanges(move, parsed) {
        if (!Array.isArray(move.stat_changes) || move.stat_changes.length === 0) return;

        const statKeyMap = {
            attack: 'atk',
            defense: 'def',
            'special-attack': 'spa',
            'special-defense': 'spd',
            speed: 'spe',
            accuracy: 'acc',
            evasion: 'eva'
        };

        const target = move.target?.name || '';
        const affectsSelf = target.includes('user');

        for (const s of move.stat_changes) {
            const key = statKeyMap[s.stat?.name];
            if (!key) continue;
            const change = Number(s.change || 0);
            if (!change) continue;

            if (affectsSelf && change > 0) {
                parsed.boost = parsed.boost || {};
                parsed.boost[key] = (parsed.boost[key] || 0) + change;
            } else if (affectsSelf && change < 0) {
                parsed.selfDebuff = parsed.selfDebuff || {};
                parsed.selfDebuff[key] = (parsed.selfDebuff[key] || 0) + change;
            } else if (!affectsSelf && change < 0) {
                parsed.debuff = parsed.debuff || {};
                parsed.debuff[key] = (parsed.debuff[key] || 0) + change;
            }
        }
    }

    parseMoveSpecialCases(slug, move, parsed) {
        if (slug === 'toxic') parsed.setStatus = 'badly_poisoned';
        if (slug === 'leech-seed') parsed.seed = true;
        if (slug === 'rest') {
            parsed.fullHeal = true;
            parsed.selfSleep = 2;
        }

        if (slug === 'dragon-rage') parsed.fixedDamage = 40;
        if (slug === 'night-shade' || slug === 'seismic-toss') parsed.fixedDamage = 50;

        if (move.meta?.drain) {
            const drain = Number(move.meta.drain);
            if (drain > 0) parsed.drain = drain / 100;
            if (drain < 0) parsed.recoil = Math.abs(drain) / 100;
        }

        if (move.meta?.healing) {
            const healing = Number(move.meta.healing);
            if (healing > 0) parsed.heal = healing / 100;
        }

        if (move.meta?.crit_rate && Number(move.meta.crit_rate) > 0) {
            parsed.critRate = 3;
        }
    }

    parseMoveData(move) {
        const slug = move.name;
        const parsed = {
            type: this.toTypeName(move.type?.name),
            cat: move.damage_class?.name === 'status' ? 'status' : move.damage_class?.name,
            pow: Number(move.power || 0),
            acc: move.accuracy == null ? 999 : Number(move.accuracy),
            pp: Number(move.pp || 10),
            priority: Number(move.priority || 0)
        };

        if (parsed.cat !== 'physical' && parsed.cat !== 'special' && parsed.cat !== 'status') {
            parsed.cat = parsed.pow > 0 ? 'physical' : 'status';
        }

        this.parseMoveAilment(move, parsed);
        this.parseMoveStatChanges(move, parsed);
        this.parseMoveSpecialCases(slug, move, parsed);

        return parsed;
    }

    async getMoveData(moveName) {
        await this.ensureInitialized();

        const cacheKey = this.normalize(moveName);
        if (this.moveCache.has(cacheKey)) return this.moveCache.get(cacheKey);

        const slug = String(moveName || '').trim().toLowerCase().replace(/\s+/g, '-');
        try {
            const res = await this.http.get(`/move/${slug}`);
            const parsed = this.parseMoveData(res.data);
            this.moveCache.set(cacheKey, parsed);
            this.moveCache.set(this.normalize(this.toDisplayName(res.data.name)), parsed);
            return parsed;
        } catch (_) {
            return null;
        }
    }

    async resolveMoveSet(moveNames, minCount = 4) {
        const picked = [];
        for (const name of moveNames) {
            if (picked.length >= minCount) break;
            const data = await this.getMoveData(name);
            if (!data) continue;
            picked.push({ name, data });
        }
        return picked;
    }

    async getAllPokemon() {
        await this.ensureInitialized();
        await this.ensurePokedexIndex();

        const entries = this.pokedexIndex;
        const all = [];
        const chunkSize = 20;

        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);
            const loaded = await Promise.allSettled(chunk.map(entry => this.getPokemonByListEntry(entry)));
            all.push(...loaded.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value));
        }

        return all;
    }
}

module.exports = new PokeApiPokemonService();
module.exports.TYPE_EMOJI = TYPE_EMOJI;
module.exports.TYPE_NAME_PT = TYPE_NAME_PT;
