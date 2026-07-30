import "server-only";

import {
  Client,
  EqualityFilter,
  InvalidCredentialsError,
  type ClientOptions,
  type Entry,
  type SearchOptions,
  type SearchResult,
} from "ldapts";
import type { DirectoryUser } from "./types";

export type LdapClient = {
  bind(dn: string, password?: string): Promise<void>;
  search(baseDN: string, options: SearchOptions): Promise<SearchResult>;
  unbind(): Promise<void>;
};

export type LdapClientFactory = (options: ClientOptions) => LdapClient;

export class LdapAuthenticationError extends Error {
  constructor(
    public readonly code: "invalid_credentials" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "LdapAuthenticationError";
  }
}

type LdapConfig = {
  url: string;
  bindDN: string;
  bindPassword: string;
  baseDN: string;
  userAttribute: string;
  nameAttribute: string;
  emailAttribute: string;
  guidAttribute: string;
  connectTimeout: number;
  rejectUnauthorized: boolean;
};

const attributePattern = /^[a-zA-Z][a-zA-Z0-9-]*$/;

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}

export function readLdapConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LdapConfig {
  const url = required(environment, "LDAP_URL");
  const allowInsecure = environment.LDAP_ALLOW_INSECURE === "true";

  if (!url.startsWith("ldaps://") && !allowInsecure) {
    throw new Error(
      "Plain LDAP requires LDAP_ALLOW_INSECURE=true.",
    );
  }

  const config: LdapConfig = {
    url,
    bindDN: required(environment, "LDAP_BIND_DN"),
    bindPassword: required(environment, "LDAP_BIND_PASSWORD"),
    baseDN: required(environment, "LDAP_BASE_DN"),
    userAttribute: environment.LDAP_USER_ATTRIBUTE?.trim() || "uid",
    nameAttribute: environment.LDAP_NAME_ATTRIBUTE?.trim() || "cn",
    emailAttribute: environment.LDAP_EMAIL_ATTRIBUTE?.trim() || "mail",
    guidAttribute: environment.LDAP_GUID_ATTRIBUTE?.trim() || "entryUUID",
    connectTimeout: Number(environment.LDAP_CONNECT_TIMEOUT_MS || 5000),
    rejectUnauthorized:
      environment.NODE_ENV === "production" ||
      environment.LDAP_TLS_REJECT_UNAUTHORIZED !== "false",
  };

  for (const attribute of [
    config.userAttribute,
    config.nameAttribute,
    config.emailAttribute,
    config.guidAttribute,
  ]) {
    if (!attributePattern.test(attribute)) {
      throw new Error(`Invalid LDAP attribute name: ${attribute}`);
    }
  }

  if (
    !Number.isFinite(config.connectTimeout) ||
    config.connectTimeout < 1 ||
    config.connectTimeout > 60_000
  ) {
    throw new Error("LDAP_CONNECT_TIMEOUT_MS must be between 1 and 60000.");
  }

  return config;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return undefined;
}

export function mapLdapEntry(
  entry: Entry,
  username: string,
  config: Pick<
    LdapConfig,
    "userAttribute" | "nameAttribute" | "emailAttribute" | "guidAttribute"
  >,
): DirectoryUser {
  const mappedUsername = firstString(entry[config.userAttribute]) || username;
  const name =
    firstString(entry[config.nameAttribute]) ||
    firstString(entry.displayName) ||
    mappedUsername;
  const email =
    firstString(entry[config.emailAttribute]) ||
    `${mappedUsername}@tongtji.com`;
  const id = firstString(entry[config.guidAttribute]) || entry.dn;

  return { id, username: mappedUsername, name, email };
}

export async function authenticateLdap(
  username: string,
  password: string,
  dependencies: {
    createClient?: LdapClientFactory;
    environment?: NodeJS.ProcessEnv;
  } = {},
): Promise<DirectoryUser> {
  const createClient =
    dependencies.createClient ||
    ((options: ClientOptions): LdapClient => new Client(options));
  let config: LdapConfig;

  try {
    config = readLdapConfig(dependencies.environment);
  } catch (error) {
    throw new LdapAuthenticationError("unavailable", { cause: error });
  }

  const clientOptions: ClientOptions = {
    url: config.url,
    connectTimeout: config.connectTimeout,
    timeout: config.connectTimeout,
  };

  if (config.url.startsWith("ldaps://")) {
    clientOptions.tlsOptions = {
      minVersion: "TLSv1.2",
      rejectUnauthorized: config.rejectUnauthorized,
    };
  }

  const client = createClient(clientOptions);
  let phase: "service" | "user" = "service";

  try {
    await client.bind(config.bindDN, config.bindPassword);
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: new EqualityFilter({
        attribute: config.userAttribute,
        value: username,
      }),
      attributes: [
        config.userAttribute,
        config.nameAttribute,
        config.emailAttribute,
        config.guidAttribute,
        "displayName",
      ],
      sizeLimit: 2,
      timeLimit: Math.ceil(config.connectTimeout / 1000),
    });

    if (searchEntries.length !== 1) {
      throw new LdapAuthenticationError("invalid_credentials");
    }

    phase = "user";
    await client.bind(searchEntries[0].dn, password);

    return mapLdapEntry(searchEntries[0], username, config);
  } catch (error) {
    if (error instanceof LdapAuthenticationError) {
      throw error;
    }

    if (phase === "user" && error instanceof InvalidCredentialsError) {
      throw new LdapAuthenticationError("invalid_credentials", {
        cause: error,
      });
    }

    throw new LdapAuthenticationError("unavailable", { cause: error });
  } finally {
    try {
      await client.unbind();
    } catch {
      // The connection may already be closed after a transport failure.
    }
  }
}
