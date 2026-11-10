import { pickVariant } from './utils.js';
import { inferApproach, inferOpportunity, inferPrimaryPain } from './lead-scoring.js';

function clean(value) {
  return String(value ?? '').trim();
}

function formatRating(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR');
}

function firstName(value) {
  return clean(value).split(/\s+/)[0] || '';
}

function isLikelyPerson(lead) {
  const text = `${lead.categoria || ''} ${lead.instagramBio || ''}`.toLowerCase();
  return /atleta|autor|criador|empres.rio|influenciador|medic|professor|personal/.test(text) ||
    (!!lead.instagramVerified && clean(lead.nome).split(/\s+/).length <= 4);
}

export const TEMPLATE_META = {
  dor_direta: {
    label: 'Dor especifica',
    description: 'Mostra que a abordagem nasceu de um problema real observado no lead.'
  },
  consultiva: {
    label: 'Consultiva',
    description: 'Abre uma conversa de diagnostico sem pressionar por uma venda imediata.'
  },
  oportunidade: {
    label: 'Oportunidade',
    description: 'Conecta os sinais positivos do lead a uma melhoria comercial concreta.'
  },
  autoridade: {
    label: 'Autoridade e prova',
    description: 'Valoriza a reputacao atual e mostra como amplificar essa credibilidade.'
  },
  quebra_padrao: {
    label: 'Quebra de padrao',
    description: 'Mensagem curta e diferente para perfis que recebem muitas abordagens.'
  },
  curta: {
    label: 'Curta para DM',
    description: 'Primeiro contato enxuto para Instagram ou WhatsApp.'
  },
  follow_up: {
    label: 'Follow-up',
    description: 'Retoma a conversa de forma educada e com um motivo claro.'
  },
  reativacao: {
    label: 'Reativacao',
    description: 'Reabre uma oportunidade antiga com uma nova leitura da dor.'
  },
  previa_pronta: {
    label: 'Previa pronta',
    description: 'Usada quando a Impacto Web ja preparou uma demonstracao.'
  }
};

const CURRENT_TEMPLATES = {
  dor_direta: `{saudacao}

{membro_intro}

Analisei a presenca digital da {empresa} e identifiquei um ponto bem especifico: {dor}

{oportunidade}

Se fizer sentido, posso te mostrar em poucos minutos como a Impacto Web estruturaria isso para a {empresa}. Posso enviar um diagnostico curto?`,

  consultiva: `{saudacao}

{membro_intro}

{abertura}. {prova}

Queria entender uma coisa: hoje, qual e o maior desafio de voces para transformar essa presenca digital em novos contatos?

Pergunto porque {dor}

Se esse tema estiver no radar, posso compartilhar uma leitura objetiva do que melhoraria primeiro.`,

  oportunidade: `{saudacao}

{membro_intro}

{abertura} e vi uma oportunidade clara para a {empresa}: {oportunidade}

{prova}

Nosso time pode montar uma sugestao visual e comercial focada nessa oportunidade. Posso te enviar?`,

  autoridade: `{saudacao}

{membro_intro}

O que chamou nossa atencao na {empresa} foi a autoridade que voces ja construiram. {prova}

Hoje, o principal ganho seria fazer essa credibilidade trabalhar melhor na conversao: {oportunidade}

Posso te mostrar uma ideia pratica para isso?`,

  quebra_padrao: `{saudacao}

Prometo ser direto: nao quero te mandar uma proposta generica.

Analisei a {empresa} e encontrei um ponto que pode estar deixando oportunidades na mesa: {dor}

Se eu te mandar uma sugestao visual de como resolver isso, voce me diz se faz sentido?`,

  curta: `{saudacao}

{membro_intro}

Analisei a {empresa} e notei isto: {dor}

Tenho uma sugestao pratica para {oportunidade_curta}. Posso te enviar?`,

  follow_up: `{saudacao}

Passando para retomar a mensagem sobre a {empresa}. O ponto que identifiquei foi: {dor}

Preparei uma forma simples de visualizar a oportunidade, sem compromisso. Ainda faz sentido eu te enviar?`,

  reativacao: `{saudacao}

Revendo a presenca digital da {empresa}, encontrei um novo angulo que pode fazer mais sentido agora: {oportunidade}

{prova}

Se essa prioridade mudou desde nosso ultimo contato, posso te mostrar uma sugestao atualizada.`,

  previa_pronta: `{saudacao}

{membro_intro}

{abertura}. {prova}

Como {dor_lower}, nosso time preparou uma previa personalizada para mostrar uma alternativa mais forte de conversao.

Nao precisa contratar nada para ver. Posso te enviar o link?`
};

