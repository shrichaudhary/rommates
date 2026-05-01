import { describe, it, expect } from '@jest/globals';
import { generateJoinCode } from '../src/house.js';

describe('generateJoinCode', () => {
  it('generates a 6-character string', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it('uses only uppercase alphanumeric characters (no ambiguous chars)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      // Should not contain ambiguous chars: 0, 1, I, O
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, generateJoinCode));
    expect(codes.size).toBeGreaterThan(90); // very high probability
  });
});
