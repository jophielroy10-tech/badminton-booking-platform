import { CourtStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.middleware.js";
import { courtQuerySchema, courtStatusSchema, createCourtSchema, updateCourtSchema } from "../validators/court.validator.js";
import { normalizeCourtImages } from "../utils/imageUrl.js";

export const getCourts = async (req: any, res: any) => {
  const query = courtQuerySchema.parse(req.query);
  const where: Prisma.CourtWhereInput = {
    isApproved: true,
    status: "ACTIVE",
    deletedAt: null,
    upiId: { not: null },
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.area ? { area: { equals: query.area, mode: "insensitive" } } : {}),
    ...((query.minPrice || query.maxPrice)
      ? { pricePerHour: { ...(query.minPrice ? { gte: query.minPrice } : {}), ...(query.maxPrice ? { lte: query.maxPrice } : {}) } }
      : {})
  };

  const data = await prisma.court.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } }, images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "desc" }
  });

  res.json({ success: true, message: "Courts fetched successfully", data: data.map((court) => normalizeCourtImages(req, court)) });
};

export const getCourtById = async (req: any, res: any) => {
  const slugOrId = String(req.params.id);
  const data = await prisma.court.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      reviews: true,
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      slots: {
        where: {
          date: { gte: new Date(new Date().toDateString()) },
          status: "AVAILABLE"
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }]
      }
    }
  });
  if (!data || !data.isApproved || data.status !== "ACTIVE" || data.deletedAt) throw new AppError("This court is not available.", 404);
  if (!data.upiId) throw new AppError("This court payment details are not configured.", 400);
  res.json({
    success: true,
    message: "Court fetched successfully",
    data: normalizeCourtImages(req, data)
  });
};

export const createCourt = async (req: any, res: any) => {
  const input = createCourtSchema.parse(req.body);
  const data = await prisma.court.create({
    data: {
      ...input,
      ownerId: req.user.id,
      isApproved: req.user.role === "ADMIN"
    }
  });
  res.status(201).json({ success: true, message: "Court created successfully", data });
};

export const updateCourt = async (req: any, res: any) => {
  const input = updateCourtSchema.parse(req.body);
  const court = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  if (req.user.role !== "ADMIN" && court.ownerId !== req.user.id) throw new AppError("You can update only your own court", 403);

  const data = await prisma.court.update({ where: { id: court.id }, data: input });
  res.json({ success: true, message: "Court updated successfully", data });
};

export const deleteCourt = async (req: any, res: any) => {
  const court = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!court) throw new AppError("Court not found", 404);
  if (req.user.role !== "ADMIN" && court.ownerId !== req.user.id) throw new AppError("You can delete only your own court", 403);

  await prisma.court.update({
    where: { id: court.id },
    data: { deletedAt: new Date(), status: CourtStatus.INACTIVE, isApproved: false }
  });
  res.json({ success: true, message: "Court deleted successfully", data: {} });
};

export const updateCourtStatus = async (req: any, res: any) => {
  const input = courtStatusSchema.parse(req.body);
  const court = await prisma.court.findUnique({ where: { id: req.params.id } });
  if (!court) throw new AppError("Court not found", 404);
  if (court.deletedAt) throw new AppError("Deleted courts cannot be updated", 400);
  if (req.user.role !== "ADMIN" && court.ownerId !== req.user.id) throw new AppError("You can update only your own court", 403);

  const data = await prisma.court.update({ where: { id: court.id }, data: { status: input.status } });
  res.json({ success: true, message: "Court status updated successfully", data });
};
