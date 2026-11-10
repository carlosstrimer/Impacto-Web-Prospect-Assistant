import { spawn } from 'node:child_process';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appPort = 4500 + (process.pid % 300);
const debugPort = 9300 + (process.pid % 300);
const root = process.cwd();
const profilePath = join(root, `.tmp-dashboard-smoke-${process.pid}`);
const targetUrl = `http://127.0.0.1:${appPort}/dashboard.html`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(appPort) },
  stdio: 'ignore',
  windowsHide: true
});

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profilePath}`,
  targetUrl
], { stdio: 'ignore', windowsHide: true });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch (_) {}
    await wait(250);
  }
  throw new Error('O servidor local nao ficou disponivel.');
}

async function getPage() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      const page = pages.find(item => item.type === 'page');
      if (page) return page;
    } catch (_) {}
    await wait(250);
  }
  throw new Error('Chrome DevTools nao ficou disponivel.');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(message.params?.exceptionDetails?.text || 'Erro JavaScript sem detalhes');
        return;
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
  }

  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  }

  close() {
    this.socket.close();
  }
}

const fixtureLeads = [
  {
    id: 'smoke:samira',
    nome: 'Dra Samira Ribeiro - SR Cruzeiro',
    categoria: 'Centro de saude e beleza',
    telefone: '(62) 99934-2827',
    whatsapp: '(62) 99934-2827',
    instagram: '@sresteticaunidademarista',
    site: 'https://instagram.com/sresteticaunidademarista/',
    endereco: 'R. das Guarirobas, qd.18 - lt.01 - Cruzeiro do Sul',
    cidade: 'Aparecida de Goiania',
    estado: 'GO',
    pais: 'Brasil',
    nota: 4.9,
    avaliacoes: 52,
    maps: 'https://maps.app.goo.gl/q9MBYoy9YV4MwrtY8',
    pesquisa: 'Google Maps',
    seedInstagram: '@renato_cariani',
    messageStatus: 'nao_gerada',
    salesStatus: 'novo',
    _importedAt: Date.now()
  },
  {
    id: 'smoke:academia',
    nome: 'Academia Teste Performance',
    categoria: 'Academia e fitness',
    telefone: '(11) 99999-1111',
    whatsapp: '(11) 99999-1111',
    instagram: '@academiatesteperformance',
    instagramFollowers: 8400,
    instagramBio: 'Academia local com planos e avaliacao gratuita',
    cidade: 'Sao Paulo',
    estado: 'SP',
    pais: 'Brasil',
    seedInstagram: '@renato_cariani',
    messageStatus: 'nao_gerada',
    salesStatus: 'novo',
    _importedAt: Date.now() - 1
  }
];

try {
  await waitForServer();
  const page = await getPage();
  const cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await wait(900);

  await cdp.evaluate(`(async () => {
    const leads = ${JSON.stringify(fixtureLeads)};
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('impacto_web_prospect', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      store.clear();
      leads.forEach(lead => store.put(lead));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return leads.length;
  })()`);

  await cdp.call('Page.navigate', { url: `${targetUrl}?smoke=1` });
  await wait(1200);

  const result = await cdp.evaluate(`(async () => {
    const tested = [];
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const byId = id => {
      const element = document.getElementById(id);
      if (!element) throw new Error('Controle ausente: ' + id);
      return element;
    };
    const assert = (condition, name) => {
      if (!condition) throw new Error('Falha no smoke test: ' + name);
      tested.push(name);
    };
    const click = (id, name = id) => {
      const element = byId(id);
      element.click();
      tested.push(name);
      return element;
    };
    const selectFirstRow = () => {
      const checkbox = document.querySelector('.row-check');
      if (!checkbox) throw new Error('Checkbox de lead ausente');
      checkbox.click();
    };

    window.__openedUrls = [];
    window.confirm = () => true;
    window.open = url => { window.__openedUrls.push(url); return null; };
    document.execCommand = () => true;

    assert(document.querySelectorAll('#leadsBody tr[data-id]').length === 2, 'fixture carregada');

    document.querySelector('[data-tab="playbook"]').click();
    assert(byId('tab-playbook').classList.contains('active'), 'aba playbook');
    document.querySelector('[data-tab="settings"]').click();
    assert(byId('tab-settings').classList.contains('active'), 'aba configuracoes');
    document.querySelector('[data-tab="leads"]').click();
    assert(byId('tab-leads').classList.contains('active'), 'aba radar');

    click('btnUseRenato');
    assert(byId('seedInstagram').value === '@renato_cariani', 'atalho Renato Cariani');
    if (!globalThis.chrome?.tabs || !globalThis.chrome?.scripting) {
      click('btnMineFollowers');
      await wait(120);
      assert(/extensao instalada/i.test(byId('instagramStatus').textContent), 'erro seguro fora da extensao');
    }

    click('btnFocusHot');
    assert(byId('filterScore').value === 'hot', 'filtro notas 4 e 5');
    byId('searchInput').value = 'Samira';
    byId('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(260);
    assert(document.querySelectorAll('#leadsBody tr[data-id]').length === 1, 'busca de lead');
    byId('searchInput').value = '';
    byId('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(260);

    click('btnGenerateAll');
    await wait(220);
    click('btnExportCSV');
    click('btnExportJSON');

    const rowCopy = document.querySelector('[data-action="copy"]');
    const rowInstagram = document.querySelector('[data-action="instagram"]');
    const rowWhatsApp = document.querySelector('[data-action="whatsapp"]');
    rowCopy.click();
    await wait(120);
    rowInstagram.click();
    rowWhatsApp.click();
    tested.push('acoes rapidas da tabela');

    document.querySelector('[data-action="open"]').click();
    assert(!byId('leadPanel').hidden, 'abrir painel do lead');
    click('panelGenerate');
    await wait(160);
    assert(byId('panelMessage').value.length > 40, 'gerar mensagem pela dor');
    click('panelVariants');
    assert(!byId('panelVariantList').hidden && document.querySelectorAll('.variant-card').length === 3, 'tres variacoes');
    document.querySelector('[data-use-variant="0"]').click();
    click('panelSaveMessage');
    await wait(100);
    click('panelCopy');
    click('panelInstagram');
    click('panelWhatsApp');
    byId('panelInternalNote').value = 'Smoke test do funil';
    click('panelSaveLead');
    await wait(100);
    click('btnClosePanel');
    assert(byId('leadPanel').hidden, 'fechar painel');

    selectFirstRow();
    click('btnBulkGenerate');
    await wait(180);
    selectFirstRow();
    click('btnBulkContacted');
    await wait(120);

    document.querySelector('[data-tab="playbook"]').click();
    const strategy = document.querySelector('.strategy-item');
    strategy.click();
    byId('templateEditor').value += ' ';
    click('btnSaveTemplate');
    await wait(80);
    click('btnResetTemplate');
    await wait(80);
    click('btnResetTemplates');
    await wait(80);

    document.querySelector('[data-tab="settings"]').click();
    byId('cfgMemberName').value = 'Teste IW';
    click('btnSaveSettings');
    await wait(100);
    click('btnExportBackup');
    let backupClicks = 0;
    byId('backupInput').addEventListener('click', () => { backupClicks++; });
    click('btnImportBackup');
    assert(backupClicks === 1, 'abrir importacao de backup');

    document.querySelector('[data-tab="leads"]').click();
    let importClicks = 0;
    byId('fileInput').addEventListener('click', () => { importClicks++; });
    click('btnImport');
    assert(importClicks === 1, 'abrir importacao de leads');

    document.querySelector('[data-action="open"]').click();
    click('panelDelete');
    await wait(120);
    assert(document.querySelectorAll('#leadsBody tr[data-id]').length === 1, 'excluir pelo painel');

    selectFirstRow();
    click('btnBulkDelete');
    await wait(120);
    assert(document.querySelectorAll('#leadsBody tr[data-id]').length === 0, 'excluir em lote');

    click('btnClearDB');
    await wait(120);
    assert(byId('leadsBody').textContent.includes('Nenhum seguidor qualificado'), 'limpar dados locais');
    assert(window.__openedUrls.length >= 2, 'abertura manual dos canais');

    return { passed: tested.length, tested };
  })()`);

  if (cdp.exceptions.length) {
    throw new Error(`Excecoes no navegador: ${cdp.exceptions.join(' | ')}`);
  }
  cdp.close();
  console.log(JSON.stringify(result, null, 2));
} finally {
  chrome.kill();
  server.kill();
}
