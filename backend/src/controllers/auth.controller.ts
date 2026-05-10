import { loginSchema, signupSchema } from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { AUDIT_ACTIONS, createAuditLog } from "../utils/audit.js";
import { AppError } from "../middleware/error.middleware.js";

export const signup = async (req: any, res: any) => {
  const input = signupSchema.parse(req.body);
  if (input.role === "ADMIN") {
    await createAuditLog({
      action: AUDIT_ACTIONS.PUBLIC_ADMIN_SIGNUP_BLOCKED,
      entity: "auth",
      metadata: {
        targetEmail: input.email,
        targetRole: input.role
      },
      req
    });
    throw new AppError("Admin signup is not allowed", 403);
  }

  const data = await authService.signup(input);
  res.status(201).json({ success: true, message: "Signup successful", data });
};

export const login = async (req: any, res: any) => {
  const input = loginSchema.parse(req.body);
  const data = await authService.login(input);
  const action =
    data.user.role === "ADMIN"
      ? AUDIT_ACTIONS.ADMIN_LOGIN
      : data.user.role === "OWNER"
        ? AUDIT_ACTIONS.OWNER_LOGIN
        : AUDIT_ACTIONS.USER_LOGIN;

  await createAuditLog({
    userId: data.user.id,
    action,
    entity: "auth",
    entityId: data.user.id,
    metadata: { email: data.user.email, role: data.user.role, loginPortal: input.expectedRole },
    req
  });
  res.json({ success: true, message: "Login successful", data });
};

export const logout = async (req: any, res: any) => {
  if (req.user?.id) {
    await createAuditLog({ userId: req.user.id, action: AUDIT_ACTIONS.USER_LOGOUT, entity: "auth", entityId: req.user.id, req });
  }
  res.json({ success: true, message: "Logout successful", data: {} });
};
