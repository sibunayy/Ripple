
export const store = { get(k, d) { try { const v = localStorage.getItem('rfp-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('rfp-' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } } };
