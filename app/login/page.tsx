import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { LoginForm } from "./login-form";
import { ReleaseNotes } from "./release-notes";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }

  const appName = process.env.APP_NAME || "Tong Tji Starter Kit";

  return (
    <main className={styles.page}>
      <div className={styles.background} aria-hidden="true">
        <div className={`${styles.leaf} ${styles.leafOne}`} />
        <div className={`${styles.leaf} ${styles.leafTwo}`} />
        <div className={`${styles.leaf} ${styles.leafThree}`} />
        <div className={`${styles.steam} ${styles.steamOne}`} />
        <div className={`${styles.steam} ${styles.steamTwo}`} />
        <div className={`${styles.steam} ${styles.steamThree}`} />
      </div>

      <section className={styles.info} aria-labelledby="app-title">
        <div className={styles.infoInner}>
          <h1 id="app-title">{appName}</h1>
          <ReleaseNotes />
        </div>
      </section>

      <section className={styles.login} aria-labelledby="login-title">
        <div className={styles.loginInner}>
          <div className={styles.brand}>
            <Image
              src="/appicon.png"
              alt={`${appName} logo`}
              width={80}
              height={80}
              priority
            />
          </div>
          <header className={styles.welcome}>
            <h2 id="login-title">Welcome Back! 👋</h2>
            <p>Please sign-in with your LDAP account</p>
          </header>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
