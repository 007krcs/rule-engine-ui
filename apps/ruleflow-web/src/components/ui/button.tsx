import * as React from 'react';
import styles from './button.module.css';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonClassNameInput = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function buttonClassName(input: ButtonClassNameInput = {}): string {
  const variant = input.variant ?? 'default';
  const size = input.size ?? 'md';

  return cn(
    styles.button,
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
    variant === 'secondary'
      ? styles.variantSecondary
      : variant === 'ghost'
        ? styles.variantGhost
        : variant === 'outline'
          ? styles.variantOutline
          : styles.variantDefault,
    input.className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonClassNameInput {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={buttonClassName({ variant, size, className })} {...props} />
  ),
);
Button.displayName = 'Button';

