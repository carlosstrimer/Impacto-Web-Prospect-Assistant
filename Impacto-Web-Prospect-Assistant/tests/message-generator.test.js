import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATES,
  generateMessageVariants,
  generateMessageWithTemplates,
  validateMessage
} from '../modules/message-generator.js';
import { applyQualification } from '../modules/lead-scoring.js';

const samira = applyQualification({
  id: 'samira',
  nome: 'Dra Samira Ribeiro - SR Cruzeiro',
  categoria: 'Centro de saude e beleza',
  instagram: '@sresteticaunidademarista',
  telefone: '(62) 99934-2827',
  nota: 4.9,
  avaliacoes: 52,
  cidade: 'Aparecida de Goiania'
});

test('gera mensagem pela dor especifica sem placeholders pendentes', () => {
  const message = generateMessageWithTemplates(samira, {
    memberName: 'Carlos',
    companyName: 'Impacto Web',
    strategy: 'dor_direta',
    channel: 'whatsapp'
  }, DEFAULT_TEMPLATES);
  assert.match(message, /prova social/i);
  assert.match(message, /Impacto Web/);
  assert.equal(validateMessage(message).valid, true);
  assert.doesNotMatch(message, /\{[^}]+\}/);
});

test('gera tres variacoes com estrategias diferentes', () => {
  const variants = generateMessageVariants(samira, { companyName: 'Impacto Web' }, DEFAULT_TEMPLATES);
  assert.equal(variants.length, 3);
  assert.equal(new Set(variants.map(item => item.strategy)).size, 3);
  variants.forEach(item => assert.equal(validateMessage(item.text).valid, true));
});

test('valida mensagens vazias e excessivamente longas', () => {
  assert.equal(validateMessage('').valid, false);
  assert.equal(validateMessage('x'.repeat(1900)).valid, false);
});
