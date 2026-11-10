import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVText } from '../modules/importer.js';
import { leadsToCSV } from '../modules/exporter.js';

test('importa lead do Maps e recalcula score na escala 1 a 5', () => {
  const csv = 'Nome;Categoria;Telefone;Instagram;Nota;Avaliacoes;Cidade\nDra Samira Ribeiro;Estetica;(62) 99934-2827;@srestetica;4,9;52;Aparecida de Goiania';
  const [lead] = parseCSVText(csv);
  assert.equal(lead.score, 5);
  assert.equal(lead.instagram, '@srestetica');
  assert.match(lead.primaryPain, /prova social/i);
});

test('neutraliza formulas perigosas ao exportar CSV', () => {
  const csv = leadsToCSV([{
    nome: '=HYPERLINK("https://example.com")',
    score: 1,
    primaryPain: '+formula',
    opportunity: '@formula'
  }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+formula/);
  assert.match(csv, /'@formula/);
});
