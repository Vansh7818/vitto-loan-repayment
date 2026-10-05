import { NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { generateRepaymentSchedule } from '../../../lib/emi';

// Mock authentication check for this endpoint since we might need firebase admin
// For a real app, this should check headers.authorization.
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No authorization header' } }, { status: 401 });
    }
    // We would verify token here via Firebase Admin
    
    const body = await request.json();
    const { principal, annualInterestRate, tenureMonths, disbursementDate } = body;
    
    if (!principal || !annualInterestRate || !tenureMonths || !disbursementDate) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Missing required fields' } }, { status: 400 });
    }
    
    // Generate schedule
    let emiResult;
    try {
      emiResult = generateRepaymentSchedule(principal, annualInterestRate, tenureMonths, disbursementDate);
    } catch (e) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: e.message } }, { status: 400 });
    }

    // Persist transactionally
    const loan = await prisma.$transaction(async (tx) => {
      const createdLoan = await tx.loan.create({
        data: {
          principal,
          annualInterestRate,
          tenureMonths,
          disbursementDate: new Date(disbursementDate),
          installments: {
            create: emiResult.schedule.map(inst => ({
              installmentNumber: inst.installmentNumber,
              dueDate: new Date(inst.dueDate),
              principalComponent: inst.principalComponent,
              interestComponent: inst.interestComponent,
              totalDue: inst.totalDue,
              amountPaid: inst.amountPaid
            }))
          }
        },
        include: {
          installments: true
        }
      });
      return createdLoan;
    });

    return NextResponse.json({ success: true, data: loan });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 });
  }
}
