import { applyQualification } from './lead-scoring.js';
import { uuid } from './utils.js';

const BUSINESS_CATEGORY_TERMS = [
  ['academia', 'Academia e fitness'],
  ['atleta', 'Fitness e esporte'],
  ['barbear', 'Barbearia'],
  ['beleza', 'Beleza'],
  ['clinica', 'Clinica'],
  ['criador de conteudo', 'Criador de conteudo'],
  ['dent', 'Odontologia'],
  ['empresario', 'Empreendedorismo'],
  ['estet', 'Estetica'],
  ['loja', 'Varejo'],
  ['medic', 'Saude'],
  ['nutri', 'Nutricao'],
  ['professor', 'Educacao'],
  ['restaurante', 'Alimentacao'],
  ['suplement', 'Suplementos']
];

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeInstagramHandle(value) {
  const raw = clean(value)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim();
  if (!raw || !/^[a-zA-Z0-9._]{1,30}$/.test(raw)) return '';
  return raw.toLowerCase();
}

export function parseCompactNumber(value) {
  if (value == null) return 0;
  const raw = clean(value).toLowerCase();
  if (!raw) return 0;
  const suffixMatch = raw.match(/(milhoes|milhao|mi|m|mil|k|bi|b)\b/i);
  const suffix = suffixMatch ? suffixMatch[1].toLowerCase() : '';
  let numeric = raw.replace(/[^\d.,]/g, '');
  if (!numeric) return 0;

  if (suffix) {
    numeric = numeric.replace(',', '.');
    const firstDot = numeric.indexOf('.');
    if (firstDot !== -1) {
      numeric = numeric.slice(0, firstDot + 1) + numeric.slice(firstDot + 1).replace(/\./g, '');
    }
  } else {
    numeric = numeric.replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  }

  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return 0;
  const multipliers = {
    mil: 1_000,
    k: 1_000,
    mi: 1_000_000,
    m: 1_000_000,
    milhao: 1_000_000,
    milhoes: 1_000_000,
    bi: 1_000_000_000,
    b: 1_000_000_000
  };
  return Math.round(parsed * (multipliers[suffix] || 1));
}

function extractMetric(text, labels) {
  const normalized = normalizeText(text);
  for (const label of labels) {
    const pattern = new RegExp(`([\\d.,]+\\s*(?:milhoes|milhao|mi|m|mil|k|bi|b)?)\\s*${label}`, 'i');
    const match = normalized.match(pattern);
    if (match) return parseCompactNumber(match[1]);
  }
  return 0;
}

function inferCategory(text) {
  const normalized = normalizeText(text);
  const match = BUSINESS_CATEGORY_TERMS.find(([term]) => normalized.includes(term));
  return match ? match[1] : 'Instagram';
}

function unwrapInstagramRedirect(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://www.instagram.com');
    if (url.hostname === 'l.instagram.com' && url.searchParams.get('u')) {
      return decodeURIComponent(url.searchParams.get('u'));
    }
    return url.href;
  } catch (_) {
    return raw;
  }
}

function selectExternalUrl(links) {
  for (const value of links || []) {
    const url = unwrapInstagramRedirect(value);
    if (!url || /instagram\.com|threads\.com/i.test(url)) continue;
    return url;
  }
  return '';
}

function extractName(title, handle, headerText) {
  const fromTitle = clean(title).split('(@')[0].replace(/\s*[•|-].*$/, '').trim();
  if (fromTitle && normalizeText(fromTitle) !== normalizeText(handle)) return fromTitle;
  const lines = String(headerText || '').split(/\r?\n/).map(clean).filter(Boolean);
  return lines.find(line => normalizeText(line) !== normalizeText(handle) && !/seguidores|followers|seguindo|following/i.test(line)) || handle;
}

