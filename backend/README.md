# Badminton Booking Backend

Active backend for the Badminton Court Booking Platform. The active project lives in `slotting/backend` and `slotting/frontend`; `slotting/badminton-booking-platform` is a legacy duplicate and should not be used.

## Architecture

Bookings use the Slot HOLD locking architecture only:

- `Slot.status = AVAILABLE / HOLD / BOOKED / BLOCKED`
- `Slot.lockedBy` and `Slot.lockedUntil` protect temporary holds.
- `Booking(PENDING)` expires automatically.
- `Payment` is connected to `Booking`.
- A cron job releases expired holds every minute and logs `BOOKING_EXPIRED`.

Do not use or reintroduce the old `BookingHold` service architecture.

## Payment And Refunds

Primary booking payment is direct owner UPI:

1. Owner creates a court with `Court.upiId` and `Court.upiQrImageUrl`.
2. Admin approval is blocked until both fields exist.
3. `POST /api/bookings/hold-upi` creates `Booking(PENDING_PAYMENT)`, locks the slot, and creates `Payment(PENDING, provider=DIRECT_UPI)`.
4. User pays the court owner directly using that court's UPI ID/QR.
5. `POST /api/payments/upi/submit` records the user's UTR.
6. Owner verifies or rejects at `/owner/payments`.
7. Verification confirms the booking and books the slot.

Admin UPI in platform settings is only for owner monthly commission settlements. It is separate from court owner UPI details.

Razorpay flow:

Flow:

1. `POST /api/bookings/hold`
2. Razorpay order creation
3. Razorpay Checkout
4. `POST /api/bookings/confirm`
5. Razorpay signature, amount, currency, and captured-status verification
6. Webhook backup for payment and refund events
7. Razorpay refund execution on eligible cancellation

Development refund fallback:

```env
MOCK_PAYMENT=true
```

This creates a mock `refund_mock_xxx` gateway refund id when running locally without real Razorpay refund execution.

## Platform Settings

Pricing is stored in `PlatformSetting`:

- `platformFee`
- `gstPercent`
- `commissionPercent`

The backend calculates final amount, GST, platform fee, commission, and net owner earning.

## Signup And Passwords

`POST /api/auth/signup` accepts `USER` and `OWNER`. Missing role defaults to `USER`. `ADMIN` signup is blocked with:

```txt
Admin signup is not allowed
```

Passwords must have minimum 8 characters with uppercase, lowercase, number, and special character. This applies to signup and admin password reset.

Admin password reset route:

```txt
PATCH /api/admin/users/:id/password
```

Admins can reset passwords for `USER` and `OWNER` accounts only.

## Admin Account Rules

- Only 2 active admin accounts are allowed.
- Admins create USER, OWNER, and ADMIN accounts from `/admin/users` using `POST /api/admin/users`.
- Admin creation counts only active, non-deleted admin accounts.
- If an admin is deleted or deactivated, another admin slot becomes available.
- Public signup supports only USER and OWNER.
- Public signup cannot create admin accounts.
- At least one admin account must remain active.

Admin user routes:

```txt
GET    /api/admin/users/stats
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id/status
DELETE /api/admin/users/:id
```

## Owner And Admin Insights

Owner routes:

```txt
GET /api/owner/users
GET /api/owner/users/:id
```

Owners only see users and bookings connected to their own courts.

Admin route:

```txt
GET /api/admin/courts/:id/details
```

Admin court details include court details, owner details, revenue, bookings, and unique booked users.

## Admin Activity Monitoring

Admin activity page:

```txt
/admin/activity
```

Backend routes:

```txt
POST /api/activity/enter
POST /api/activity/track
GET  /api/admin/activity
GET  /api/admin/activity/summary
```

Tracked events include user, owner, and admin logins, website entry, key court views, booking/payment/refund events, owner court actions, admin moderation actions, password resets, webhooks, and expired hold cleanup.

Only `ADMIN` can read global activity. Audit metadata is sanitized and must not include passwords, JWT tokens, authorization headers, or Razorpay secrets. IP address and user agent are stored for security monitoring.

The frontend `ActivityTracker` logs `WEBSITE_ENTERED` once per browser tab session.

## Owner Monthly Commission System

Owners pay commission to the platform admin each calendar month:

- Normal commission: 15% of monthly revenue
- Due window: last 5 days of the month
- Penalty commission: 20% if unpaid after month end
- Payment destination: admin UPI ID from `PlatformSetting`
- Owner submits UTR/payment proof
- Admin verifies or rejects the submitted payment

Owner routes:

```txt
GET  /api/owner/settlements/current
GET  /api/owner/settlements
POST /api/owner/settlements/:id/submit-payment
```

Admin routes:

```txt
GET   /api/admin/settlements
GET   /api/admin/settlements/summary
GET   /api/admin/settlements/:id
PATCH /api/admin/settlements/:id/verify
PATCH /api/admin/settlements/:id/reject
POST  /api/admin/settlements/recalculate
```

Example:

```txt
Monthly revenue = Rs. 10,000
Normal commission = Rs. 1,500
Penalty commission = Rs. 2,000
```

## Owner Pay To Admin Flow

This flow is for `OWNER -> ADMIN / PLATFORM` commission payment. It is separate from user booking payment.

Owner settlement payment types:

- Daily: owner can pay today's payable commission.
- Monthly: owner can pay this month's pending commission.
- Total Pending: if owner misses daily or monthly payments, pending amount accumulates and the owner can pay all pending till now.

