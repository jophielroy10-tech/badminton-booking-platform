# Badminton Court Booking Platform

Portfolio-ready full-stack booking app with Next.js, Express, Prisma, PostgreSQL, JWT role auth, owner/admin dashboards, Slot HOLD locking, direct owner UPI payments, Razorpay support, refunds, audit logs, and responsive booking UX.

## Active Project Folders

- `backend` is the active Express/Prisma API.
- `frontend` is the active Next.js app.
- `badminton-booking-platform` is a legacy duplicate folder. Do not use it for active development.

## Booking Architecture

The active booking flow uses only the Slot locking system:

- `Slot.status = AVAILABLE / HOLD / BOOKED / BLOCKED`
- `Slot.lockedBy` and `Slot.lockedUntil` hold a selected slot temporarily.
- `Booking.status = PENDING / CONFIRMED / EXPIRED / CANCELLED`
- `Payment` belongs to `Booking`.
- Pending holds expire automatically.
- A cron job releases expired holds every minute and writes `BOOKING_EXPIRED` audit logs.

Do not use the old `BookingHold` service architecture.

## Payment Flow

Primary court booking payment is direct owner UPI:

1. Owner creates a court with the court owner's UPI ID and uploaded UPI QR code.
2. Admin can approve the court only when both UPI fields are present.
3. User selects a slot and `POST /api/bookings/hold-upi` locks the slot as `HOLD`, creates `Booking(PENDING_PAYMENT)`, and creates `Payment(PENDING, provider=DIRECT_UPI)`.
4. The booking page shows that court's `court.upiId` and `court.upiQrImageUrl`.
5. User pays the court owner directly and submits UTR through `POST /api/payments/upi/submit`.
6. Owner reviews `/owner/payments`, then confirms or rejects the payment.
7. Owner confirmation marks payment `SUCCESS`, booking `CONFIRMED`, and slot `BOOKED`.

Court owner UPI is separate from the admin UPI used for monthly commission settlements.

Legacy Razorpay flow remains available:

1. User selects an approved active court slot from the weekly calendar.
2. `POST /api/bookings/hold` locks the slot as `HOLD`, creates `Booking(PENDING)`, creates `Payment(PENDING)`, and creates a Razorpay order.
3. Frontend opens Razorpay Checkout.
4. `POST /api/bookings/confirm` verifies signature, amount, currency, captured status, and order ownership.
5. Backend marks the booking confirmed, slot booked, payment successful, and creates OTP/QR check-in data.
6. Razorpay webhook backs up `payment.captured`, `payment.failed`, and `refund.processed`.
7. Booking cancellation calls the Razorpay refund API when a real captured payment exists. In development, `MOCK_PAYMENT=true` creates a mock refund id.

Refund policy:

- More than 24 hours before slot start: 100%
- 6 to 24 hours before slot start: 50%
- Less than 6 hours before slot start: 0%

## Platform Settings

Pricing is read from `PlatformSetting`:

- `platformFee`
- `gstPercent`
- `commissionPercent`

The backend calculates final amounts and owner earnings. Never trust a frontend-supplied amount.

## Signup And Passwords

Public signup supports user and owner accounts. Admin signup is disabled.

Password rule:

```txt
Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.
```

This rule applies to signup and admin password resets.

## Run

Database:

```bash
docker compose up -d
```

Backend:

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

URLs:

```txt
Backend:  http://localhost:5000/api
Health:   http://localhost:5000/api/health
Frontend: http://localhost:3000
```

## Environment

Backend `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/badminton
PORT=5000
JWT_SECRET=badminton_super_secret_key
FRONTEND_URL=http://localhost:3000
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
MOCK_PAYMENT=true
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
```

## Default Logins

| Role | Email | Password |
| --- | --- | --- |
| User | user@gmail.com | User@1234 |
| Owner | owner@gmail.com | Owner@1234 |
| Admin | admin@gmail.com | Admin@1234 |

