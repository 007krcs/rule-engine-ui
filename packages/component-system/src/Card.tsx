import type { ReactNode } from 'react';
import styles from './Card.module.css';

export type CardVariant = 'elevated' | 'outline' | 'subtle';

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
}

export function Card({
  title,
  description,
  actions,
  footer,
  children,
  variant = 'elevated',
  className,
}: CardProps) {
  return (
    <section
      className={[
        styles.card,
        variant === 'outline' ? styles.outline : variant === 'subtle' ? styles.subtle : styles.elevated,
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {title || description || actions ? (
        <header className={styles.header}>
          <div>
            {title ? <h3 className={styles.title}>{title}</h3> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </section>
  );
}
