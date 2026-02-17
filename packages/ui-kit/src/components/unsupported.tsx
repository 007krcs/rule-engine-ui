import type { HTMLAttributes } from 'react';
import { PFButton } from './buttons';
import { PFCard, PFCardContent, PFTypography } from './display';
import { PFStack } from './layout';
import { cn } from './utils';

export interface UnsupportedComponentPlaceholderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  id: string;
  onReplace?: () => void;
  onViewRegistry?: () => void;
  onContactAdmin?: () => void;
}

export function UnsupportedComponentPlaceholder({
  id,
  className,
  onReplace,
  onViewRegistry,
  onContactAdmin,
  ...rest
}: UnsupportedComponentPlaceholderProps) {
  return (
    <PFCard className={cn('pf-unsupported', className)} data-unsupported-id={id} {...rest}>
      <PFCardContent className="pf-unsupported__content">
        <PFTypography variant="h6">Component not enabled</PFTypography>
        <PFTypography variant="body2">
          <code>{id}</code> is not available in this environment.
        </PFTypography>
        <PFStack direction="row" wrap="wrap" gap="var(--pf-space-2)" align="center">
          <PFButton type="button" size="sm" variant="outline" onClick={onReplace}>
            Replace component
          </PFButton>
          <PFButton type="button" size="sm" variant="ghost" onClick={onViewRegistry}>
            View in registry
          </PFButton>
          <PFButton type="button" size="sm" variant="ghost" onClick={onContactAdmin}>
            Contact admin
          </PFButton>
        </PFStack>
      </PFCardContent>
    </PFCard>
  );
}