Use `/login` and select the matching role.

## Owner User Insights

Owners can open `/owner/users` to view only users who booked their own courts. Owner user detail pages show that user's bookings for the owner's courts only.

## Admin Controls

Admins can reset passwords for users and owners only. Admin-to-admin password reset is blocked.

Admins can open `/admin/courts`, review court-wise revenue, and click a court to see court details, owner details, revenue, bookings, and unique users.

Admin account rule:

- Only 2 active admin accounts are allowed.
- Admin can create USER, OWNER, and ADMIN accounts from the Admin Users page.
- Public signup supports only USER and OWNER.
- If an admin is deleted or deactivated, another admin slot becomes available.
- Public signup cannot create admin accounts.
- At least one admin account must remain active.

## Admin Activity Monitoring

Admins can open `/admin/activity` to monitor important platform activity:

- User, owner, and admin login activity
- Website entry activity after login
- Court browsing and court detail views
- Booking holds, confirmations, cancellations, payments, refunds, and webhooks
- Owner court creation, updates, uploads, status changes, and check-ins
- Admin approval, rejection, delete, status change, and password reset actions
- System cleanup events such as expired hold cleanup

Only admins can access activity APIs. Users and owners receive access denied for global activity logs.

Sensitive data is never logged: passwords, JWT tokens, authorization headers, and Razorpay secrets are excluded from audit metadata.

The frontend `ActivityTracker` records `WEBSITE_ENTERED` once per browser tab session using `sessionStorage`, so activity monitoring is useful without spamming the database.

## Owner Monthly Commission System

Owners pay monthly platform commission directly to the admin UPI ID configured in admin settings.

- Normal commission is 15% of monthly owner revenue.
- Payment should be made during the last 5 days of the month.
- If the settlement is not submitted or verified before month end, penalty applies and commission becomes 20%.
- Monthly revenue is calculated from successful payments for confirmed/completed bookings on the owner's courts.
- Owners view current and historical settlements at `/owner/settlements`.
- Owners pay using the admin UPI QR/link and submit UTR/payment proof.
- Admins manage, verify, reject, and recalculate settlements at `/admin/settlements`.

Example:

```txt
Monthly revenue = Rs. 10,000
Normal commission = Rs. 1,500
Penalty commission = Rs. 2,000
```

## Court Owner UPI Payment Details

Every court must have payment receiving details:

- Owner UPI ID
- Owner UPI QR code image

Court Contact Mobile Number:

- Mandatory for owner court creation and owner court edits.
- Used for court contact/support.
- Admin can view it in court management and court details.
- Accepted format: 10-digit Indian mobile number or `+91` format.
- Existing older courts show `Mobile number not added` until updated.

Owners add these while creating a court and can update them later from the owner court edit page. Admins can update UPI details for any court from admin courts and court details pages.

Rules:

- Admin cannot approve a court without owner UPI ID and QR code.
- Public court listing and booking require configured court owner UPI details.
- User booking payment shows that specific court owner's UPI ID and uploaded QR image.
- User submits UTR after payment.
- Owner manually verifies or rejects direct UPI payments at `/owner/payments`.
- Admin UPI for owner monthly commission is separate from court owner UPI.

## Owner Slot Management

Owners can manage court availability from:

```txt
http://localhost:3000/owner/slots
```

Owner slot tools include:

- Generate simple 1-hour slots.
- Generate custom 30, 60, 90, or 120 minute slots.
- Repeat slot generation for the next 7, 14, or 30 days with weekday selection.
- Use court default hourly price or set a price per slot.
- Mark today or a selected day unavailable.
- Block maintenance, holiday, owner unavailable, or private-event slots.
- Edit slot price and AVAILABLE/BLOCKED status.
- Delete available or blocked slots.

