import { describe, it, expect } from 'vitest';
import { maskContent, containsSensitiveData } from './masking.js';

describe('maskContent', () => {
  it('masks Spanish DNI (8 digits + letter)', () => {
    const result = maskContent('Mi DNI es 12345678A');
    expect(result).toBe('Mi DNI es ****5678A');
  });

  it('masks IBAN', () => {
    const result = maskContent('IBAN: ES91 2100 0418 4502 0005 1332');
    expect(result).toBe('IBAN: ES91 **** **** **** **** 1332');
  });

  it('leaves text without sensitive data unchanged', () => {
    const result = maskContent('Comprar leche');
    expect(result).toBe('Comprar leche');
  });
});

describe('containsSensitiveData', () => {
  it('detects DNI', () => {
    expect(containsSensitiveData('Mi DNI es 12345678A')).toBe(true);
  });

  it('detects IBAN', () => {
    expect(containsSensitiveData('IBAN: ES91 2100 0418 4502 0005 1332')).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(containsSensitiveData('Añade leche a la lista')).toBe(false);
  });
});
