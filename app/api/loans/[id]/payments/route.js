import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/db';
import { allocatePayment } from '../../../../../lib/allocation';

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' } }, { status: 400 });
    }

    const body = await request.json();
    const { amount, paymentDate } = body;

    if (amount === undefined || amount <= 0) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Payment amount must be greater than zero' } }, { status: 400 });
    }

    // Process transactionally
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey }
      });

      if (existingPayment) {
        // Already processed, return success but don't allocate again
        return { alreadyProcessed: true, payment: existingPayment };
      }

      // 2. Load loan and schedule
      const loan = await tx.loan.findUnique({
        where: { id },
        include: {
          installments: {
            orderBy: { installmentNumber: 'asc' }
          }
        }
      });

      if (!loan) {
        throw new Error("LOAN_NOT_FOUND");
      }

      // 3. Calculate allocation
      const { allocatedSchedule, unallocatedAmount } = allocatePayment(loan.installments, amount);

      if (unallocatedAmount > 0) {
        throw new Error("EXCESS_PAYMENT");
      }

      // 4. Update installments
      for (const inst of allocatedSchedule) {
        await tx.installment.update({
          where: { id: inst.id },
          data: { amountPaid: inst.amountPaid }
        });
      }

      // 5. Record payment
      const payment = await tx.payment.create({
        data: {
          loanId: id,
          amount,
          paymentDate: new Date(paymentDate || Date.now()),
          idempotencyKey
        }
      });

      return { alreadyProcessed: false, payment, unallocatedAmount };
    });

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    if (error.message === 'LOAN_NOT_FOUND') {
      return NextResponse.json({ success: false, error: { code: 'LOAN_NOT_FOUND', message: 'Loan not found' } }, { status: 404 });
    }
    if (error.message === 'EXCESS_PAYMENT') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYMENT_AMOUNT', message: 'Payment exceeds the total outstanding loan balance.' } }, { status: 400 });
    }
    // Handle Prisma unique constraint violation for idempotency key if caught here
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: { code: 'PAYMENT_ALREADY_PROCESSED', message: 'Payment already processed' } }, { status: 409 });
    }
    console.error("Error recording payment:", error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record payment' } }, { status: 500 });
  }
}
