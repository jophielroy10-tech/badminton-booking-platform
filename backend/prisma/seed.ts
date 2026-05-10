import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

const userSelect = {
  id: true,
  email: true,
  role: true
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function upsertUser(name: string, email: string, plainPassword: string, role: Role) {
  const password = await hashPassword(plainPassword);

  return prisma.user.upsert({
    where: { email },
    update: { name, role, password, status: "ACTIVE", isSuspended: false },
    create: {
      name,
      email,
      password,
      role,
      status: "ACTIVE"
    },
    select: userSelect
  });
}

async function main() {
  await prisma.platformSetting.upsert({
    where: { id: "default-platform-settings" },
    update: {
      platformFee: 20,
      gstPercent: 18,
      commissionPercent: 15,
      penaltyCommissionPercent: 20,
      commissionDueWindowDays: 5,
      adminUpiId: "admin@upi",
      adminUpiName: "Platform Admin"
    },
    create: {
      id: "default-platform-settings",
      platformFee: 20,
      gstPercent: 18,
      commissionPercent: 15,
      penaltyCommissionPercent: 20,
      commissionDueWindowDays: 5,
      adminUpiId: "admin@upi",
      adminUpiName: "Platform Admin"
    }
  });

  const admin = await upsertUser("Platform Admin", "admin@gmail.com", "Admin@1234", Role.ADMIN);
  const owner = await upsertUser("Court Owner", "owner@gmail.com", "Owner@1234", Role.OWNER);
  await upsertUser("Demo User", "user@gmail.com", "User@1234", Role.USER);

  const courts = [
    {
      name: "Smash Arena",
      slug: "smash-arena",
      description: "Premium indoor badminton court with wooden flooring and bright lights.",
      city: "Bengaluru",
      area: "Indiranagar",
      address: "12 Sports Avenue, Indiranagar",
      imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
      pricePerHour: 650,
      rating: 4.7,
      status: "ACTIVE" as const,
      type: "INDOOR" as const,
      isApproved: true
    },
    {
      name: "Shuttle Hub",
      slug: "shuttle-hub",
      description: "Affordable neighborhood court for daily practice and weekend games.",
      city: "Chennai",
      area: "Velachery",
      address: "44 Fitness Street, Velachery",
      imageUrl: "https://images.unsplash.com/photo-1613918431703-aa50889e3be3?auto=format&fit=crop&w=1200&q=80",
      pricePerHour: 500,
      rating: 4.3,
      status: "ACTIVE" as const,
      type: "INDOOR" as const,
      isApproved: true
    },
    {
      name: "Rally Sports Club",
      slug: "rally-sports-club",
      description: "Spacious multi-court sports club with parking and coaching support.",
      city: "Hyderabad",
      area: "Gachibowli",
      address: "8 Club Road, Gachibowli",
      imageUrl: "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=1200&q=80",
      pricePerHour: 700,
      rating: 4.8,
      status: "ACTIVE" as const,
      type: "INDOOR" as const,
      isApproved: true
    },
    {
      name: "Prime Badminton Court",
      slug: "prime-badminton-court",
      description: "Well maintained court currently under maintenance for resurfacing.",
      city: "Pune",
      area: "Kothrud",
      address: "21 Prime Lane, Kothrud",
      imageUrl: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=80",
      pricePerHour: 450,
      rating: 4.1,
      status: "MAINTENANCE" as const,
      type: "INDOOR" as const,
      isApproved: false
    }
  ];

  for (const court of courts) {
    const existing = await prisma.court.findFirst({ where: { name: court.name, ownerId: owner.id } });
    const savedCourt = existing
      ? await prisma.court.update({ where: { id: existing.id }, data: { ...court, slug: court.slug || slugify(court.name) } })
      : await prisma.court.create({ data: { ...court, slug: court.slug || slugify(court.name), ownerId: owner.id } });

    if (savedCourt.status === "ACTIVE" && savedCourt.isApproved) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      for (const hour of [6, 7, 8, 18, 19, 20]) {
        const startTime = new Date(tomorrow);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(tomorrow);
        endTime.setHours(hour + 1, 0, 0, 0);

        const existingSlot = await prisma.slot.findFirst({
          where: { courtId: savedCourt.id, startTime, endTime }
        });

        if (!existingSlot) {
          await prisma.slot.create({
            data: {
              courtId: savedCourt.id,
              date: tomorrow,
              startTime,
              endTime,
              price: savedCourt.pricePerHour,
              status: "AVAILABLE"
            }
          });
        }
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED_COMPLETED",
      entity: "System",
      entityId: "seed"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
