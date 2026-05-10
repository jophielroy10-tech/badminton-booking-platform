export const mobileValidationMessage = "Please enter a valid mobile number.";

export function normalizeMobileInput(value: string) {
  return value.replace(/\s+/g, "");
}

export function isValidIndianMobile(value: string) {
  return /^(\+91)?[6-9]\d{9}$/.test(normalizeMobileInput(value));
}
