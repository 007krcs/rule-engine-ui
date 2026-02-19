"use client";

import Link from "next/link";
import { useState } from "react";
import type { UISchema } from "@platform/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBuilder } from "@/context/BuilderContext";
import styles from "./screens.module.scss";

const nav = [
  { href: "/builder/screens", label: "Screens" },
  { href: "/builder/flow", label: "Flow" },
  { href: "/builder/rules", label: "Rules" },
  { href: "/builder/api-mappings", label: "API Mappings" },
  { href: "/builder/legacy", label: "Legacy Builder" },
];

function createDefaultScreen(id: string): UISchema {
  return {
    version: "1.0.0",
    pageId: id,
    layout: { type: "vertical", children: [] },
  };
}

export default function ScreensPage() {
  const {
    state: { screens, flow },
    dispatch,
  } = useBuilder();
  const [newId, setNewId] = useState("");

  const addScreen = () => {
    const id = (newId || `screen-${Object.keys(screens).length + 1}`).trim();
    if (!id || screens[id]) return;
    dispatch({ type: "ADD_SCREEN", id, schema: createDefaultScreen(id) });
    setNewId("");
  };

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
        <div className={styles.addRow}>
          <Input
            placeholder="new-screen-id"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            data-testid="screens-add-input"
          />
          <Button size="sm" onClick={addScreen} data-testid="screens-add-btn">
            Add
          </Button>
        </div>

        <div className={styles.screenGrid}>
          {Object.entries(screens).length === 0 ? <p className={styles.empty}>No screens yet</p> : null}
          {Object.entries(screens).map(([id]) => (
            <div key={id} className={styles.screenCard}>
              <div>
                <p className={styles.kicker}>Screen</p>
                <h3 className={styles.cardTitle}>{id}</h3>
                <p className={styles.subtext}>Initial? {flow.initialState === id ? "Yes" : "No"}</p>
              </div>
              <Link href={`/builder/screens?screenId=${encodeURIComponent(id)}`} className={styles.link}>
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