// Mantem compatibilidade com backups da versao 1.
export const DEFAULT_TEMPLATES = {
  ...CURRENT_TEMPLATES,
  profissional: CURRENT_TEMPLATES.consultiva,
  curiosidade: CURRENT_TEMPLATES.oportunidade,
  direta: CURRENT_TEMPLATES.dor_direta
};

export function generateObservation(lead) {
  const site = clean(lead.site);
  const instagram = clean(lead.instagram);
  const whatsapp = clean(lead.whatsapp);
  const categoria = clean(lead.categoria);
  const nota = Number(lead.nota || 0);
  const avaliacoes = Number(lead.avaliacoes || 0);
  const followers = Number(lead.instagramFollowers || 0);
  const hasSite = site.length > 0 && !/^(nao|não|sem|none|n\/a|nao informado|não informado)$/i.test(site);

  if (!hasSite && avaliacoes > 0 && nota > 0) {
    return `voces tem ${formatCount(avaliacoes)} avaliacoes e nota ${formatRating(nota)} no Google, mas ainda nao identificamos um site proprio`;
  }
  if (!hasSite && followers >= 2000) {
    return `o Instagram ja reune ${formatCount(followers)} seguidores, mas essa audiencia ainda depende de uma plataforma de terceiros`;
  }
  if (!hasSite && instagram) {
    return 'o Instagram e uma das principais formas de apresentar o trabalho de voces atualmente';
  }
  if (!hasSite && whatsapp) {
    return 'o WhatsApp e hoje um dos principais canais digitais de contato da empresa';
  }
  if (!hasSite) {
    return 'voces possuem presenca digital, mas ainda nao identificamos um site proprio da empresa';
  }
  if (avaliacoes >= 200) {
    const rounded = Math.floor(avaliacoes / 100) * 100;
    return `voces ja possuem mais de ${formatCount(rounded)} avaliacoes no Google`;
  }
  if (nota >= 4.5) return `a empresa possui nota ${formatRating(nota)} no Google`;
  if (followers >= 100000) return `o perfil ja alcanca ${formatCount(followers)} seguidores no Instagram`;
  if (categoria) return `a empresa atua no segmento de ${categoria.toLowerCase()}`;
  return 'a empresa ja construiu sinais importantes de presenca digital';
}

function pickOpening(lead) {
  const name = clean(lead.nome);
  const reference = name ? `a ${name}` : 'a empresa';
  const source = clean(lead.pesquisa).toLowerCase();
  const channel = source.includes('instagram') || clean(lead.instagram) ? 'Instagram' : 'Google';
  const variants = [
    `Conheci ${reference} pelo ${channel}`,
    `Encontrei ${reference} enquanto pesquisava negocios do segmento`,
    `Nosso time analisou ${reference} a partir do ${channel}`
  ];
  return pickVariant(variants, `${lead.id || ''}|${name}|${channel}`);
}

function buildProof(lead) {
  const parts = [];
  const reviews = Number(lead.avaliacoes || 0);
  const rating = Number(lead.nota || 0);
  const followers = Number(lead.instagramFollowers || 0);
  if (reviews > 0 && rating > 0) {
    parts.push(`${formatCount(reviews)} avaliacoes com nota ${formatRating(rating)} no Google`);
  } else if (reviews > 0) {
    parts.push(`${formatCount(reviews)} avaliacoes no Google`);
  }
  if (followers > 0) parts.push(`${formatCount(followers)} seguidores no Instagram`);
  if (lead.instagramVerified) parts.push('perfil verificado');
  if (!parts.length) return 'Ja existem sinais de mercado que podem ser apresentados de forma mais convincente.';
  return `Voces ja tem ${parts.join(' e ')}.`;
}

