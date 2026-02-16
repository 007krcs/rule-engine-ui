import { useEffect, useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn, intentClass, sizeClass, type PFBaseProps, type PFIntent } from './utils';

export interface PFAlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, PFBaseProps {
  intent?: Exclude<PFIntent, 'secondary'>;
  title?: ReactNode;
  action?: ReactNode;
}

export function PFAlert({
  className,
  intent = 'neutral',
  title,
  action,
  children,
  ...rest
}: PFAlertProps) {
  return (
    <div className={cn('pf-alert', intentClass('pf-alert', intent), className)} role="alert" {...rest}>
      <div className="pf-alert__body">
        {title ? <strong className="pf-alert__title">{title}</strong> : null}
        <div className="pf-alert__content">{children}</div>
      </div>
      {action ? <div className="pf-alert__action">{action}</div> : null}
    </div>
  );
}

export interface PFBackdropProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClick?: () => void;
}

export function PFBackdrop({ open, className, onClick, ...rest }: PFBackdropProps) {
  if (!open) return null;
  return <div className={cn('pf-backdrop', className)} onClick={onClick} aria-hidden="true" {...rest} />;
}

export interface PFDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  actions?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdropClick?: boolean;
}

export function PFDialog({
  open,
  onClose,
  title,
  actions,
  children,
  className,
  size = 'md',
  closeOnBackdropClick = true,
  ...rest
}: PFDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pf-dialog-root">
      <PFBackdrop
        open
        onClick={() => {
          if (closeOnBackdropClick) onClose?.();
        }}
      />
      <section
        className={cn('pf-dialog', `pf-dialog--${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        {...rest}
      >
        {title ? <PFDialogHeader id={titleId}>{title}</PFDialogHeader> : null}
        <PFDialogBody>{children}</PFDialogBody>
        {actions ? <PFDialogActions>{actions}</PFDialogActions> : null}
      </section>
    </div>
  );
}

export type PFDialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export function PFDialogHeader({ className, ...rest }: PFDialogHeaderProps) {
  return <header className={cn('pf-dialog__header', className)} {...rest} />;
}

export type PFDialogBodyProps = HTMLAttributes<HTMLDivElement>;

export function PFDialogBody({ className, ...rest }: PFDialogBodyProps) {
  return <div className={cn('pf-dialog__body', className)} {...rest} />;
}

export type PFDialogActionsProps = HTMLAttributes<HTMLDivElement>;

export function PFDialogActions({ className, ...rest }: PFDialogActionsProps) {
  return <footer className={cn('pf-dialog__actions', className)} {...rest} />;
}

export interface PFProgressProps extends PFBaseProps, HTMLAttributes<HTMLDivElement> {
  variant?: 'linear' | 'circular';
  value?: number;
  indeterminate?: boolean;
}

export function PFProgress({
  variant = 'linear',
  value = 0,
  indeterminate = false,
  className,
  size = 'md',
  ...rest
}: PFProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  if (variant === 'circular') {
    const radius = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
    const stroke = size === 'sm' ? 3 : 4;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div className={cn('pf-progress-circular', indeterminate && 'is-indeterminate', className)} {...rest}>
        <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            strokeWidth={stroke}
            className="pf-progress-circular__track"
          />
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            strokeWidth={stroke}
            className="pf-progress-circular__value"
            strokeDasharray={circumference}
            strokeDashoffset={indeterminate ? undefined : offset}
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn('pf-progress', sizeClass(size), indeterminate && 'is-indeterminate', className)}
      role="progressbar"
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : clampedValue}
      {...rest}
    >
      <span className="pf-progress__bar" style={{ width: indeterminate ? undefined : `${clampedValue}%` }} />
    </div>
  );
}

export interface PFSkeletonProps extends PFBaseProps, HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'rounded' | 'circular';
  width?: number | string;
  height?: number | string;
  animated?: boolean;
}

export function PFSkeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animated = true,
  ...rest
}: PFSkeletonProps) {
  return (
    <span
      className={cn('pf-skeleton', `pf-skeleton--${variant}`, animated && 'is-animated', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export interface PFSnackbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  message: ReactNode;
  action?: ReactNode;
  autoHideDuration?: number;
  intent?: Exclude<PFIntent, 'secondary'>;
}

export function PFSnackbar({
  open,
  onClose,
  title,
  message,
  action,
  autoHideDuration = 4000,
  intent = 'neutral',
  className,
  ...rest
}: PFSnackbarProps) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, autoHideDuration);
    return () => clearTimeout(timeout);
  }, [autoHideDuration, onClose, visible]);

  if (!visible) return null;

  return (
    <div className={cn('pf-snackbar', intentClass('pf-snackbar', intent), className)} role="status" {...rest}>
      <div className="pf-snackbar__message">
        {title ? <strong className="pf-snackbar__title">{title}</strong> : null}
        <span>{message}</span>
      </div>
      {action ? <div className="pf-snackbar__action">{action}</div> : null}
    </div>
  );
}

export interface PFTooltipProps extends PFBaseProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function PFTooltip({
  content,
  children,
  className,
  placement = 'top',
}: PFTooltipProps) {
  const tooltipId = useId();
  return (
    <span className={cn('pf-tooltip', `pf-tooltip--${placement}`, className)}>
      <span className="pf-tooltip__trigger" tabIndex={0} aria-describedby={tooltipId}>
        {children}
      </span>
      <span role="tooltip" className="pf-tooltip__content" id={tooltipId}>
        {content}
      </span>
    </span>
  );
}