function extractBio(headerText, description, name, handle) {
  const lines = String(headerText || '').split(/\r?\n/).map(clean).filter(Boolean);
  const ignored = new Set([normalizeText(name), normalizeText(handle)]);
  const useful = lines.filter(line => {
    const normalized = normalizeText(line);
    return !ignored.has(normalized) &&
      !/^(posts?|publicacoes|seguidores|followers|seguindo|following)$/i.test(normalized) &&
      !/^\d+[\d.,\s]*(mil|mi|m|k)?\s*(seguidores|followers|seguindo|following|posts?|publicacoes)?$/i.test(normalized) &&
      !/^entrar$|^cadastre-se$/i.test(normalized);
  });
  if (useful.length) return useful.slice(0, 8).join(' | ').slice(0, 900);
  return clean(description).slice(0, 900);
}

export function parseInstagramPage(raw, requestedHandle = '') {
  const handle = normalizeInstagramHandle(
    requestedHandle || raw.handle || raw.canonical || raw.url || raw.title
  );
  const combined = [raw.headerText, raw.description, raw.bodyText, raw.title].join('\n');
  const followers = extractMetric(combined, ['seguidores', 'followers']);
  const following = extractMetric(combined, ['seguindo', 'following']);
  const posts = extractMetric(combined, ['publicacoes', 'posts']);
  const externalUrl = selectExternalUrl(raw.links);
  const name = extractName(raw.title, handle, raw.headerText);
  const bio = extractBio(raw.headerText, raw.description, name, handle);
  const verified = !!raw.verified || /verificado|verified/i.test(combined);
  const unavailable = /pagina nao esta disponivel|page isn't available|sorry, this page isn't available/i.test(combined);
  const isPrivate = /perfil privado|private account|esta conta e privada|this account is private/i.test(combined);

  return {
    handle,
    name,
    bio,
    category: inferCategory(`${name} ${bio}`),
    followers,
    following,
    posts,
    verified,
    externalUrl,
    avatarUrl: clean(raw.avatarUrl),
    profileUrl: handle ? `https://www.instagram.com/${handle}/` : clean(raw.url),
    collectedAt: new Date().toISOString(),
    isPrivate,
    unavailable
  };
}

export function createLeadFromInstagram(profile, existing = null) {
  const now = Date.now();
  const currentSeeds = Array.isArray(existing?.seedInstagrams) ? existing.seedInstagrams : [];
  const incomingSeed = profile.seedHandle ? `@${profile.seedHandle}` : '';
  const seedInstagrams = Array.from(new Set([
    ...currentSeeds,
    existing?.seedInstagram || '',
    incomingSeed
  ].filter(Boolean)));
  const base = existing || {
    id: `ig:${profile.handle || uuid()}`,
    telefone: '',
    whatsapp: '',
    facebook: '',
    tiktok: '',
    endereco: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    nota: null,
    avaliacoes: null,
    maps: '',
    placeId: '',
    messageStatus: 'nao_gerada',
    messageText: '',
    salesStatus: 'novo',
    internalNote: '',
    contactDate: '',
    followUpDate: '',
    _importedAt: now
  };

  const merged = {
    ...base,
    nome: base.nome || profile.name || `@${profile.handle}`,
    categoria: base.categoria || profile.category,
    instagram: `@${profile.handle}`,
    site: base.site || profile.externalUrl,
    instagramExternalUrl: profile.externalUrl,
    instagramFollowers: profile.followers,
    instagramFollowing: profile.following,
    instagramPosts: profile.posts,
    instagramVerified: profile.verified,
    instagramPrivate: profile.isPrivate,
    instagramBio: profile.bio,
    instagramAvatarUrl: profile.avatarUrl,
    instagramProfileUrl: profile.profileUrl,
    instagramCollectedAt: profile.collectedAt,
    seedInstagram: incomingSeed || base.seedInstagram || '',
    seedInstagrams,
    followerPoolPosition: profile.followerPoolPosition || base.followerPoolPosition || null,
    pesquisa: base.pesquisa || (profile.seedHandle ? `Seguidores de @${profile.seedHandle}` : 'Instagram'),
    source: base.source || (profile.seedHandle ? 'instagram_followers' : 'instagram'),
    _dedupKey: base._dedupKey || `ig:${profile.handle}`,
    _updatedAt: now
  };

  return applyQualification(merged);
}

