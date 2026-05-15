import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Gift,
  Home,
  LockKeyhole,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users
} from "lucide-react";
import type { DashboardMenuItem } from "./dashboardMenuTypes";

export const adminMenu: DashboardMenuItem[] = [
  {
    title: "Overview",
    icon: Home,
    children: [
      { title: "Platform Dashboard", href: "/admin/dashboard" },
      { title: "Total Users", href: "/admin/dashboard/users" },
      { title: "Total Owners", href: "/admin/dashboard/owners" },
      { title: "Total Courts", href: "/admin/dashboard/courts" },
      { title: "Total Revenue", href: "/admin/dashboard/revenue" }
    ]
  },
  {
    title: "User Management",
    icon: Users,
    children: [
      { title: "All Users", href: "/admin/users" },
      { title: "Active Users", href: "/admin/users/active" },
      { title: "Blocked Users", href: "/admin/users/blocked" },
      { title: "User Booking History", href: "/admin/users/booking-history" }
    ]
  },
  {
    title: "Owner Management",
    icon: Building2,
    children: [
      { title: "All Owners", href: "/admin/owners" },
      { title: "Pending Owner Approvals", href: "/admin/owners/pending" },
      { title: "Approved Owners", href: "/admin/owners/approved" },
      { title: "Rejected Owners", href: "/admin/owners/rejected" },
      { title: "Owner Verification Documents", href: "/admin/owners/verification-documents" }
    ]
  },
  {
    title: "Court Management",
    icon: TicketCheck,
    children: [
      { title: "All Courts", href: "/admin/courts" },
      { title: "Pending Court Approvals", href: "/admin/courts/pending" },
      { title: "Approved Courts", href: "/admin/courts/approved" },
      { title: "Rejected Courts", href: "/admin/courts/rejected" },
      { title: "Court Reports", href: "/admin/courts/reports" }
    ]
  },
  {
    title: "Booking Management",
    icon: ShieldCheck,
    children: [
      { title: "All Bookings", href: "/admin/bookings" },
      { title: "Pending Bookings", href: "/admin/bookings/pending" },
      { title: "Confirmed Bookings", href: "/admin/bookings/confirmed" },
      { title: "Cancelled Bookings", href: "/admin/bookings/cancelled" },
      { title: "Disputed Bookings", href: "/admin/bookings/disputed" }
    ]
  },
  {
    title: "Payments",
    icon: CreditCard,
    children: [
      { title: "All Transactions", href: "/admin/payments/transactions" },
      { title: "Settlement Details", href: "/admin/payments/settlements" },
      { title: "Owner Payouts", href: "/admin/payments/payouts" },
      { title: "Refund Requests", href: "/admin/payments/refunds" },
      { title: "Failed Payments", href: "/admin/payments/failed" },
      { title: "Commission Reports", href: "/admin/payments/commission-reports" }
    ]
  },
  {
    title: "Offers & Promotions",
    icon: Gift,
    children: [
      { title: "Platform Coupons", href: "/admin/promotions/coupons" },
      { title: "Featured Courts", href: "/admin/promotions/featured-courts" },
      { title: "Banner Management", href: "/admin/promotions/banners" },
      { title: "Campaign Management", href: "/admin/promotions/campaigns" }
    ]
  },
  {
    title: "Reviews & Complaints",
    icon: MessageSquareWarning,
    children: [
      { title: "User Reviews", href: "/admin/reviews/user-reviews" },
      { title: "Court Ratings", href: "/admin/reviews/court-ratings" },
      { title: "Reported Reviews", href: "/admin/reviews/reported" },
      { title: "Complaint Tickets", href: "/admin/reviews/complaints" }
    ]
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    children: [
      { title: "Revenue Analytics", href: "/admin/reports/revenue" },
      { title: "Booking Analytics", href: "/admin/reports/bookings" },
      { title: "User Growth", href: "/admin/reports/user-growth" },
      { title: "Owner Growth", href: "/admin/reports/owner-growth" },
      { title: "Export Reports", href: "/admin/reports/export" }
    ]
  },
  {
    title: "Notifications",
    icon: Bell,
    children: [
      { title: "Send Notification", href: "/admin/notifications/send" },
      { title: "Email Notifications", href: "/admin/notifications/email" },
      { title: "SMS Notifications", href: "/admin/notifications/sms" },
      { title: "WhatsApp Notifications", href: "/admin/notifications/whatsapp" }
    ]
  },
  {
    title: "Security",
    icon: LockKeyhole,
    children: [
      { title: "Admin Roles", href: "/admin/security/roles" },
      { title: "Permissions", href: "/admin/security/permissions" },
      { title: "Login Activity", href: "/admin/activity" },
      { title: "Audit Logs", href: "/admin/audit-logs" }
    ]
  },
  {
    title: "Settings",
    icon: Settings,
    children: [
      { title: "Platform Settings", href: "/admin/settings" },
      { title: "Payment Settings", href: "/admin/settings/payment" },
      { title: "Commission Settings", href: "/admin/settings/commission" },
      { title: "Support Settings", href: "/admin/settings/support" },
      { title: "Logout", href: "/logout" }
    ]
  }
];
