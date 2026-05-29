import { describe, it, expect } from 'vitest';
import { parseFallback } from './fallback-parser.js';

describe('parseFallback', () => {
  // add_shopping_items
  it('detects add_shopping intent', () => {
    expect(parseFallback('añade leche y pan')).toMatchObject({
      tool:  'add_shopping_items',
      items: expect.arrayContaining([
        expect.objectContaining({ name: 'leche' }),
        expect.objectContaining({ name: 'pan' }),
      ]),
    });
  });

  it('detects add_shopping with "agrega"', () => {
    expect(parseFallback('agrega tomate a la lista')).toMatchObject({
      tool: 'add_shopping_items',
    });
  });

  // query_shopping
  it('detects query_shopping with "qué hay"', () => {
    expect(parseFallback('qué hay en la lista')).toMatchObject({ tool: 'query_shopping' });
  });

  it('detects query_shopping with "muéstrame la lista"', () => {
    expect(parseFallback('muéstrame la lista de la compra')).toMatchObject({ tool: 'query_shopping' });
  });

  // check_shopping_item
  it('detects check_shopping_item with "tacha"', () => {
    expect(parseFallback('tacha la leche')).toMatchObject({
      tool:      'check_shopping_item',
      item_name: 'la leche',
    });
  });

  it('detects check_shopping_item with "he comprado"', () => {
    expect(parseFallback('he comprado el pan')).toMatchObject({
      tool:      'check_shopping_item',
      item_name: 'el pan',
    });
  });

  // null
  it('returns null for unknown input', () => {
    expect(parseFallback('cuéntame un chiste')).toBeNull();
  });
});
