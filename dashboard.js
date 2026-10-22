// FILE: dashboard.js
import * as DB from './modules/db.js';
import * as Importer from './modules/importer.js';
import * as MsgGen from './modules/message-generator.js';
import * as Phone from './modules/phone.js';
import * as Exporter from './modules/exporter.js';
import { escapeHtml, debounce } from './modules/utils.js';

// ============================================================
// CONSTANTES
// ============================================================
const DEFAULT_SETTINGS = {
  memberName: '',
  memberRole: '',
  companyName: 'Impacto Web',
  companySite: '',
  companyWhatsApp: '',
  companyInstagram: '',
  tone: 'profissional',
  channel: 'whatsapp',
  previewReady: false
};

const MESSAGE_STATUS_LABELS = {
  nao_gerada: 'Não gerada',
  gerada: 'Gerada',
  copiada: 'Copiada',
  contatada: 'Contatada',
  respondida: 'Respondida',
  interessada: 'Interessada',
  sem_interesse: 'Sem interesse'
};

const SALES_STATUS_LABELS = {
  novo: 'Novo',
  contatado: 'Contatado',
  respondeu: 'Respondeu',
  interessado: 'Interessado',
  negociacao: 'Negociação',
  cliente: 'Cliente',
  sem_interesse: 'Sem interesse',
  ignorar: 'Ignorar'
};

// ============================================================
// ESTADO
// ============================================================
const state = {
  leads: [],
  filtered: [],
  page: 1,
  pageSize: 50,
  selected: new Set(),
  search: '',
  filters: { presenca: '', status: '', categoria: '' },
  sortBy: 'score_desc',
  config: { ...DEFAULT_SETTINGS },
  templates: { ...MsgGen.DEFAULT_TEMPLATES },
  currentLeadId: null,
  generating: false
};

// ============================================================
// HELPERS
// ============================================================
const $ = (id) => document.getElementById(id);

function showToast(msg, ms = 2400) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
}

function presenceKey(lead) {
  const site = (lead.site || '').trim();
  const hasSite = site.length > 0 && !/^(nao|não|sem|none|n\/a|nao informado|não informado)$/i.test(site);
  const insta = !!(lead.instagram || '').trim();
  const wa = !!(lead.whatsapp || '').trim();
  if (hasSite) return 'site';
  if (insta && wa) return 'insta_whats';
  if (insta) return 'instagram';
  if (wa) return 'whatsapp';
  return 'nenhuma';
}

function presenceLabel(lead) {
  const map = {
    site: 'Site',
    insta_whats: 'Instagram + WhatsApp',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
    nenhuma: 'Sem presença'
  };
  return map[presenceKey(lead)];
}

function phoneForLead(lead) {
  return Phone.normalizePhone(lead.whatsapp || lead.telefone, lead.pais);
}

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    const settings = await DB.getAllSettings();
    state.config = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (settings[k] !== undefined) state.config[k] = settings[k];
    }
    if (settings.templates && typeof settings.templates === 'object') {
      state.templates = { ...MsgGen.DEFAULT_TEMPLATES, ...settings.templates };
    }
    state.leads = await DB.getAllLeads();
    applyConfigToUI();
    refresh();
    bindEvents();
  } catch (e) {
    console.error(e);
    showToast('Erro ao inicializar: ' + e.message);
  }
}

// ============================================================
// CONFIG / TEMPLATES UI
// ============================================================
function applyConfigToUI() {
  $('cfgMemberName').value = state.config.memberName || '';
  $('cfgMemberRole').value = state.config.memberRole || '';
  $('cfgCompanyName').value = state.config.companyName || 'Impacto Web';
  $('cfgCompanySite').value = state.config.companySite || '';
  $('cfgCompanyWhatsApp').value = state.config.companyWhatsApp || '';
  $('cfgCompanyInstagram').value = state.config.companyInstagram || '';
  $('cfgTone').value = state.config.tone || 'profissional';
  $('cfgChannel').value = state.config.channel || 'whatsapp';
  $('cfgPreview').value = String(!!state.config.previewReady);

  $('tplCurta').value = state.templates.curta || '';
  $('tplProfissional').value = state.templates.profissional || '';
  $('tplCuriosidade').value = state.templates.curiosidade || '';
  $('tplDireta').value = state.templates.direta || '';
  $('tplPrevia').value = state.templates.previa_pronta || '';
}

