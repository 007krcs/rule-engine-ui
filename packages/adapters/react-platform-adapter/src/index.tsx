import React from 'react';
import { builtinComponentDefinitions } from '@platform/component-registry';
import type { ComponentDefinition } from '@platform/component-registry';
import {
  PFAlert,
  PFAvatar,
  PFBadge,
  PFButton,
  PFCalendar,
  PFCard,
  PFCardContent,
  PFCardGrid,
  PFChip,
  PFDateField,
  PFDatePicker,
  PFDateTimeField,
  PFDivider,
  PFEmptyState,
  PFPageShell,
  PFPagination,
  PFSection,
  PFSelect,
  PFSplitLayout,
  PFTable,
  PFTab,
  PFTabs,
  PFTextField,
  PFTimeField,
  PFTimePicker,
  PFToolbar,
  PFTypography,
  PFClock,
  UnsupportedComponentPlaceholder,
} from '@platform/ui-kit';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';
import type { JSONValue, UIComponent } from '@platform/schema';
import { platformComponentMap } from './component-map';
export { getPlatformComponent, platformComponentMap } from './component-map';

let registered = false;
let reportedHandshake = false;

type ReplaceComponentRequestEvent = {
  componentId: string;
  adapterHint: string;
};

export function getImplementedComponentIds(): string[] {
  return Object.keys(platformComponentMap).sort((a, b) => a.localeCompare(b));
}

export function registerPlatformAdapter(): void {
  if (registered) return;
  if (process.env.NODE_ENV !== 'production') {
    assertRegistryAdapterHandshake();
  }
  registered = true;
  registerAdapter('platform.', (component, ctx) => renderPlatformComponent(component, ctx));
}

