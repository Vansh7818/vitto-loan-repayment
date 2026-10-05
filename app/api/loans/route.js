import { NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { generateRepaymentSchedule } from '../../../lib/emi';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const loans = await prisma.loan.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        principal: true,
        annualInterestRate: true,
        tenureMonths: true,
        disbursementDate: true,
      }
    });
    
    return NextResponse.json({ success: true, data: loans });
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch loans' } }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { principal, annualInterestRate, tenureMonths, disbursementDate } = body;

    // Validation
    if (!principal || Number(principal) <= 0) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Principal must be positive' } }, { status: 400 });
    }
    if (!annualInterestRate || Number(annualInterestRate) <= 0) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Interest rate must be positive' } }, { status: 400 });
    }
    if (!tenureMonths || !Number.isInteger(Number(tenureMonths)) || Number(tenureMonths) <= 0) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Tenure must be a positive integer' } }, { status: 400 });
    }
    const dDate = new Date(disbursementDate);
    if (isNaN(dDate.getTime())) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid disbursement date is required' } }, { status: 400 });
    }

    const loanId = `LN-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
    
    // Generate schedule
    const { schedule } = generateRepaymentSchedule(
      Number(principal),
      Number(annualInterestRate),
      Number(tenureMonths),
      dDate
    );

    // Save transactionally
    const loan = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: {
          id: loanId,
          principal: Number(principal),
          annualInterestRate: Number(annualInterestRate),
          tenureMonths: Number(tenureMonths),
          disbursementDate: dDate
        }
      });

      for (const inst of schedule) {
        await tx.installment.create({
          data: {
            loanId: newLoan.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalComponent: inst.principalComponent,
            interestComponent: inst.interestComponent,
            totalDue: inst.totalDue,
            amountPaid: 0
          }
        });
      }
      return newLoan;
    });

    return NextResponse.json({ success: true, data: loan });
  } catch (error) {
    console.error("Error creating loan:", error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create loan' } }, { status: 500 });
  }
}

