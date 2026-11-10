import * as DB from './modules/db.js';
import * as Importer from './modules/importer.js';
import * as MsgGen from './modules/message-generator.js';
import * as Phone from './modules/phone.js';
import * as Exporter from './modules/exporter.js';
import * as Instagram from './modules/instagram-analyzer.js';
import * as LeadScoring from './modules/lead-scoring.js';
import { debounce, escapeHtml } from './modules/utils.js';

const DEFAULT_SETTINGS = {
  memberName: '',
  memberRole: '',
  companyName: 'Impacto Web',
  companySite: '',
  companyWhatsApp: '',
  companyInstagram: '',
  strategy: 'dor_direta',
  channel: 'whatsapp',
  previewReady: false
};

const MESSAGE_STATUS_LABELS = {
  nao_gerada: 'Nao gerada',
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
  negociacao: 'Negociacao',
  cliente: 'Cliente',
  sem_interesse: 'Sem interesse',
  ignorar: 'Ignorar'
};

const state = {
  leads: [],
  filtered: [],
  page: 1,
  pageSize: 40,
  selected: new Set(),
  search: '',
  filters: { score: '', presenca: '', status: '', categoria: '' },
  sortBy: 'score_desc',
  config: { ...DEFAULT_SETTINGS },
  templates: { ...MsgGen.DEFAULT_TEMPLATES },
  activeTemplate: 'dor_direta',
  currentLeadId: null,
  panelStrategy: '',
  generating: false,
  analyzing: false
};

const $ = id => document.getElementById(id);

function showToast(message, ms = 2600) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function clean(value) {
  return String(value ?? '').trim();
}

function truncate(value, max = 130) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('pt-BR') : '0';
}

function formatCompact(value) {
  const number = Number(value || 0);
  if (!number) return '0';
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
}

function normalizeHandle(value) {
  return Instagram.normalizeInstagramHandle(value);
}

function instagramUrl(lead) {
  const handle = normalizeHandle(lead.instagram);
  return handle ? `https://www.instagram.com/${handle}/` : '';
}

function phoneForLead(lead) {
  return Phone.normalizePhone(lead.whatsapp || lead.telefone, lead.pais);
}

function presenceKey(lead) {
  const hasSite = LeadScoring.hasOwnWebsite(lead.site || lead.instagramExternalUrl);
  const hasInstagram = !!normalizeHandle(lead.instagram);
  const hasWhatsApp = !!clean(lead.whatsapp || lead.telefone);
  if (hasSite) return 'site';
  if (hasInstagram && hasWhatsApp) return 'insta_whats';
  if (hasInstagram) return 'instagram';
  if (hasWhatsApp) return 'whatsapp';
  return 'nenhuma';
}

function presenceLabel(lead) {
  return {
    site: 'Site proprio',
    insta_whats: 'Instagram + WhatsApp',
    instagram: 'Somente Instagram',
    whatsapp: 'Somente WhatsApp',
    nenhuma: 'Sem presenca'
  }[presenceKey(lead)];
}

function findLead(id) {
  return state.leads.find(lead => lead.id === id) || null;
}

function findLeadByInstagram(handle) {
  const normalized = normalizeHandle(handle);
  return state.leads.find(lead => normalizeHandle(lead.instagram) === normalized) || null;
}

async function persistLead(lead) {
  lead._updatedAt = Date.now();
  await DB.putLead(lead);
}

async function init() {
  try {
    const settings = await DB.getAllSettings();
    state.config = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (settings[key] !== undefined) state.config[key] = settings[key];
    }
    if (!settings.strategy && settings.tone) {
      state.config.strategy = {
        profissional: 'consultiva',
        curta: 'curta',
        curiosidade: 'oportunidade',
        direta: 'dor_direta'
      }[settings.tone] || 'dor_direta';
    }
    if (settings.templates && typeof settings.templates === 'object') {
      state.templates = { ...MsgGen.DEFAULT_TEMPLATES, ...settings.templates };
    }

    const storedLeads = await DB.getAllLeads();
    state.leads = storedLeads.map(lead => LeadScoring.applyQualification(lead));
    if (state.leads.length) await DB.putLeadsBatch(state.leads);

    applyConfigToUI();
    renderStrategyUI();
    refresh();
    bindEvents();
    const initialInstagram = new URLSearchParams(location.search).get('instagram');
    if (initialInstagram) {
      $('seedInstagram').value = initialInstagram;
      mineFollowersFromSeed();
    }
  } catch (error) {
    console.error(error);
    showToast(`Erro ao inicializar: ${error.message}`, 5000);
  }
}