// Executada dentro da pagina do Instagram por chrome.scripting.executeScript.
export function collectInstagramPageData() {
  const readMeta = (selector) => document.querySelector(selector)?.getAttribute('content') || '';
  const header = document.querySelector('header');
  const scope = header || document;
  const links = Array.from(scope.querySelectorAll('a[href]'))
    .map(anchor => anchor.href)
    .filter(Boolean)
    .slice(0, 80);
  const avatar = scope.querySelector('img[alt*="perfil" i], img[alt*="profile" i]');
  const bodyText = document.body?.innerText || '';
  return {
    title: document.title,
    description: readMeta('meta[property="og:description"]') || readMeta('meta[name="description"]'),
    canonical: document.querySelector('link[rel="canonical"]')?.href || location.href,
    url: location.href,
    headerText: header?.innerText || '',
    bodyText: bodyText.slice(0, 16000),
    links,
    avatarUrl: readMeta('meta[property="og:image"]') || avatar?.src || '',
    verified: /verificado|verified/i.test(header?.innerText || bodyText.slice(0, 3000))
  };
}

// Executada na pagina-semente. Usa apenas a lista de seguidores visivel no DOM.
export async function collectInstagramFollowersPage(options = {}) {
  const maxFollowers = Math.min(Math.max(Number(options.maxFollowers || 80), 10), 500);
  const seedHandle = String(options.seedHandle || '').replace(/^@/, '').toLowerCase();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
  const ignored = new Set([
    '', seedHandle, 'accounts', 'about', 'developer', 'direct', 'explore',
    'legal', 'popular', 'reels', 'stories', 'web'
  ]);
  const isHandle = value => /^[a-z0-9._]{1,30}$/i.test(value) && !ignored.has(normalize(value));

  const loginVisible = () => {
    const text = document.body?.innerText || '';
    return !!document.querySelector('form[action*="/accounts/login"]') ||
      (/entrar|log in/i.test(text) && /cadastre-se|sign up/i.test(text));
  };

  const followerLink = Array.from(document.querySelectorAll('a, button')).find(element => {
    const href = element.getAttribute('href') || '';
    const text = element.textContent || element.getAttribute('aria-label') || '';
    return href.includes('/followers') || /seguidores|followers/i.test(text);
  });

  if (!followerLink) {
    return {
      requiresLogin: loginVisible(),
      error: 'Nao foi possivel localizar o acesso aos seguidores.',
      candidates: []
    };
  }

  followerLink.click();
  let dialog = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(350);
    dialog = document.querySelector('[role="dialog"]');
    if (dialog) break;
    if (loginVisible()) {
      return {
        requiresLogin: true,
        error: 'O Instagram solicitou login para abrir a lista de seguidores.',
        candidates: []
      };
    }
  }

  if (!dialog) {
    return {
      requiresLogin: loginVisible(),
      error: 'A lista de seguidores nao abriu. O Instagram pode ter limitado a consulta.',
      candidates: []
    };
  }

  const candidates = new Map();
  const collectVisibleRows = () => {
    const links = Array.from(dialog.querySelectorAll('a[href]'));
    for (const link of links) {
      const match = (link.getAttribute('href') || '').match(/^\/([a-zA-Z0-9._]{1,30})\/?(?:\?.*)?$/);
      if (!match) continue;
      const username = normalize(match[1]);
      if (!isHandle(username) || candidates.has(username)) continue;

      let row = link;
      for (let level = 0; level < 5 && row.parentElement; level++) {
        row = row.parentElement;
        const rowText = (row.innerText || '').trim();
        if (rowText.includes(username) && rowText.length > username.length && rowText.length < 500) break;
      }
      const lines = (row.innerText || '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean);
      const name = lines.find(value => normalize(value) !== username && !/seguir|following|follow/i.test(value)) || '';
      const verified = !!row.querySelector('[aria-label*="Verificado" i], [aria-label*="Verified" i], svg[aria-label*="Verified" i]');
      const avatarUrl = row.querySelector('img')?.src || '';
      candidates.set(username, { username, name, verified, avatarUrl });
      if (candidates.size >= maxFollowers) break;
    }
  };

  const scrollables = [dialog, ...dialog.querySelectorAll('div')]
    .filter(element => element.clientHeight >= 120 && element.scrollHeight > element.clientHeight + 40)
    .sort((a, b) => b.scrollHeight - a.scrollHeight);
  const scroller = scrollables[0] || dialog;
  let stagnantRounds = 0;
  let previousSize = 0;

  for (let round = 0; round < 100 && candidates.size < maxFollowers; round++) {
    collectVisibleRows();
    if (candidates.size === previousSize) stagnantRounds++;
    else stagnantRounds = 0;
    if (stagnantRounds >= 6) break;
    previousSize = candidates.size;

    const previousTop = scroller.scrollTop;
    scroller.scrollTop = Math.min(
      scroller.scrollHeight,
      scroller.scrollTop + Math.max(scroller.clientHeight * 0.82, 360)
    );
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(650);
    if (scroller.scrollTop === previousTop && round > 2) stagnantRounds++;
  }
  collectVisibleRows();

  return {
    requiresLogin: false,
    candidates: Array.from(candidates.values()).slice(0, maxFollowers),
    collected: candidates.size,
    requested: maxFollowers
  };
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
    };
    const done = (value, error) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const listener = (updatedId, changeInfo, tab) => {
      if (updatedId === tabId && changeInfo.status === 'complete') done(tab);
    };
    const timer = setTimeout(() => done(null, new Error('O Instagram demorou demais para carregar.')), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') done(tab);
    }).catch(error => done(null, error));
  });
}

