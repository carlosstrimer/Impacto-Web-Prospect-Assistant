// FILE: modules/importer.js
import { normalizeKey, uuid } from './utils.js';
import { detectDelimiter, parseCSV } from './csv-parser.js';

const ALIASES = {
  nome: ['nome','empresa','name','company','business','local','estabelecimento','razao social','title','titulo'],
  categoria: ['categoria','category','segmento','tipo','ramo','nicho'],
  telefone: ['telefone','phone','fone','tel','contato','celular'],
  whatsapp: ['whatsapp','whats','whatsapp business','zap','telefone whatsapp'],
  instagram: ['instagram','insta','ig'],
  facebook: ['facebook','fb'],
  tiktok: ['tiktok','tik tok'],
  site: ['site','website','url','dominio','homepage','site oficial'],
  siteInformado: ['site informado','site_informado','siteinformado'],
  presenca: ['presenca','presenca digital','presenca_digital','digital presence','presenca online'],
  motivo: ['motivo'],
  endereco: ['endereco','address','localizacao','logradouro','rua'],
  cidade: ['cidade','city','municipio'],
  estado: ['estado','uf','state','estado regiao','regiao'],
  pais: ['pais','country'],
  nota: ['nota','rating','estrelas','stars','avaliacao media','nota google'],
  avaliacoes: ['avaliacoes','reviews','total avaliacoes','num avaliacoes','review count','numero de avaliacoes','quantidade de avaliacoes'],
  score: ['score','lead score','lead_score','pontuacao','pontos'],
  potencial: ['potencial','potential'],
  status: ['status'],
  observacao: ['observacao','notes','note','obs','observacoes'],
  maps: ['maps','google maps','google_maps','url maps','maps url','google maps url','place url','link maps'],
  pesquisa: ['pesquisa de origem','pesquisa origem','pesquisa_origem','origem','source'],
  data: ['data','data da coleta','data_coleta','date','created at','created_at'],
  placeId: ['place id','place_id','placeid','google place id','gplace_id']
};

const NORMALIZED_ALIASES = {};
for (const [canonical, list] of Object.entries(ALIASES)) {
  for (const alias of list) NORMALIZED_ALIASES[normalizeKey(alias)] = canonical;
}

export function normalizeColumns(headers) {
  return headers.map(h => NORMALIZED_ALIASES[normalizeKey(h)] || null);
}

function clean(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function parseNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = String(v).trim().replace(/[^\d,.\-]/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function buildDedupKey(lead) {
  if (lead.placeId) return 'pid:' + normalizeKey(lead.placeId);
  if (lead.maps) return 'maps:' + lead.maps.trim().toLowerCase();
  if (lead.telefone) {
    const digits = lead.telefone.replace(/\D/g, '');
    if (digits.length >= 8) return 'tel:' + digits;
  }
  if (lead.nome) {
    return 'name:' + normalizeKey(lead.nome) + '|' + normalizeKey(lead.endereco || '');
  }
  return null;
}

export function normalizeLead(raw) {
  const lead = {
    id: clean(raw.id) || clean(raw.placeId) || clean(raw.maps) || clean(raw.telefone) || uuid(),
    nome: clean(raw.nome),
    categoria: clean(raw.categoria),
    telefone: clean(raw.telefone),
    whatsapp: clean(raw.whatsapp),
    instagram: clean(raw.instagram),
    facebook: clean(raw.facebook),
    tiktok: clean(raw.tiktok),
    site: clean(raw.site),
    siteInformado: clean(raw.siteInformado),
    presenca: clean(raw.presenca),
    motivo: clean(raw.motivo),
    endereco: clean(raw.endereco),
    cidade: clean(raw.cidade),
    estado: clean(raw.estado),
    pais: clean(raw.pais),
    nota: parseNumber(raw.nota),
    avaliacoes: parseNumber(raw.avaliacoes),
    score: parseNumber(raw.score),
    potencial: clean(raw.potencial),
    status: clean(raw.status),
    observacao: clean(raw.observacao),
    maps: clean(raw.maps),
    pesquisa: clean(raw.pesquisa),
    data: clean(raw.data),
    placeId: clean(raw.placeId),
    messageStatus: 'nao_gerada',
    messageText: '',
    salesStatus: 'novo',
    internalNote: '',
    contactDate: '',
    followUpDate: '',
    _dedupKey: null,
    _importedAt: Date.now(),
    _updatedAt: Date.now()
  };
  lead._dedupKey = buildDedupKey(lead);
  return lead;
}

export function parseJSONText(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('JSON inválido: ' + e.message); }
  let arr = data;
  if (!Array.isArray(data) && data && typeof data === 'object') {
    for (const key of ['leads','data','items','results','empresas','companies','rows']) {
      if (Array.isArray(data[key])) { arr = data[key]; break; }
    }
  }
  if (!Array.isArray(arr)) throw new Error('Formato JSON não reconhecido (esperado array ou objeto com "leads").');

  const headersSet = new Set();
  for (const row of arr) {
    if (row && typeof row === 'object') for (const k of Object.keys(row)) headersSet.add(k);
  }
  const headers = Array.from(headersSet);
  const normalizedHeaders = normalizeColumns(headers);
  const leads = [];
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const obj = {};
    headers.forEach((h, i) => {
      const canon = normalizedHeaders[i];
      if (!canon) return;
      const val = row[h];
      if (val !== undefined && val !== null && String(val).trim() !== '') obj[canon] = val;
    });
    const lead = normalizeLead(obj);
    if (lead.nome || lead.telefone || lead.maps) leads.push(lead);
  }
  return leads;
}

export function parseCSVText(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const rows = parseCSV(text, delimiter);
  if (!rows.length) return [];
  const headers = rows[0];
  const normalizedHeaders = normalizeColumns(headers);
  const leads = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => (c || '').trim() === '')) continue;
    const obj = {};
    for (let j = 0; j < row.length; j++) {
      const canon = normalizedHeaders[j];
      if (!canon) continue;
      const val = row[j];
      if (val !== undefined && val !== null && String(val).trim() !== '') obj[canon] = val;
    }
    const lead = normalizeLead(obj);
    if (lead.nome || lead.telefone || lead.maps) leads.push(lead);
  }
  return leads;
}

export async function parseFile(file) {
  const text = await file.text();
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.json')) return parseJSONText(text);
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return parseCSVText(text);
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return parseJSONText(text); } catch (e) { /* fallback CSV */ }
  }
  return parseCSVText(text);
}

export function deduplicate(newLeads, existingLeads) {
  const index = new Map();
  for (const e of existingLeads) {
    if (e._dedupKey) index.set(e._dedupKey, e);
    else {
      const k = buildDedupKey(e);
      if (k) { e._dedupKey = k; index.set(k, e); }
    }
  }
  const toInsert = [];
  const toUpdate = [];
  const now = Date.now();
  for (const lead of newLeads) {
    const key = lead._dedupKey;
    if (key && index.has(key)) {
      const existing = index.get(key);
      const merged = { ...existing };
      const publicFields = [
        'nome','categoria','telefone','whatsapp','instagram','facebook','tiktok',
        'site','siteInformado','presenca','motivo','endereco','cidade','estado',
        'pais','nota','avaliacoes','score','potencial','status','maps','pesquisa',
        'data','placeId'
      ];
      for (const f of publicFields) {
        if (lead[f] !== '' && lead[f] != null) merged[f] = lead[f];
      }
      merged._updatedAt = now;
      toUpdate.push(merged);
    } else {
      toInsert.push(lead);
      if (key) index.set(key, lead);
    }
  }
  return { toInsert, toUpdate };
}