async function saveSettings() {
  state.config.memberName = $('cfgMemberName').value.trim();
  state.config.memberRole = $('cfgMemberRole').value.trim();
  state.config.companyName = $('cfgCompanyName').value.trim() || 'Impacto Web';
  state.config.companySite = $('cfgCompanySite').value.trim();
  state.config.companyWhatsApp = $('cfgCompanyWhatsApp').value.trim();
  state.config.companyInstagram = $('cfgCompanyInstagram').value.trim();
  state.config.tone = $('cfgTone').value;
  state.config.channel = $('cfgChannel').value;
  state.config.previewReady = $('cfgPreview').value === 'true';

  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    await DB.setSetting(k, state.config[k]);
  }
  showToast('Configurações salvas.');
}

async function saveTemplates() {
  state.templates = {
    curta: $('tplCurta').value,
    profissional: $('tplProfissional').value,
    curiosidade: $('tplCuriosidade').value,
    direta: $('tplDireta').value,
    previa_pronta: $('tplPrevia').value
  };
  await DB.setSetting('templates', state.templates);
  showToast('Templates salvos.');
}

async function resetTemplates() {
  if (!confirm('Restaurar os templates padrão?')) return;
  state.templates = { ...MsgGen.DEFAULT_TEMPLATES };
  await DB.setSetting('templates', state.templates);
  applyConfigToUI();
  showToast('Templates restaurados.');
}

// ============================================================
// REFRESH
// ============================================================
function refresh() {
  applyFilters();
  renderStats();
  renderTable();
  renderPagination();
  populateFilterOptions();
}

function applyFilters() {
  let list = state.leads.slice();
  const q = (state.search || '').trim().toLowerCase();
  if (q) {
    list = list.filter(l =>
      (l.nome || '').toLowerCase().includes(q) ||
      (l.categoria || '').toLowerCase().includes(q) ||
      (l.cidade || '').toLowerCase().includes(q) ||
      (l.telefone || '').toLowerCase().includes(q) ||
      (l.whatsapp || '').toLowerCase().includes(q)
    );
  }
  if (state.filters.presenca) {
    list = list.filter(l => presenceKey(l) === state.filters.presenca);
  }
  if (state.filters.status) {
    list = list.filter(l => (l.messageStatus || 'nao_gerada') === state.filters.status);
  }
  if (state.filters.categoria) {
    list = list.filter(l => (l.categoria || '').toLowerCase() === state.filters.categoria);
  }
  switch (state.sortBy) {
    case 'score_desc':      list.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)); break;
    case 'avaliacoes_desc': list.sort((a, b) => (b.avaliacoes ?? -Infinity) - (a.avaliacoes ?? -Infinity)); break;
    case 'nota_desc':       list.sort((a, b) => (b.nota ?? -Infinity) - (a.nota ?? -Infinity)); break;
    case 'nome_asc':        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); break;
    case 'data_desc':       list.sort((a, b) => (b._importedAt || 0) - (a._importedAt || 0)); break;
  }
  state.filtered = list;
  const maxPage = Math.max(1, Math.ceil(list.length / state.pageSize));
  if (state.page > maxPage) state.page = maxPage;
}

function populateFilterOptions() {
  const catSelect = $('filterCategoria');
  const current = catSelect.value;
  const cats = Array.from(new Set(state.leads.map(l => (l.categoria || '').trim()).filter(Boolean))).sort();
  catSelect.innerHTML = '<option value="">Categoria</option>' +
    cats.map(c => `<option value="${escapeHtml(c.toLowerCase())}">${escapeHtml(c)}</option>`).join('');
  if (cats.some(c => c.toLowerCase() === current)) catSelect.value = current;
}

