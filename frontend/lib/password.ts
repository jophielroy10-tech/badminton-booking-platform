export const strongPasswordMessage = "Password must contain uppercase, lowercase, number, and special character.";
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function isStrongPassword(value: string) {
  return strongPasswordRegex.test(value);
}
