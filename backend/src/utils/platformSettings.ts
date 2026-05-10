import { prisma } from "../lib/prisma.js";

export async function getPlatformSettings() {
  const existing = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.platformSetting.create({
    data: {
      platformFee: 20,
      gstPercent: 18,
      commissionPercent: 15,
      penaltyCommissionPercent: 20,
      commissionDueWindowDays: 5
    }
  });
}

export async function calculateFinalAmount(basePrice: number, discount: number = 0) {
  const settings = await getPlatformSettings();
  const platformFee = settings.platformFee;
  const gst = Math.round((basePrice * settings.gstPercent) / 100);
  const finalAmount = basePrice + platformFee + gst - discount;

  return {
    basePrice,
    platformFee,
    gst,
    discount,
    finalAmount: Math.max(finalAmount, 0)
  };
}

export async function calculateOwnerEarning(grossAmount: number, extras: { platformFee?: number; gst?: number; courtId?: string; paymentId?: string } = {}) {
  const settings = await getPlatformSettings();
  const commission = Math.round((grossAmount * settings.commissionPercent) / 100);
  return {
    grossAmount,
    platformFee: extras.platformFee ?? 0,
    commission,
    gst: extras.gst ?? 0,
    netAmount: grossAmount - commission
  };
}
