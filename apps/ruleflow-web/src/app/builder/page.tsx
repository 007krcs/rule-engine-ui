'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createUISchema } from '@platform/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBuilder } from '@/context/BuilderContext';
import styles from './builder.module.css';

export default function BuilderHomePage() {
  const {
    state: { screens },
    dispatch,
  } = useBuilder();

  const [newScreenId, setNewScreenId] = useState('');
  const screenEntries = useMemo(() => Object.entries(screens), [screens]);

  const addScreen = () => {
    const id = newScreenId.trim() || `screen-${screenEntries.length + 1}`;
    if (screens[id]) return;
    dispatch({ type: 'ADD_SCREEN', id, schema: createUISchema({ pageId: id }) });
    setNewScreenId('');
  };

  return (
    <div className={styles.builderHome}>
      <header className={styles.homeHeader}>
        <div>
          <p className={styles.kicker}>Builder Console</p>
          <h1 className={styles.title}>Project Overview</h1>
          <p className={styles.subtitle}>Screens, flow, and rules now share one centralized state.</p>
        </div>
        <div className={styles.navLinks}>
          <Link href="/builder/screens">Open Screens</Link>
          <Link href="/builder/flow">Open Flow</Link>
          <Link href="/builder/rules">Open Rules</Link>
        </div>
      </header>

      <div className={styles.grid}>
        <Card>
          <CardHeader>
            <CardTitle>Screens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.addRow}>
              <Input
                placeholder="screen-id"
                value={newScreenId}
                onChange={(e) => setNewScreenId(e.target.value)}
                data-testid="builder-home-new-screen"
              />
              <Button onClick={addScreen} size="sm" data-testid="builder-home-add-screen">
                Add
              </Button>
            </div>
            <ul className={styles.list}>
              {screenEntries.length === 0 ? <li className={styles.empty}>No screens yet</li> : null}
              {screenEntries.map(([id]) => (
                <li key={id} className={styles.listItem}>
                  <span className={styles.screenId}>{id}</span>
                  <Link href={`/builder/screens?screenId=${encodeURIComponent(id)}`} className={styles.link}>
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className={styles.shortcuts}>
            <Link href="/builder/json">JSON Export</Link>
            <Link href="/builder/api-mappings">API Mappings</Link>
            <Link href="/builder/legacy">Legacy Builder</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
