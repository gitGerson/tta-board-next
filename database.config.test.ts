// @vitest-environment node

import { describe, expect, it } from "vitest";
import { databaseConnectionString } from "./database.config";

describe("databaseConnectionString", () => {
  it("builds a local PostgreSQL connection and escapes credentials", () => {
    expect(
      databaseConnectionString({
        DB_HOST: "localhost",
        DB_PORT: "5432",
        DB_NAME: "tta_board",
        DB_USER: "local user",
        DB_PASSWORD: "p@ss/word",
        DB_SCHEMA: "public",
      }),
    ).toBe(
      "postgresql://local%20user:p%40ss%2Fword@localhost:5432/tta_board?schema=public",
    );
  });

  it("rejects an invalid local port", () => {
    expect(() =>
      databaseConnectionString({
        DB_PORT: "invalid",
        DB_NAME: "tta_board",
        DB_USER: "tta_board",
        DB_PASSWORD: "secret",
      }),
    ).toThrow("DB_PORT must be an integer");
  });

  it("supports trusted local PostgreSQL without a password", () => {
    expect(
      databaseConnectionString({
        DB_NAME: "tta_board",
        DB_USER: "postgres",
      }),
    ).toBe("postgresql://postgres@127.0.0.1:5432/tta_board?schema=public");
  });
});
