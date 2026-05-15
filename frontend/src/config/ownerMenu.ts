import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  CreditCard,
  Gift,
  Home,
  Settings,
  TicketCheck,
  Users
} from "lucide-react";
import type { DashboardMenuItem } from "./dashboardMenuTypes";

export const ownerMenu: DashboardMenuItem[] = [
  {
    title: "Overview",
    icon: Home,
    children: [
      { title: "Dashboard Summary", href: "/owner/dashboard" },
      { title: "Revenue Summary", href: "/owner/revenue" },
      { title: "Today Bookings", href: "/owner/bookings/today" }
    ]
  },
  {
    title: "Court Management",
    icon: TicketCheck,
    children: [
      { title: "My Courts", href: "/owner/courts" },
      { title: "Add Court", href: "/owner/courts/add" },
      { title: "Court Images", href: "/owner/courts/images" },
      { title: "Court Amenities", href: "/owner/courts/amenities" },
      { title: "Court Availability", href: "/owner/courts/availability" }
    ]
  },
  {
    title: "Slot Management",
    icon: CalendarDays,
    children: [
      { title: "Slot Calendar", href: "/owner/slots" },
      { title: "Generate Slots", href: "/owner/slots/generate" },
      { title: "Block Slots", href: "/owner/slots/block" },
      { title: "Holiday Slots", href: "/owner/slots/holidays" }
    ]
  },
  {
    title: "Bookings",
    icon: TicketCheck,
    children: [
      { title: "All Bookings", href: "/owner/bookings" },
      { title: "Pending Bookings", href: "/owner/bookings/pending" },
      { title: "Confirmed Bookings", href: "/owner/bookings/confirmed" },
      { title: "Cancelled Bookings", href: "/owner/bookings/cancelled" },
      { title: "Booking OTP Verification", href: "/owner/bookings/otp-verification" }
    ]
  },
  {
    title: "Payments",
    icon: CreditCard,
    children: [
      { title: "Transaction Details", href: "/owner/payments/transactions" },
      { title: "Settlement Details", href: "/owner/payments/settlements" },
      { title: "Refund Details", href: "/owner/payments/refunds" },
      { title: "Payout History", href: "/owner/payments/payouts" },
      { title: "Revenue Reports", href: "/owner/payments/revenue-reports" }
    ]
  },
  {
    title: "Customers",
    icon: Users,
    children: [
      { title: "Customer List", href: "/owner/users" },
      { title: "Customer Booking History", href: "/owner/customers/booking-history" },
      { title: "Customer Feedback", href: "/owner/customers/feedback" }
    ]
  },
  {
    title: "Offers & Pricing",
    icon: Gift,
    children: [
      { title: "Pricing Rules", href: "/owner/offers/pricing-rules" },
      { title: "Discount Coupons", href: "/owner/offers/coupons" },
      { title: "Peak Hour Pricing", href: "/owner/offers/peak-hour-pricing" }
    ]
  },
  {
    title: "Reports",
    icon: BarChart3,
    children: [
      { title: "Booking Reports", href: "/owner/reports/bookings" },
      { title: "Revenue Reports", href: "/owner/reports/revenue" },
      { title: "Court Usage Reports", href: "/owner/reports/court-usage" },
      { title: "Export Reports", href: "/owner/reports/export" }
    ]
  },
  {
    title: "Support",
    icon: CircleHelp,
    children: [
      { title: "Customer Complaints", href: "/owner/support/complaints" },
      { title: "Owner Support Tickets", href: "/owner/support/tickets" },
      { title: "Help Center", href: "/owner/support/help-center" }
    ]
  },
  {
    title: "Settings",
    icon: Settings,
    children: [
      { title: "Profile Settings", href: "/owner/settings" },
      { title: "Business Details", href: "/owner/settings/business" },
      { title: "Bank Details", href: "/owner/settings/bank" },
      { title: "Notification Settings", href: "/owner/settings/notifications" },
      { title: "Logout", href: "/logout" }
    ]
  }
];
