import { describe, it, expect } from 'vitest';
import { allocatePayment } from '../lib/allocation';

describe('Payment Allocation Engine', () => {
  const mockSchedule = [
    { id: 1, installmentNumber: 1, totalDue: 10000, amountPaid: 0, interestComponent: 2000, principalComponent: 8000 },
    { id: 2, installmentNumber: 2, totalDue: 10000, amountPaid: 0, interestComponent: 1900, principalComponent: 8100 },
    { id: 3, installmentNumber: 3, totalDue: 10000, amountPaid: 0, interestComponent: 1800, principalComponent: 8200 },
  ];

  it('allocates an exact full payment', () => {
    const { allocatedSchedule, unallocatedAmount } = allocatePayment(mockSchedule, 10000);
    expect(unallocatedAmount).toBe(0);
    expect(allocatedSchedule[0].amountPaid).toBe(10000);
    expect(allocatedSchedule[1].amountPaid).toBe(0);
  });

  it('handles underpayment correctly', () => {
    // Instalment is ₹10000, Payment is ₹5000
    const { allocatedSchedule, unallocatedAmount } = allocatePayment(mockSchedule, 5000);
    expect(unallocatedAmount).toBe(0);
    expect(allocatedSchedule[0].amountPaid).toBe(5000);
  });

  it('handles overpayment (twice the installment)', () => {
    // Instalment is ₹10000, Payment is ₹20000
    const { allocatedSchedule, unallocatedAmount } = allocatePayment(mockSchedule, 20000);
    expect(unallocatedAmount).toBe(0);
    expect(allocatedSchedule[0].amountPaid).toBe(10000); // 1st settled
    expect(allocatedSchedule[1].amountPaid).toBe(10000); // 2nd settled
    expect(allocatedSchedule[2].amountPaid).toBe(0);
  });

  it('allocates payment across multiple installments including partials', () => {
    // Pay ₹25000 (settles 1, 2, and half of 3)
    const { allocatedSchedule, unallocatedAmount } = allocatePayment(mockSchedule, 25000);
    expect(unallocatedAmount).toBe(0);
    expect(allocatedSchedule[0].amountPaid).toBe(10000);
    expect(allocatedSchedule[1].amountPaid).toBe(10000);
    expect(allocatedSchedule[2].amountPaid).toBe(5000);
  });

  it('rejects zero or negative payments', () => {
    expect(() => allocatePayment(mockSchedule, 0)).toThrow('Payment amount must be greater than zero');
    expect(() => allocatePayment(mockSchedule, -5000)).toThrow('Payment amount must be greater than zero');
  });

  it('returns unallocated amount if payment exceeds total loan balance', () => {
    // Total loan balance is 30000, pay 35000
    const { allocatedSchedule, unallocatedAmount } = allocatePayment(mockSchedule, 35000);
    expect(allocatedSchedule[0].amountPaid).toBe(10000);
    expect(allocatedSchedule[1].amountPaid).toBe(10000);
    expect(allocatedSchedule[2].amountPaid).toBe(10000);
    expect(unallocatedAmount).toBe(5000); // 5000 unallocated
  });
});
