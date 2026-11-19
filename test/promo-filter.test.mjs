import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/promo-filter.mjs';

test('flyer with prices and validity is a promo', () => {
  assert.ok(classify('Ofertas válidas ATÉ O DIA 21/11 Paleta Suína kg R$ 22,90 Pernil kg 15,90').promo);
});
test('opening hours notice is not a promo', () => {
  assert.ok(!classify('Atenção Clientes HORÁRIO DE FUNCIONAMENTO 20 de Novembro Consciência Negra').promo);
});
test('hiring post is not a promo', () => {
  assert.ok(!classify('ESTAMOS CONTRATANDO repositor. Se você tem experiência, envie seu currículo').promo);
});
test('teaser without prices is not a promo', () => {
  assert.ok(!classify('E AINDA COM OFERTAS DO ESQUENTA BLACK').promo);
});
test('notice mentioning a discount still needs strong price proof', () => {
  assert.ok(!classify('Comunicado: horário especial. Desconto 10%').promo);
});
test('caption text helps when the image is hard to read', () => {
  assert.ok(classify('xx', 'Super oferta! Frango a R$ 9,99 o kg, válido até domingo').promo);
});
