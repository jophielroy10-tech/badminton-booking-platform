import { otpSendSchema, otpVerifySchema } from "../validators/booking.validator.js";
import * as otpService from "../services/otp.service.js";

export const sendOtp = async (req: any, res: any) => {
  const input = otpSendSchema.parse(req.body);
  const data = await otpService.sendOtp(input.email, input.purpose);
  res.json({ success: true, message: "OTP sent successfully", data });
};

export const verifyOtp = async (req: any, res: any) => {
  const input = otpVerifySchema.parse(req.body);
  const data = await otpService.verifyOtp(input.email, input.purpose, input.otp);
  res.json({ success: true, message: "OTP verified successfully", data });
};