export async function analyzeInstagramHandle(handle, options = {}) {
  const normalized = normalizeInstagramHandle(handle);
  if (!normalized) throw new Error(`Instagram invalido: ${handle}`);
  if (!globalThis.chrome?.tabs || !globalThis.chrome?.scripting) {
    throw new Error('A analise do Instagram precisa ser executada pela extensao instalada.');
  }

  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
  let tabId = null;
  try {
    onStatus(`Abrindo @${normalized}...`);
    const tab = await chrome.tabs.create({
      url: `https://www.instagram.com/${normalized}/`,
      active: false
    });
    tabId = tab.id;
    await waitForTabComplete(tabId, options.timeoutMs || 30000);
    onStatus(`Lendo sinais publicos de @${normalized}...`);
    await new Promise(resolve => setTimeout(resolve, options.settleDelayMs ?? 1800));
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectInstagramPageData
    });
    const raw = execution?.[0]?.result;
    if (!raw) throw new Error('Nao foi possivel ler o perfil. Confirme se o Instagram carregou corretamente.');
    const profile = parseInstagramPage(raw, normalized);
    if (profile.unavailable || !profile.handle) {
      throw new Error(`O perfil @${normalized} esta indisponivel, privado ou exige login.`);
    }
    return profile;
  } finally {
    if (tabId && options.keepTab !== true) {
      try { await chrome.tabs.remove(tabId); } catch (_) {}
    }
  }
}

export function selectDistributedFollowerSample(candidates, limit = 20) {
  const list = Array.from(new Map(
    (candidates || []).map(candidate => [normalizeInstagramHandle(candidate.username), candidate])
  ).values()).filter(candidate => normalizeInstagramHandle(candidate.username));
  const target = Math.min(Math.max(Number(limit || 20), 1), list.length);
  if (!target || !list.length) return [];
  if (target >= list.length) return list;

  const selected = [];
  const used = new Set();
  for (let index = 0; index < target; index++) {
    const position = Math.round(index * (list.length - 1) / Math.max(target - 1, 1));
    const candidate = list[position];
    const handle = normalizeInstagramHandle(candidate.username);
    if (!used.has(handle)) {
      used.add(handle);
      selected.push(candidate);
    }
  }
  for (const candidate of list) {
    if (selected.length >= target) break;
    const handle = normalizeInstagramHandle(candidate.username);
    if (!used.has(handle)) {
      used.add(handle);
      selected.push(candidate);
    }
  }
  return selected;
}

export async function collectFollowersFromSeed(seedHandle, options = {}) {
  const seed = normalizeInstagramHandle(seedHandle);
  if (!seed) throw new Error(`Instagram invalido: ${seedHandle}`);
  if (!globalThis.chrome?.tabs || !globalThis.chrome?.scripting) {
    throw new Error('A coleta de seguidores precisa ser executada pela extensao instalada.');
  }

  const maxFollowers = Math.min(Math.max(Number(options.maxFollowers || 80), 10), 500);
  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
  let tabId = null;
  try {
    onStatus(`Abrindo a audiencia de @${seed}...`);
    const tab = await chrome.tabs.create({
      url: `https://www.instagram.com/${seed}/`,
      active: false
    });
    tabId = tab.id;
    await waitForTabComplete(tabId, options.timeoutMs || 30000);
    await new Promise(resolve => setTimeout(resolve, options.settleDelayMs ?? 1800));
    onStatus(`Coletando ate ${maxFollowers} seguidores visiveis de @${seed}...`);
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectInstagramFollowersPage,
      args: [{ seedHandle: seed, maxFollowers }]
    });
    const result = execution?.[0]?.result;
    if (!result) throw new Error('O Instagram nao retornou a lista de seguidores.');
    if (result.requiresLogin) {
      throw new Error('Entre no Instagram neste navegador e tente novamente. A extensao nao automatiza login.');
    }
    if (!result.candidates?.length) {
      throw new Error(result.error || 'Nenhum seguidor visivel foi coletado.');
    }
    return { seedHandle: seed, ...result };
  } finally {
    if (tabId && options.keepTab !== true) {
      try { await chrome.tabs.remove(tabId); } catch (_) {}
    }
  }
}

export async function discoverFollowerProfiles(seedHandle, options = {}) {
  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
  const pool = await collectFollowersFromSeed(seedHandle, {
    maxFollowers: options.maxFollowers || 80,
    timeoutMs: options.timeoutMs,
    settleDelayMs: options.settleDelayMs,
    onStatus
  });
  const sample = selectDistributedFollowerSample(pool.candidates, options.analysisLimit || 20);
  const profiles = [];
  const errors = [];

  for (let index = 0; index < sample.length; index++) {
    const candidate = sample[index];
    const handle = normalizeInstagramHandle(candidate.username);
    onStatus(`Analisando @${handle} (${index + 1} de ${sample.length})...`);
    try {
      const profile = await analyzeInstagramHandle(handle, {
        timeoutMs: options.profileTimeoutMs || 24000,
        settleDelayMs: options.profileSettleDelayMs
      });
      profiles.push({
        ...profile,
        name: profile.name || candidate.name,
        verified: profile.verified || candidate.verified,
        avatarUrl: profile.avatarUrl || candidate.avatarUrl,
        seedHandle: pool.seedHandle,
        followerPoolPosition: pool.candidates.findIndex(item => normalizeInstagramHandle(item.username) === handle) + 1
      });
    } catch (error) {
      errors.push({ handle, error: error.message });
    }
    if (index < sample.length - 1) {
      await new Promise(resolve => setTimeout(resolve, Number(options.delayMs ?? 900)));
    }
  }

  return {
    seedHandle: pool.seedHandle,
    collected: pool.candidates.length,
    analyzed: profiles.length,
    profiles,
    errors
  };
}

export function parseHandleList(value, limit = 20) {
  const handles = String(value || '')
    .split(/[\s,;]+/)
    .map(normalizeInstagramHandle)
    .filter(Boolean);
  return Array.from(new Set(handles)).slice(0, limit);
}
