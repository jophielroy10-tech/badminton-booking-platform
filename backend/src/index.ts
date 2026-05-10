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

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

// Webhook route needs raw body for signature verification
app.use("/api/payments/razorpay/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

const uploadsPath = path.join(process.cwd(), "uploads");

app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(uploadsPath)
);

if (process.env.NODE_ENV === "production") {
  app.use("/api", apiLimiter);
} else {
  console.log("Development mode: global API rate limiter disabled");
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Badminton Booking Backend is running",
    apiBaseUrl: `http://localhost:${env.PORT}/api`
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Badminton booking API is healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/activity", activityRoutes);

app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`);
  console.log(`Serving uploads from: ${uploadsPath}`);
  startReleaseExpiredHoldsJob();
  startSettlementStatusJob();
});