const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const API_URL = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE.replace(/\/$/, "")}/api`;

export type UserRole = "ADMIN" | "OWNER" | "USER";

export type Court = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  address?: string | null;
  contactMobile?: string | null;
  city?: string | null;
  area?: string | null;
  mapUrl?: string | null;
  pricePerHour: string | number;
  cancellationChargePercent?: number | string | null;
  rating?: string | number;
  imageUrl?: string | null;
  status: "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "REJECTED";
  approved?: boolean;
  isApproved?: boolean;
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  upiId?: string | null;
  upiQrImageUrl?: string | null;
  upiUpdatedAt?: string | null;
  upiUpdatedBy?: string | null;
  deletedAt?: string;
  owner?: { id: string; name: string; email: string };
  slots?: Slot[];
  images?: Array<{ id: string; imageUrl: string; isPrimary?: boolean; createdAt?: string }>;
  type?: "INDOOR" | "OUTDOOR" | string;
  hasAC?: boolean;
  hasCoaching?: boolean;
  openingTime?: string;
  closingTime?: string;
  defaultScheduleEnabled?: boolean;
  defaultSlotDurationMinutes?: number;
  slotGenerationDays?: number;
  schedules?: CourtSchedule[];
  createdAt?: string;
  updatedAt?: string;
  analytics?: AdminCourtAnalytics;
};

export type CourtSchedule = {
  id?: string;
  courtId?: string;
  dayOfWeek: number;
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
};

export type Slot = {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  status: "AVAILABLE" | "HOLD" | "BOOKED" | "BLOCKED";
  lockedBy?: string | null;
  lockedUntil?: string | null;
  reason?: string | null;
};

export type Booking = {
  id: string;
  userId: string;
  courtId: string;
  slotId: string;
  status: "PENDING" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "FAILED" | "EXPIRED" | "REFUNDED" | "COMPLETED";
  expiresAt?: string;
  checkInOtp?: string;
  qrToken?: string;
  checkedIn: boolean;
  checkedInAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
  court: Court;
  slot: Slot;
  payment: Payment;
  refund?: Refund | null;
};

export type Refund = {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  cancellationCharge?: number;
  cancellationChargePercent?: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED" | "FAILED";
  reason?: string | null;
  gatewayRefundId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  platformFee: number;
  gst: number;
  discount: number;
  finalAmount: number;
  currency: string;
  status: "PENDING" | "USER_SUBMITTED" | "SUCCESS" | "FAILED" | "OWNER_REJECTED" | "EXPIRED" | "REFUND_PENDING" | "REFUNDED";
  provider: string;
  upiId?: string | null;
  upiQrImageUrl?: string | null;
  utrNumber?: string | null;
  ownerId?: string | null;
  user?: { id: string; name: string; email: string };
  booking?: Booking;
  refund?: Refund | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  deletedAt?: string | null;
  courtsCount?: number;
  createdAt?: string;
};

export type AdminUserStats = {
  activeAdmins: number;
  adminLimit: number;
  canCreateAdmin: boolean;
  totalUsers: number;
  totalOwners: number;
  totalAdmins: number;
};

export type OwnerCourtUser = {
  id: string;
  name: string;
  email: string;
  totalBookings: number;
  totalAmountPaid: number;
  lastBookingDate?: string | null;
  confirmedBookings: number;
  cancelledBookings: number;
};

export type OwnerCourtUserDetails = {
  user: Pick<AuthUser, "id" | "name" | "email" | "createdAt">;
  summary: {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    totalAmountPaid: number;
    lastBookingDate?: string | null;
  };
  bookings: Array<{
    id: string;
    court: { id: string; name: string };
    slot: Slot;
    status: Booking["status"];
    paymentStatus?: Payment["status"] | null;
    finalAmount: number;
    checkedIn: boolean;
    checkedInAt?: string | null;
    createdAt: string;
  }>;
};

export type AdminCourtAnalytics = {
  totalBookings: number;
  successfulPayments: number;
  totalRevenue: number;
  pendingPayments: number;
  cancelledBookings: number;
  confirmedBookings?: number;
  completedBookings?: number;
  totalUsers?: number;
  refundedAmount?: number;
  platformCommission?: number;
  ownerNetEarning?: number;
};

export type AdminCourtDetails = {
  court: Court;
  owner: Pick<AuthUser, "id" | "name" | "email" | "status">;
  analytics: AdminCourtAnalytics;
  bookings: Array<{
    id: string;
    user: { id: string; name: string; email: string };
    slot: Slot;
    status: Booking["status"];
    paymentStatus?: Payment["status"] | null;
    finalAmount: number;
    checkedIn: boolean;
    createdAt: string;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    bookingCount: number;
    totalPaid: number;
    lastBookingDate?: string | null;
  }>;
  ownerCommissionStatus?: {
    month: number;
    year: number;
    ownerMonthlyRevenue: number;
    thisCourtRevenue: number;
    commissionPercent: number;
    amountDue: number;
    status: string;
    paymentUtr?: string | null;
    settlementId: string;
  };
  slotOverview?: {
    total: number;
    available: number;
    booked: number;
    blocked: number;
    hold: number;
    todayAvailability: number;
  };
};

export type SlotSummary = {
  total: number;
  available: number;
  booked: number;
  blocked: number;
  hold: number;
};

export type OwnerSlotCourt = Court & {
  slotSummaryToday: SlotSummary;
};

export type OwnerCourtSlots = {
  court: Court;
  date: string;
  slots: Slot[];
  summary: SlotSummary;
};

export type GenerateSlotsPayload = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: 30 | 60 | 90 | 120;
  price?: number;
  overwriteExisting?: boolean;
};

export type GenerateBulkSlotsPayload = Omit<GenerateSlotsPayload, "date"> & {
  startDate: string;
  repeatDays: number;
  weekdays: number[];
};

export type AuditActivity = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: UserRole } | null;
};

export type ActivityListResponse = {
  items: AuditActivity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type ActivitySummary = {
  todayLogins: number;
  todayUserLogins: number;
  todayOwnerLogins: number;
  todayAdminLogins: number;
  todayBookings: number;
  todayPayments: number;
  todayOwnerActions: number;
  todayAdminActions: number;
  recentActivities: AuditActivity[];
};

export type PlatformSettings = {
  id: string;
  adminUpiId?: string | null;
  adminUpiName?: string | null;
  platformUpiId?: string | null;
  platformQrImageUrl?: string | null;
  platformAccountName?: string | null;
  commissionPercent: number;
  penaltyCommissionPercent: number;
  commissionDueWindowDays: number;
};

export type OwnerEarning = {
  id: string;
  ownerId: string;
  courtId?: string | null;
  bookingId: string;
  paymentId?: string | null;
  grossAmount: number;
  platformFee: number;
  commission: number;
  gst: number;
  netAmount: number;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "OVERDUE";
  createdAt: string;
  court?: { id: string; name: string } | null;
  booking?: { id: string; createdAt: string; status?: string };
  payment?: { id: string; provider: string; utrNumber?: string | null };
};

export type OwnerSettlement = {
  id: string;
  ownerId: string;
  cycle: "DAILY" | "MONTHLY" | "MANUAL" | "TOTAL_PENDING";
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  fromDate: string;
  toDate: string;
  grossAmount: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalGst: number;
  netAmount: number;
  paidAt?: string | null;
  paidBy?: string | null;
  settlementUtr?: string | null;
  note?: string | null;
  ownerPaymentUtr?: string | null;
  ownerPaymentStatus?: "NOT_PAID" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  ownerPaidAt?: string | null;
  ownerPaymentRejectionReason?: string | null;
  owner?: { id: string; name: string; email: string };
};

export type OwnerMonthlySettlement = {
  id: string;
  ownerId: string;
  month: number;
  year: number;
  monthlyRevenue: number;
  commissionPercent: number;
  commissionAmount: number;
  penaltyApplied: boolean;
  amountDue: number;
  amountPaid?: number | null;
  adminUpiIdSnapshot?: string | null;
  adminUpiId?: string | null;
  adminUpiName?: string | null;
  upiLink?: string | null;
  paymentUtr?: string | null;
  paymentProofUrl?: string | null;
  status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "OVERDUE" | "PAID" | "FAILED";
  submittedAt?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  dueDate: string;
  dueWindowStart?: string;
  message?: string;
  owner?: { id: string; name: string; email: string };
};

export type SettlementSummary = {
  totalPendingSettlement: number;
  totalPaidSettlement: number;
  todayPending: number;
  thisMonthPending: number;
  totalPendingCount: number;
  totalPaidCount: number;
};

export type OwnerPayToAdminSettlement = {
    id: string;
    settlementId: string;
    type: "DAILY" | "MONTHLY" | "TOTAL_PENDING" | "MANUAL";
    date: string;
    fromDate?: string;
    toDate?: string;
    grossAmount: number;
    commissionAmount: number;
    platformFee: number;
    gst: number;
    totalPayableToAdmin: number;
    status: "NOT_PAID" | "SUBMITTED" | "VERIFIED" | "REJECTED";
    utrNumber?: string | null;
    submittedAt?: string | null;
    rejectionReason?: string | null;
  };
export type OwnerPayToAdminDetails = {
  platform: {
    upiId?: string | null;
    accountName?: string | null;
    qrImageUrl?: string | null;
  };
  settlement: OwnerPayToAdminSettlement;
  payable: OwnerPayToAdminSettlement;
  upiLink?: string | null;
};

export type OwnerSettlementSummaryBlock = {
  date?: string;
  month?: number;
  year?: number;
  grossAmount: number;
  commissionAmount: number;
  platformFee: number;
  gst?: number;
  totalPayable: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDING" | "PAID" | "SUBMITTED" | "VERIFIED" | "REJECTED";
};

export type OwnerSettlementSummaryData = {
  daily: OwnerSettlementSummaryBlock;
  monthly: OwnerSettlementSummaryBlock;
  totalPending: OwnerSettlementSummaryBlock;
  recentPayments: Array<{ id: string; type: string; amount: number; utrNumber?: string | null; status: string; submittedAt?: string | null; paidAt?: string | null }>;
  pendingAmount: number;
  paidAmount: number;
  todayGross: number;
  todayCommission: number;
  todayNet: number;
  todayPending: number;
  todayPaid: number;
  yesterdayNet: number;
  monthGross: number;
  monthCommission: number;
  monthNet: number;
  monthPending: number;
  monthPaid: number;
  todayEarning: number;
  thisMonthEarning: number;
  totalCommission: number;
  totalGross: number;
  recentEarnings: OwnerEarning[];
};

export type UserPaymentDetails = {
  booking: {
    id: string;
    status: Booking["status"];
    expiresAt?: string | null;
  };
  court: Court;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
  };
  payment: {
    id: string;
    amount: number;
    finalAmount: number;
    status: Payment["status"];
    provider: string;
    utrNumber?: string | null;
  };
  upiLink: string;
};

export type OwnerSettlementPaymentSubmission = {
  id: string;
  owner: { id: string; name: string; email: string };
  cycle: OwnerSettlement["cycle"];
  type?: OwnerSettlement["cycle"];
  fromDate: string;
  toDate: string;
  amount: number;
  utrNumber?: string | null;
  submittedAt?: string | null;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED" | "NOT_PAID";
  grossAmount: number;
  commissionAmount: number;
  platformFee: number;
  gst: number;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) return response.json();
  return { success: false, message: (await response.text()) || "Server returned non-JSON response" };
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(data?.message || `Request failed with status ${response.status}`);
  return data;
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export async function getCourts() {
  return apiRequest<Court[]>("/courts");
}

export async function getCourtById(id: string) {
  return apiRequest<Court>(`/courts/${id}`);
}

export async function loginUser(payload: { email: string; password: string; expectedRole: UserRole }) {
  return apiRequest<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function signupUser(payload: { name: string; email: string; password: string; role?: "USER" | "OWNER" }) {
  return apiRequest<{ token: string; user: AuthUser }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function sendOtp(payload: { email: string; purpose?: string }) {
  return apiRequest<{ sent: boolean; otp?: string }>("/otp/send", {
    method: "POST",
    body: JSON.stringify({ purpose: "BOOKING", ...payload })
  });
}

export async function verifyOtp(payload: { email: string; purpose?: string; otp: string }) {
  return apiRequest<{ verified: boolean }>("/otp/verify", {
    method: "POST",
    body: JSON.stringify({ purpose: "BOOKING", ...payload })
  });
}

export async function getMyBookings() {
  return apiRequest<Booking[]>("/bookings/my");
}

export async function createBookingHold(payload: { slotId: string; couponCode?: string }) {
  return apiRequest<{ bookingId: string; paymentId: string; razorpayOrderId: string; amount: number; currency: string; key: string }>("/bookings/hold", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createUpiBookingHold(payload: { slotId: string }) {
  return apiRequest<{
    bookingId: string;
    paymentId: string;
    amount: number;
    upiId: string;
    upiQrImageUrl?: string | null;
    courtName: string;
    ownerName: string;
    upiLink: string;
    expiresAt: string;
  }>("/bookings/hold-upi", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitUpiPayment(payload: { paymentId: string; utrNumber: string }) {
  return apiRequest<Payment>("/payments/upi/submit", { method: "POST", body: JSON.stringify(payload) });
}

export async function getPaymentDetails(bookingId: string) {
  return apiRequest<UserPaymentDetails>(`/payments/details/${bookingId}`);
}

export async function confirmBooking(payload: {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiRequest<{ booking: Booking; checkInOtp: string; qrToken: string }>("/bookings/confirm", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export type CancellationPreview = {
  paidAmount: number;
  cancellationChargePercent: number;
  cancellationCharge: number;
  refundAmount: number;
  refundStatus: "PENDING_OWNER_REFUND" | "NO_REFUND_NEEDED";
};

export async function getCancelBookingPreview(bookingId: string) {
  return apiRequest<CancellationPreview>(`/bookings/${bookingId}/cancel-preview`);
}

export async function cancelBooking(bookingId: string) {
  return apiRequest<CancellationPreview & { bookingId: string }>(`/bookings/${bookingId}/cancel`, { method: "PATCH" });
}

export async function getOwnerDashboard() {
  return apiRequest<{
    totalCourts: number;
    activeCourts: number;
    totalBookings: number;
    totalRevenue: number;
    slotSummaryToday?: SlotSummary & { pendingPaymentHolds?: number };
    settlementSummaryToday?: {
      todayNet: number;
      todayPending: number;
      todayPaid: number;
    };
  }>("/owner/dashboard");
}

export async function getOwnerCurrentSettlement() {
  return apiRequest<OwnerMonthlySettlement>("/owner/settlements/current");
}

export async function getOwnerSettlements() {
  return apiRequest<OwnerSettlement[]>("/owner/settlements");
}

export async function getOwnerPayToAdminDetails(params: { type?: "DAILY" | "MONTHLY" | "TOTAL_PENDING"; date?: string; month?: number; year?: number; settlementId?: string }) {
  return apiRequest<OwnerPayToAdminDetails>(`/owner/settlements/pay-to-admin${queryString(params)}`);
}

export async function submitOwnerPayToAdminPayment(payload: { type?: "DAILY" | "MONTHLY" | "TOTAL_PENDING"; settlementId?: string; date?: string; month?: number; year?: number; utrNumber: string; paymentProofUrl?: string }) {
  return apiRequest<OwnerSettlement>("/owner/settlements/pay-to-admin/submit", { method: "POST", body: JSON.stringify(payload) });
}

export async function getOwnerSettlementSummary() {
  return apiRequest<OwnerSettlementSummaryData>("/owner/settlements/summary");
}

export async function getOwnerEarnings(params: Record<string, string | number | undefined> = {}) {
  return apiRequest<OwnerEarning[]>(`/owner/earnings${queryString(params)}`);
}

export async function submitOwnerSettlementPayment(id: string, payload: { paymentUtr: string; paymentProofUrl?: string }) {
  return apiRequest<OwnerMonthlySettlement>(`/owner/settlements/${id}/submit-payment`, { method: "POST", body: JSON.stringify(payload) });
}

export async function getOwnerCourts() {
  return apiRequest<Court[]>("/owner/courts");
}

export async function getOwnerCourtById(id: string) {
  try {
    return await apiRequest<Court>(`/owner/courts/${id}/details`);
  } catch {
    return apiRequest<Court>(`/owner/courts/${id}`);
  }
}

export async function getOwnerSlotCourts() {
  return apiRequest<OwnerSlotCourt[]>("/owner/slots");
}

export async function getOwnerCourtSlots(courtId: string, date?: string) {
  return apiRequest<OwnerCourtSlots>(`/owner/courts/${courtId}/slots${queryString({ date })}`);
}

export async function generateOwnerSlots(courtId: string, payload: GenerateSlotsPayload) {
  return apiRequest<{ createdCount: number; skippedCount: number }>(`/owner/courts/${courtId}/slots/generate`, { method: "POST", body: JSON.stringify(payload) });
}

export async function generateOwnerSlotsBulk(courtId: string, payload: GenerateBulkSlotsPayload) {
  return apiRequest<{ createdCount: number; skippedCount: number }>(`/owner/courts/${courtId}/slots/generate-bulk`, { method: "POST", body: JSON.stringify(payload) });
}

export async function generateOwnerSlotsFromSchedule(courtId: string) {
  return apiRequest<{ createdCount: number; skippedCount: number }>(`/owner/courts/${courtId}/slots/generate-schedule`, { method: "POST" });
}

export async function makeOwnerCourtUnavailableDay(courtId: string, payload: { date: string; reason: string }) {
  return apiRequest<{ blockedCount: number; skippedBookedCount: number; skippedHoldCount: number }>(`/owner/courts/${courtId}/unavailable-day`, { method: "POST", body: JSON.stringify(payload) });
}

export async function makeOwnerCourtAvailableDay(courtId: string, payload: { date: string }) {
  return apiRequest<{ updatedCount: number }>(`/owner/courts/${courtId}/available-day`, { method: "POST", body: JSON.stringify(payload) });
}

export async function blockOwnerSlots(courtId: string, payload: { slotIds: string[]; reason: string }) {
  return apiRequest<{ blockedCount: number; skippedCount: number }>(`/owner/courts/${courtId}/block-slots`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateOwnerSlot(slotId: string, payload: { price?: number; status?: "AVAILABLE" | "BLOCKED"; reason?: string | null }) {
  return apiRequest<Slot>(`/owner/slots/${slotId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteOwnerSlot(slotId: string) {
  return apiRequest(`/owner/slots/${slotId}`, { method: "DELETE" });
}

export async function createOwnerCourt(payload: Partial<Court> | FormData) {
  return apiRequest<Court>("/owner/courts", {
    method: "POST",
    body: payload instanceof FormData ? payload : JSON.stringify(payload)
  });
}

export async function updateOwnerCourt(id: string, payload: Partial<Court> | FormData) {
  return apiRequest<Court>(`/owner/courts/${id}`, {
    method: "PATCH",
    body: payload instanceof FormData ? payload : JSON.stringify(payload)
  });
}

export async function uploadOwnerCourtImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("images", file);
  return apiRequest<Court>(`/owner/courts/${id}/images`, { method: "POST", body: formData });
}

