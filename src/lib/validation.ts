import { z } from "zod";

// Auth validation schemas
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" }),
});

export const signUpSchema = authSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Admin login validation
export const adminLoginSchema = authSchema;

// Admin registration validation
export const adminRegisterSchema = authSchema.extend({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" }),
  note: z
    .string()
    .max(1000, { message: "Note must be less than 1000 characters" })
    .optional(),
});

export type AuthFormData = z.infer<typeof authSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;
export type AdminRegisterFormData = z.infer<typeof adminRegisterSchema>;