// ============================================================
// RENDER — STATS
// ============================================================
function renderStats() {
  const total = state.leads.length;
  const msgs = state.leads.filter(l => l.messageText && l.messageText.trim()).length;
  const copiadas = state.leads.filter(l => l.messageStatus === 'copiada').length;
  const contatados = state.leads.filter(l =>
    ['contatada','respondida','interessada','sem_interesse'].includes(l.messageStatus) ||
    ['contatado','respondeu','interessado','negociacao','cliente'].includes(l.salesStatus)
  ).length;
  const interessados = state.leads.filter(l =>
    ['interessado','negociacao'].includes(l.salesStatus) || l.messageStatus === 'interessada'
  ).length;
  const clientes = state.leads.filter(l => l.salesStatus === 'cliente').length;

  const cards = [
    { label: 'Leads importados', value: total },
    { label: 'Mensagens geradas', value: msgs },
    { label: 'Copiadas', value: copiadas },
    { label: 'Contatados', value: contatados },
    { label: 'Interessados', value: interessados },
    { label: 'Clientes', value: clientes }
  ];
  $('statsGrid').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-value">${c.value.toLocaleString('pt-BR')}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');
}

// ============================================================
// RENDER — TABLE
// ============================================================
function renderTable() {
  const tbody = $('leadsBody');
  const start = (state.page - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageLeads = state.filtered.slice(start, end);

  if (!pageLeads.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhum lead encontrado. Importe um arquivo .csv ou .json para começar.</td></tr>`;
    updateBulkActions();
    return;
  }

  tbody.innerHTML = pageLeads.map(lead => {
    const sel = state.selected.has(lead.id);
    const ms = lead.messageStatus || 'nao_gerada';
    const phone = phoneForLead(lead);
    const waUrl = Phone.toWhatsAppUrl(phone);
    const hasMsg = !!(lead.messageText && lead.messageText.trim());
    return `<tr data-id="${escapeHtml(lead.id)}" class="${sel ? 'selected' : ''}">
      <td><input type="checkbox" class="row-check" data-id="${escapeHtml(lead.id)}" ${sel ? 'checked' : ''}></td>
      <td class="col-empresa"><strong>${escapeHtml(lead.nome || '—')}</strong></td>
      <td>${escapeHtml(lead.categoria || '—')}</td>
      <td>${escapeHtml(lead.telefone || lead.whatsapp || '—')}</td>
      <td>${escapeHtml(presenceLabel(lead))}</td>
      <td>${lead.nota != null ? escapeHtml(String(lead.nota)) : '—'}</td>
      <td>${lead.avaliacoes != null ? escapeHtml(String(lead.avaliacoes)) : '—'}</td>
      <td>${lead.score != null ? escapeHtml(String(lead.score)) : '—'}</td>
      <td><span class="badge badge-${ms}">${MESSAGE_STATUS_LABELS[ms] || ms}</span></td>
      <td class="actions">
        <button class="btn-xs" data-action="open" data-id="${escapeHtml(lead.id)}">Abrir</button>
        <button class="btn-xs" data-action="copy" data-id="${escapeHtml(lead.id)}" ${!hasMsg && !lead.nome && !lead.telefone ? 'disabled' : ''}>Copiar</button>
        <button class="btn-xs" data-action="whatsapp" data-id="${escapeHtml(lead.id)}" ${!waUrl ? 'disabled' : ''}>WhatsApp</button>
      </td>
    </tr>`;
  }).join('');

  updateBulkActions();
}

function renderPagination() {
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const cur = state.page;
  const parts = [];
  parts.push(`<button data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>Anterior</button>`);

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - cur) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  for (const p of pages) {
    if (p === '...') parts.push(`<span>…</span>`);
    else parts.push(`<button data-page="${p}" class="${p === cur ? 'active' : ''}">${p}</button>`);
  }
  parts.push(`<button data-page="${cur + 1}" ${cur >= totalPages ? 'disabled' : ''}>Próxima</button>`);
  parts.push(`<span class="page-info">${total.toLocaleString('pt-BR')} leads · página ${cur} de ${totalPages}</span>`);

  $('pagination').innerHTML = parts.join('');

  $('pagination').querySelectorAll('button[data-page]').forEach(btn => {
    btn.onclick = () => {
      const p = parseInt(btn.dataset.page, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        state.page = p;
        renderTable();
        renderPagination();
      }
    };
  });
}

function updateBulkActions() {
  const el = $('bulkActions');
  if (state.selected.size > 0) {
    el.hidden = false;
    $('bulkCount').textContent = `${state.selected.size} selecionado(s)`;
  } else {
    el.hidden = true;
  }
}

// ============================================================
// LEAD PANEL
// ============================================================
function openLeadPanel(id) {
  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;
  state.currentLeadId = id;
  $('leadPanel').hidden = false;
  $('leadPanelTitle').textContent = lead.nome || 'Lead';
  renderLeadPanel(lead);
}

function closePanel() {
  $('leadPanel').hidden = true;
  state.currentLeadId = null;
}

function renderLeadPanel(lead) {
  const body = $('leadPanelBody');
  const ms = lead.messageStatus || 'nao_gerada';
  const ss = lead.salesStatus || 'novo';
  const phone = phoneForLead(lead);
  const waUrl = Phone.toWhatsAppUrl(phone);
  const hasMsg = !!(lead.messageText && lead.messageText.trim());

  body.innerHTML = `
    <div class="detail-grid">
      <div><span>Empresa</span><strong>${escapeHtml(lead.nome || '—')}</strong></div>
      <div><span>Categoria</span><strong>${escapeHtml(lead.categoria || '—')}</strong></div>
      <div><span>Telefone</span><strong>${escapeHtml(lead.telefone || '—')}</strong></div>
      <div><span>WhatsApp</span><strong>${escapeHtml(lead.whatsapp || '—')}</strong></div>
      <div><span>Endereço</span><strong>${escapeHtml(lead.endereco || '—')}</strong></div>
      <div><span>Nota</span><strong>${lead.nota ?? '—'}</strong></div>
      <div><span>Avaliações</span><strong>${lead.avaliacoes ?? '—'}</strong></div>
      <div><span>Site</span><strong>${escapeHtml(lead.site || '—')}</strong></div>
      <div><span>Instagram</span><strong>${escapeHtml(lead.instagram || '—')}</strong></div>
      <div><span>Facebook</span><strong>${escapeHtml(lead.facebook || '—')}</strong></div>
      <div><span>Presença Digital</span><strong>${escapeHtml(presenceLabel(lead))}</strong></div>
      <div><span>Score</span><strong>${lead.score ?? '—'}</strong></div>
      <div><span>Pesquisa de origem</span><strong>${escapeHtml(lead.pesquisa || '—')}</strong></div>
      <div><span>Status mensagem</span><strong><span class="badge badge-${ms}">${MESSAGE_STATUS_LABELS[ms] || ms}</span></strong></div>
    </div>

    <div class="panel-actions">
      <label>Tom</label>
      <select id="panelTone" class="select">
        <option value="profissional" ${state.config.tone === 'profissional' ? 'selected' : ''}>Profissional</option>
        <option value="curta" ${state.config.tone === 'curta' ? 'selected' : ''}>Curta</option>
        <option value="curiosidade" ${state.config.tone === 'curiosidade' ? 'selected' : ''}>Curiosidade</option>
        <option value="direta" ${state.config.tone === 'direta' ? 'selected' : ''}>Direta</option>
      </select>
      <label>Canal</label>
      <select id="panelChannel" class="select">
        <option value="whatsapp" ${state.config.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
        <option value="instagram" ${state.config.channel === 'instagram' ? 'selected' : ''}>Instagram DM</option>
      </select>
      <label>Prévia</label>
      <select id="panelPreview" class="select">
        <option value="false" ${!state.config.previewReady ? 'selected' : ''}>Ainda não preparada</option>
        <option value="true" ${state.config.previewReady ? 'selected' : ''}>Já preparada</option>
      </select>
    </div>

    <h3>Mensagem personalizada</h3>
    <textarea id="panelMessage" rows="12" placeholder="Clique em Gerar mensagem">${escapeHtml(lead.messageText || '')}</textarea>

    <div class="panel-buttons">
      <button class="btn primary" id="panelGenerate">${hasMsg ? 'Regenerar' : 'Gerar mensagem'}</button>
      <button class="btn" id="panelSave" ${!hasMsg ? 'disabled' : ''}>Salvar alteração</button>
      <button class="btn ghost" id="panelRestore" ${!hasMsg ? 'disabled' : ''}>Restaurar padrão</button>
      <button class="btn" id="panelCopy" ${!hasMsg ? 'disabled' : ''}>Copiar</button>
      <button class="btn" id="panelWhatsApp" ${!waUrl ? 'disabled' : ''}>Abrir WhatsApp</button>
      <button class="btn primary" id="panelCopyWA" ${(!waUrl || !hasMsg) ? 'disabled' : ''}>Copiar + Abrir WhatsApp</button>
    </div>

    <h3>Status comercial</h3>
    <select id="panelSalesStatus" class="select">
      ${Object.entries(SALES_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${ss === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select>

    <h3>Observação interna</h3>
    <textarea id="panelInternalNote" rows="3" placeholder="Ex.: Falou para entrar em contato sexta-feira.">${escapeHtml(lead.internalNote || '')}</textarea>

    <h3>Follow-up</h3>
    <label>Data do contato</label>
    <input type="date" id="panelContactDate" value="${escapeHtml(lead.contactDate || '')}">
    <label>Próximo follow-up</label>
    <input type="date" id="panelFollowUpDate" value="${escapeHtml(lead.followUpDate || '')}">

    <div class="panel-buttons" style="margin-top:20px;">
      <button class="btn primary" id="panelSaveMeta">Salvar informações</button>
      <button class="btn danger" id="panelDelete">Excluir lead</button>
    </div>
  `;

  bindPanelEvents(lead, waUrl);
}

async function persistLead(lead) {
  lead._updatedAt = Date.now();
  await DB.putLead(lead);
}

function bindPanelEvents(lead, waUrl) {
  $('panelGenerate').onclick = async () => {
    const tone = $('panelTone').value;
    const channel = $('panelChannel').value;
    const previewReady = $('panelPreview').value === 'true';
    const cfg = { ...state.config, tone, channel, previewReady };
    const msg = MsgGen.generateMessageWithTemplates(lead, cfg, state.templates);
    const v = MsgGen.validateMessage(msg);
    if (!v.valid) {
      if (!confirm(`A mensagem gerada parece inválida (${v.reason}). Usar mesmo assim?`)) return;
    }
    $('panelMessage').value = msg;
    lead.messageText = msg;
    if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    await persistLead(lead);
    renderTable();
    renderStats();
    // re-render panel buttons (estado "tem mensagem")
    renderLeadPanel(lead);
  };

  $('panelSave').onclick = async () => {
    lead.messageText = $('panelMessage').value;
    if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    await persistLead(lead);
    showToast('Alteração salva.');
    renderTable();
    renderStats();
    renderLeadPanel(lead);
  };

  $('panelRestore').onclick = async () => {
    const msg = MsgGen.generateMessageWithTemplates(lead, state.config, state.templates);
    $('panelMessage').value = msg;
    lead.messageText = msg;
    if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    await persistLead(lead);
    renderTable();
    renderLeadPanel(lead);
  };

  $('panelCopy').onclick = async () => {
    const text = $('panelMessage').value;
    if (!text) return;
    await copyText(text);
    lead.messageStatus = 'copiada';
    await persistLead(lead);
    showToast('Mensagem copiada.');
    renderTable();
    renderStats();
    renderLeadPanel(lead);
  };

  $('panelWhatsApp').onclick = () => {
    if (waUrl) window.open(waUrl, '_blank', 'noopener');
  };

  $('panelCopyWA').onclick = async () => {
    const text = $('panelMessage').value;
    if (text) {
      await copyText(text);
      lead.messageStatus = 'copiada';
      await persistLead(lead);
    }
    if (waUrl) window.open(waUrl, '_blank', 'noopener');
    showToast('Mensagem copiada. Cole no WhatsApp.');
    renderTable();
    renderStats();
    renderLeadPanel(lead);
  };

  $('panelSalesStatus').onchange = async (e) => {
    lead.salesStatus = e.target.value;
    await persistLead(lead);
    renderStats();
  };

  $('panelSaveMeta').onclick = async () => {
    lead.salesStatus = $('panelSalesStatus').value;
    lead.internalNote = $('panelInternalNote').value;
    lead.contactDate = $('panelContactDate').value;
    lead.followUpDate = $('panelFollowUpDate').value;
    await persistLead(lead);
    showToast('Informações salvas.');
    renderStats();
    renderTable();
  };

  $('panelDelete').onclick = async () => {
    if (!confirm('Excluir este lead?')) return;
    await DB.deleteLead(lead.id);
    state.leads = state.leads.filter(l => l.id !== lead.id);
    state.selected.delete(lead.id);
    closePanel();
    refresh();
    showToast('Lead excluído.');
  };
}

// ============================================================
// IMPORTAÇÃO
// ============================================================
async function importFile(file, mode) {
  try {
    showToast('Lendo arquivo...', 60000);
    const parsed = await Importer.parseFile(file);
    if (!parsed.length) {
      showToast('Nenhum lead válido encontrado no arquivo.');
      return;
    }
    const now = Date.now();
    for (const lead of parsed) {
      if (!lead._importedAt) lead._importedAt = now;
      lead._updatedAt = now;
    }

    if (mode === 'replace') {
      await DB.clearLeads();
      await DB.putLeadsBatch(parsed);
      state.leads = parsed;
      showToast(`${parsed.length} leads importados (lista substituída).`);
    } else {
      const { toInsert, toUpdate } = Importer.deduplicate(parsed, state.leads);
      const all = [...toInsert, ...toUpdate];
      if (all.length) await DB.putLeadsBatch(all);
      const map = new Map(state.leads.map(l => [l.id, l]));
      for (const l of all) map.set(l.id, l);
      state.leads = Array.from(map.values());
      showToast(`${toInsert.length} novos, ${toUpdate.length} atualizados.`);
    }

    state.page = 1;
    state.selected.clear();
    refresh();
  } catch (e) {
    console.error(e);
    showToast('Erro na importação: ' + e.message, 5000);
  }
}

// ============================================================
// GERAÇÃO EM MASSA
// ============================================================
async function generateForIds(ids) {
  if (state.generating) {
    showToast('Já existe uma geração em andamento.');
    return;
  }
  if (!ids.length) {
    showToast('Nenhum lead selecionado.');
    return;
  }
  state.generating = true;
  const total = ids.length;
  let done = 0;
  let batch = [];

  try {
    for (const id of ids) {
      const lead = state.leads.find(l => l.id === id);
      if (!lead) continue;
      const msg = MsgGen.generateMessageWithTemplates(lead, state.config, state.templates);
      lead.messageText = msg;
      if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') {
        lead.messageStatus = 'gerada';
      }
      batch.push(lead);
      done++;
      if (batch.length >= 50) {
        await DB.putLeadsBatch(batch);
        batch = [];
        showToast(`Gerando... ${done} de ${total}`, 60000);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (batch.length) await DB.putLeadsBatch(batch);
    showToast(`${done} mensagens geradas.`);
  } catch (e) {
    console.error(e);
    showToast('Erro na geração: ' + e.message, 5000);
  } finally {
    state.generating = false;
    renderTable();
    renderStats();
  }
}

// ============================================================
// AÇÕES DE LINHA
// ============================================================
async function handleRowAction(action, id) {
  const lead = state.leads.find(l => l.id === id);
  if (!lead) return;

  if (action === 'open') {
    openLeadPanel(id);
  } else if (action === 'copy') {
    let text = lead.messageText;
    if (!text || !text.trim()) {
      text = MsgGen.generateMessageWithTemplates(lead, state.config, state.templates);
      lead.messageText = text;
      if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    }
    await copyText(text);
    lead.messageStatus = 'copiada';
    await persistLead(lead);
    showToast('Mensagem copiada.');
    renderTable();
    renderStats();
  } else if (action === 'whatsapp') {
    const url = Phone.toWhatsAppUrl(phoneForLead(lead));
    if (url) window.open(url, '_blank', 'noopener');
  }
}

// ============================================================
// BIND DE EVENTOS
// ============================================================
function bindEvents() {
  // tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    };
  });

  // importar
  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      importFile(file, $('importMode').value);
      e.target.value = '';
    }
  };

  // drag & drop no painel de leads
  const leadsPanel = $('tab-leads');
  leadsPanel.addEventListener('dragover', (e) => { e.preventDefault(); });
  leadsPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) importFile(file, $('importMode').value);
  });

  // busca
  $('searchInput').oninput = debounce((e) => {
    state.search = e.target.value;
    state.page = 1;
    refresh();
  }, 200);

  // filtros
  $('filterPresenca').onchange = (e) => { state.filters.presenca = e.target.value; state.page = 1; refresh(); };
  $('filterStatus').onchange = (e) => { state.filters.status = e.target.value; state.page = 1; refresh(); };
  $('filterCategoria').onchange = (e) => { state.filters.categoria = e.target.value; state.page = 1; refresh(); };
  $('sortBy').onchange = (e) => { state.sortBy = e.target.value; state.page = 1; refresh(); };

  // tabela - clique em linha
  $('leadsBody').addEventListener('click', (e) => {
    if (e.target.matches('.row-check')) return;
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      handleRowAction(actionBtn.dataset.action, actionBtn.dataset.id);
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) openLeadPanel(tr.dataset.id);
  });

  // tabela - checkbox individual
  $('leadsBody').addEventListener('change', (e) => {
    if (e.target.matches('.row-check')) {
      const id = e.target.dataset.id;
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      const tr = e.target.closest('tr');
      if (tr) tr.classList.toggle('selected', e.target.checked);
      updateBulkActions();
    }
  });

  // selecionar todos (página atual)
  $('selectAll').onchange = (e) => {
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    const pageIds = state.filtered.slice(start, end).map(l => l.id);
    if (e.target.checked) pageIds.forEach(id => state.selected.add(id));
    else pageIds.forEach(id => state.selected.delete(id));
    renderTable();
  };

  // ações em lote
  $('btnBulkGenerate').onclick = async () => {
    const ids = Array.from(state.selected);
    await generateForIds(ids);
    state.selected.clear();
    $('selectAll').checked = false;
    updateBulkActions();
  };

  $('btnBulkContacted').onclick = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    const batch = [];
    for (const id of ids) {
      const lead = state.leads.find(l => l.id === id);
      if (!lead) continue;
      lead.messageStatus = 'contatada';
      if (!lead.salesStatus || lead.salesStatus === 'novo') lead.salesStatus = 'contatado';
      lead.contactDate = lead.contactDate || new Date().toISOString().slice(0, 10);
      batch.push(lead);
    }
    await DB.putLeadsBatch(batch);
    showToast(`${ids.length} leads marcados como contatados.`);
    state.selected.clear();
    $('selectAll').checked = false;
    refresh();
  };

  $('btnBulkDelete').onclick = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} lead(s)? Esta ação não pode ser desfeita.`)) return;
    await DB.deleteLeads(ids);
    const set = new Set(ids);
    state.leads = state.leads.filter(l => !set.has(l.id));
    state.selected.clear();
    refresh();
    showToast(`${ids.length} leads excluídos.`);
  };

  // gerar todas (filtradas)
  $('btnGenerateAll').onclick = async () => {
    const ids = state.filtered.map(l => l.id);
    if (!ids.length) { showToast('Nenhum lead para gerar.'); return; }
    if (!confirm(`Gerar mensagens para ${ids.length} lead(s) (respeitando filtros atuais)?`)) return;
    await generateForIds(ids);
  };

  // exportações
  $('btnExportCSV').onclick = () => {
    if (!state.filtered.length) { showToast('Nada para exportar.'); return; }
    const csv = Exporter.leadsToCSV(state.filtered);
    Exporter.downloadFile(`impacto-web-leads-${Date.now()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  };
  $('btnExportJSON').onclick = () => {
    if (!state.filtered.length) { showToast('Nada para exportar.'); return; }
    const json = Exporter.leadsToJSON(state.filtered);
    Exporter.downloadFile(`impacto-web-leads-${Date.now()}.json`, json, 'application/json');
  };

  // templates
  $('btnSaveTemplates').onclick = saveTemplates;
  $('btnResetTemplates').onclick = resetTemplates;

  // configurações
  $('btnSaveSettings').onclick = saveSettings;

  // backup
  $('btnExportBackup').onclick = async () => {
    const all = await DB.getAllLeads();
    const settings = await DB.getAllSettings();
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'impacto-web-prospect-assistant',
      leads: all,
      settings
    };
    Exporter.downloadFile(`impacto-web-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };
  $('btnImportBackup').onclick = () => $('backupInput').click();
  $('backupInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Importar backup? Isso SUBSTITUIRÁ todos os dados atuais.')) { e.target.value = ''; return; }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.leads)) throw new Error('Backup inválido (sem "leads").');
      await DB.clearLeads();
      await DB.putLeadsBatch(data.leads);
      if (data.settings && typeof data.settings === 'object') {
        for (const [k, v] of Object.entries(data.settings)) {
          await DB.setSetting(k, v);
        }
      }
      state.leads = data.leads;
      const s = await DB.getAllSettings();
      state.config = { ...DEFAULT_SETTINGS };
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (s[k] !== undefined) state.config[k] = s[k];
      }
      if (s.templates) state.templates = { ...MsgGen.DEFAULT_TEMPLATES, ...s.templates };
      applyConfigToUI();
      refresh();
      showToast('Backup restaurado.');
    } catch (err) {
      console.error(err);
      showToast('Erro ao importar backup: ' + err.message, 5000);
    } finally {
      e.target.value = '';
    }
  };

  $('btnClearDB').onclick = async () => {
    if (!confirm('Isso apagará TODOS os leads, mensagens e configurações. Continuar?')) return;
    if (!confirm('Tem certeza absoluta? A ação é irreversível.')) return;
    await DB.clearAll();
    state.leads = [];
    state.selected.clear();
    state.config = { ...DEFAULT_SETTINGS };
    state.templates = { ...MsgGen.DEFAULT_TEMPLATES };
    applyConfigToUI();
    closePanel();
    refresh();
    showToast('Banco limpo.');
  };

  // fechar painel
  $('btnClosePanel').onclick = closePanel;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('leadPanel').hidden) closePanel();
  });
}

// ============================================================
// BOOT
// ============================================================
init();