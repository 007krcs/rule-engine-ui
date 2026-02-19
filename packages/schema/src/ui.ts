import type {
  ColumnNode,
  LayoutColumnChildNode,
  LayoutComponentNode,
  LayoutContainerNode,
  LayoutTreeNode,
  RowNode,
  SectionNode,
  UIComponent,
  UISchema,
} from './types';

export const LAYOUT_GRID_COLUMNS = 12;

let layoutIdCounter = 0;

export function createLayoutId(prefix: string): string {
  layoutIdCounter += 1;
  return `${prefix}-${layoutIdCounter}`;
}

export interface CreateLayoutComponentNodeOptions {
  id?: string;
  label?: string;
  className?: string;
  componentType?: string;
  componentSpan?: number;
}

export function createLayoutComponentNode(
  componentId: string,
  options: CreateLayoutComponentNodeOptions = {},
): LayoutComponentNode {
  return {
    id: options.id ?? createLayoutId('component-node'),
    kind: 'component',
    componentId,
    componentType: options.componentType,
    componentSpan: options.componentSpan,
    label: options.label,
    className: options.className,
  };
}

export interface CreateColumnNodeOptions {
  id?: string;
  label?: string;
  className?: string;
  span?: number;
  children?: LayoutColumnChildNode[];
}

export function createColumnNode(options: CreateColumnNodeOptions = {}): ColumnNode {
  return {
    id: options.id ?? createLayoutId('column'),
    kind: 'column',
    label: options.label,
    className: options.className,
    span: options.span,
    children: options.children ?? [],
  };
}

export interface CreateRowNodeOptions {
  id?: string;
  label?: string;
  className?: string;
  columns?: ColumnNode[];
  columnCount?: number;
}

export function createRowNode(options: CreateRowNodeOptions = {}): RowNode {
  const columnCount = Math.max(1, options.columnCount ?? 2);
  const columns =
    options.columns ??
    Array.from({ length: columnCount }, () =>
      createColumnNode({
        span: Math.floor(LAYOUT_GRID_COLUMNS / columnCount),
      }),
    );

  return {
    id: options.id ?? createLayoutId('row'),
    kind: 'row',
    label: options.label,
    className: options.className,
    columns,
  };
}

export interface CreateSectionNodeOptions {
  id?: string;
  title?: string;
  label?: string;
  className?: string;
  rows?: RowNode[];
}

export function createSectionNode(options: CreateSectionNodeOptions = {}): SectionNode {
  return {
    id: options.id ?? createLayoutId('section'),
    kind: 'section',
    title: options.title,
    label: options.label,
    className: options.className,
    rows: options.rows ?? [createRowNode()],
  };
}

export interface CreateUISchemaOptions {
  pageId: string;
  version?: string;
  sections?: SectionNode[];
  components?: UIComponent[];
}

export function createUISchema(options: CreateUISchemaOptions): UISchema {
  const sections = options.sections ?? [createSectionNode()];
  return {
    version: options.version ?? '1.0.0',
    pageId: options.pageId,
    layout: {
      id: 'root-layout',
      type: 'stack',
      direction: 'vertical',
    },
    components: options.components ?? [],
    sections,
  };
}

export function createDefaultUIComponent(componentId: string, componentType: string): UIComponent {
  return {
    id: componentId,
    type: componentType,
    adapterHint: `native.${componentType}`,
    props: {},
    accessibility: {
      ariaLabelKey: `${componentType}.label`,
      keyboardNav: true,
      focusOrder: 1,
    },
  };
}

export function findLayoutNodeById(sections: SectionNode[], nodeId: string): LayoutTreeNode | undefined {
  for (const section of sections) {
    if (section.id === nodeId) return section;

    for (const row of section.rows) {
      if (row.id === nodeId) return row;

      for (const column of row.columns) {
        if (column.id === nodeId) return column;

        for (const child of column.children) {
          if (child.id === nodeId) return child;
          if (child.kind === 'section') {
            const nested = findLayoutNodeById([child], nodeId);
            if (nested) return nested;
          }
        }
      }
    }
  }

  return undefined;
}

export function updateLayoutNode(
  sections: SectionNode[],
  nodeId: string,
  updater: (node: LayoutTreeNode) => LayoutTreeNode,
): SectionNode[] {
  return sections.map((section) => updateSectionNode(section, nodeId, updater));
}

export function appendSection(sections: SectionNode[], section: SectionNode): SectionNode[] {
  return [...sections, section];
}

export function appendRowToSection(
  sections: SectionNode[],
  sectionId: string,
  row: RowNode,
): SectionNode[] {
  return sections.map((section) => {
    if (section.id === sectionId) {
      return { ...section, rows: [...section.rows, row] };
    }

    return updateSectionNode(section, sectionId, (node) => {
      if (node.kind !== 'section') {
        return node;
      }
      return { ...node, rows: [...node.rows, row] };
    });
  });
}

export function appendColumnToRow(sections: SectionNode[], rowId: string, column: ColumnNode): SectionNode[] {
  return updateLayoutNode(sections, rowId, (node) => {
    if (node.kind !== 'row') return node;
    return { ...node, columns: [...node.columns, column] };
  });
}

export function appendChildToColumn(
  sections: SectionNode[],
  columnId: string,
  child: LayoutColumnChildNode,
): SectionNode[] {
  return updateLayoutNode(sections, columnId, (node) => {
    if (node.kind !== 'column') return node;
    return { ...node, children: [...node.children, child] };
  });
}

function updateSectionNode(
  section: SectionNode,
  nodeId: string,
  updater: (node: LayoutTreeNode) => LayoutTreeNode,
): SectionNode {
  const nextSection = section.id === nodeId ? (updater(section) as SectionNode) : section;
  const nextRows = nextSection.rows.map((row) => updateRowNode(row, nodeId, updater));
  if (nextRows === nextSection.rows) {
    return nextSection;
  }
  return { ...nextSection, rows: nextRows };
}

function updateRowNode(row: RowNode, nodeId: string, updater: (node: LayoutTreeNode) => LayoutTreeNode): RowNode {
  const nextRow = row.id === nodeId ? (updater(row) as RowNode) : row;
  const nextColumns = nextRow.columns.map((column) => updateColumnNode(column, nodeId, updater));
  if (nextColumns === nextRow.columns) {
    return nextRow;
  }
  return { ...nextRow, columns: nextColumns };
}

function updateColumnNode(
  column: ColumnNode,
  nodeId: string,
  updater: (node: LayoutTreeNode) => LayoutTreeNode,
): ColumnNode {
  const nextColumn = column.id === nodeId ? (updater(column) as ColumnNode) : column;
  const nextChildren = nextColumn.children.map((child) => {
    if (child.id === nodeId) {
      return updater(child) as LayoutColumnChildNode;
    }
    if (child.kind === 'section') {
      return updateSectionNode(child, nodeId, updater);
    }
    return child;
  });
  if (nextChildren === nextColumn.children) {
    return nextColumn;
  }
  return { ...nextColumn, children: nextChildren };
}

export function isLayoutContainerNode(node: LayoutTreeNode): node is LayoutContainerNode {
  return node.kind === 'section' || node.kind === 'row' || node.kind === 'column';
}
