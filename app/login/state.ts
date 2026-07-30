export type LoginState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: {
    username?: string[];
    password?: string[];
  };
};

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };
