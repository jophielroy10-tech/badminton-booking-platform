import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { getOrCreateOwnerSettlement } from "../services/settlement.service.js";

let jobStarted = false;

export async function markOverdueSettlements() {
  const now = new Date();
  const settlements = await prisma.ownerMonthlySettlement.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now }
    },
    select: { ownerId: true, month: true, year: true }
  });

  for (const settlement of settlements) {
    await getOrCreateOwnerSettlement(settlement.ownerId, settlement.month, settlement.year, true);
  }

  return settlements.length;
}

export function startSettlementStatusJob() {
  if (jobStarted) return;
  jobStarted = true;
  cron.schedule("0 2 * * *", async () => {
    try {
      await markOverdueSettlements();
    } catch (error) {
      console.error("Settlement overdue job failed:", error);
    }
  });
  console.log("Owner monthly settlement status job started");
}
