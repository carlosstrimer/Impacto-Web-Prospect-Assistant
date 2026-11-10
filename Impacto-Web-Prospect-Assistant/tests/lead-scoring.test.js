import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQualification, hasOwnWebsite, qualifyLead } from '../modules/lead-scoring.js';

test('qualifica como 5 um negocio local com prova social e sem site proprio', () => {
  const lead = {
    id: 'samira',
    nome: 'Dra Samira Ribeiro - SR Cruzeiro',
    categoria: 'Centro de saude e beleza',
    instagram: '@sresteticaunidademarista',
    site: 'https://instagram.com/sresteticaunidademarista/',
    telefone: '(62) 99934-2827',
    cidade: 'Aparecida de Goiania',
    nota: 4.9,
    avaliacoes: 52
  };
  const qualification = qualifyLead(lead);
  assert.equal(qualification.score, 5);
  assert.match(qualification.primaryPain, /prova social/i);
  assert.ok(qualification.evidence.some(item => item.includes('52')));
});

test('penaliza operacao digital muito madura mesmo com grande audiencia', () => {
  const lead = {
    id: 'renato',
    nome: 'Renato Cariani',
    categoria: 'Fitness e esporte',
    instagram: '@renato_cariani',
    instagramBio: 'Professor | Atleta | Empresario | Criador de Conteudo',
    instagramFollowers: 11_400_000,
    instagramVerified: true,
    site: 'https://www.redectrc.com.br/'
  };
  const qualification = qualifyLead(lead);
  assert.equal(qualification.score, 2);
  assert.ok(qualification.cautions.some(item => /madura/i.test(item)));
  assert.match(qualification.primaryPain, /audiencia/i);
});

test('mantem score final entre 1 e 5 e registra modelo 2.0', () => {
  const lead = applyQualification({ id: 'x', nome: 'Perfil pessoal', instagram: '@perfil' });
  assert.ok(lead.score >= 1 && lead.score <= 5);
  assert.equal(lead.scoreModelVersion, '2.0.0');
  assert.ok(lead.qualificationConfidence >= 38);
});

test('distingue site proprio de redes sociais e agregadores', () => {
  assert.equal(hasOwnWebsite('https://instagram.com/empresa'), false);
  assert.equal(hasOwnWebsite('https://linktr.ee/empresa'), false);
  assert.equal(hasOwnWebsite('https://empresa.com.br'), true);
});
