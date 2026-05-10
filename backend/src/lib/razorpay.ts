import Razorpay from "razorpay";

const missingMessage = "Razorpay keys are missing in backend environment variables.";

function readRazorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (
    !keyId ||
    !keySecret ||
    keyId === "rzp_test_dev_key" ||
    keySecret === "rzp_test_dev_secret" ||
    keyId === "rzp_test_your_key_id" ||
    keySecret === "your_razorpay_secret"
  ) {
    throw new Error(missingMessage);
  }

  return { keyId, keySecret };
}

export function getRazorpayClient() {
  const { keyId, keySecret } = readRazorpayKeys();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function getRazorpayKeyId() {
  return readRazorpayKeys().keyId;
}

export function isRazorpayConfigError(error: unknown) {
  return error instanceof Error && error.message === missingMessage;
}
