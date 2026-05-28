import { describe, it, expect } from 'vitest';
import { parseFallback } from './fallback-parser.js';

describe('parseFallback', () => {
  it('detects add_shopping intent', () => {
    expect(parseFallback('añade leche y pan')).toMatchObject({
      tool:  'add_shopping_items',
      items: expect.arrayContaining([
        expect.objectContaining({ name: 'leche' }),
        expect.objectContaining({ name: 'pan' }),
      ]),
    });
  });

  it('returns null for unknown input', () => {
    expect(parseFallback('cuéntame un chiste')).toBeNull();
  });
});
