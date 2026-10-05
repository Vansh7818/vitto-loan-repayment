// lib/money.js
import Decimal from 'decimal.js';

// Configuration for rounding. We'll use HALF_UP which is standard financial rounding.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function toMoney(value) {
  return new Decimal(value).toDecimalPlaces(2);
}

export function formatMoney(amount) {
  // Safe formatting for numbers or Decimals
  const num = amount instanceof Decimal ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
