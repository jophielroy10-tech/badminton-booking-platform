import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import { authRoutes } from "./routes/auth.routes.js";
import { courtRoutes } from "./routes/court.routes.js";
import { bookingRoutes } from "./routes/booking.routes.js";
import { otpRoutes } from "./routes/otp.routes.js";
import { paymentRoutes } from "./routes/payment.routes.js";
import { ownerRoutes } from "./routes/owner.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { walletRoutes } from "./routes/wallet.routes.js";
import { activityRoutes } from "./routes/activity.routes.js";
import { startReleaseExpiredHoldsJob } from "./jobs/releaseExpiredHolds.job.js";
import { startSettlementStatusJob } from "./jobs/settlementStatus.job.js";

const app = express();

// Render runs Express behind a proxy.
// Required for express-rate-limit when X-Forwarded-For header is present.
app.set("trust proxy", 1);

const allowedOrigins = new Set([
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001"
]);