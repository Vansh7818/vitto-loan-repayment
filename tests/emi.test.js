import { describe, it, expect } from 'vitest';
import { generateRepaymentSchedule } from '../lib/emi';

describe('EMI and Schedule Generation', () => {
  it('calculates the reference case correctly (₹2,00,000 / 18% / 24 months)', () => {
    // Requirements: EMI ≈ ₹9,986. Rounding variance of ₹1–₹2 is acceptable.
    const principal = 200000;
    const rate = 18;
    const tenure = 24;
    const date = new Date('2023-01-01');

    const result = generateRepaymentSchedule(principal, rate, tenure, date);
    
    // Check EMI is within variance
    expect(result.emi).toBeGreaterThanOrEqual(9984);
    expect(result.emi).toBeLessThanOrEqual(9988);
    
    // Check schedule length
    expect(result.schedule.length).toBe(24);
    
    // Check final installment handles rounding (total principal across schedule = 200000)
    const totalPrincipal = result.schedule.reduce((sum, inst) => sum + inst.principalComponent, 0);
    expect(Math.round(totalPrincipal)).toBe(200000);
  });

  it('rejects negative principal', () => {
    expect(() => {
      generateRepaymentSchedule(-50000, 18, 12, new Date());
    }).toThrow('Invalid loan parameters');
  });

  it('rejects zero or negative tenure', () => {
    expect(() => {
      generateRepaymentSchedule(100000, 18, 0, new Date());
    }).toThrow('Invalid loan parameters');
  });
});
