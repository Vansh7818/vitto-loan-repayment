import { NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { generateRepaymentSchedule } from '../../../lib/emi';

export async function POST() {
  try {
    // Clear existing data
    await prisma.payment.deleteMany();
    await prisma.installment.deleteMany();
    await prisma.loan.deleteMany();

    const loansToSeed = [
      {
        id: "LOAN-A-ACTIVE",
        principal: 200000,
        annualInterestRate: 18,
        tenureMonths: 24,
        disbursementDate: new Date(new Date().setMonth(new Date().getMonth() - 2)), // 2 months ago
        desc: "Normal active loan"
      },
      {
        id: "LOAN-B-OVERDUE",
        principal: 500000,
        annualInterestRate: 15,
        tenureMonths: 12,
        disbursementDate: new Date(new Date().setMonth(new Date().getMonth() - 4)), // 4 months ago
        desc: "Overdue instalment"
      },
      {
        id: "LOAN-C-PARTIAL",
        principal: 100000,
        annualInterestRate: 20,
        tenureMonths: 6,
        disbursementDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), // 1 month ago
        desc: "Partially paid instalment"
      },
      {
        id: "LOAN-D-HISTORY",
        principal: 1000000,
        annualInterestRate: 12,
        tenureMonths: 36,
        disbursementDate: new Date(new Date().setMonth(new Date().getMonth() - 10)), // 10 months ago
        desc: "Payment history"
      }
    ];

    for (const loanData of loansToSeed) {
      const loan = await prisma.loan.create({
        data: {
          id: loanData.id,
          principal: loanData.principal,
          annualInterestRate: loanData.annualInterestRate,
          tenureMonths: loanData.tenureMonths,
          disbursementDate: loanData.disbursementDate
        }
      });

      const { schedule } = generateRepaymentSchedule(
        loan.principal, 
        loan.annualInterestRate, 
        loan.tenureMonths, 
        loan.disbursementDate
      );

      for (const inst of schedule) {
        await prisma.installment.create({
          data: {
            loanId: loan.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalComponent: inst.principalComponent,
            interestComponent: inst.interestComponent,
            totalDue: inst.totalDue,
            amountPaid: 0
          }
        });
      }
    }

    // Now apply some mock payments
    // LOAN-B-OVERDUE: 4 months old. Pay only 2 months. 3rd and 4th are overdue.
    let instsB = await prisma.installment.findMany({ where: { loanId: "LOAN-B-OVERDUE" }, orderBy: { installmentNumber: 'asc' }});
    await prisma.installment.update({ where: { id: instsB[0].id }, data: { amountPaid: instsB[0].totalDue } });
    await prisma.installment.update({ where: { id: instsB[1].id }, data: { amountPaid: instsB[1].totalDue } });

    // LOAN-C-PARTIAL: 1 month old. Partially pay.
    let instsC = await prisma.installment.findMany({ where: { loanId: "LOAN-C-PARTIAL" }, orderBy: { installmentNumber: 'asc' }});
    await prisma.installment.update({ where: { id: instsC[0].id }, data: { amountPaid: Number(instsC[0].totalDue) / 2 } });

    // LOAN-D-HISTORY: 10 months old. Pay 8 perfectly.
    let instsD = await prisma.installment.findMany({ where: { loanId: "LOAN-D-HISTORY" }, orderBy: { installmentNumber: 'asc' }});
    for(let i=0; i<8; i++) {
      await prisma.installment.update({ where: { id: instsD[i].id }, data: { amountPaid: instsD[i].totalDue } });
    }

    return NextResponse.json({ success: true, message: "Database seeded successfully" });

  } catch (error) {
    console.error("Seeding error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