function strategyOptions(selected) {
  return Object.entries(MsgGen.TEMPLATE_META)
    .map(([key, meta]) => `<option value="${key}" ${selected === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
    .join('');
}

function applyConfigToUI() {
  $('cfgMemberName').value = state.config.memberName || '';
  $('cfgMemberRole').value = state.config.memberRole || '';
  $('cfgCompanyName').value = state.config.companyName || 'Impacto Web';
  $('cfgCompanySite').value = state.config.companySite || '';
  $('cfgCompanyWhatsApp').value = state.config.companyWhatsApp || '';
  $('cfgCompanyInstagram').value = state.config.companyInstagram || '';
  $('cfgStrategy').innerHTML = strategyOptions(state.config.strategy || 'dor_direta');
  $('cfgStrategy').value = state.config.strategy || 'dor_direta';
  $('cfgChannel').value = state.config.channel || 'whatsapp';
  $('cfgPreview').value = String(!!state.config.previewReady);
}

async function saveSettings() {
  state.config.memberName = $('cfgMemberName').value.trim();
  state.config.memberRole = $('cfgMemberRole').value.trim();
  state.config.companyName = $('cfgCompanyName').value.trim() || 'Impacto Web';
  state.config.companySite = $('cfgCompanySite').value.trim();
  state.config.companyWhatsApp = $('cfgCompanyWhatsApp').value.trim();
  state.config.companyInstagram = $('cfgCompanyInstagram').value.trim();
  state.config.strategy = $('cfgStrategy').value;
  state.config.channel = $('cfgChannel').value;
  state.config.previewReady = $('cfgPreview').value === 'true';
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    await DB.setSetting(key, state.config[key]);
  }
  showToast('Configuracoes salvas.');
}

function renderStrategyUI() {
  $('strategyList').innerHTML = Object.entries(MsgGen.TEMPLATE_META).map(([key, meta]) => `
    <button type="button" class="strategy-item ${key === state.activeTemplate ? 'active' : ''}" data-template="${key}">
      <strong>${escapeHtml(meta.label)}</strong>
      <small>${escapeHtml(meta.description)}</small>
    </button>
  `).join('');
  renderTemplateEditor();
}

function renderTemplateEditor() {
  const meta = MsgGen.TEMPLATE_META[state.activeTemplate];
  $('templateTitle').textContent = meta?.label || state.activeTemplate;
  $('templateDescription').textContent = meta?.description || '';
  $('templateEditor').value = state.templates[state.activeTemplate] || MsgGen.DEFAULT_TEMPLATES[state.activeTemplate] || '';
  document.querySelectorAll('.strategy-item').forEach(button => {
    button.classList.toggle('active', button.dataset.template === state.activeTemplate);
  });
}

async function saveActiveTemplate() {
  state.templates[state.activeTemplate] = $('templateEditor').value;
  await DB.setSetting('templates', state.templates);
  showToast('Template salvo.');
}

async function resetActiveTemplate() {
  if (!confirm(`Restaurar o template "${MsgGen.TEMPLATE_META[state.activeTemplate]?.label}"?`)) return;
  state.templates[state.activeTemplate] = MsgGen.DEFAULT_TEMPLATES[state.activeTemplate];
  await DB.setSetting('templates', state.templates);
  renderTemplateEditor();
  showToast('Template restaurado.');
}

async function resetAllTemplates() {
  if (!confirm('Restaurar todos os templates padrao da versao 2.0?')) return;
  state.templates = { ...MsgGen.DEFAULT_TEMPLATES };
  await DB.setSetting('templates', state.templates);
  renderTemplateEditor();
  showToast('Todos os templates foram restaurados.');
}

function applyFilters() {
  let list = state.leads.slice();
  const query = clean(state.search).toLowerCase();
  if (query) {
    list = list.filter(lead => [
      lead.nome,
      lead.instagram,
      lead.seedInstagram,
      lead.categoria,
      lead.cidade,
      lead.telefone,
      lead.whatsapp,
      lead.primaryPain,
      lead.opportunity
    ].some(value => clean(value).toLowerCase().includes(query)));
  }
  if (state.filters.score === 'hot') list = list.filter(lead => Number(lead.score) >= 4);
  else if (state.filters.score) list = list.filter(lead => Number(lead.score) === Number(state.filters.score));
  if (state.filters.presenca) list = list.filter(lead => presenceKey(lead) === state.filters.presenca);
  if (state.filters.status) {
    list = list.filter(lead => (lead.messageStatus || 'nao_gerada') === state.filters.status);
  }
  if (state.filters.categoria) {
    list = list.filter(lead => clean(lead.categoria).toLowerCase() === state.filters.categoria);
  }

  switch (state.sortBy) {
    case 'followers_desc': list.sort((a, b) => Number(b.instagramFollowers || 0) - Number(a.instagramFollowers || 0)); break;
    case 'avaliacoes_desc': list.sort((a, b) => Number(b.avaliacoes || 0) - Number(a.avaliacoes || 0)); break;
    case 'nota_desc': list.sort((a, b) => Number(b.nota || 0) - Number(a.nota || 0)); break;
    case 'nome_asc': list.sort((a, b) => clean(a.nome).localeCompare(clean(b.nome))); break;
    case 'data_desc': list.sort((a, b) => Number(b._importedAt || 0) - Number(a._importedAt || 0)); break;
    default:
      list.sort((a, b) => Number(b.score || 0) - Number(a.score || 0) ||
        Number(b.qualificationConfidence || 0) - Number(a.qualificationConfidence || 0));
  }
  state.filtered = list;
  const maxPage = Math.max(1, Math.ceil(list.length / state.pageSize));
  if (state.page > maxPage) state.page = maxPage;
}

function refresh() {
  applyFilters();
  renderStats();
  renderInsights();
  renderTable();
  renderPagination();
  populateFilterOptions();
}

function renderStats() {
  const total = state.leads.length;
  const hot = state.leads.filter(lead => Number(lead.score) >= 4).length;
  const scoreFive = state.leads.filter(lead => Number(lead.score) === 5).length;
  const messages = state.leads.filter(lead => clean(lead.messageText)).length;
  const contacted = state.leads.filter(lead =>
    ['contatada', 'respondida', 'interessada', 'sem_interesse'].includes(lead.messageStatus) ||
    ['contatado', 'respondeu', 'interessado', 'negociacao', 'cliente'].includes(lead.salesStatus)
  ).length;
  const cards = [
    { label: 'Seguidores na base', value: total, foot: 'Audiencias analisadas' },
    { label: 'Prioridade 4–5', value: hot, foot: total ? `${Math.round(hot / total * 100)}% da base` : 'Sem dados', hot: true },
    { label: 'Nota máxima', value: scoreFive, foot: 'Atacar primeiro' },
    { label: 'Mensagens prontas', value: messages, foot: 'Personalizadas' },
    { label: 'Já contatados', value: contacted, foot: 'Movidos no funil' }
  ];
  $('statsGrid').innerHTML = cards.map(card => `
    <article class="stat-card ${card.hot ? 'hot' : ''}">
      <span class="stat-label">${escapeHtml(card.label)}</span>
      <strong class="stat-value">${formatNumber(card.value)}</strong>
      <small class="stat-foot">${escapeHtml(card.foot)}</small>
    </article>
  `).join('');
}

function renderInsights() {
  const total = state.leads.length;
  const average = total
    ? state.leads.reduce((sum, lead) => sum + Number(lead.score || 0), 0) / total
    : 0;
  $('averageScore').textContent = `Media ${average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  $('scoreDistribution').innerHTML = [5, 4, 3, 2, 1].map(score => {
    const count = state.leads.filter(lead => Number(lead.score) === score).length;
    const percent = total ? Math.round(count / total * 100) : 0;
    return `
      <div class="distribution-row">
        <b>${score}</b>
        <div class="distribution-track"><div class="distribution-fill score-${score}" style="width:${percent}%"></div></div>
        <span>${count}</span>
      </div>
    `;
  }).join('');

  const available = state.leads.filter(lead => !['cliente', 'ignorar'].includes(lead.salesStatus));
  const highPotential = available.slice()
    .sort((a, b) => Number(b.score) - Number(a.score) || Number(b.qualificationConfidence) - Number(a.qualificationConfidence))
    .slice(0, 3);
  const lowPotential = available.slice()
    .sort((a, b) => Number(a.score) - Number(b.score) || Number(b.qualificationConfidence) - Number(a.qualificationConfidence))
    .slice(0, 3);
  const renderExtreme = leads => leads.length ? leads.map(lead => `
      <button type="button" class="next-action" data-open-lead="${escapeHtml(lead.id)}">
        <b class="score-badge score-${lead.score}">${lead.score}</b>
        <span><strong>${escapeHtml(lead.nome || lead.instagram || 'Seguidor')}</strong><small>${escapeHtml(lead.seedInstagram ? `Origem ${lead.seedInstagram}` : truncate(lead.primaryPain, 70))}</small></span>
        <em>→</em>
      </button>
    `).join('') : '<div class="empty-mini">Minere uma audiencia para comparar os extremos.</div>';
  $('highPotential').innerHTML = renderExtreme(highPotential);
  $('lowPotential').innerHTML = renderExtreme(lowPotential);
}

function populateFilterOptions() {
  const select = $('filterCategoria');
  const current = select.value;
  const categories = Array.from(new Set(state.leads.map(lead => clean(lead.categoria)).filter(Boolean))).sort();
  select.innerHTML = '<option value="">Todas as categorias</option>' + categories
    .map(category => `<option value="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</option>`)
    .join('');
  if (categories.some(category => category.toLowerCase() === current)) select.value = current;
}

function proofHtml(lead) {
  const lines = [];
  if (Number(lead.instagramFollowers || 0) > 0) lines.push(`${formatCompact(lead.instagramFollowers)} seguidores`);
  if (Number(lead.avaliacoes || 0) > 0) {
    lines.push(`${formatNumber(lead.avaliacoes)} avaliacoes${lead.nota ? ` · nota ${escapeHtml(String(lead.nota))}` : ''}`);
  }
  if (lead.instagramVerified) lines.push('Perfil verificado');
  return lines.length
    ? `<span class="proof-stack">${lines.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</span>`
    : '<span class="muted-line">Poucos sinais coletados</span>';
}

function renderTable() {
  const start = (state.page - 1) * state.pageSize;
  const pageLeads = state.filtered.slice(start, start + state.pageSize);
  const body = $('leadsBody');
  if (!pageLeads.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">Nenhum seguidor qualificado. Informe uma conta de origem ou importe uma base para começar.</td></tr>';
    updateBulkActions();
    return;
  }

  body.innerHTML = pageLeads.map(lead => {
    const selected = state.selected.has(lead.id);
    const messageStatus = lead.messageStatus || 'nao_gerada';
    const hasMessage = !!clean(lead.messageText);
    const hasInstagram = !!instagramUrl(lead);
    const hasWhatsApp = !!Phone.toWhatsAppUrl(phoneForLead(lead));
    return `
      <tr data-id="${escapeHtml(lead.id)}" class="${selected ? 'selected' : ''}">
        <td><input type="checkbox" class="row-check" data-id="${escapeHtml(lead.id)}" ${selected ? 'checked' : ''} aria-label="Selecionar ${escapeHtml(lead.nome || 'lead')}"></td>
        <td><span class="lead-cell"><strong>${escapeHtml(lead.nome || 'Seguidor sem nome')}</strong><span>${escapeHtml([lead.instagram, lead.seedInstagram ? `de ${lead.seedInstagram}` : ''].filter(Boolean).join(' · ') || lead.categoria || presenceLabel(lead))}</span></span></td>
        <td><span class="pain-cell">${escapeHtml(lead.primaryPain || 'Dor ainda nao identificada')}</span></td>
        <td><span class="qualification-cell"><b class="score-badge score-${lead.score}">${lead.score}</b><span><strong>${escapeHtml(lead.qualificationLabel || '')}</strong><small>${lead.qualificationConfidence || 0}% de confianca</small></span></span></td>
        <td>${proofHtml(lead)}</td>
        <td><span class="badge badge-${messageStatus}">${escapeHtml(MESSAGE_STATUS_LABELS[messageStatus] || messageStatus)}</span></td>
        <td><span class="pain-cell">${escapeHtml(truncate(lead.nextStep || lead.recommendedApproach, 95))}</span></td>
        <td class="actions">
          <button type="button" class="btn-xs" data-action="open" data-id="${escapeHtml(lead.id)}">Abrir</button>
          <button type="button" class="btn-xs" data-action="copy" data-id="${escapeHtml(lead.id)}">${hasMessage ? 'Copiar' : 'Gerar'}</button>
          <button type="button" class="btn-xs" data-action="instagram" data-id="${escapeHtml(lead.id)}" ${hasInstagram ? '' : 'disabled'}>Instagram</button>
          <button type="button" class="btn-xs" data-action="whatsapp" data-id="${escapeHtml(lead.id)}" ${hasWhatsApp ? '' : 'disabled'}>WhatsApp</button>
        </td>
      </tr>
    `;
  }).join('');
  updateBulkActions();
}

function renderPagination() {
  const total = state.filtered.length;
  const pagesTotal = Math.max(1, Math.ceil(total / state.pageSize));
  const current = state.page;
  const pages = [];
  for (let page = 1; page <= pagesTotal; page++) {
    if (page === 1 || page === pagesTotal || Math.abs(page - current) <= 2) pages.push(page);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  const html = [
    `<button type="button" data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>Anterior</button>`,
    ...pages.map(page => page === '...'
      ? '<span>…</span>'
      : `<button type="button" data-page="${page}" class="${page === current ? 'active' : ''}">${page}</button>`),
    `<button type="button" data-page="${current + 1}" ${current >= pagesTotal ? 'disabled' : ''}>Proxima</button>`,
    `<span class="page-info">${formatNumber(total)} leads · pagina ${current} de ${pagesTotal}</span>`
  ];
  $('pagination').innerHTML = html.join('');
  $('pagination').querySelectorAll('button[data-page]').forEach(button => {
    button.onclick = () => {
      const page = Number(button.dataset.page);
      if (page >= 1 && page <= pagesTotal) {
        state.page = page;
        renderTable();
        renderPagination();
      }
    };
  });
}

function updateBulkActions() {
  const visible = state.selected.size > 0;
  $('bulkActions').hidden = !visible;
  if (visible) $('bulkCount').textContent = `${state.selected.size} selecionado(s)`;
}

function openLeadPanel(id) {
  const lead = findLead(id);
  if (!lead) return;
  state.currentLeadId = id;
  state.panelStrategy = MsgGen.getRecommendedStrategy(lead);
  $('leadPanel').hidden = false;
  $('panelBackdrop').hidden = false;
  $('leadPanelTitle').textContent = lead.nome || lead.instagram || 'Lead';
  renderLeadPanel(lead);
}

function closePanel() {
  $('leadPanel').hidden = true;
  $('panelBackdrop').hidden = true;
  state.currentLeadId = null;
  state.panelStrategy = '';
}

function renderLeadPanel(lead) {
  const qualification = lead.qualification || LeadScoring.qualifyLead(lead);
  const messageStatus = lead.messageStatus || 'nao_gerada';
  const salesStatus = lead.salesStatus || 'novo';
  const hasMessage = !!clean(lead.messageText);
  const waUrl = Phone.toWhatsAppUrl(phoneForLead(lead));
  const igUrl = instagramUrl(lead);
  const signals = [
    ...qualification.evidence.map(item => `<span class="signal-chip positive">+ ${escapeHtml(item)}</span>`),
    ...qualification.cautions.map(item => `<span class="signal-chip caution">! ${escapeHtml(item)}</span>`)
  ].join('') || '<span class="signal-chip">Poucos sinais disponiveis</span>';

  $('leadPanelBody').innerHTML = `
    <div class="score-hero">
      <b class="score-badge score-${lead.score}">${lead.score}</b>
      <div>
        <h3>${escapeHtml(lead.qualificationLabel || qualification.label)}</h3>
        <p>${lead.qualificationConfidence || qualification.confidence}% de confianca · modelo local 2.0</p>
        <div class="confidence-bar"><span style="width:${lead.qualificationConfidence || qualification.confidence}%"></span></div>
      </div>
    </div>

    <section class="panel-section">
      <div class="panel-section-head"><h3>Por que esta nota?</h3><span class="badge badge-${messageStatus}">${escapeHtml(MESSAGE_STATUS_LABELS[messageStatus] || messageStatus)}</span></div>
      <div class="signal-list">${signals}</div>
    </section>

    <section class="panel-section">
      <div class="panel-section-head"><h3>Diagnostico personalizado</h3></div>
      <div class="diagnosis-grid">
        <label class="diagnosis-card"><span>Dor principal</span><textarea id="panelPain" rows="5">${escapeHtml(lead.primaryPain || qualification.primaryPain)}</textarea></label>
        <label class="diagnosis-card"><span>Oportunidade</span><textarea id="panelOpportunity" rows="5">${escapeHtml(lead.opportunity || qualification.opportunity)}</textarea></label>
      </div>
      <p class="panel-note">Voce pode ajustar a leitura antes de gerar a abordagem.</p>
    </section>

    <section class="panel-section">
      <div class="panel-section-head"><h3>Sinais coletados</h3></div>
      <div class="detail-grid">
        <div class="detail-item"><span>Instagram</span><strong>${escapeHtml(lead.instagram || '—')}</strong></div>
        <div class="detail-item"><span>Seguidores</span><strong>${lead.instagramFollowers ? formatNumber(lead.instagramFollowers) : '—'}</strong></div>
        <div class="detail-item"><span>Categoria</span><strong>${escapeHtml(lead.categoria || '—')}</strong></div>
        <div class="detail-item"><span>Presenca digital</span><strong>${escapeHtml(presenceLabel(lead))}</strong></div>
        <div class="detail-item"><span>Google</span><strong>${lead.avaliacoes ? `${formatNumber(lead.avaliacoes)} avaliacoes · ${lead.nota || 's/n'}` : '—'}</strong></div>
        <div class="detail-item"><span>Contato</span><strong>${escapeHtml(lead.whatsapp || lead.telefone || lead.email || '—')}</strong></div>
        <div class="detail-item"><span>Site</span><strong>${escapeHtml(lead.site || lead.instagramExternalUrl || '—')}</strong></div>
        <div class="detail-item"><span>Origem</span><strong>${escapeHtml(lead.pesquisa || lead.source || '—')}</strong></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="panel-section-head"><h3>Mensagem pela dor</h3><button type="button" class="text-btn" id="panelVariants">Gerar 3 versoes</button></div>
      <div class="generator-controls">
        <label>Estrategia<select id="panelStrategy" class="select full">${strategyOptions(state.panelStrategy)}</select></label>
        <label>Canal<select id="panelChannel" class="select full"><option value="whatsapp" ${state.config.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="instagram" ${state.config.channel === 'instagram' ? 'selected' : ''}>Instagram DM</option></select></label>
        <label>Previa<select id="panelPreview" class="select full"><option value="false" ${!state.config.previewReady ? 'selected' : ''}>Nao pronta</option><option value="true" ${state.config.previewReady ? 'selected' : ''}>Ja pronta</option></select></label>
      </div>
      <div id="panelVariantList" class="variant-grid" hidden></div>
      <label class="panel-field" for="panelMessage">Texto da mensagem</label>
      <textarea id="panelMessage" rows="12" placeholder="Gere uma abordagem personalizada">${escapeHtml(lead.messageText || '')}</textarea>
      <div class="panel-buttons">
        <button type="button" class="btn accent" id="panelGenerate">${hasMessage ? 'Regenerar' : 'Gerar mensagem'}</button>
        <button type="button" class="btn secondary" id="panelSaveMessage">Salvar texto</button>
        <button type="button" class="btn ghost" id="panelCopy" ${hasMessage ? '' : 'disabled'}>Copiar</button>
        <button type="button" class="btn ghost" id="panelInstagram" ${igUrl ? '' : 'disabled'}>Abrir Instagram</button>
        <button type="button" class="btn ghost" id="panelWhatsApp" ${waUrl ? '' : 'disabled'}>Abrir WhatsApp</button>
      </div>
    </section>

    <section class="panel-section">
      <div class="panel-section-head"><h3>Funil e follow-up</h3></div>
      <div class="generator-controls">
        <label>Status<select id="panelSalesStatus" class="select full">${Object.entries(SALES_STATUS_LABELS).map(([key, label]) => `<option value="${key}" ${salesStatus === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Contato<input type="date" id="panelContactDate" value="${escapeHtml(lead.contactDate || '')}"></label>
        <label>Follow-up<input type="date" id="panelFollowUpDate" value="${escapeHtml(lead.followUpDate || '')}"></label>
      </div>
      <label class="panel-field" for="panelInternalNote">Observacao interna</label>
      <textarea id="panelInternalNote" rows="4" placeholder="Contexto da conversa, objecoes e proximo passo">${escapeHtml(lead.internalNote || '')}</textarea>
      <div class="panel-buttons">
        <button type="button" class="btn accent" id="panelSaveLead">Salvar diagnostico e funil</button>
        <button type="button" class="btn danger" id="panelDelete">Excluir lead</button>
      </div>
    </section>
  `;
  bindPanelEvents(lead, waUrl, igUrl);
}

function currentPanelConfig() {
  return {
    ...state.config,
    strategy: $('panelStrategy').value,
    channel: $('panelChannel').value,
    previewReady: $('panelPreview').value === 'true'
  };
}

function syncPanelDiagnosis(lead) {
  lead.primaryPain = $('panelPain').value.trim();
  lead.opportunity = $('panelOpportunity').value.trim();
  state.panelStrategy = $('panelStrategy').value;
}

function bindPanelEvents(lead, waUrl, igUrl) {
  $('panelStrategy').onchange = event => { state.panelStrategy = event.target.value; };

  $('panelGenerate').onclick = async () => {
    syncPanelDiagnosis(lead);
    const message = MsgGen.generateMessageWithTemplates(lead, currentPanelConfig(), state.templates);
    const validation = MsgGen.validateMessage(message);
    if (!validation.valid) {
      showToast(`A mensagem precisa de revisao: ${validation.reason}.`, 4200);
      return;
    }
    lead.messageText = message;
    if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    await persistLead(lead);
    $('panelMessage').value = message;
    $('panelCopy').disabled = false;
    $('panelSaveMessage').disabled = false;
    renderTable();
    renderStats();
    showToast('Mensagem gerada pela dor do lead.');
  };

  $('panelVariants').onclick = () => {
    syncPanelDiagnosis(lead);
    const variants = MsgGen.generateMessageVariants(lead, currentPanelConfig(), state.templates);
    const list = $('panelVariantList');
    list.hidden = false;
    list.innerHTML = variants.map((variant, index) => `
      <article class="variant-card">
        <div class="variant-card-head"><strong>${escapeHtml(variant.label)}</strong><button type="button" class="text-btn" data-use-variant="${index}">Usar esta</button></div>
        <p>${escapeHtml(variant.text)}</p>
      </article>
    `).join('');
    list.querySelectorAll('[data-use-variant]').forEach(button => {
      button.onclick = () => {
        const variant = variants[Number(button.dataset.useVariant)];
        $('panelMessage').value = variant.text;
        state.panelStrategy = variant.strategy;
        $('panelStrategy').value = variant.strategy;
      };
    });
  };

  $('panelSaveMessage').onclick = async () => {
    syncPanelDiagnosis(lead);
    const message = $('panelMessage').value.trim();
    const validation = MsgGen.validateMessage(message);
    if (!validation.valid) {
      showToast(`Revise a mensagem: ${validation.reason}.`, 4200);
      return;
    }
    lead.messageText = message;
    if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
    await persistLead(lead);
    renderTable();
    renderStats();
    showToast('Mensagem salva.');
  };

  $('panelCopy').onclick = async () => {
    const message = $('panelMessage').value.trim();
    if (!message) return;
    await copyText(message);
    lead.messageText = message;
    lead.messageStatus = 'copiada';
    await persistLead(lead);
    renderTable();
    renderStats();
    showToast('Mensagem copiada.');
  };

  $('panelInstagram').onclick = () => { if (igUrl) window.open(igUrl, '_blank', 'noopener'); };
  $('panelWhatsApp').onclick = () => { if (waUrl) window.open(waUrl, '_blank', 'noopener'); };

  $('panelSaveLead').onclick = async () => {
    syncPanelDiagnosis(lead);
    lead.salesStatus = $('panelSalesStatus').value;
    lead.contactDate = $('panelContactDate').value;
    lead.followUpDate = $('panelFollowUpDate').value;
    lead.internalNote = $('panelInternalNote').value.trim();
    if (lead.salesStatus === 'contatado' && (!lead.messageStatus || lead.messageStatus === 'gerada')) {
      lead.messageStatus = 'contatada';
    }
    await persistLead(lead);
    refresh();
    showToast('Diagnostico e funil atualizados.');
  };

  $('panelDelete').onclick = async () => {
    if (!confirm('Excluir este lead e as mensagens associadas?')) return;
    await DB.deleteLead(lead.id);
    state.leads = state.leads.filter(item => item.id !== lead.id);
    state.selected.delete(lead.id);
    closePanel();
    refresh();
    showToast('Lead excluido.');
  };
}

async function mineFollowersFromSeed() {
  if (state.analyzing) return;
  const seedHandle = normalizeHandle($('seedInstagram').value);
  if (!seedHandle) {
    showToast('Digite um @ de origem valido.');
    return;
  }
  const maxFollowers = Number($('followerPoolSize').value || 100);
  const analysisLimit = Number($('analysisLimit').value || 20);
  state.analyzing = true;
  $('btnMineFollowers').disabled = true;
  try {
    const result = await Instagram.discoverFollowerProfiles(seedHandle, {
      maxFollowers,
      analysisLimit,
      onStatus: message => { $('instagramStatus').textContent = message; }
    });
    const changed = [];
    for (const profile of result.profiles) {
      const existing = findLeadByInstagram(profile.handle);
      const lead = Instagram.createLeadFromInstagram(profile, existing);
      changed.push(lead);
      if (existing) {
        const index = state.leads.findIndex(item => item.id === existing.id);
        state.leads[index] = lead;
      } else {
        state.leads.push(lead);
      }
    }
    if (changed.length) await DB.putLeadsBatch(changed);
    state.page = 1;
    refresh();
    $('instagramStatus').textContent = `${result.collected} seguidores coletados de @${result.seedHandle}; ${result.analyzed} perfis qualificados; ${result.errors.length} falhas.`;
    showToast(`${result.analyzed} seguidores de @${result.seedHandle} adicionados ao ranking.`);
  } catch (error) {
    console.error(error);
    $('instagramStatus').textContent = error.message;
    showToast(`Nao foi possivel minerar a audiencia: ${error.message}`, 6000);
  } finally {
    state.analyzing = false;
    $('btnMineFollowers').disabled = false;
  }
}

async function importFile(file, mode) {
  try {
    showToast('Lendo e qualificando a base...', 60000);
    const parsed = await Importer.parseFile(file);
    if (!parsed.length) {
      showToast('Nenhum lead valido foi encontrado.');
      return;
    }
    if (mode === 'replace') {
      await DB.clearLeads();
      await DB.putLeadsBatch(parsed);
      state.leads = parsed;
      showToast(`${parsed.length} leads importados e requalificados.`);
    } else {
      const { toInsert, toUpdate } = Importer.deduplicate(parsed, state.leads);
      const changed = [...toInsert, ...toUpdate];
      if (changed.length) await DB.putLeadsBatch(changed);
      const map = new Map(state.leads.map(lead => [lead.id, lead]));
      changed.forEach(lead => map.set(lead.id, lead));
      state.leads = Array.from(map.values());
      showToast(`${toInsert.length} novos e ${toUpdate.length} atualizados.`);
    }
    state.page = 1;
    state.selected.clear();
    refresh();
  } catch (error) {
    console.error(error);
    showToast(`Erro na importacao: ${error.message}`, 5000);
  }
}

async function generateForIds(ids) {
  if (state.generating) {
    showToast('Ja existe uma geracao em andamento.');
    return;
  }
  if (!ids.length) {
    showToast('Nenhum lead selecionado.');
    return;
  }
  state.generating = true;
  let batch = [];
  let completed = 0;
  try {
    for (const id of ids) {
      const lead = findLead(id);
      if (!lead) continue;
      const strategy = MsgGen.getRecommendedStrategy(lead);
      lead.messageText = MsgGen.generateMessageWithTemplates(lead, { ...state.config, strategy }, state.templates);
      if (!lead.messageStatus || lead.messageStatus === 'nao_gerada') lead.messageStatus = 'gerada';
      batch.push(lead);
      completed++;
      if (batch.length >= 40) {
        await DB.putLeadsBatch(batch);
        batch = [];
        showToast(`Gerando ${completed} de ${ids.length}...`, 60000);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (batch.length) await DB.putLeadsBatch(batch);
    showToast(`${completed} mensagens geradas com estrategia recomendada.`);
  } catch (error) {
    console.error(error);
    showToast(`Erro na geracao: ${error.message}`, 5000);
  } finally {
    state.generating = false;
    renderTable();
    renderStats();
  }
}

async function handleRowAction(action, id) {
  const lead = findLead(id);
  if (!lead) return;
  if (action === 'open') return openLeadPanel(id);
  if (action === 'copy') {
    if (!clean(lead.messageText)) {
      const strategy = MsgGen.getRecommendedStrategy(lead);
      lead.messageText = MsgGen.generateMessageWithTemplates(lead, { ...state.config, strategy }, state.templates);
      lead.messageStatus = 'gerada';
    }
    await copyText(lead.messageText);
    lead.messageStatus = 'copiada';
    await persistLead(lead);
    renderTable();
    renderStats();
    showToast('Mensagem personalizada copiada.');
    return;
  }
  if (action === 'instagram') {
    const url = instagramUrl(lead);
    if (url) window.open(url, '_blank', 'noopener');
    return;
  }
  if (action === 'whatsapp') {
    const url = Phone.toWhatsAppUrl(phoneForLead(lead));
    if (url) window.open(url, '_blank', 'noopener');
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(button => {
    button.onclick = () => {
      document.querySelectorAll('.tab').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-selected', String(item === button));
      });
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      $(`tab-${button.dataset.tab}`)?.classList.add('active');
    };
  });

  $('btnMineFollowers').onclick = mineFollowersFromSeed;
  $('seedInstagram').onkeydown = event => {
    if (event.key === 'Enter') mineFollowersFromSeed();
  };
  $('btnUseRenato').onclick = () => {
    $('seedInstagram').value = '@renato_cariani';
    $('seedInstagram').focus();
  };

  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = event => {
    const file = event.target.files?.[0];
    if (file) importFile(file, $('importMode').value);
    event.target.value = '';
  };
  $('tab-leads').addEventListener('dragover', event => event.preventDefault());
  $('tab-leads').addEventListener('drop', event => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) importFile(file, $('importMode').value);
  });

  $('searchInput').oninput = debounce(event => {
    state.search = event.target.value;
    state.page = 1;
    refresh();
  }, 180);
  $('filterScore').onchange = event => { state.filters.score = event.target.value; state.page = 1; refresh(); };
  $('filterPresenca').onchange = event => { state.filters.presenca = event.target.value; state.page = 1; refresh(); };
  $('filterStatus').onchange = event => { state.filters.status = event.target.value; state.page = 1; refresh(); };
  $('filterCategoria').onchange = event => { state.filters.categoria = event.target.value; state.page = 1; refresh(); };
  $('sortBy').onchange = event => { state.sortBy = event.target.value; state.page = 1; refresh(); };
  $('btnFocusHot').onclick = () => {
    state.filters.score = 'hot';
    $('filterScore').value = 'hot';
    state.page = 1;
    refresh();
    $('baseTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openExtremeLead = event => {
    const button = event.target.closest('[data-open-lead]');
    if (button) openLeadPanel(button.dataset.openLead);
  };
  $('highPotential').onclick = openExtremeLead;
  $('lowPotential').onclick = openExtremeLead;
  $('leadsBody').onclick = event => {
    if (event.target.matches('.row-check')) return;
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.stopPropagation();
      handleRowAction(actionButton.dataset.action, actionButton.dataset.id);
      return;
    }
    const row = event.target.closest('tr[data-id]');
    if (row) openLeadPanel(row.dataset.id);
  };
  $('leadsBody').onchange = event => {
    if (!event.target.matches('.row-check')) return;
    const id = event.target.dataset.id;
    if (event.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    event.target.closest('tr')?.classList.toggle('selected', event.target.checked);
    updateBulkActions();
  };
  $('selectAll').onchange = event => {
    const start = (state.page - 1) * state.pageSize;
    const ids = state.filtered.slice(start, start + state.pageSize).map(lead => lead.id);
    if (event.target.checked) ids.forEach(id => state.selected.add(id));
    else ids.forEach(id => state.selected.delete(id));
    renderTable();
  };

  $('btnBulkGenerate').onclick = async () => {
    await generateForIds(Array.from(state.selected));
    state.selected.clear();
    $('selectAll').checked = false;
    updateBulkActions();
  };
  $('btnBulkContacted').onclick = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    const batch = [];
    for (const id of ids) {
      const lead = findLead(id);
      if (!lead) continue;
      lead.messageStatus = 'contatada';
      lead.salesStatus = lead.salesStatus === 'novo' ? 'contatado' : lead.salesStatus;
      lead.contactDate = lead.contactDate || new Date().toISOString().slice(0, 10);
      batch.push(lead);
    }
    await DB.putLeadsBatch(batch);
    state.selected.clear();
    $('selectAll').checked = false;
    refresh();
    showToast(`${batch.length} leads marcados como contatados.`);
  };
  $('btnBulkDelete').onclick = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length || !confirm(`Excluir ${ids.length} lead(s)?`)) return;
    await DB.deleteLeads(ids);
    const selectedSet = new Set(ids);
    state.leads = state.leads.filter(lead => !selectedSet.has(lead.id));
    state.selected.clear();
    refresh();
    showToast(`${ids.length} lead(s) excluido(s).`);
  };

  $('btnGenerateAll').onclick = async () => {
    const ids = state.filtered.map(lead => lead.id);
    if (!ids.length) return showToast('Nenhum lead filtrado.');
    if (!confirm(`Gerar mensagens recomendadas para ${ids.length} lead(s)?`)) return;
    await generateForIds(ids);
  };
  $('btnExportCSV').onclick = () => {
    if (!state.filtered.length) return showToast('Nada para exportar.');
    Exporter.downloadFile(`impacto-web-leads-v2-${Date.now()}.csv`, `\uFEFF${Exporter.leadsToCSV(state.filtered)}`, 'text/csv;charset=utf-8');
  };
  $('btnExportJSON').onclick = () => {
    if (!state.filtered.length) return showToast('Nada para exportar.');
    Exporter.downloadFile(`impacto-web-leads-v2-${Date.now()}.json`, Exporter.leadsToJSON(state.filtered), 'application/json');
  };

  $('strategyList').onclick = event => {
    const button = event.target.closest('[data-template]');
    if (!button) return;
    state.activeTemplate = button.dataset.template;
    renderTemplateEditor();
  };
  $('btnSaveTemplate').onclick = saveActiveTemplate;
  $('btnResetTemplate').onclick = resetActiveTemplate;
  $('btnResetTemplates').onclick = resetAllTemplates;
  $('btnSaveSettings').onclick = saveSettings;

  $('btnExportBackup').onclick = async () => {
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      app: 'impacto-web-prospect-assistant',
      leads: await DB.getAllLeads(),
      settings: await DB.getAllSettings()
    };
    Exporter.downloadFile(`impacto-web-backup-v2-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };
  $('btnImportBackup').onclick = () => $('backupInput').click();
  $('backupInput').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm('Importar backup e substituir os dados atuais?')) {
      event.target.value = '';
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.leads)) throw new Error('Backup invalido: campo leads ausente.');
      await DB.clearLeads();
      const leads = data.leads.map(lead => LeadScoring.applyQualification(lead));
      await DB.putLeadsBatch(leads);
      for (const [key, value] of Object.entries(data.settings || {})) await DB.setSetting(key, value);
      state.leads = leads;
      const settings = await DB.getAllSettings();
      state.config = { ...DEFAULT_SETTINGS, ...settings };
      state.templates = { ...MsgGen.DEFAULT_TEMPLATES, ...(settings.templates || {}) };
      applyConfigToUI();
      renderStrategyUI();
      refresh();
      showToast('Backup restaurado e migrado para a v2.');
    } catch (error) {
      showToast(`Erro ao importar backup: ${error.message}`, 5000);
    } finally {
      event.target.value = '';
    }
  };
  $('btnClearDB').onclick = async () => {
    if (!confirm('Apagar todos os leads, mensagens e configuracoes locais?')) return;
    if (!confirm('Esta acao nao pode ser desfeita. Confirmar limpeza total?')) return;
    await DB.clearAll();
    state.leads = [];
    state.selected.clear();
    state.config = { ...DEFAULT_SETTINGS };
    state.templates = { ...MsgGen.DEFAULT_TEMPLATES };
    applyConfigToUI();
    renderStrategyUI();
    closePanel();
    refresh();
    showToast('Dados locais removidos.');
  };

  $('btnClosePanel').onclick = closePanel;
  $('panelBackdrop').onclick = closePanel;
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('leadPanel').hidden) closePanel();
  });
}

init();