```txt
Owner opens /owner/settlements
↓
Clicks Pay Daily / Pay Monthly / Pay All Pending
↓
Redirects to /owner/settlements/pay-admin
↓
Sees admin UPI and QR
↓
Pays manually
↓
Owner submits UTR
↓
Admin verifies payment
↓
Settlement becomes paid
```

Admin must configure the platform UPI ID, account name, and QR image in Admin Settings before owners can pay.

Owner routes:

```txt
GET  /api/owner/settlements/pay-to-admin?date=YYYY-MM-DD
POST /api/owner/settlements/pay-to-admin/submit
```

Admin routes:

```txt
GET   /api/admin/settlements/owner-payments
PATCH /api/admin/settlements/:id/verify-owner-payment
PATCH /api/admin/settlements/:id/reject-owner-payment
```

Owner UTRs are normalized to uppercase, must be alphanumeric, and are checked against both owner settlement UTRs and direct user UPI payment UTRs. The backend recalculates payable amounts and does not trust frontend amounts.

## Court Owner UPI Payment Details

Every court needs:

- `upiId`
- `upiQrImageUrl`

## Court Contact Mobile Number

Owner court creation and owner court edits require a court contact/support mobile number.

- Accepted format: 10-digit Indian mobile number or `+91` format, for example `9876543210` or `+919876543210`.
- The backend validates and stores the number as 10 digits.
- Existing older courts may have no number until the owner edits them.
- Admins can view court contact mobile numbers in court management and court details.
- Audit logs record only the last four digits of the mobile number.

Validation rules:

- Owner court creation requires owner UPI ID and QR image.
- Owner can update only their own court UPI details.
- Admin can update UPI details for any court.
- Admin cannot approve a court without UPI details.
- Public court detail rejects booking when owner payment details are missing.
- UPI IDs are masked in audit metadata.

Direct UPI routes:

```txt
POST  /api/bookings/hold-upi
POST  /api/payments/upi/submit
GET   /api/owner/payments
PATCH /api/owner/payments/:id/verify
PATCH /api/owner/payments/:id/reject
PATCH /api/admin/courts/:id/upi
```

## Image Uploads

In development, if Cloudinary credentials are not configured, uploaded files are saved locally and served from the active backend process directory:

```txt
D:\new project\slotting\backend\uploads
```

Static URLs are mounted at:

```txt
GET /uploads/courts/<filename>
GET /uploads/qr/<filename>
```

Owner court create/edit routes accept `multipart/form-data`:

```txt
POST  /api/owner/courts
PATCH /api/owner/courts/:id
```

Court images should be sent as `courtImages`. QR images should be sent as `qrImage`. The backend also accepts older aliases for compatibility. Database records should store public relative paths only, for example `/uploads/courts/name.jpg` and `/uploads/qr/name.png`; absolute Windows paths and browser `blob:` URLs should not be stored.

In production, configure Cloudinary so uploads are stored remotely and database records store the Cloudinary `secure_url` directly:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Cloudinary folders:

```txt
badminton/courts
badminton/qr
```

If any Cloudinary variable is missing, the backend automatically falls back to local `/uploads` storage. Cloudinary URLs are returned as-is by the image URL normalizer; local upload paths are expanded through the backend `/uploads` static route.

Supported upload formats:

```txt
JPG, JPEG, PNG, WEBP, GIF, BMP, AVIF, HEIC, HEIF
```

Recommended:

- Court images: JPG, PNG, WEBP
- QR images: PNG or JPG

Limits:

- Court image: 5 MB per file
- QR image: 3 MB per file

HEIC/HEIF and BMP uploads are converted when possible for browser display. HEIC/HEIF may not preview in all browsers before upload.

Admins can inspect a court's stored image paths, normalized URLs, and local file existence with:

```txt
GET /api/admin/debug/court-images/:courtId
```

Developer-only repair for old local records:

```bash
npm run repair:images
```

Owners do not need terminal commands after uploading images from the website UI.

## Run

From `slotting`:

```bash
docker compose up -d
```

From `slotting/backend`:

```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

Health check:

```txt
GET http://localhost:5000/api/health
```

## Main Routes

```txt
POST  /api/bookings/hold
POST  /api/bookings/hold-upi
POST  /api/bookings/confirm
GET   /api/bookings/my
PATCH /api/bookings/:id/cancel
POST  /api/bookings/expire-holds
GET   /api/payments/details/:bookingId
POST  /api/payments/upi/submit
POST  /api/payments/razorpay/webhook
```

## Direct UPI User Payment Page

User booking payment is a two-step flow:

```txt
User selects a slot
↓
POST /api/bookings/hold-upi creates a pending booking and payment
↓
Frontend redirects to /payment/:bookingId
↓
GET /api/payments/details/:bookingId returns court, slot, amount, owner UPI, uploaded court QR, and UPI link
↓
User pays owner manually and submits UTR
↓
POST /api/payments/upi/submit marks payment USER_SUBMITTED
↓
Owner verifies payment before booking is confirmed
```

The payment details route is USER-only and returns data only for the logged-in user's own booking.

## Default Logins

| Role | Email | Password |
| --- | --- | --- |
| User | user@gmail.com | User@1234 |
| Owner | owner@gmail.com | Owner@1234 |
| Admin | admin@gmail.com | Admin@1234 |

## Validation

```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run build
```

Frontend run guide:

```bash
cd ../frontend
npm install
npm run dev
```