Booking rule: users can book only `AVAILABLE` slots. `BLOCKED`, `BOOKED`, and active `HOLD` slots are hidden from public court details and rejected by booking APIs.

## Direct UPI Manual Verification

- Users pay to the selected court owner's UPI ID during direct UPI checkout.
- If the owner uploaded a QR image, the booking screen displays it. If no QR image exists, the frontend generates a QR from the UPI link.
- Users must submit a unique UTR / transaction ID. UTR values are normalized, validated, indexed, and rejected if reused.
- The booking is confirmed only after the court owner verifies the submitted payment from `/owner/payments`.
- Rejected or failed payment UTR values are not reusable unless an admin manually clears the payment record.

## Owner Payout Settlements

- Each successful booking creates an `OwnerEarning` record with gross amount, platform commission, fees, GST, net amount, and status.
- Owners can view booking-wise earnings and settlement history at `/owner/settlements`.
- Owners can pay admin/platform commission as Daily, Monthly, or Total Pending settlements.
- If an owner misses daily or monthly payment, the unpaid payable amount remains visible and accumulates in Total Pending until admin verifies payment.
- Admins can generate daily night settlements or monthly settlements at `/admin/settlements`.
- Admins mark settlements as paid with a settlement UTR and optional note. Linked owner earnings are marked `PAID`.
- The older monthly platform commission model remains in the codebase for compatibility, but owner payout settlement is the primary settlement workflow.

Owner settlement payment flow:

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
Submits UTR
↓
Admin verifies
↓
Settlement becomes paid
```

## Multi-Court Creation And Scheduling

- Owners can create 1 to 20 courts from `/owner/courts/new`.
- Each court can have its own price, multiple images, UPI ID, optional QR image, map URL, opening/closing time, slot duration, and weekday availability.
- Default schedule is Monday to Sunday, 9 AM to 9 PM, with 1-hour slots.
- When admin approves a court, the backend automatically generates default slots for the next configured number of days and skips duplicates.
- Owners can later generate more slots from saved schedule in `/owner/slots`.

## Image And Map Storage

- Local development saves and serves uploaded files from `backend/uploads`.
- Court images are stored under `backend/uploads/courts`.
- Court and platform QR images are stored under `backend/uploads/qr`.
- Supported court and QR upload formats: JPG, JPEG, PNG, WEBP, GIF, BMP, AVIF, HEIC, and HEIF.
- Recommended court image formats: JPG, PNG, or WEBP.
- Recommended QR image formats: PNG or JPG.
- Court image max size is 5 MB per file. QR image max size is 3 MB.
- HEIC/HEIF and BMP uploads may be converted server-side for browser display. HEIC/HEIF may not preview in all browsers before upload.
- The backend serves uploads with `app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))`.
- Set `BACKEND_PUBLIC_URL=http://localhost:5000` when the frontend needs absolute upload URLs.
- Court images are stored in `CourtImage`, ordered by primary image first, and `court.imageUrl` remains a fallback.
- Public court cards and court details use `court.images[0].imageUrl` first, then fallback to `court.imageUrl`.
- Broken or missing image URLs render a placeholder instead of a broken image icon.
- Court details, owner court details, and admin court details show the map URL as an "Open Map" link when provided.
- Production deployments should move uploaded images and QR files to Cloudinary, S3, or another durable object storage service.

## Developer Debugging

- Owners do not need terminal commands after uploading images. The browser upload flow automatically saves files, stores database paths, refetches court data, and displays previews.
- If a developer needs to repair old seeded/local records that already contain Windows paths or bare filenames, run `cd backend && npm run repair:images` to normalize them to `/uploads/...` paths.

## Daily Settlement Visibility

- `/api/owner/settlements/summary` includes today, yesterday, month, pending, and paid owner earning totals.
- Owner dashboard shows today's net settlement with pending and paid breakdown.
- Owner settlements page includes a Daily Settlement section with today gross, commission, net, pending, paid, yesterday settlement, and monthly pending/paid totals.

