import { prisma } from "../lib/prisma.js";

export const walletBalance = async (req: any, res: any) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { walletBalance: true } });
  res.json({ success: true, message: "Wallet fetched successfully", data: { walletBalance: user?.walletBalance ?? 0 } });
};

export const walletTransactions = async (req: any, res: any) => {
  const data = await prisma.walletTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, message: "Wallet transactions fetched successfully", data });
};
