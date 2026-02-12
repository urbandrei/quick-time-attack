// Leaderboard module — dual storage: localStorage (always) + remote API (when configured)
// Remote backend: Leaderboard Creator by danqzq (https://lcv2-server.danqzq.games)

// Set public key here after creating a leaderboard on Leaderboard Creator
const PUBLIC_KEY = '40e0e746ba98c0cd919537602faf2adbea4a763cfa87556c84b295c7f19fd7c9';

const API_BASE = 'https://lcv2-server.danqzq.games';
const STORAGE_KEY = 'qta_leaderboard';
const GUID_KEY = 'qta_player_guid';
const MAX_ENTRIES = 100;

function _generateGuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: random hex string
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function _getGuid() {
  let guid = localStorage.getItem(GUID_KEY);
  if (!guid) {
    guid = _generateGuid();
    localStorage.setItem(GUID_KEY, guid);
  }
  return guid;
}

function _loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function _saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function _sortEntries(entries) {
  entries.sort((a, b) => b.levelDepth - a.levelDepth);
}

export const leaderboard = {
  entries: [],
  playerGuid: '',
  loading: false,
  lastError: null,

  _init() {
    this.playerGuid = _getGuid();
    this.entries = _loadEntries();
    _sortEntries(this.entries);
  },

  submitEntry(nickname, levelDepth, enemiesKilled, runLength) {
    if (!this.playerGuid) this._init();

    const entry = {
      nickname,
      levelDepth,
      enemiesKilled,
      runLength,
      timestamp: Date.now(),
      guid: this.playerGuid,
    };

    this.entries.push(entry);
    _sortEntries(this.entries);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES;
    }
    _saveEntries(this.entries);

    // Fire-and-forget remote submission
    if (PUBLIC_KEY) {
      this._submitRemote(entry);
    }

    return entry;
  },

  getEntries() {
    if (!this.playerGuid) this._init();
    return this.entries;
  },

  async fetchRemoteEntries() {
    if (!PUBLIC_KEY) return;
    if (!this.playerGuid) this._init();

    this.loading = true;
    this.lastError = null;

    try {
      const url = `${API_BASE}/get?publicKey=${encodeURIComponent(PUBLIC_KEY)}&userGuid=${encodeURIComponent(this.playerGuid)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data.entries || !Array.isArray(data.entries)) return;

      // Map remote format to local format
      const remoteEntries = data.entries.map(e => {
        let extra = {};
        try { extra = JSON.parse(e.extra || '{}'); } catch { /* ignore */ }
        return {
          nickname: e.username,
          levelDepth: e.score,
          enemiesKilled: extra.k || 0,
          runLength: extra.t || 0,
          timestamp: e.date ? new Date(e.date).getTime() : 0,
          guid: e.userGuid || '',
          rank: e.rank,
        };
      });

      // Merge: use remote entries as authoritative, keep local entries that aren't duplicates
      const remoteGuids = new Set(remoteEntries.map(e => `${e.guid}_${e.levelDepth}`));
      const uniqueLocal = this.entries.filter(e =>
        !e.guid || !remoteGuids.has(`${e.guid}_${e.levelDepth}`)
      );

      this.entries = [...remoteEntries, ...uniqueLocal];
      _sortEntries(this.entries);
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.length = MAX_ENTRIES;
      }
      _saveEntries(this.entries);
    } catch (err) {
      this.lastError = err.message;
    } finally {
      this.loading = false;
    }
  },

  async _submitRemote(entry) {
    try {
      const formData = new FormData();
      formData.append('publicKey', PUBLIC_KEY);
      formData.append('username', entry.nickname);
      formData.append('score', String(entry.levelDepth));
      formData.append('userGuid', this.playerGuid);
      formData.append('extra', JSON.stringify({ k: entry.enemiesKilled, t: entry.runLength }));

      await fetch(`${API_BASE}/entry/upload`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      // Fire-and-forget — silently ignore errors
    }
  },
};

// Auto-initialize
leaderboard._init();
