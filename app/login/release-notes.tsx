import { Fragment } from "react";
import styles from "./login.module.css";

type Release = {
  version: string;
  title: string;
  date: string;
  icon: string;
  /** Backtick-wrapped segments render as inline <code>. */
  items: string[];
  latest?: boolean;
};

const releases: Release[] = [
  {
    version: "1.0.0",
    title: "Initial Release",
    date: "Aug 2025",
    icon: "📦",
    items: [
      "Sneat Admin Template integration",
      "LDAP Authentication integration",
      "User & Role Management System",
      "Role-Based Access Control (RBAC)",
      "Audit Trail implementation",
      "DataTables with server-side processing",
      "Mobile UI layout",
    ],
  },
  {
    version: "1.1.0",
    title: "CRUD & Form Components",
    date: "Nov 2025 – Jan 2026",
    icon: "🚀",
    items: [
      "Category & Product CRUD modules",
      "Dark theme styles for menu active states",
      "Employee management with JPayroll sync",
      "ESB product sync example",
      "Custom error pages",
      "Timezone & role template improvements",
      "Navbar autofocus & modal improvements",
    ],
  },
  {
    version: "1.2.0",
    title: "Reusable Components & RBAC",
    date: "Apr 2026",
    icon: "🧩",
    items: [
      "Reusable Blade form components",
      "Rich editor, date picker & daterangepicker modes",
      "Generic FilePond upload with existing-file preload",
      "Sidebar & navbar search driven by config menu",
      "Hashid route binding for core web modules",
      "Reusable DataTable Blade components",
      "Vite-backed Sneat layout assets",
      "RBAC permission catalog moved to config",
      "Auditable trait for model-layer activity logging",
      "Permission update artisan command",
      "Fix: user dropdown menu, role count columns & permissions",
      "Fix: LDAP user creation flow improved",
      "Fix: product validation moved to model/request rules",
    ],
  },
  {
    version: "1.3.0",
    title: "Tables, Forms & DevTools",
    date: "May – Jun 2026",
    icon: "📊",
    items: [
      "Config-driven DataTable components",
      "Reusable Tabulator table engine with inline CRUD demo",
      "Tabulator engine expanded & backend renamed to `App\\Tables`",
      "Date picker auto-apply option",
      "Select2-enhanced multiple & searchable select",
      "FilePond self-hosted via npm",
      "Rich editor: StarterKit duplicate extension fix",
      "Seeded super admin env configuration",
      "Fix: search engine indexing disabled (robots.txt & noindex headers)",
      "Fix: CI/CD pipeline",
      "Debugbar support for development",
      "Docs consolidated into `docs/` with unified index",
    ],
  },
  {
    version: process.env.APP_VERSION || "1.4.0",
    title: "Latest",
    date: "Jun 2026",
    icon: "✨",
    latest: true,
    items: [
      "Dynamic app version via `config('app.version')`",
      "Dynamic `APP_NAME` across all views (footer, mobile, notification)",
      "Dynamic superadmin credentials via env variables",
      "PermissionSyncService cleanup & DatabaseSeeder refactor",
    ],
  },
];

function ReleaseItem({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((segment, index) =>
        index % 2 === 1 ? (
          <code key={index}>{segment}</code>
        ) : (
          <Fragment key={index}>{segment}</Fragment>
        ),
      )}
    </>
  );
}

export function ReleaseNotes() {
  return (
    <details className={styles.releasePanel}>
      <summary className={styles.releaseButton}>
        Version Release Notes &amp; Updates
      </summary>
      <div className={styles.releaseList}>
        {releases.map((release, index) => (
          <article
            className={styles.release}
            style={{ "--delay": `${index * 0.05}s` } as React.CSSProperties}
            key={release.version}
          >
            <span className={styles.releaseIcon} aria-hidden="true">
              {release.icon}
            </span>
            <details open={release.latest}>
              <summary>
                <span>
                  v{release.version} —{" "}
                  <strong className={release.latest ? styles.latest : ""}>
                    {release.title}
                  </strong>{" "}
                  <small>({release.date})</small>
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </summary>
              <ul>
                {release.items.map((item) => (
                  <li key={item}>
                    {release.latest ? (
                      <>
                        <span className={styles.newBadge}>✅ NEW</span>{" "}
                      </>
                    ) : null}
                    <ReleaseItem text={item} />
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </details>
  );
}
