"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutProps {
  orderData: {
    bookingId: string;
    paymentId: string;
    razorpayOrderId: string;
    amount: number;
    currency?: string;
    key: string;
  };
  onSuccess: (response: any) => void;
  onFailure?: (error: any) => void;
}

const RAZORPAY_SCRIPT_ID = "razorpay-checkout-js";

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);

  const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    return new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      if (existingScript.dataset.loaded === "true") resolve(Boolean(window.Razorpay));
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve(Boolean(window.Razorpay));
    }, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckout({ orderData, onSuccess, onFailure }: RazorpayCheckoutProps) {
  const openedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    loadRazorpayScript().then((loaded) => {
      if (!mounted) return;
      if (!loaded || !window.Razorpay) {
        toast.error("Razorpay SDK failed to load");
        onFailure?.({ reason: "script_failed" });
        return;
      }
      if (!openedRef.current) {
        openedRef.current = true;
        initializeRazorpay();
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const initializeRazorpay = () => {
    const options = {
      key: orderData.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency || "INR",
      name: "Badminton Court Booking",
      description: "Court slot booking",
      order_id: orderData.razorpayOrderId,
      handler: async function (response: any) {
        try {
          await onSuccess({
            bookingId: orderData.bookingId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        } catch (error) {
          console.error("Payment success handler error:", error);
          toast.error("Payment verification failed");
        }
      },
      prefill: {
        name: "",
        email: "",
        contact: "",
      },
      theme: {
        color: "#2563eb",
      },
      modal: {
        ondismiss: function () {
          toast.error("Payment cancelled by user");
          onFailure?.({ reason: "dismissed" });
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  return null; // This component doesn't render anything
}
