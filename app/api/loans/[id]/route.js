import { NextResponse } from 'next/server';
import prisma from '../../../../lib/db';
import Decimal from 'decimal.js';

export async function GET(request, { params }) {
  const { id } = params;

  try {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!loan) {
      return NextResponse.json({ success: false, error: { code: 'LOAN_NOT_FOUND', message: 'Loan not found' } }, { status: 404 });
    }

    const now = new Date();
    
    let totalScheduledAmount = new Decimal(0);
    let totalPaid = new Decimal(0);
    let outstandingPrincipal = new Decimal(loan.principal);
    let overdueAmount = new Decimal(0);
    
    let nextDueDate = null;
    let nextDueAmount = new Decimal(0);

    const schedule = loan.installments.map(inst => {
      const totalDue = new Decimal(inst.totalDue);
      const amountPaid = new Decimal(inst.amountPaid);
      const remaining = totalDue.minus(amountPaid);
      const dueDate = new Date(inst.dueDate);
      
      let status = 'Pending';
      if (remaining.lte(0)) {
        status = 'Paid';
      } else if (dueDate < now) {
        status = 'Overdue';
        overdueAmount = overdueAmount.plus(remaining);
      }

      totalScheduledAmount = totalScheduledAmount.plus(totalDue);
      totalPaid = totalPaid.plus(amountPaid);
      outstandingPrincipal = outstandingPrincipal.minus(new Decimal(inst.principalComponent).mul(amountPaid.div(totalDue))); // Rough outstanding principal calc, but we can just use total principal - total principal paid.
      
      // A better outstanding principal calculation:
      // Outstanding principal = Original Principal - Sum of (principal component of fully or partially paid installments)
      // For simplicity, we just use the remaining principal balance directly if we track it, or we calculate it.
      
      if (status !== 'Paid' && !nextDueDate) {
        nextDueDate = inst.dueDate;
        nextDueAmount = remaining;
      }

      return {
        id: inst.id,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        principalComponent: Number(inst.principalComponent),
        interestComponent: Number(inst.interestComponent),
        totalDue: Number(inst.totalDue),
        amountPaid: Number(inst.amountPaid),
        remaining: Number(remaining),
        status
      };
    });

    // Precise outstanding principal calc
    const totalPrincipalPaid = loan.installments.reduce((acc, inst) => {
      const totalDue = new Decimal(inst.totalDue);
      const amountPaid = new Decimal(inst.amountPaid);
      if (amountPaid.gte(totalDue)) {
         return acc.plus(inst.principalComponent);
      }
      // Partial payment logic: interest is paid first.
      const interest = new Decimal(inst.interestComponent);
      if (amountPaid.gt(interest)) {
         return acc.plus(amountPaid.minus(interest));
      }
      return acc;
    }, new Decimal(0));

    outstandingPrincipal = new Decimal(loan.principal).minus(totalPrincipalPaid);

    const currentPosition = {
      originalPrincipal: Number(loan.principal),
      totalScheduledAmount: Number(totalScheduledAmount),
      totalPaid: Number(totalPaid),
      outstandingPrincipal: Number(outstandingPrincipal),
      nextDueDate: nextDueDate,
      nextDueAmount: Number(nextDueAmount),
      overdueAmount: Number(overdueAmount),
      repaymentProgress: totalPaid.div(totalScheduledAmount).mul(100).toNumber()
    };

    return NextResponse.json({
      success: true,
      data: {
        loan: {
          id: loan.id,
          principal: Number(loan.principal),
          annualInterestRate: Number(loan.annualInterestRate),
          tenureMonths: loan.tenureMonths,
          disbursementDate: loan.disbursementDate
        },
        schedule,
        currentPosition,
        payments: loan.payments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          paymentDate: p.paymentDate
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching loan details:", error);
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch loan details' } }, { status: 500 });
  }
}
