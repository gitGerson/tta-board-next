type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_SCHEMA?: string;
};

function required(
  environment: DatabaseEnvironment,
  key: "DB_NAME" | "DB_USER",
): string {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}

export function databaseConnectionString(
  environment: DatabaseEnvironment = process.env,
): string {
  const host = environment.DB_HOST?.trim() || "127.0.0.1";
  const port = Number(environment.DB_PORT || 5432);
  const database = required(environment, "DB_NAME");
  const user = required(environment, "DB_USER");
  const password = environment.DB_PASSWORD?.trim();
  const schema = environment.DB_SCHEMA?.trim() || "public";

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535.");
  }

  const credentials = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);

  return [
    `postgresql://${credentials}`,
    `@${host}:${port}/${encodeURIComponent(database)}`,
    `?schema=${encodeURIComponent(schema)}`,
  ].join("");
}