export function buildMessageContext(lead, config = {}) {
  const company = clean(lead.nome) || clean(lead.instagram) || 'empresa';
  const memberName = clean(config.memberName);
  const iwName = clean(config.companyName) || 'Impacto Web';
  const person = isLikelyPerson(lead);
  const contactName = person ? firstName(company) : company;
  const greeting = person
    ? `Ola, ${contactName}, tudo bem?`
    : `Ola, equipe da ${company}, tudo bem?`;
  const memberIntro = memberName
    ? `Sou ${memberName}, do time da ${iwName}.`
    : `Faco parte do time da ${iwName}.`;
  const pain = clean(lead.primaryPain) || inferPrimaryPain(lead);
  const opportunity = clean(lead.opportunity) || inferOpportunity(lead);
  const approach = clean(lead.recommendedApproach) || inferApproach(lead, Number(lead.score || 1));
  const shortOpportunity = opportunity
    .replace(/^Criar\s+/i, 'criar ')
    .replace(/^Construir\s+/i, 'construir ')
    .replace(/^Transformar\s+/i, 'transformar ')
    .replace(/^Conectar\s+/i, 'conectar ')
    .replace(/^Reorganizar\s+/i, 'reorganizar ')
    .replace(/[.!?]+$/, '');

  return {
    saudacao: greeting,
    membro_intro: memberIntro,
    abertura: pickOpening(lead),
    observacao: generateObservation(lead),
    empresa: company,
    nossa_empresa: iwName,
    dor: pain,
    dor_lower: pain.charAt(0).toLowerCase() + pain.slice(1),
    oportunidade: opportunity,
    oportunidade_curta: shortOpportunity,
    prova: buildProof(lead),
    abordagem: approach,
    proximo_passo: clean(lead.nextStep) || 'avaliar uma sugestao personalizada',
    instagram: clean(lead.instagram),
    canal_preferido: config.channel === 'instagram' ? 'Instagram' : 'WhatsApp'
  };
}

export function fillTemplate(template, lead, config = {}) {
  const context = buildMessageContext(lead, config);
  return Object.entries(context)
    .reduce((text, [key, value]) => text.replace(new RegExp(`{${key}}`, 'g'), value), template)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

export function getRecommendedStrategy(lead) {
  const status = lead.salesStatus || 'novo';
  if (['contatado', 'respondeu'].includes(status)) return 'follow_up';
  if (['sem_interesse', 'ignorar'].includes(status)) return 'reativacao';
  if (Number(lead.score || 0) >= 5) return 'dor_direta';
  if (Number(lead.instagramFollowers || 0) >= 100000 || Number(lead.avaliacoes || 0) >= 100) return 'autoridade';
  if (Number(lead.score || 0) >= 4) return 'oportunidade';
  return 'consultiva';
}

function resolveTemplateKey(lead, config) {
  if (config.previewReady) return 'previa_pronta';
  if (config.strategy && DEFAULT_TEMPLATES[config.strategy]) return config.strategy;
  if (config.tone === 'curta' || config.channel === 'instagram') return 'curta';
  if (config.tone === 'curiosidade') return 'oportunidade';
  if (config.tone === 'direta') return 'dor_direta';
  if (config.tone === 'profissional') return 'consultiva';
  return getRecommendedStrategy(lead);
}

export function generateMessageWithTemplates(lead, config = {}, templates = {}) {
  const key = resolveTemplateKey(lead, config);
  const template = templates[key] || DEFAULT_TEMPLATES[key] || DEFAULT_TEMPLATES.consultiva;
  return fillTemplate(template, lead, config);
}

export function generateMessageVariants(lead, config = {}, templates = {}) {
  const recommended = getRecommendedStrategy(lead);
  const keys = [recommended, 'curta', 'consultiva', 'oportunidade', 'dor_direta'];
  const unique = Array.from(new Set(keys)).slice(0, 3);
  return unique.map(strategy => ({
    strategy,
    label: TEMPLATE_META[strategy]?.label || strategy,
    text: generateMessageWithTemplates(lead, { ...config, strategy, previewReady: false }, templates)
  }));
}

export function validateMessage(message) {
  if (!message || !message.trim()) return { valid: false, reason: 'vazia' };
  const bad = ['undefined', 'null', 'NaN', '[object Object]', '{dor}', '{oportunidade}'];
  const lower = message.toLowerCase();
  for (const value of bad) {
    if (lower.includes(value.toLowerCase())) return { valid: false, reason: `contem ${value}` };
  }
  if (/equipe da\s*,/i.test(message)) return { valid: false, reason: 'empresa vazia' };
  if (message.length < 40) return { valid: false, reason: 'muito curta' };
  if (message.length > 1800) return { valid: false, reason: 'muito longa' };
  return { valid: true };
}
