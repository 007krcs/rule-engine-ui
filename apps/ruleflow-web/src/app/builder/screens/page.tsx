import Link from "next/link";
import styles from "./screens.module.scss";

const nav = [
  { href: "/builder/screens", label: "Screens" },
  { href: "/builder/flow", label: "Flow" },
  { href: "/builder/rules", label: "Rules" },
  { href: "/builder/api-mappings", label: "API Mappings" },
  { href: "/builder/legacy", label: "Legacy Builder" },
];

export default function ScreensPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.banner}>NEW BUILDER SHELL ✅</div>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Workspace</p>
          <h1 className={styles.title}>Screens</h1>
          <p className={styles.subtitle}>Design screens here (canvas comes next).</p>
        </div>
      </header>

      <nav className={styles.subnav} aria-label="Builder navigation">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className={styles.subnavLink}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className={styles.placeholder}>
        <p>This is the new builder shell workspace landing page.</p>
      </section>
    </div>
  );
}
