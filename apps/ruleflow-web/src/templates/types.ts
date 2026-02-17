export type TemplateCategory =
  | 'Admin Console screens'
  | 'Data/Operations screens'
  | 'Profile/Settings screens'
  | 'Communication screens';

export type TemplateId =
  | 'orders-list'
  | 'profile-settings'
  | 'files-explorer'
  | 'messaging-screen';

export type TemplateSummary = {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  purpose: string;
  requiredData: string[];
  components: string[];
  customizable: string[];
  setupChecklist: string[];
  screenshotTone: 'orders' | 'profile' | 'files' | 'messages';
};

export type TemplateDetail = {
  summary: TemplateSummary;
  schema: unknown;
};
