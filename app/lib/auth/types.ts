export type SessionUser = {
  id: string;
  username: string;
  name: string;
  email: string;
};

export type SessionPayload = {
  user: SessionUser;
  expiresAt: string;
};
