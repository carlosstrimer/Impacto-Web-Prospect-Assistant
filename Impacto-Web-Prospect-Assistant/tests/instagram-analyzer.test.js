import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLeadFromInstagram,
  discoverFollowerProfiles,
  normalizeInstagramHandle,
  parseCompactNumber,
  parseHandleList,
  parseInstagramPage,
  selectDistributedFollowerSample
} from '../modules/instagram-analyzer.js';

const renatoPage = {
  title: 'Renato Cariani (@renato_cariani) • Fotos e videos do Instagram',
  headerText: `renato_cariani
11,4 mi seguidores
1.269 seguindo
Renato Cariani
Professor | Atleta | Empresario
Criador de Conteudo
@growthsupplements
@ctrc_oficial`,
  description: '11.4M Followers, 1,269 Following - Renato Cariani (@renato_cariani) on Instagram',
  links: ['https://l.instagram.com/?u=https%3A%2F%2Fwww.redectrc.com.br%2F'],
  avatarUrl: 'https://example.com/avatar.jpg',
  url: 'https://www.instagram.com/renato_cariani/',
  verified: true
};

test('normaliza handles e listas sem duplicar', () => {
  assert.equal(normalizeInstagramHandle('@Renato_Cariani'), 'renato_cariani');
  assert.equal(normalizeInstagramHandle('https://instagram.com/renato_cariani/'), 'renato_cariani');
  assert.deepEqual(parseHandleList('@a, @b\na'), ['a', 'b']);
});

test('interpreta numeros compactos brasileiros e internacionais', () => {
  assert.equal(parseCompactNumber('11,4 mi'), 11_400_000);
  assert.equal(parseCompactNumber('52'), 52);
  assert.equal(parseCompactNumber('1.269'), 1269);
  assert.equal(parseCompactNumber('18.5K'), 18_500);
});

test('extrai os sinais publicos do perfil de Renato Cariani', () => {
  const profile = parseInstagramPage(renatoPage, '@renato_cariani');
  assert.equal(profile.handle, 'renato_cariani');
  assert.equal(profile.name, 'Renato Cariani');
  assert.equal(profile.followers, 11_400_000);
  assert.equal(profile.following, 1269);
  assert.equal(profile.verified, true);
  assert.equal(profile.externalUrl, 'https://www.redectrc.com.br/');
  assert.match(profile.bio, /Professor/i);
});

test('cria lead qualificado a partir da analise do Instagram', () => {
  const profile = {
    ...parseInstagramPage(renatoPage, '@seguidor_empresario'),
    handle: 'seguidor_empresario',
    seedHandle: 'renato_cariani',
    followerPoolPosition: 17
  };
  const lead = createLeadFromInstagram(profile);
  assert.equal(lead.instagram, '@seguidor_empresario');
  assert.equal(lead.seedInstagram, '@renato_cariani');
  assert.deepEqual(lead.seedInstagrams, ['@renato_cariani']);
  assert.equal(lead.source, 'instagram_followers');
  assert.equal(lead.followerPoolPosition, 17);
  assert.equal(lead.instagramFollowers, 11_400_000);
  assert.equal(lead.score, 2);
  assert.equal(lead.messageStatus, 'nao_gerada');
});

test('seleciona uma amostra distribuida sem transformar a conta-semente em candidato', () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({ username: `seguidor_${index + 1}` }));
  const sample = selectDistributedFollowerSample(candidates, 4);
  assert.deepEqual(sample.map(item => item.username), [
    'seguidor_1',
    'seguidor_4',
    'seguidor_7',
    'seguidor_10'
  ]);
  assert.equal(sample.some(item => item.username === 'renato_cariani'), false);
});

test('perfil privado continua analisavel pelos sinais publicos', () => {
  const profile = parseInstagramPage({
    ...renatoPage,
    bodyText: 'Esta conta e privada',
    headerText: 'perfil_privado\n1.200 seguidores\nEsta conta e privada'
  }, '@perfil_privado');
  assert.equal(profile.isPrivate, true);
  assert.equal(profile.unavailable, false);
});

test('descobre seguidores da conta-semente sem analisar o famoso como lead', async () => {
  let nextTabId = 1;
  const tabs = new Map();
  globalThis.chrome = {
    tabs: {
      create: async ({ url }) => {
        const tab = { id: nextTabId++, url, status: 'complete' };
        tabs.set(tab.id, tab);
        return tab;
      },
      get: async id => tabs.get(id),
      remove: async id => { tabs.delete(id); },
      onUpdated: { addListener() {}, removeListener() {} }
    },
    scripting: {
      executeScript: async ({ target, args }) => {
        if (args) {
          return [{ result: {
            requiresLogin: false,
            collected: 4,
            candidates: [1, 2, 3, 4].map(index => ({ username: `seguidor_${index}` }))
          } }];
        }
        const handle = tabs.get(target.tabId).url.split('/').filter(Boolean).at(-1);
        return [{ result: {
          title: `${handle} (@${handle})`,
          headerText: `${handle}\n2.500 seguidores\nEmpresario e consultor`,
          description: 'Perfil comercial',
          links: [],
          url: `https://www.instagram.com/${handle}/`
        } }];
      }
    }
  };

  try {
    const result = await discoverFollowerProfiles('@renato_cariani', {
      maxFollowers: 4,
      analysisLimit: 2,
      settleDelayMs: 0,
      profileSettleDelayMs: 0,
      delayMs: 0
    });
    assert.equal(result.seedHandle, 'renato_cariani');
    assert.equal(result.collected, 4);
    assert.equal(result.analyzed, 2);
    assert.deepEqual(result.profiles.map(profile => profile.handle), ['seguidor_1', 'seguidor_4']);
    assert.equal(result.profiles.some(profile => profile.handle === 'renato_cariani'), false);
  } finally {
    delete globalThis.chrome;
  }
});
