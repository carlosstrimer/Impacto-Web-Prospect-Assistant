// Modelo local e explicavel de qualificacao comercial da Impacto Web.

const OWN_SITE_BLOCKLIST = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'wa.me',
  'whatsapp.com',
  'linktr.ee',
  'bio.site',
  'beacons.ai',
  'taplink.cc',
  'campsite.bio'
];

const BUSINESS_KEYWORDS = [
  'agencia', 'academia', 'advogado', 'arquitet', 'atendimento', 'barbearia',
  'beleza', 'clinica', 'consultor', 'criador de conteudo', 'dentista',
  'empresa', 'empresario', 'estetica', 'loja', 'marketing', 'medic',
  'negocio', 'nutric', 'oficial', 'professor', 'restaurante', 'servico',
  'studio', 'suplement', 'treinador'
];

const LOCAL_SERVICE_KEYWORDS = [
  'advoc', 'arquitet', 'barbear', 'beleza', 'clinica', 'dent', 'estet',
  'imobili', 'loja', 'medic', 'nutri', 'restaurante', 'saude', 'studio'
];

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesAny(value, terms) {
  const normalized = normalizeText(value);
  return terms.some(term => normalized.includes(term));
}

export function getUrlHost(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(candidate).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

export function hasOwnWebsite(value) {
  const host = getUrlHost(value);
  if (!host) return false;
  return !OWN_SITE_BLOCKLIST.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

export function isLinkAggregator(value) {
  const host = getUrlHost(value);
  return ['linktr.ee', 'bio.site', 'beacons.ai', 'taplink.cc', 'campsite.bio']
    .some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreFromPoints(points) {
  if (points <= 0.75) return 1;
  if (points <= 2) return 2;
  if (points <= 4.25) return 3;
  if (points <= 6.25) return 4;
  return 5;
}

export function inferPrimaryPain(lead) {
  const site = clean(lead.site || lead.instagramExternalUrl);
  const ownSite = hasOwnWebsite(site);
  const followers = Number(lead.instagramFollowers || 0);
  const reviews = Number(lead.avaliacoes || 0);
  const hasInstagram = !!clean(lead.instagram);
  const hasPhone = !!clean(lead.whatsapp || lead.telefone);

  if (!ownSite && reviews >= 20) {
    return 'A prova social ja existe, mas ainda depende de Google e Instagram para virar contato e venda.';
  }
  if (!ownSite && hasInstagram) {
    return 'A operacao depende de uma rede social alugada e nao possui um ativo proprio para captar e converter demanda.';
  }
  if (!ownSite && hasPhone) {
    return 'O contato acontece de forma direta, sem uma pagina que apresente valor, filtre o interesse e prepare a conversa comercial.';
  }
  if (isLinkAggregator(site)) {
    return 'A jornada esta fragmentada em varios links e exige passos demais antes da conversao.';
  }
  if (followers >= 100000) {
    return 'Existe muita atencao nas redes, mas a oportunidade esta em transformar audiencia em base propria, dados e fluxo comercial mensuravel.';
  }
  if (ownSite) {
    return 'A oportunidade e evoluir o site de vitrine para uma jornada mais clara de captacao, qualificacao e acompanhamento de oportunidades.';
  }
  return 'A presenca digital ainda oferece poucos sinais de autoridade e poucos caminhos claros para o cliente avancar.';
}

export function inferOpportunity(lead) {
  const ownSite = hasOwnWebsite(lead.site || lead.instagramExternalUrl);
  const followers = Number(lead.instagramFollowers || 0);
  const reviews = Number(lead.avaliacoes || 0);

  if (!ownSite && reviews >= 20) {
    return 'Criar um site de conversao que use as avaliacoes como prova, destaque os servicos e leve o visitante ao WhatsApp ja contextualizado.';
  }
  if (!ownSite && followers >= 5000) {
    return 'Transformar o alcance do Instagram em uma estrutura propria com oferta, captura de leads e medicao de conversao.';
  }
  if (!ownSite) {
    return 'Construir uma presenca propria, encontravel no Google e preparada para converter visitas em conversas comerciais.';
  }
  if (followers >= 100000) {
    return 'Conectar site, campanhas, automacao e agentes de IA para aproveitar melhor a demanda gerada pela audiencia.';
  }
  return 'Reorganizar a jornada digital para comunicar melhor a oferta, reduzir friccao e aumentar a quantidade de contatos qualificados.';
}

export function inferApproach(lead, score) {
  if (score >= 5) return 'Abordagem consultiva pela dor, citando a prova social e oferecendo um diagnostico visual objetivo.';
  if (score === 4) return 'Abordagem de oportunidade, mostrando o ganho pratico e propondo uma previa personalizada.';
  if (score === 3) return 'Abordagem de diagnostico, validando prioridades antes de sugerir uma solucao.';
  if (score === 2) return 'Contato curto de descoberta, sem assumir urgencia ou necessidade de compra.';
  return 'Nutrir ou pesquisar mais antes de abordar; ainda faltam sinais claros de aderencia.';
}

export function qualifyLead(lead) {
  const sourceText = [lead.nome, lead.categoria, lead.instagramBio, lead.potencial, lead.motivo].join(' ');
  const followers = Number(lead.instagramFollowers || 0);
  const reviews = Number(lead.avaliacoes || 0);
  const rating = Number(lead.nota || 0);
  const site = clean(lead.site || lead.instagramExternalUrl);
  const ownSite = hasOwnWebsite(site);
  const aggregator = isLinkAggregator(site);
  const hasInstagram = !!clean(lead.instagram);
  const hasContact = !!clean(lead.whatsapp || lead.telefone || lead.email);
  const businessIntent = includesAny(sourceText, BUSINESS_KEYWORDS);
  const localService = includesAny(sourceText, LOCAL_SERVICE_KEYWORDS);
  const verified = !!lead.instagramVerified;
  const evidence = [];
  const cautions = [];
  const breakdown = {
    necessidadeDigital: 0,
    tracao: 0,
    contato: 0,
    aderencia: 0,
    maturidade: 0
  };

  if (!ownSite) {
    breakdown.necessidadeDigital += 2.5;
    evidence.push('nao foi identificado um site proprio');
  } else if (aggregator) {
    breakdown.necessidadeDigital += 1.5;
    evidence.push('a jornada depende de um agregador de links');
  } else {
    breakdown.necessidadeDigital += 0.25;
    evidence.push('ja possui dominio proprio');
  }

  if (hasInstagram && !ownSite) {
    breakdown.necessidadeDigital += 0.5;
    evidence.push('a presenca digital esta concentrada no Instagram');
  }

  if (reviews >= 100) breakdown.tracao += 1.5;
  else if (reviews >= 20) breakdown.tracao += 1;
  else if (reviews >= 5) breakdown.tracao += 0.5;

  if (rating >= 4.7 && reviews >= 10) breakdown.tracao += 0.5;
  if (followers >= 100000) breakdown.tracao += 1.5;
  else if (followers >= 10000) breakdown.tracao += 1;
  else if (followers >= 2000) breakdown.tracao += 0.5;

  if (reviews >= 20) evidence.push(`${reviews.toLocaleString('pt-BR')} avaliacoes no Google`);
  if (followers >= 2000) evidence.push(`${followers.toLocaleString('pt-BR')} seguidores no Instagram`);

  if (hasContact) {
    breakdown.contato += 1;
    evidence.push('possui canal direto de contato');
  } else if (hasInstagram) {
    breakdown.contato += 0.35;
    cautions.push('o contato depende de DM');
  }

  if (businessIntent) {
    breakdown.aderencia += 1.25;
    evidence.push('o perfil apresenta sinais comerciais');
  }
  if (localService) breakdown.aderencia += 0.5;
  if (clean(lead.cidade || lead.endereco)) breakdown.aderencia += 0.25;
  if (verified) breakdown.aderencia += 0.5;

  const matureDigitalOperation = followers >= 1000000 && ownSite && businessIntent;
  if (matureDigitalOperation) {
    breakdown.maturidade -= 2;
    cautions.push('operacao digital madura e provavel ciclo comercial mais complexo');
  } else if (followers >= 250000 && ownSite) {
    breakdown.maturidade -= 1;
    cautions.push('marca com estrutura digital ja consolidada');
  }

  if (!businessIntent && !localService && !reviews && followers < 2000) {
    breakdown.aderencia -= 1;
    cautions.push('faltam sinais claros de atividade comercial');
  }

  const points = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const score = scoreFromPoints(points);
  const confidenceSignals = [
    !!clean(lead.nome),
    !!clean(lead.categoria || lead.instagramBio),
    hasInstagram,
    !!site,
    hasContact,
    reviews > 0 || followers > 0
  ].filter(Boolean).length;
  const confidence = clamp(38 + confidenceSignals * 10, 38, 98);
  const labels = {
    1: 'Baixa prioridade',
    2: 'Prioridade baixa',
    3: 'Vale diagnosticar',
    4: 'Lead qualificado',
    5: 'Alta prioridade'
  };
  const primaryPain = inferPrimaryPain(lead);
  const opportunity = inferOpportunity(lead);

  return {
    score,
    label: labels[score],
    confidence,
    points: Number(points.toFixed(2)),
    breakdown,
    evidence: evidence.slice(0, 5),
    cautions: cautions.slice(0, 3),
    primaryPain,
    opportunity,
    recommendedApproach: inferApproach(lead, score),
    nextStep: score >= 4
      ? 'Gerar uma mensagem pela dor e iniciar contato.'
      : score === 3
        ? 'Revisar o perfil e fazer uma pergunta de diagnostico.'
        : 'Pesquisar mais sinais antes de investir tempo comercial.'
  };
}

export function applyQualification(lead) {
  const qualification = qualifyLead(lead);
  const sourceScore = lead.sourceScore ?? (
    lead.score != null && lead.scoreModelVersion !== '2.0.0' ? lead.score : undefined
  );
  return {
    ...lead,
    ...(sourceScore !== undefined ? { sourceScore } : {}),
    score: qualification.score,
    qualification,
    qualificationLabel: qualification.label,
    qualificationConfidence: qualification.confidence,
    primaryPain: lead.primaryPain || qualification.primaryPain,
    opportunity: lead.opportunity || qualification.opportunity,
    recommendedApproach: qualification.recommendedApproach,
    nextStep: qualification.nextStep,
    scoreModelVersion: '2.0.0',
    _updatedAt: Date.now()
  };
}
