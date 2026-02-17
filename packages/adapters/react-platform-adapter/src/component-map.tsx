import React from 'react';
import {
  PFAlert,
  PFAvatar,
  PFBadge,
  PFButton,
  PFCalendar,
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
  PFTabs,
  PFTextField,
  PFTimeField,
  PFTimePicker,
  PFToolbar,
  PFClock,
  UnsupportedComponentPlaceholder,
} from '@platform/ui-kit';

export const platformComponentMap: Record<string, React.FC<any>> = {
  'platform.pageShell': PFPageShell as React.FC<any>,
  'platform.section': PFSection as React.FC<any>,
  'platform.splitLayout': PFSplitLayout as React.FC<any>,
  'platform.toolbar': PFToolbar as React.FC<any>,
  'platform.cardGrid': PFCardGrid as React.FC<any>,
  'platform.emptyState': PFEmptyState as React.FC<any>,
  'platform.button': PFButton as React.FC<any>,
  'platform.textField': PFTextField as React.FC<any>,
  'platform.select': PFSelect as React.FC<any>,
  'platform.table': PFTable as React.FC<any>,
  'platform.pagination': PFPagination as React.FC<any>,
  'platform.tabs': PFTabs as React.FC<any>,
  'platform.alert': PFAlert as React.FC<any>,
  'platform.avatar': PFAvatar as React.FC<any>,
  'platform.badge': PFBadge as React.FC<any>,
  'platform.chip': PFChip as React.FC<any>,
  'platform.divider': PFDivider as React.FC<any>,
  'platform.dateField': PFDateField as React.FC<any>,
  'platform.datePicker': PFDatePicker as React.FC<any>,
  'platform.timeField': PFTimeField as React.FC<any>,
  'platform.timePicker': PFTimePicker as React.FC<any>,
  'platform.dateTimeField': PFDateTimeField as React.FC<any>,
  'platform.calendar': PFCalendar as React.FC<any>,
  'platform.clock': PFClock as React.FC<any>,
};

export function getPlatformComponent(id: string): React.FC<any> {
  return (
    platformComponentMap[id] ??
    (() => <UnsupportedComponentPlaceholder id={id} />)
  );
}