## Core Routes

```txt
POST  /api/bookings/hold
POST  /api/bookings/hold-upi
POST  /api/bookings/confirm
POST  /api/bookings/expire-holds
GET   /api/bookings/my
PATCH /api/bookings/:id/cancel
POST  /api/payments/upi/submit
POST  /api/payments/razorpay/webhook
GET   /api/owner/bookings
POST  /api/owner/bookings/check-in
GET   /api/owner/payments
PATCH /api/owner/payments/:id/verify
PATCH /api/owner/payments/:id/reject
GET   /api/owner/slots
GET   /api/owner/courts/:courtId/slots
POST  /api/owner/courts/:courtId/slots/generate
POST  /api/owner/courts/:courtId/slots/generate-bulk
POST  /api/owner/courts/:courtId/unavailable-day
POST  /api/owner/courts/:courtId/available-day
POST  /api/owner/courts/:courtId/block-slots
PATCH /api/owner/slots/:slotId
DELETE /api/owner/slots/:slotId
GET   /api/owner/settlements/summary
GET   /api/owner/settlements
GET   /api/owner/earnings
GET   /api/owner/platform-payment-settings
GET   /api/admin/settlements/summary
GET   /api/admin/settlements
POST  /api/admin/settlements/generate-daily
POST  /api/admin/settlements/generate-monthly
PATCH /api/admin/settlements/:id/mark-paid
GET   /api/admin/earnings
GET   /api/admin/payment-settings
PATCH /api/admin/payment-settings
POST  /api/admin/payment-settings/qr-upload
POST  /api/activity/enter
POST  /api/activity/track
GET   /api/admin/activity
GET   /api/admin/activity/summary
GET   /api/owner/settlements/current
GET   /api/owner/settlements
POST  /api/owner/settlements/:id/submit-payment
GET   /api/admin/settlements
GET   /api/admin/settlements/summary
GET   /api/admin/settlements/:id
PATCH /api/admin/settlements/:id/verify
PATCH /api/admin/settlements/:id/reject
```

## Manual Testing

## Cancellation Charge System

- Default cancellation charge is 10%.
- Owners can set a different cancellation percentage for each court while creating or editing it.
- When a user cancels a paid booking, the backend calculates the deduction from the actual payment amount.
- The remaining amount is the refund amount.
- Because direct UPI payments are manual, refunds are marked as pending owner refund for owner/admin visibility.

Example:

Booking amount: Rs. 1000
Cancellation charge: 10%
Deducted: Rs. 100
Refund: Rs. 900

Use `GET /api/bookings/:id/cancel-preview` to preview the calculation before cancellation. The final cancellation calculation is always performed by the backend.

1. Login as user.
2. Open an approved active court.
3. Choose a slot from the weekly calendar.
4. Pay using the displayed court owner UPI ID/QR and submit UTR.
5. Login as owner, open `/owner/payments`, and confirm the submitted payment.
6. Open My Bookings and test Upcoming, Past, Cancelled, Refunded, and All tabs.
7. Login as owner and verify court image upload still works.
8. Open owner users and verify only users connected to owner courts are visible.
9. Login as admin and verify court accept/reject, soft delete, password reset, court revenue details, refunds, and audit logs.
10. Login as owner and open `/owner/slots`.
11. Select a court and generate slots from 06:00 to 10:00 with 1-hour duration.
12. Confirm 4 slots are created: 06-07, 07-08, 08-09, 09-10.
13. Generate the same range again and confirm duplicates are skipped.
14. Mark today unavailable and confirm available slots become blocked.
15. Confirm public court details do not show blocked slots.
16. Make the selected day available and confirm owner-blocked slots return to available.
17. Delete an available slot and confirm booked or active hold slots cannot be deleted.

## Validation

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run build
npm run dev

cd ../frontend
npm install
npm run build
npm run dev
```
