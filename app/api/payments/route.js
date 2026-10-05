import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../lib/firebase-admin';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const idempotencyKey = request.headers.get('idempotency-key');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header required' }, { status: 400 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { loanId, amount } = body;

    if (!loanId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 });
    }

    // Professional Pattern: Database Transaction to ensure ACID properties
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check Idempotency Key to prevent double charges
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey }
      });
      if (existingPayment) {
        return { status: 'already_processed', payment: existingPayment };
      }

      // 2. Fetch the loan and verify ownership
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { schedules: { orderBy: { dueDate: 'asc' } } }
      });

      if (!loan || loan.userId !== userId) {
        throw new Error('Loan not found or unauthorized');
      }

      // 3. Process the payment logic
      const paidAmount = Number(amount);
      const newOverdue = Math.max(0, loan.overdue - paidAmount);
      const newOutstanding = Math.max(0, loan.outstanding - paidAmount);

      let remainingToApply = paidAmount;
      
      // Update schedules sequentially
      for (const schedule of loan.schedules) {
        if ((schedule.status === 'Overdue' || schedule.status === 'Pending') && remainingToApply > 0) {
          if (remainingToApply >= schedule.amount) {
            remainingToApply -= schedule.amount;
            await tx.paymentSchedule.update({
              where: { id: schedule.id },
              data: { status: 'Paid' }
            });
          } else {
            // Partially paying a schedule (simplistic approach for demo)
            await tx.paymentSchedule.update({
              where: { id: schedule.id },
              data: { amount: schedule.amount - remainingToApply }
            });
            remainingToApply = 0;
          }
        }
      }

      // 4. Update Loan record
      await tx.loan.update({
        where: { id: loanId },
        data: {
          outstanding: newOutstanding,
          overdue: newOverdue
        }
      });

      // 5. Record the Payment
      const paymentRecord = await tx.payment.create({
        data: {
          loanId,
          amount: paidAmount,
          idempotencyKey
        }
      });

      return { status: 'success', payment: paymentRecord };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing payment:', error);
    if (error.message === 'Loan not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
