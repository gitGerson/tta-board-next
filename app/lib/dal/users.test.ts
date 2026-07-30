// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("@/app/lib/db/client", () => ({
  db: { user: { upsert: mocks.upsert } },
}));

import { syncDirectoryUser } from "./users";

describe("syncDirectoryUser", () => {
  beforeEach(() => {
    mocks.upsert.mockReset().mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      username: "jdoe",
      displayName: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("upserts by immutable LDAP GUID and returns a safe local user", async () => {
    const user = await syncDirectoryUser({
      id: "ldap-guid-1",
      username: " JDOE ",
      name: "Jane Doe",
      email: "JANE@EXAMPLE.COM",
    });

    expect(user).toEqual({
      id: "10000000-0000-4000-8000-000000000001",
      username: "jdoe",
      name: "Jane Doe",
      email: "jane@example.com",
    });
    expect(user).not.toHaveProperty("ldapGuid");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ldapGuid: "ldap-guid-1" },
        update: expect.objectContaining({
          username: "jdoe",
          email: "jane@example.com",
          isActive: true,
          lastLoginAt: expect.any(Date),
        }),
      }),
    );
  });
});
