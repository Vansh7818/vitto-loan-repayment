import { PrismaClient } from '@prisma/client';
import { generateRepaymentSchedule } from '../lib/emi.js';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Loan A: Normal Active
  const loanA = await prisma.loan.create({
    data: {
      principal: 200000,
      annualInterestRate: 18,
      tenureMonths: 24,
      disbursementDate: new Date(),
    }
  });
  console.log(`Created Loan A: ${loanA.id}`);

  // We could add more loans here...
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
