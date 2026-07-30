// @vitest-environment node

import { InvalidCredentialsError, type ClientOptions } from "ldapts";
import { describe, expect, it, vi } from "vitest";
import {
  authenticateLdap,
  LdapAuthenticationError,
  mapLdapEntry,
  readLdapConfig,
  type LdapClient,
} from "./ldap";

const environment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  LDAP_URL: "ldaps://ldap.example.com:636",
  LDAP_BIND_DN: "cn=readonly,dc=example,dc=com",
  LDAP_BIND_PASSWORD: "service-secret",
  LDAP_BASE_DN: "ou=Users,dc=example,dc=com",
};

function clientWithEntries(entries: Record<string, unknown>[]) {
  return {
    bind: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue({ searchEntries: entries }),
    unbind: vi.fn().mockResolvedValue(undefined),
  } as unknown as LdapClient;
}

describe("LDAP authentication service", () => {
  it("maps the reference LDAP attributes and fallbacks", () => {
    const config = readLdapConfig(environment);

    expect(
      mapLdapEntry(
        {
          dn: "uid=jdoe,ou=Users,dc=example,dc=com",
          uid: "jdoe",
          cn: "Jane Doe",
          mail: "jane@example.com",
          entryUUID: "guid-1",
        },
        "fallback",
        config,
      ),
    ).toEqual({
      id: "guid-1",
      username: "jdoe",
      name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("service-binds, searches, user-binds, and always unbinds", async () => {
    const client = clientWithEntries([
      {
        dn: "uid=jdoe,ou=Users,dc=example,dc=com",
        uid: "jdoe",
        cn: "Jane Doe",
        mail: "jane@example.com",
        entryUUID: "guid-1",
      },
    ]);

    await expect(
      authenticateLdap("jdoe", "secret", {
        environment,
        createClient: () => client,
      }),
    ).resolves.toMatchObject({ username: "jdoe", id: "guid-1" });

    expect(client.bind).toHaveBeenNthCalledWith(
      1,
      environment.LDAP_BIND_DN,
      environment.LDAP_BIND_PASSWORD,
    );
    expect(client.bind).toHaveBeenNthCalledWith(
      2,
      "uid=jdoe,ou=Users,dc=example,dc=com",
      "secret",
    );
    expect(client.unbind).toHaveBeenCalledOnce();
  });

  it("does not enable a TLS socket for a plain LDAP test server", async () => {
    const client = clientWithEntries([]);
    let clientOptions: ClientOptions | undefined;

    await expect(
      authenticateLdap("jdoe", "secret", {
        environment: {
          ...environment,
          LDAP_URL: "ldap://ldap.example.com:389",
          LDAP_ALLOW_INSECURE: "true",
        },
        createClient: (options) => {
          clientOptions = options;
          return client;
        },
      }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });

    expect(clientOptions?.tlsOptions).toBeUndefined();
  });

  it.each([[[]], [[{ dn: "one" }, { dn: "two" }]]])(
    "rejects missing or ambiguous directory entries",
    async (entries) => {
      const client = clientWithEntries(entries);

      await expect(
        authenticateLdap("jdoe", "secret", {
          environment,
          createClient: () => client,
        }),
      ).rejects.toMatchObject({ code: "invalid_credentials" });
      expect(client.unbind).toHaveBeenCalledOnce();
    },
  );

  it("classifies an invalid user bind without leaking the account", async () => {
    const client = clientWithEntries([
      { dn: "uid=jdoe,dc=example,dc=com", uid: "jdoe" },
    ]);
    vi.mocked(client.bind)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new InvalidCredentialsError());

    await expect(
      authenticateLdap("jdoe", "wrong", {
        environment,
        createClient: () => client,
      }),
    ).rejects.toMatchObject({
      code: "invalid_credentials",
      name: LdapAuthenticationError.name,
    });
  });

  it("classifies service or transport failures as unavailable", async () => {
    const client = clientWithEntries([]);
    vi.mocked(client.bind).mockRejectedValueOnce(new Error("offline"));

    await expect(
      authenticateLdap("jdoe", "secret", {
        environment,
        createClient: () => client,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(client.unbind).toHaveBeenCalledOnce();
  });

  it("requires an explicit opt-in for plain LDAP in production", () => {
    expect(() =>
      readLdapConfig({
        ...environment,
        NODE_ENV: "production",
        LDAP_URL: "ldap://ldap.example.com:389",
      }),
    ).toThrow("LDAP_ALLOW_INSECURE=true");

    expect(
      readLdapConfig({
        ...environment,
        NODE_ENV: "production",
        LDAP_URL: "ldap://ldap.example.com:389",
        LDAP_ALLOW_INSECURE: "true",
      }).url,
    ).toBe("ldap://ldap.example.com:389");
  });

  it("requires an explicit opt-in for plain LDAP during development", () => {
    expect(() =>
      readLdapConfig({
        ...environment,
        NODE_ENV: "development",
        LDAP_URL: "ldap://ldap.example.com:389",
      }),
    ).toThrow("LDAP_ALLOW_INSECURE=true");
  });
});
