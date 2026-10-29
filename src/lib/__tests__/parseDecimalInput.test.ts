import { describe, it, expect } from 'vitest';
import { parseDecimalInput } from '../utils';
describe('parseDecimalInput', () => {
  it('formatos', () => {
    expect(parseDecimalInput('8500.00')).toBe(8500);
    expect(parseDecimalInput('1.500,00')).toBe(1500);
    expect(parseDecimalInput('1500,5')).toBe(1500.5);
    expect(parseDecimalInput('1.500')).toBe(1500);
    expect(parseDecimalInput('12.345.678,90')).toBe(12345678.9);
    expect(parseDecimalInput('6')).toBe(6);
    expect(parseDecimalInput('5,5')).toBe(5.5);
    expect(parseDecimalInput('')).toBe(0);
  });
});
