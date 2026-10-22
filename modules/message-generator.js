// FILE: modules/message-generator.js
import { pickVariant } from './utils.js';

function clean(s) { return (s || '').toString().trim(); }

function formatRating(n) {
  if (n == null) return '';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCount(n) {
  if (n == null) return '';
  return Number(n).toLocaleString('pt-BR');
}

export function generateObservation(lead) {
  const site = clean(lead.site);
  const instagram = clean(lead.instagram);
  const whatsapp = clean(lead.whatsapp);
  const categoria = clean(lead.categoria);
  const nota = lead.nota;
  const avaliacoes = lead.avaliacoes;
  const hasNota = nota != null && !isNaN(nota) && Number(nota) > 0;
  const hasAval = avaliacoes != null && !isNaN(avaliacoes) && Number(avaliacoes) > 0;
  const hasSite = site.length > 0 && !/^(nao|não|sem|none|n\/a|nao informado|não informado)$/i.test(site);

  // Caso 1 — sem site + avaliações + nota
  if (!hasSite && hasAval && hasNota) {
    return `chamou nossa atenção o fato de vocês terem ${formatCount(avaliacoes)} avaliações e nota ${formatRating(nota)} no Google, mas ainda não identificamos um site próprio`;
  }
  // Caso 3 — sem site + Instagram
  if (!hasSite && instagram.length > 0) {
    return `percebemos que o Instagram é uma das principais formas de apresentar o trabalho de vocês atualmente`;
  }
  // Caso 4 — sem site + WhatsApp
  if (!hasSite && whatsapp.length > 0) {
    return `percebemos que o WhatsApp é hoje um dos principais canais digitais de contato da empresa`;
  }
  // Caso 2 — sem site (genérico)
  if (!hasSite) {
    return `percebemos que vocês já possuem presença no Google, mas ainda não identificamos um site próprio da empresa`;
  }
  // Caso 5 — muitas avaliações
  if (hasAval && Number(avaliacoes) >= 200) {
    const rounded = Math.floor(Number(avaliacoes) / 100) * 100;
    return `chamou nossa atenção o fato de vocês já possuírem mais de ${formatCount(rounded)} avaliações no Google`;
  }
  // Caso 6 — nota alta
  if (hasNota && Number(nota) >= 4.5) {
    return `chamou nossa atenção a nota ${formatRating(nota)} da empresa no Google`;
  }
  // Caso 7 — categoria conhecida
  if (categoria.length > 0) {
    return `conhecemos o trabalho da empresa no segmento de ${categoria.toLowerCase()} através do Google`;
  }
  return null;
}

function pickAbertura(lead) {
  const name = clean(lead.nome);
  const ref = name ? `a ${name}` : 'a empresa';
  const variants = [
    `Conhecemos ${ref} através do Google`,
    `Encontrei ${ref} enquanto pesquisávamos negócios do segmento`,
    `Nosso time conheceu ${ref} através do Google`
  ];
  const seed = (lead.id || '') + '|' + name;
  return pickVariant(variants, seed);
}

export const DEFAULT_TEMPLATES = {
  profissional: `{saudacao}

{membro_intro}

{abertura} e {observacao}.

Analisando a presença digital de vocês, identificamos uma oportunidade de apresentar ainda melhor a empresa e facilitar o contato de potenciais clientes.

Nosso time pode preparar uma prévia personalizada mostrando como poderia ficar a presença digital da {empresa}.

Posso te enviar para você dar uma olhada?`,
  curta: `{saudacao}

{membro_intro}

{abertura} e {observacao}.

Nosso time pode preparar uma prévia personalizada da presença digital da {empresa}. Posso te enviar?`,
  curiosidade: `{saudacao}

{membro_intro}

{abertura} e {observacao}.

Nosso time analisou a presença digital de vocês e preparou uma prévia personalizada de como poderia ficar a presença digital da {empresa}.

Posso te enviar para você dar uma olhada?`,
  direta: `{saudacao}

{membro_intro}

{abertura} e {observacao}.

Podemos preparar uma prévia personalizada da presença digital da {empresa}. Posso te enviar?`,
  previa_pronta: `{saudacao}

{membro_intro}

{abertura} e {observacao}.

Nosso time analisou a presença digital de vocês e, por iniciativa própria, preparou uma prévia personalizada de um site para a empresa.

Não precisa contratar nada para ver. É apenas uma demonstração.

Posso te enviar o link para você dar uma olhada?`
};

function fillTemplate(tpl, lead, config) {
  const empName = clean(lead.nome);
  const emp = empName || 'empresa';
  const memberName = clean(config.memberName);
  const companyName = clean(config.companyName) || 'Impacto Web';
  const saudacao = empName
    ? `Olá, equipe da ${empName}, tudo bem?`
    : `Olá, tudo bem?`;
  const membroIntro = memberName
    ? `Sou ${memberName} e faço parte do time da ${companyName}.`
    : `Faço parte do time da ${companyName}.`;
  const abertura = pickAbertura(lead);
  const observacao = generateObservation(lead) ||
    'identificamos uma oportunidade de fortalecer a presença digital de vocês';

  return tpl
    .replace(/{saudacao}/g, saudacao)
    .replace(/{membro_intro}/g, membroIntro)
    .replace(/{abertura}/g, abertura)
    .replace(/{observacao}/g, observacao)
    .replace(/{empresa}/g, emp)
    .replace(/{nossa_empresa}/g, companyName)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function generateMessageWithTemplates(lead, config, templates) {
  const tone = config.tone || 'profissional';
  const previewReady = !!config.previewReady;
  const channel = config.channel || 'whatsapp';
  let tplKey;
  if (previewReady) tplKey = 'previa_pronta';
  else if (channel === 'instagram' || tone === 'curta') tplKey = 'curta';
  else if (tone === 'curiosidade') tplKey = 'curiosidade';
  else if (tone === 'direta') tplKey = 'direta';
  else tplKey = 'profissional';
  const tpl = (templates && templates[tplKey]) || DEFAULT_TEMPLATES[tplKey] || DEFAULT_TEMPLATES.profissional;
  return fillTemplate(tpl, lead, config);
}

export function validateMessage(msg) {
  if (!msg || !msg.trim()) return { valid: false, reason: 'vazio' };
  const bad = ['undefined', 'null', 'NaN', '[object Object]'];
  const low = msg.toLowerCase();
  for (const b of bad) {
    if (low.includes(b.toLowerCase())) return { valid: false, reason: 'contém ' + b };
  }
  if (/equipe da\s*,/i.test(msg)) return { valid: false, reason: 'empresa vazia' };
  if (/,\s*tudo bem\?$/m.test(msg) && /equipe da\s*,/i.test(msg)) return { valid: false, reason: 'saudação vazia' };
  if (msg.length < 40) return { valid: false, reason: 'muito curta' };
  return { valid: true };
}