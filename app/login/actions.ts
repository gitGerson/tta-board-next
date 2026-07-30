"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticateLdap,
  LdapAuthenticationError,
} from "@/app/lib/auth/ldap";
import {
  clearLoginFailures,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/app/lib/auth/rate-limit";
import { createSession } from "@/app/lib/auth/session";
import { loginSchema } from "@/app/lib/auth/validation";
import { syncDirectoryUser } from "@/app/lib/dal/users";
import type { LoginState } from "./state";

async function clientAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      fieldErrors: {
        username: fieldErrors.username,
        password: fieldErrors.password,
      },
    };
  }

  const { username, password, remember } = parsed.data;
  const limiterKey = `${(await clientAddress()).toLowerCase()}:${username.toLowerCase()}`;

  if (isLoginRateLimited(limiterKey)) {
    return {
      status: "error",
      message: "Too many login attempts. Please wait one minute and try again.",
    };
  }

  try {
    const directoryUser = await authenticateLdap(username, password);
    const localUser = await syncDirectoryUser(directoryUser);
    await createSession(localUser, remember);
    clearLoginFailures(limiterKey);
  } catch (error) {
    if (
      error instanceof LdapAuthenticationError &&
      error.code === "invalid_credentials"
    ) {
      recordLoginFailure(limiterKey);

      return {
        status: "error",
        message: "The username or password is invalid.",
      };
    }

    if (error instanceof LdapAuthenticationError) {
      return {
        status: "error",
        message: "Whoops! LDAP server cannot be reached.",
      };
    }

    return {
      status: "error",
      message: "Whoops! Sign-in service is unavailable.",
    };
  }

  redirect("/");
}
