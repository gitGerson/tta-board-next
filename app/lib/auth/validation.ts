import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required.")
    .max(255, "Username must not exceed 255 characters."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(1024, "Password is too long."),
  remember: z.boolean(),
});

export type LoginCredentials = z.infer<typeof loginSchema>;
