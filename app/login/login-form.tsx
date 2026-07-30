"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";
import { INITIAL_LOGIN_STATE } from "./state";
import styles from "./login.module.css";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.3 9 5.3a15 15 0 01-2.2 2.8M6.6 6.6C4.3 8 3 10 3 10s3.5 6 9 6a9.8 9.8 0 003.4-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.submit} type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          Signing in…
        </>
      ) : (
        "Login"
      )}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, INITIAL_LOGIN_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const messageId = useId();
  const usernameErrorId = useId();
  const passwordErrorId = useId();

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message && (
        <div
          id={messageId}
          className={styles.alert}
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="username">Username</label>
        <input
          className={state.fieldErrors?.username ? styles.inputError : ""}
          id="username"
          name="username"
          type="text"
          placeholder="Enter your username"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(state.fieldErrors?.username)}
          aria-describedby={
            state.fieldErrors?.username ? usernameErrorId : undefined
          }
        />
        {state.fieldErrors?.username && (
          <p id={usernameErrorId} className={styles.fieldError}>
            {state.fieldErrors.username[0]}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <div
          className={`${styles.passwordField} ${
            state.fieldErrors?.password ? styles.inputError : ""
          }`}
        >
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="············"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={
              state.fieldErrors?.password ? passwordErrorId : undefined
            }
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            <EyeIcon hidden={!showPassword} />
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p id={passwordErrorId} className={styles.fieldError}>
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <label className={styles.remember}>
        <input type="checkbox" name="remember" />
        <span>Remember Me</span>
      </label>

      <SubmitButton />
    </form>
  );
}