export async function getOwnerBookings() {
  return apiRequest<Booking[]>("/owner/bookings");
}

export async function getOwnerPayments() {
  return apiRequest<Payment[]>("/owner/payments");
}

export async function getOwnerPlatformPaymentSettings() {
  return apiRequest<Pick<PlatformSettings, "platformUpiId" | "platformQrImageUrl" | "platformAccountName">>("/owner/platform-payment-settings");
}

export async function verifyOwnerUpiPayment(id: string) {
  return apiRequest<Booking>(`/owner/payments/${id}/verify`, { method: "PATCH" });
}

export async function rejectOwnerUpiPayment(id: string, reason: string) {
  return apiRequest(`/owner/payments/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

export async function getOwnerUsers() {
  return apiRequest<OwnerCourtUser[]>("/owner/users");
}

export async function getOwnerUserDetails(id: string) {
  return apiRequest<OwnerCourtUserDetails>(`/owner/users/${id}`);
}

export async function checkInUser(payload: { bookingId: string; otp?: string; qrToken?: string }) {
  return apiRequest<Booking>("/owner/bookings/check-in", { method: "POST", body: JSON.stringify(payload) });
}

export async function getAdminDashboard() {
  return apiRequest<{ users: number; owners: number; courts: number; bookings: number; revenue: number }>("/admin/dashboard");
}

export async function getAdminSettings() {
  return apiRequest<PlatformSettings>("/admin/settings");
}

export async function getAdminPaymentSettings() {
  return apiRequest<PlatformSettings>("/admin/payment-settings");
}

export async function updateAdminPaymentSettings(payload: { platformUpiId?: string; platformAccountName?: string }) {
  return apiRequest<PlatformSettings>("/admin/payment-settings", { method: "PATCH", body: JSON.stringify(payload) });
}

export async function uploadAdminPaymentQr(file: File) {
  const formData = new FormData();
  formData.append("upiQrImage", file);
  return apiRequest<PlatformSettings>("/admin/payment-settings/qr-upload", { method: "POST", body: formData });
}

export async function updateAdminSettings(payload: Partial<PlatformSettings>) {
  return apiRequest<PlatformSettings>("/admin/settings", { method: "PATCH", body: JSON.stringify(payload) });
}

export async function downloadAdminBackup() {
  const token = getToken();
  const response = await fetch(`${API_URL}/admin/backup`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const data = await readResponse(response);
    throw new Error(data?.message || "Backup failed");
  }

  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get("Content-Disposition")
  };
}

export async function getAdminSettlementSummary(params: { month?: number; year?: number } = {}) {
  return apiRequest<SettlementSummary>(`/admin/settlements/summary${queryString(params)}`);
}

export async function getAdminSettlements(params: { month?: number; year?: number; status?: string; ownerId?: string } = {}) {
  return apiRequest<OwnerSettlement[]>(`/admin/settlements${queryString(params)}`);
}

export async function getAdminOwnerSettlementPayments(params: { cycle?: string; status?: string } = {}) {
  return apiRequest<OwnerSettlementPaymentSubmission[]>(`/admin/settlements/owner-payments${queryString(params)}`);
}

export async function verifyAdminOwnerSettlementPayment(id: string) {
  return apiRequest<OwnerSettlement>(`/admin/settlements/${id}/verify-owner-payment`, { method: "PATCH", body: JSON.stringify({ action: "VERIFY" }) });
}

export async function rejectAdminOwnerSettlementPayment(id: string, reason: string) {
  return apiRequest<OwnerSettlement>(`/admin/settlements/${id}/reject-owner-payment`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

export async function generateAdminDailySettlement(payload: { date: string; ownerId?: string }) {
  return apiRequest<OwnerSettlement[]>("/admin/settlements/generate-daily", { method: "POST", body: JSON.stringify(payload) });
}

export async function generateAdminMonthlySettlement(payload: { year: number; month: number; ownerId?: string }) {
  return apiRequest<OwnerSettlement[]>("/admin/settlements/generate-monthly", { method: "POST", body: JSON.stringify(payload) });
}

export async function markAdminSettlementPaid(id: string, payload: { settlementUtr: string; note?: string }) {
  return apiRequest<OwnerSettlement>(`/admin/settlements/${id}/mark-paid`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function getAdminEarnings(params: Record<string, string | number | undefined> = {}) {
  return apiRequest<OwnerEarning[]>(`/admin/earnings${queryString(params)}`);
}

export async function getAdminSettlementDetails(id: string) {
  return apiRequest<any>(`/admin/settlements/${id}`);
}

export async function verifyAdminSettlement(id: string) {
  return apiRequest<OwnerMonthlySettlement>(`/admin/settlements/${id}/verify`, { method: "PATCH" });
}

export async function rejectAdminSettlement(id: string, reason: string) {
  return apiRequest<OwnerMonthlySettlement>(`/admin/settlements/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

export async function recalculateAdminSettlements(payload: { month: number; year: number; force?: boolean }) {
  return apiRequest<{ count: number }>("/admin/settlements/recalculate", { method: "POST", body: JSON.stringify(payload) });
}

export async function getAdminActivity(params: Record<string, string | number | undefined>) {
  return apiRequest<ActivityListResponse>(`/admin/activity${queryString(params)}`);
}

export async function getAdminActivitySummary() {
  return apiRequest<ActivitySummary>("/admin/activity/summary");
}

export async function getAdminUsers() {
  return apiRequest<AuthUser[]>("/admin/users");
}

export async function getAdminUserStats() {
  return apiRequest<AdminUserStats>("/admin/users/stats");
}

export async function createAdminUser(payload: { name: string; email: string; password: string; role: UserRole }) {
  return apiRequest<AuthUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getAdminOwners() {
  return apiRequest<AuthUser[]>("/admin/owners");
}

export async function getAdminCourts() {
  return apiRequest<Court[]>("/admin/courts");
}

export async function getAdminCourtDetails(id: string) {
  return apiRequest<AdminCourtDetails>(`/admin/courts/${id}/details`);
}

export async function getAdminBookings() {
  return apiRequest<Booking[]>("/admin/bookings");
}

export async function getAdminPayments() {
  return apiRequest<Payment[]>("/admin/payments");
}

export async function getAdminRefunds() {
  return apiRequest<unknown[]>("/admin/refunds");
}

export async function getAdminAuditLogs() {
  return apiRequest<unknown[]>("/admin/audit-logs");
}

export async function approveAdminCourt(id: string) {
  return apiRequest<Court>(`/admin/courts/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({})
  });
}

export async function updateAdminCourtUpi(id: string, payload: FormData) {
  return apiRequest<Court>(`/admin/courts/${id}/upi`, { method: "PATCH", body: payload });
}

export async function rejectAdminCourt(id: string, reason: string) {
  return apiRequest<Court>(`/admin/courts/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason })
  });
}

export async function deleteAdminUser(id: string) {
  return apiRequest(`/admin/users/${id}`, { method: "DELETE" });
}

export async function deleteAdminOwner(id: string) {
  return apiRequest(`/admin/owners/${id}`, { method: "DELETE" });
}

export async function deleteAdminCourt(id: string) {
  return apiRequest(`/admin/courts/${id}`, { method: "DELETE" });
}

export async function resetAdminUserPassword(id: string, newPassword: string) {
  return apiRequest(`/admin/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ newPassword })
  });
}

export async function recordWebsiteEntered(path: string) {
  return apiRequest("/activity/enter", { method: "POST", body: JSON.stringify({ path }) });
}

export async function trackActivity(payload: { action: string; entity: string; entityId?: string; metadata?: Record<string, unknown> }) {
  return apiRequest("/activity/track", { method: "POST", body: JSON.stringify(payload) });
}
