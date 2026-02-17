import type { TemplateId, TemplateSummary } from './types';

export const templateCatalog: Record<TemplateId, TemplateSummary> = {
  'orders-list': {
    id: 'orders-list',
    name: 'Orders List Screen',
    category: 'Data/Operations screens',
    purpose:
      'Track operational orders with filters, table results, and role-based actions such as PDF export.',
    requiredData: [
      'orders.items[] with invoice, date, status, customerName, customerEmail, total',
      'orders.filters with search/status/category/customer',
      'orders.pagination with page/count',
      'navigation.ordersSidebar[] for left navigation labels',
    ],
    components: [
      'platform.pageShell',
      'platform.section',
      'platform.toolbar',
      'platform.textField',
      'platform.select',
      'platform.button',
      'platform.table',
      'platform.pagination',
      'platform.emptyState',
    ],
    customizable: [
      'Sidebar width and header behavior',
      'Filter fields and toolbar action visibility',
      'Table columns, paging, and empty-state messaging',
      'Admin-only export rule',
    ],
    setupChecklist: [
      'Connect orders dataset',
      'Map filter controls to your data model',
      'Review role-based visibility rules',
      'Validate table columns for business users',
      'Preview desktop/tablet/mobile layout',
    ],
    screenshotTone: 'orders',
  },
  'profile-settings': {
    id: 'profile-settings',
    name: 'My Profile Screen',
    category: 'Profile/Settings screens',
    purpose:
      'Provide a guided profile management screen with tabs, personal info form, and save/cancel actions.',
    requiredData: [
      'userProfile with firstName, lastName, email, role, bio',
      'userProfile.sections[] for summary cards',
      'navigation.profileSidebar[] for profile navigation',
    ],
    components: [
      'platform.pageShell',
      'platform.section',
      'platform.tabs',
      'platform.cardGrid',
      'platform.textField',
      'platform.select',
      'platform.button',
      'platform.alert',
    ],
    customizable: [
      'Tab labels and active tab',
      'Form fields and validation requirements',
      'Card summaries for account plan/team details',
      'Save behavior and role-based lock rules',
    ],
    setupChecklist: [
      'Bind profile fields to your user object',
      'Adjust required validations',
      'Confirm save permissions by role',
      'Localize labels and helper text',
      'Preview for tablet/mobile',
    ],
    screenshotTone: 'profile',
  },
  'files-explorer': {
    id: 'files-explorer',
    name: 'Files Explorer Screen',
    category: 'Admin Console screens',
    purpose:
      'Manage folders and files with list + tile views, plus a details panel for file metadata and activity.',
    requiredData: [
      'files.folders[] with name, modifiedAt, size, owner',
      'files.tiles[] with title, description',
      'files.detailsTabs[] metadata for details/activity',
      'navigation.filesSidebar[] for browse/tag links',
    ],
    components: [
      'platform.pageShell',
      'platform.section',
      'platform.toolbar',
      'platform.splitLayout',
      'platform.table',
      'platform.cardGrid',
      'platform.tabs',
      'platform.emptyState',
    ],
    customizable: [
      'Folder table columns and sort order',
      'Tile density and responsive card layout',
      'Details/activity tabs and right panel content',
      'Filter toolbar options and tags',
    ],
    setupChecklist: [
      'Connect folders and tiles datasets',
      'Map details tab content',
      'Set empty-state messages for no files',
      'Review responsive split behavior',
      'Validate permissions for admin actions',
    ],
    screenshotTone: 'files',
  },
  'messaging-screen': {
    id: 'messaging-screen',
    name: 'Messaging Screen',
    category: 'Communication screens',
    purpose:
      'Run inbox-style communication with conversations list, message thread, info panel, and composer.',
    requiredData: [
      'messages.conversations[] with contact, lastMessage, time, unreadCount',
      'messages.thread[] with title/body',
      'messages.composer text value',
      'navigation.messagingSidebar[] for channels/folders',
    ],
    components: [
      'platform.pageShell',
      'platform.section',
      'platform.toolbar',
      'platform.splitLayout',
      'platform.table',
      'platform.cardGrid',
      'platform.tabs',
      'platform.textField',
      'platform.button',
      'platform.badge',
    ],
    customizable: [
      'Conversation fields and unread badges',
      'Thread card density and ordering',
      'Composer behavior and send action rule',
      'Info panel tabs and locale-specific labels',
    ],
    setupChecklist: [
      'Bind conversations and thread datasets',
      'Configure unread badge mapping',
      'Define visibility/disable rules by role',
      'Preview mobile stacked layout',
      'Validate publish readiness',
    ],
    screenshotTone: 'messages',
  },
};

export function listTemplateSummaries(): TemplateSummary[] {
  return Object.values(templateCatalog);
}
