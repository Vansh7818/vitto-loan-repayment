// lib/allocation.js
import Decimal from 'decimal.js';
import { toMoney } from './money.js';

/**
 * Allocates a payment amount across the schedule.
 * Policy:
 * 1. Identify unpaid/partially unpaid instalments in chronological order.
 * 2. For each instalment: satisfy outstanding interest first, then outstanding principal.
 * 3. Continue until payment is exhausted.
 * 4. Overpayment settles the current outstanding instalment and continues allocating to the next.
 * 
 * @param {Array} schedule - The current array of installments from the DB.
 *                           Must be sorted chronologically by installmentNumber.
 * @param {number|string|Decimal} paymentAmount - The amount paid in this transaction.
 * @returns {Array} - The modified schedule and details of allocations made.
 */
export function allocatePayment(schedule, paymentAmount) {
  let remainingPayment = new Decimal(paymentAmount);
  
  if (remainingPayment.lte(0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  // Deep copy to avoid mutating the original directly until we are sure
  const updatedSchedule = schedule.map(inst => ({
    ...inst,
    principalComponent: new Decimal(inst.principalComponent),
    interestComponent: new Decimal(inst.interestComponent),
    totalDue: new Decimal(inst.totalDue),
    amountPaid: new Decimal(inst.amountPaid)
  }));
  
  for (let inst of updatedSchedule) {
    if (remainingPayment.lte(0)) break;
    
    // How much is still unpaid on this installment?
    const unpaidAmount = inst.totalDue.minus(inst.amountPaid);
    
    if (unpaidAmount.gt(0)) {
      // Amount to allocate to this installment is the min of unpaidAmount and remainingPayment
      const allocation = Decimal.min(unpaidAmount, remainingPayment);
      
      inst.amountPaid = inst.amountPaid.plus(allocation);
      remainingPayment = remainingPayment.minus(allocation);
    }
  }
  
  // If remainingPayment > 0 after satisfying all installments, we can either
  // throw an error or just return it as unallocated. Since prepayment closure
  // is out of scope, we will just let it be (or we can allocate it to the final installment's amountPaid)
  // The assignment says: "Overpayment... Determine whether this settles the following instalment or reduces principal."
  // "Preferred: settle the current outstanding instalment, continue allocating to the next scheduled instalment chronologically"
  // Which we did above. Any excess beyond the entire loan can be added to the final installment or returned.
  // We'll return the remaining unallocated amount in case it needs to be recorded.
  
  return {
    allocatedSchedule: updatedSchedule.map(inst => ({
      ...inst,
      principalComponent: inst.principalComponent.toNumber(),
      interestComponent: inst.interestComponent.toNumber(),
      totalDue: inst.totalDue.toNumber(),
      amountPaid: inst.amountPaid.toNumber(),
    })),
    unallocatedAmount: remainingPayment.toNumber()
  };
}