export function renderPlatformComponent(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey, undefined, { defaultText: component.id });
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : asString(component.props?.label, component.id);
  const helperText = component.i18n?.helperTextKey
    ? ctx.i18n.t(component.i18n.helperTextKey)
    : asString(component.props?.helperText, '');
  const timezone = asString(component.props?.timezone, ctx.context.timezone);
  const displayFormat = asString(component.props?.displayFormat, 'medium');
  const valueBindingPath = resolveDataBindingPath(component);

  switch (component.adapterHint) {
    case 'platform.pageShell': {
      const sidebarItems = toStringArray(
        resolveBindingValue(component, ctx, 'sidebarItems') ?? component.props?.sidebarItems,
      );
      const rightPanelItems = toStringArray(
        resolveBindingValue(component, ctx, 'rightPanelItems') ?? component.props?.rightPanelItems,
      );
      const shellContentTitle = resolveText(
        ctx,
        component.props?.contentTitleKey,
        component.props?.contentTitle,
        label,
      );
      const shellContentDescription = resolveText(
        ctx,
        component.props?.contentDescriptionKey,
        component.props?.contentDescription,
        helperText || 'Use this surface to compose complete screens.',
      );

      return (
        <PFPageShell
          headerHeight={asNumber(component.props?.headerHeight, 64)}
          sidebarWidth={asNumber(component.props?.sidebarWidth, 280)}
          collapsedSidebarWidth={asNumber(component.props?.collapsedSidebarWidth, 84)}
          stickyHeader={asBoolean(component.props?.stickyHeader, true)}
          hasRightPanel={asBoolean(component.props?.hasRightPanel, false)}
          header={(
            <PFToolbar align="space-between" wrap>
              <PFTypography variant="h6">{label}</PFTypography>
              <PFChip intent="primary">Layout Primitive</PFChip>
            </PFToolbar>
          )}
          sidebar={(
            <nav aria-label={`${label} sidebar`}>
              <PFToolbar align="left" density="compact">
                <PFTypography variant="label">Navigation</PFTypography>
              </PFToolbar>
              <PFCard>
                <PFCardContent>
                  {sidebarItems.length > 0 ? (
                    <ul>
                      {sidebarItems.map((item) => (
                        <li key={item}>{resolveStringOrKey(ctx, item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <PFTypography variant="body2" muted>
                      Bind `sidebarItems` to render menu entries.
                    </PFTypography>
                  )}
                </PFCardContent>
              </PFCard>
            </nav>
          )}
          rightPanel={(
            <PFCard>
              <PFCardContent>
                <PFTypography variant="label">Right Panel</PFTypography>
                {rightPanelItems.length > 0 ? (
                  <ul>
                    {rightPanelItems.map((item) => (
                      <li key={item}>{resolveStringOrKey(ctx, item)}</li>
                    ))}
                  </ul>
                ) : (
                  <PFTypography variant="body2" muted>
                    Optional context area for activity, comments, or metadata.
                  </PFTypography>
                )}
              </PFCardContent>
            </PFCard>
          )}
        >
          <PFSection
            title={shellContentTitle}
            description={shellContentDescription}
          >
            <PFTypography variant="body2" muted>
              PageShell coordinates header, sidebar, content, and optional right panel across breakpoints.
            </PFTypography>
          </PFSection>
        </PFPageShell>
      );
    }
    case 'platform.section':
      return (
        <PFSection
          title={resolveText(ctx, component.props?.titleKey, component.props?.title, label)}
          description={resolveText(
            ctx,
            component.props?.descriptionKey,
            component.props?.description,
            helperText || '',
          )}
          intent={toSectionIntent(component.props?.intent)}
          actions={resolveText(ctx, component.props?.actionLabelKey, component.props?.actionLabel, '') ? (
            <PFButton size="sm">{resolveText(ctx, component.props?.actionLabelKey, component.props?.actionLabel, '')}</PFButton>
          ) : undefined}
        >
          <PFTypography variant="body2">
            {resolveText(
              ctx,
              component.props?.bodyKey,
              component.props?.body,
              'Section content. Place forms, tables, or summaries here.',
            )}
          </PFTypography>
        </PFSection>
      );
    case 'platform.splitLayout':
      return (
        <PFSplitLayout
          leftWidthPercent={asNumber(component.props?.leftWidthPercent, 40)}
          gap={asNumber(component.props?.gap, 16)}
          stackOnMobile={asBoolean(component.props?.stackOnMobile, true)}
          left={(
            <PFCard>
              <PFCardContent>
                <PFTypography variant="label">{asString(component.props?.leftTitle, 'Left Pane')}</PFTypography>
                <PFTypography variant="body2" muted>
                  {asString(component.props?.leftDescription, 'Primary list, filters, or navigation.')}
                </PFTypography>
              </PFCardContent>
            </PFCard>
          )}
          right={(
            <PFCard>
              <PFCardContent>
                <PFTypography variant="label">{asString(component.props?.rightTitle, 'Right Pane')}</PFTypography>
                <PFTypography variant="body2" muted>
                  {asString(component.props?.rightDescription, 'Detail panel, preview, or editor.')}
                </PFTypography>
              </PFCardContent>
            </PFCard>
          )}
        />
      );
    case 'platform.toolbar':
      return (
        <PFToolbar
          align={toToolbarAlign(component.props?.align)}
          wrap={asBoolean(component.props?.wrap, true)}
          density={asBoolean(component.props?.density === 'compact', false) ? 'compact' : 'comfortable'}
        >
          <PFTypography variant="label">{label}</PFTypography>
          <PFTextField
            id={`${component.id}-search`}
            label=""
            placeholder={resolveText(ctx, component.props?.searchPlaceholderKey, component.props?.searchPlaceholder, 'Search')}
          />
          <PFButton size="sm">{resolveText(ctx, component.props?.actionLabelKey, component.props?.actionLabel, 'Apply')}</PFButton>
        </PFToolbar>
      );
    case 'platform.cardGrid': {
      const cards = toObjectArray(
        resolveBindingValue(component, ctx, 'items') ?? component.props?.items,
      );
      const columns = toColumnsValue(component.props?.columns);
      return (
        <PFCardGrid columns={columns} gap={asNumber(component.props?.gap, 16)}>
          {cards.length > 0 ? (
            cards.map((card, index) => (
              <PFCard key={`${component.id}-card-${index}`}>
                <PFCardContent>
                  <PFTypography variant="h6">{asString(card.title, `Card ${index + 1}`)}</PFTypography>
                  <PFTypography variant="body2" muted>
                    {asString(card.description, 'Card summary bound from data.')}
                  </PFTypography>
                </PFCardContent>
              </PFCard>
            ))
          ) : (
            <PFCard>
              <PFCardContent>
                <PFTypography variant="body2" muted>
                  Bind `items` to render cards from your dataset.
                </PFTypography>
              </PFCardContent>
            </PFCard>
          )}
        </PFCardGrid>
      );
    }
    case 'platform.emptyState':
      return (
        <PFEmptyState
          title={label}
          description={resolveText(
            ctx,
            component.props?.descriptionKey,
            component.props?.description,
            helperText || 'There is nothing to display yet.',
          )}
          action={<PFButton size="sm">{resolveText(ctx, component.props?.actionLabelKey, component.props?.actionLabel, 'Create')}</PFButton>}
          icon={<span aria-hidden="true">+</span>}
        />
      );

    case 'platform.button':
      return (
        <PFButton
          size={toButtonSize(component.props?.size)}
          variant={toButtonVariant(component.props?.variant)}
          intent={toButtonIntent(component.props?.intent)}
          disabled={Boolean(component.props?.disabled)}
          onClick={() => ctx.events.onClick?.({ componentId: component.id })}
        >
          {resolveText(ctx, component.props?.labelKey, component.props?.label, label)}
        </PFButton>
      );

    case 'platform.textField': {
      const value = asString(resolveBindingValue(component, ctx, 'value') ?? resolveBoundDataValue(component, ctx), '');
      return (
        <PFTextField
          id={component.id}
          label={label}
          helperText={helperText}
          value={value}
          placeholder={asString(component.props?.placeholder, '')}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          aria-label={ariaLabel}
          onChange={(event) => ctx.events.onChange?.(event.target.value, valueBindingPath)}
        />
      );
    }
    case 'platform.select': {
      const options = toSelectOptions(component.props?.options, ctx);
      const value = asString(resolveBindingValue(component, ctx, 'value') ?? resolveBoundDataValue(component, ctx), '');
      return (
        <PFSelect
          aria-label={ariaLabel}
          options={options}
          value={value}
          placeholder={asString(component.props?.placeholder, '')}
          onChange={(event) => ctx.events.onChange?.(event.target.value, valueBindingPath)}
        />
      );
    }
    case 'platform.table': {
      const rows = toObjectArray(
        resolveBindingValue(component, ctx, 'rows') ?? component.props?.rows,
      );
      const columns = toTableColumns(component.props?.columns, ctx);
      return (
        <PFTable
          columns={columns}
          rows={rows}
          emptyState={resolveText(ctx, component.props?.emptyStateKey, component.props?.emptyState, 'No rows available.')}
          rowKey={(row, index) => asString(row.id, String(index))}
        />
      );
    }
    case 'platform.pagination':
      return (
        <PFPagination
          count={asNumber(component.props?.count, 1)}
          page={asNumber(component.props?.page, 1)}
          onPageChange={(page) => ctx.events.onChange?.(page, valueBindingPath)}
        />
      );
    case 'platform.tabs': {
      const tabs = toTabs(component.props?.tabs, ctx);
      const value = asString(resolveBindingValue(component, ctx, 'value') ?? component.props?.value, tabs[0]?.id ?? 'tab-1');
      return (
        <PFTabs value={value} onChange={(next) => ctx.events.onChange?.(next, valueBindingPath)}>
          {tabs.map((tab) => (
            <PFTab key={tab.id} value={tab.id} label={tab.label}>
              <PFTypography variant="body2">{tab.content}</PFTypography>
            </PFTab>
          ))}
        </PFTabs>
      );
    }
    case 'platform.alert':
      return (
        <PFAlert title={label} intent={toAlertIntent(component.props?.intent)}>
          {resolveText(ctx, component.props?.descriptionKey, component.props?.description, helperText || '')}
        </PFAlert>
      );
    case 'platform.avatar':
      return (
        <PFAvatar
          name={asString(resolveBindingValue(component, ctx, 'name') ?? component.props?.name, label)}
          src={asOptionalString(component.props?.src)}
        />
      );
    case 'platform.badge':
      return (
        <PFBadge
          badgeContent={asNumber(resolveBindingValue(component, ctx, 'badgeContent') ?? component.props?.badgeContent, 0)}
          max={asNumber(component.props?.max, 99)}
          intent={toBadgeIntent(component.props?.intent)}
          dot={asBoolean(component.props?.dot, false)}
        >
          <PFChip intent="neutral">{label}</PFChip>
        </PFBadge>
      );
    case 'platform.chip':
      return (
        <PFChip
          intent={toChipIntent(component.props?.intent)}
          size={toChipSize(component.props?.size)}
          icon={asOptionalString(component.props?.icon) ? <span aria-hidden="true">{asString(component.props?.icon, '')}</span> : undefined}
          dismissLabel={asString(component.props?.dismissLabel, `Remove ${label}`)}
          onDismiss={asBoolean(component.props?.dismissible, false) ? () => ctx.events.onClick?.({ componentId: component.id }) : undefined}
        >
          {label}
        </PFChip>
      );
    case 'platform.divider':
      return (
        <PFDivider
          orientation={component.props?.orientation === 'vertical' ? 'vertical' : 'horizontal'}
          inset={asBoolean(component.props?.inset, false)}
        />
      );

    case 'platform.dateField':
      return (
        <PFDateField
          id={component.id}
          label={label}
          helperText={helperText}
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minDate={asString(component.validations?.minDate, asString(component.props?.minDate, ''))}
          maxDate={asString(component.validations?.maxDate, asString(component.props?.maxDate, ''))}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          timezone={timezone || undefined}
          displayFormat={displayFormat === 'short' || displayFormat === 'long' ? displayFormat : 'medium'}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.datePicker':
      return (
        <PFDatePicker
          id={component.id}
          label={label}
          helperText={helperText}
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minDate={asString(component.validations?.minDate, asString(component.props?.minDate, ''))}
          maxDate={asString(component.validations?.maxDate, asString(component.props?.maxDate, ''))}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          timezone={timezone || undefined}
          displayFormat={displayFormat === 'short' || displayFormat === 'long' ? displayFormat : 'medium'}
          showCalendar={asBoolean(component.props?.showCalendar, true)}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.timeField':
      return (
        <PFTimeField
          id={component.id}
          label={label}
          helperText={helperText}
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minTime={asString(component.validations?.minTime, asString(component.props?.minTime, ''))}
          maxTime={asString(component.validations?.maxTime, asString(component.props?.maxTime, ''))}
          step={asNumber(component.props?.step, 60)}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.timePicker':
      return (
        <PFTimePicker
          id={component.id}
          label={label}
          helperText={helperText}
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minTime={asString(component.validations?.minTime, asString(component.props?.minTime, ''))}
          maxTime={asString(component.validations?.maxTime, asString(component.props?.maxTime, ''))}
          step={asNumber(component.props?.step, 60)}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          timezone={timezone || undefined}
          locale={ctx.context.locale}
          showClock={asBoolean(component.props?.showClock, true)}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.dateTimeField':
      return (
        <PFDateTimeField
          id={component.id}
          label={label}
          helperText={helperText}
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minDateTime={asString(component.props?.minDateTime, '') || undefined}
          maxDateTime={asString(component.props?.maxDateTime, '') || undefined}
          step={asNumber(component.props?.step, 60)}
          required={Boolean(component.validations?.required)}
          disabled={Boolean(component.props?.disabled)}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.calendar':
      return (
        <PFCalendar
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          minDate={asString(component.validations?.minDate, asString(component.props?.minDate, '')) || undefined}
          maxDate={asString(component.validations?.maxDate, asString(component.props?.maxDate, '')) || undefined}
          timezone={timezone || undefined}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    case 'platform.clock':
      return (
        <PFClock
          value={asString(resolveBoundDataValue(component, ctx), asString(component.props?.defaultValue, ''))}
          timezone={timezone}
          picker={Boolean(component.props?.picker)}
          showSeconds={Boolean(component.props?.showSeconds)}
          aria-label={ariaLabel}
          onValueChange={(value: string) => ctx.events.onChange?.(value, valueBindingPath)}
        />
      );
    default:
      return (
        <UnsupportedComponentPlaceholder
          id={component.adapterHint}
          onReplace={() =>
            dispatchReplaceComponentRequest({
              componentId: component.id,
              adapterHint: component.adapterHint,
            })
          }
          onViewRegistry={() => openRegistryFor(component.adapterHint)}
          onContactAdmin={() => copyAdminRequestText(component)}
        />
      );
  }
}

function resolveDataBindingPath(component: UIComponent): string {
  return component.bindings?.data?.valuePath ?? component.bindings?.data?.value ?? `data.${component.id}`;
}

function resolveBindingValue(
  component: UIComponent,
  ctx: AdapterContext,
  bindingKey: string,
): JSONValue | undefined {
  const direct = ctx.bindings.data[bindingKey]?.value;
  if (direct !== undefined) return direct;

  const mappedPath = component.bindings?.data?.[bindingKey];
  if (!mappedPath || typeof mappedPath !== 'string') return undefined;
  return getBoundPathValue(mappedPath, ctx.data);
}

function resolveBoundDataValue(component: UIComponent, ctx: AdapterContext): JSONValue | undefined {
  const direct = ctx.bindings.data.valuePath?.value ?? ctx.bindings.data.value?.value;
  if (direct !== undefined) return direct;
  return getBoundPathValue(resolveDataBindingPath(component), ctx.data);
}

function getBoundPathValue(path: string, data: Record<string, JSONValue>): JSONValue | undefined {
  if (!path) return undefined;
  const normalized = path.startsWith('data.') ? path.slice('data.'.length) : path;
  return getPath(data, normalized);
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  if (!path) return obj as unknown as JSONValue;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const index = Number(part);
    if (!Number.isNaN(index) && Array.isArray(current)) {
      current = current[index];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current)) return undefined;
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return undefined;
    current = (current as Record<string, JSONValue>)[part];
  }
  return current;
}

function toObjectArray(value: unknown): Array<Record<string, JSONValue>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function toSelectOptions(
  value: unknown,
  ctx?: AdapterContext,
): Array<{ value: string; label: string; disabled?: boolean }> {
  if (!Array.isArray(value)) {
    return [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ];
  }
  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      options.push({ value: entry, label: entry });
      continue;
    }
    if (!isRecord(entry)) continue;
    const optionValue = asString(entry.value, '');
    if (!optionValue) continue;
    options.push({
      value: optionValue,
      label: resolveText(ctx, entry.labelKey, entry.label, optionValue),
      disabled: asBoolean(entry.disabled, false),
    });
  }
  return options.length > 0 ? options : [{ value: 'default', label: 'Default' }];
}

function toTableColumns(
  value: unknown,
  ctx?: AdapterContext,
): Array<{ id: string; header: React.ReactNode; align?: 'left' | 'right' | 'center' }> {
  if (!Array.isArray(value)) {
    return [
      { id: 'name', header: 'Name' },
      { id: 'status', header: 'Status' },
      { id: 'owner', header: 'Owner' },
    ];
  }
  const columns: Array<{ id: string; header: React.ReactNode; align?: 'left' | 'right' | 'center' }> = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = asString(entry.field ?? entry.id, '');
    if (!id) continue;
    const align = toAlign(entry.align);
    columns.push({
      id,
      header: resolveText(ctx, entry.headerKey, entry.header ?? entry.label, id),
      align,
    });
  }
  return columns.length > 0 ? columns : [{ id: 'value', header: 'Value' }];
}

function toTabs(value: unknown, ctx?: AdapterContext): Array<{ id: string; label: string; content: string }> {
  if (!Array.isArray(value)) {
    return [
      { id: 'overview', label: 'Overview', content: 'Overview content.' },
      { id: 'details', label: 'Details', content: 'Details content.' },
    ];
  }
  const tabs: Array<{ id: string; label: string; content: string }> = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = asString(entry.id, '');
    if (!id) continue;
    tabs.push({
      id,
      label: resolveText(ctx, entry.labelKey, entry.label, id),
      content: resolveText(ctx, entry.contentKey, entry.content, 'Tab content.'),
    });
  }
  return tabs.length > 0 ? tabs : [{ id: 'overview', label: 'Overview', content: 'Overview content.' }];
}

function toColumnsValue(value: unknown): number | { sm?: number; md?: number; lg?: number; xl?: number } {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  if (!isRecord(value)) {
    return { sm: 1, md: 2, lg: 3, xl: 4 };
  }
  return {
    sm: asNumber(value.sm, 1),
    md: asNumber(value.md, 2),
    lg: asNumber(value.lg, 3),
    xl: asNumber(value.xl, 4),
  };
}

function toToolbarAlign(value: unknown): 'left' | 'right' | 'space-between' {
  if (value === 'left' || value === 'right' || value === 'space-between') return value;
  return 'left';
}

function toSectionIntent(value: unknown): 'neutral' | 'info' | 'warn' {
  if (value === 'neutral' || value === 'info' || value === 'warn') return value;
  return 'neutral';
}

function toAlign(value: unknown): 'left' | 'right' | 'center' {
  if (value === 'left' || value === 'right' || value === 'center') return value;
  return 'left';
}

function toAlertIntent(value: unknown): 'neutral' | 'primary' | 'success' | 'warn' | 'error' {
  if (value === 'neutral' || value === 'primary' || value === 'success' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'neutral';
}

function toChipIntent(value: unknown): 'neutral' | 'primary' | 'secondary' | 'success' | 'warn' | 'error' {
  if (value === 'neutral' || value === 'primary' || value === 'secondary' || value === 'success' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'neutral';
}

function toBadgeIntent(value: unknown): 'primary' | 'neutral' | 'success' | 'warn' | 'error' {
  if (value === 'primary' || value === 'neutral' || value === 'success' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'primary';
}

function toChipSize(value: unknown): 'sm' | 'md' {
  if (value === 'sm' || value === 'md') return value;
  return 'md';
}

function toButtonVariant(value: unknown): 'solid' | 'outline' | 'ghost' {
  if (value === 'solid' || value === 'outline' || value === 'ghost') return value;
  return 'solid';
}

function toButtonIntent(value: unknown): 'primary' | 'secondary' | 'neutral' | 'success' | 'warn' | 'error' {
  if (value === 'primary' || value === 'secondary' || value === 'neutral' || value === 'success' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'primary';
}

function toButtonSize(value: unknown): 'sm' | 'md' | 'lg' {
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return 'md';
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRegistryAdapterHandshake(): void {
  if (reportedHandshake) return;
  reportedHandshake = true;

  const registryPlatformImplemented = new Set(getRegistryImplementedPlatformIds(builtinComponentDefinitions()));
  const adapterImplemented = new Set(getImplementedComponentIds());

  const missingInAdapter = [...registryPlatformImplemented].filter((hint) => !adapterImplemented.has(hint));
  const missingInRegistry = [...adapterImplemented].filter((hint) => !registryPlatformImplemented.has(hint));

  if (missingInAdapter.length === 0 && missingInRegistry.length === 0) return;

  const message = [
    '[platform-adapter] Registry/adapter availability mismatch detected.',
    missingInAdapter.length > 0
      ? `  Implemented in registry but missing in adapter: ${missingInAdapter.join(', ')}`
      : null,
    missingInRegistry.length > 0
      ? `  Implemented in adapter but not marked implemented in registry: ${missingInRegistry.join(', ')}`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
  throw new Error(message);
}

function getRegistryImplementedPlatformIds(definitions: ComponentDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.adapterHint.startsWith('platform.'))
    .filter((definition) => definition.availability === 'implemented' && definition.supportsDrag)
    .map((definition) => definition.adapterHint);
}

function dispatchReplaceComponentRequest(detail: ReplaceComponentRequestEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ReplaceComponentRequestEvent>('ruleflow:replace-component-request', {
      detail,
    }),
  );
}

function copyAdminRequestText(component: UIComponent): void {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  const requestText =
    `Please enable support for ${component.adapterHint} in the Platform adapter.\n` +
    `Component id: ${component.id}\n` +
    'Reason: this component is used by a schema but is unavailable in this environment.';
  void navigator.clipboard.writeText(requestText);
}

function openRegistryFor(adapterHint: string): void {
  if (typeof window === 'undefined') return;
  window.location.assign(`/component-registry?c=${encodeURIComponent(adapterHint)}`);
}

function resolveText(
  ctx: AdapterContext | undefined,
  keyValue: unknown,
  fallbackValue: unknown,
  defaultText: string,
): string {
  const fallbackText = asString(fallbackValue, defaultText);
  const key = asOptionalString(keyValue);
  if (!key) {
    if (!ctx) return fallbackText;
    if (fallbackText.includes('.') || fallbackText.includes(':')) {
      return ctx.i18n.t(fallbackText, undefined, { defaultText: fallbackText });
    }
    return fallbackText;
  }
  if (!ctx) return fallbackText || key;
  return ctx.i18n.t(key, undefined, { defaultText: fallbackText || key });
}

function resolveStringOrKey(ctx: AdapterContext, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return value;
  if (!trimmed.includes('.') && !trimmed.includes(':')) return value;
  return ctx.i18n.t(trimmed, undefined, { defaultText: value });
}
