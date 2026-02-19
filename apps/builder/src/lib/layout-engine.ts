import {
  appendChildToColumn,
  appendRowToSection,
  appendSection,
  createDefaultUIComponent,
  createLayoutComponentNode,
  createRowNode,
  createSectionNode,
  findLayoutNodeById,
  updateLayoutNode,
  type ColumnNode,
  type JSONValue,
  type LayoutTreeNode,
  type RowNode,
  type SectionNode,
  type UIComponent,
  type UISchema,
} from '@platform/schema';
import type { ComponentContract } from '@platform/component-contract';
import type { DropTarget, PaletteDragItem } from '../utils/DragDropManager';

const GRID_COLUMN_MAX = 12;
const DEFAULT_ROW_COLUMN_COUNT = 2;

export interface DropOperationResult {
  schema: UISchema;
  selectedNodeId: string | null;
  changed: boolean;
}

export interface ApplyPaletteDropOptions {
  getComponentContract?: (componentType: string) => ComponentContract | undefined;
}

export interface LayoutIndex {
  nodeById: Map<string, LayoutTreeNode>;
  sectionById: Map<string, SectionNode>;
  rowById: Map<string, RowNode>;
  columnById: Map<string, ColumnNode>;
  rowToSection: Map<string, string>;
  columnToRow: Map<string, string>;
  columnToSection: Map<string, string>;
  componentToColumn: Map<string, string>;
}

export interface LayoutNodePatch {
  title?: string | undefined;
  label?: string | undefined;
  className?: string | undefined;
  span?: number | undefined;
  componentSpan?: number | undefined;
}

export function createInitialBuilderSchema(pageId: string): UISchema {
  return {
    version: '1.0.0',
    pageId,
    layout: {
      id: 'root-layout',
      type: 'stack',
      direction: 'vertical',
    },
    components: [],
    sections: [createSectionNode({ title: 'Section 1' })],
  };
}

export function buildLayoutIndex(sections: SectionNode[]): LayoutIndex {
  const index: LayoutIndex = {
    nodeById: new Map<string, LayoutTreeNode>(),
    sectionById: new Map<string, SectionNode>(),
    rowById: new Map<string, RowNode>(),
    columnById: new Map<string, ColumnNode>(),
    rowToSection: new Map<string, string>(),
    columnToRow: new Map<string, string>(),
    columnToSection: new Map<string, string>(),
    componentToColumn: new Map<string, string>(),
  };

  const visitSection = (section: SectionNode): void => {
    index.nodeById.set(section.id, section);
    index.sectionById.set(section.id, section);

    for (const row of section.rows) {
      index.nodeById.set(row.id, row);
      index.rowById.set(row.id, row);
      index.rowToSection.set(row.id, section.id);

      for (const column of row.columns) {
        index.nodeById.set(column.id, column);
        index.columnById.set(column.id, column);
        index.columnToRow.set(column.id, row.id);
        index.columnToSection.set(column.id, section.id);

        for (const child of column.children) {
          index.nodeById.set(child.id, child);
          if (child.kind === 'component') {
            index.componentToColumn.set(child.id, column.id);
          } else {
            visitSection(child);
          }
        }
      }
    }
  };

  for (const section of sections) {
    visitSection(section);
  }

  return index;
}

export function getLayoutNode(schema: UISchema, nodeId: string | null): LayoutTreeNode | undefined {
  if (!nodeId) {
    return undefined;
  }
  return findLayoutNodeById(schema.sections ?? [], nodeId);
}

export function applyPaletteDrop(
  schema: UISchema,
  item: PaletteDragItem,
  target: DropTarget,
  selectedNodeId: string | null,
  options: ApplyPaletteDropOptions = {},
): DropOperationResult {
  const sections = schema.sections ?? [];
  const index = buildLayoutIndex(sections);

  if (item.kind === 'section') {
    if (target.kind === 'column') {
      return addNestedSectionToColumn(schema, target.columnId, item.displayName);
    }

    const newSection = createSectionNode({ title: item.displayName });
    const nextSections = appendSection(sections, newSection);
    return {
      schema: {
        ...schema,
        sections: nextSections,
      },
      selectedNodeId: newSection.id,
      changed: true,
    };
  }

  if (item.kind === 'row') {
    const sectionId = resolveSectionDropTarget(index, target, selectedNodeId, sections);
    if (!sectionId) {
      return { schema, selectedNodeId, changed: false };
    }

    const newRow = createRowNode({
      label: item.displayName,
      columnCount: DEFAULT_ROW_COLUMN_COUNT,
    });
    const nextSections = appendRowToSection(sections, sectionId, newRow);
    return {
      schema: {
        ...schema,
        sections: nextSections,
      },
      selectedNodeId: newRow.id,
      changed: true,
    };
  }

  const columnId = resolveColumnDropTarget(index, target, selectedNodeId);
  if (!columnId) {
    return { schema, selectedNodeId, changed: false };
  }
  return addComponentToColumn(schema, columnId, item.type, item.displayName, options.getComponentContract?.(item.type));
}

export function updateLayoutNodeProperties(
  schema: UISchema,
  nodeId: string,
  patch: LayoutNodePatch,
): UISchema {
  const sections = schema.sections ?? [];
  const nextSections = updateLayoutNode(sections, nodeId, (node) => patchLayoutNode(node, patch));
  return {
    ...schema,
    sections: nextSections,
  };
}

function patchLayoutNode(node: LayoutTreeNode, patch: LayoutNodePatch): LayoutTreeNode {
  if (node.kind === 'section') {
    return {
      ...node,
      title: 'title' in patch ? toOptionalText(patch.title) : node.title,
      label: 'label' in patch ? toOptionalText(patch.label) : node.label,
      className: 'className' in patch ? toOptionalText(patch.className) : node.className,
    };
  }

  if (node.kind === 'row') {
    return {
      ...node,
      label: 'label' in patch ? toOptionalText(patch.label) : node.label,
      className: 'className' in patch ? toOptionalText(patch.className) : node.className,
    };
  }

  if (node.kind === 'column') {
    return {
      ...node,
      label: 'label' in patch ? toOptionalText(patch.label) : node.label,
      className: 'className' in patch ? toOptionalText(patch.className) : node.className,
      span: 'span' in patch ? clampSpan(patch.span) : node.span,
    };
  }

  return {
    ...node,
    label: 'label' in patch ? toOptionalText(patch.label) : node.label,
    className: 'className' in patch ? toOptionalText(patch.className) : node.className,
    componentSpan: 'componentSpan' in patch ? clampSpan(patch.componentSpan) : node.componentSpan,
  };
}

function addComponentToColumn(
  schema: UISchema,
  columnId: string,
  componentType: string,
  displayName: string,
  contract?: ComponentContract,
): DropOperationResult {
  const sections = schema.sections ?? [];
  const existingComponentIds = new Set((schema.components ?? []).map((component) => component.id));
  const componentId = createUniqueComponentId(componentType, existingComponentIds);
  const componentNode = createLayoutComponentNode(componentId, {
    componentType,
    label: displayName,
  });

  const nextSections = appendChildToColumn(sections, columnId, componentNode);
  const baseComponent = createDefaultUIComponent(componentId, componentType);
  const defaultProps = (contract?.defaultProps ?? {}) as Record<string, JSONValue>;
  const nextComponents = [
    ...schema.components,
    {
      ...baseComponent,
      adapterHint: contract?.adapterHint ?? baseComponent.adapterHint,
      props: { ...(baseComponent.props ?? {}), ...defaultProps },
    },
  ];

  return {
    schema: {
      ...schema,
      sections: nextSections,
      components: nextComponents,
    },
    selectedNodeId: componentNode.id,
    changed: true,
  };
}

export function getComponentById(schema: UISchema, componentId: string): UIComponent | undefined {
  return schema.components.find((component) => component.id === componentId);
}

export function updateComponentProps(
  schema: UISchema,
  componentId: string,
  patch: Record<string, JSONValue | undefined>,
): UISchema {
  const nextComponents = schema.components.map((component) => {
    if (component.id !== componentId) return component;
    const nextProps: Record<string, JSONValue> = { ...(component.props ?? {}) };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        delete nextProps[key];
      } else {
        nextProps[key] = value;
      }
    }
    return {
      ...component,
      props: nextProps,
    };
  });

  return {
    ...schema,
    components: nextComponents,
  };
}

function addNestedSectionToColumn(
  schema: UISchema,
  columnId: string,
  title: string,
): DropOperationResult {
  const sections = schema.sections ?? [];
  const nestedSection = createSectionNode({
    title,
  });
  const nextSections = appendChildToColumn(sections, columnId, nestedSection);
  return {
    schema: {
      ...schema,
      sections: nextSections,
    },
    selectedNodeId: nestedSection.id,
    changed: true,
  };
}

function resolveSectionDropTarget(
  index: LayoutIndex,
  target: DropTarget,
  selectedNodeId: string | null,
  sections: SectionNode[],
): string | undefined {
  if (target.kind === 'section') {
    return target.sectionId;
  }

  if (target.kind === 'row') {
    return index.rowToSection.get(target.rowId);
  }

  if (target.kind === 'column') {
    return index.columnToSection.get(target.columnId);
  }

  if (selectedNodeId) {
    const selectedSectionId = getOwningSectionId(index, selectedNodeId);
    if (selectedSectionId) {
      return selectedSectionId;
    }
  }

  return sections[0]?.id;
}

function resolveColumnDropTarget(
  index: LayoutIndex,
  target: DropTarget,
  selectedNodeId: string | null,
): string | undefined {
  if (target.kind === 'column') {
    return target.columnId;
  }

  if (target.kind === 'row') {
    return findFirstColumnIdForRow(index, target.rowId);
  }

  if (target.kind === 'section') {
    return findFirstColumnIdForSection(index, target.sectionId);
  }

  if (selectedNodeId) {
    const selectedNode = index.nodeById.get(selectedNodeId);
    if (selectedNode?.kind === 'column') {
      return selectedNode.id;
    }
    if (selectedNode?.kind === 'row') {
      return findFirstColumnIdForRow(index, selectedNode.id);
    }
    if (selectedNode?.kind === 'section') {
      return findFirstColumnIdForSection(index, selectedNode.id);
    }
    if (selectedNode?.kind === 'component') {
      return index.componentToColumn.get(selectedNode.id);
    }
  }

  const firstRow = Array.from(index.rowById.values())[0];
  if (!firstRow) {
    return undefined;
  }
  return findFirstColumnIdForRow(index, firstRow.id);
}

function findFirstColumnIdForSection(index: LayoutIndex, sectionId: string): string | undefined {
  const section = index.sectionById.get(sectionId);
  const firstRow = section?.rows[0];
  if (!firstRow) {
    return undefined;
  }
  return firstRow.columns[0]?.id;
}

function findFirstColumnIdForRow(index: LayoutIndex, rowId: string): string | undefined {
  const row = index.rowById.get(rowId);
  return row?.columns[0]?.id;
}

function getOwningSectionId(index: LayoutIndex, nodeId: string): string | undefined {
  if (index.sectionById.has(nodeId)) {
    return nodeId;
  }
  if (index.rowToSection.has(nodeId)) {
    return index.rowToSection.get(nodeId);
  }
  if (index.columnToSection.has(nodeId)) {
    return index.columnToSection.get(nodeId);
  }

  const componentColumnId = index.componentToColumn.get(nodeId);
  if (componentColumnId) {
    return index.columnToSection.get(componentColumnId);
  }

  return undefined;
}

function createUniqueComponentId(componentType: string, takenIds: Set<string>): string {
  const base = componentType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const normalizedBase = base.length > 0 ? base : 'component';

  let suffix = 1;
  let candidate = `${normalizedBase}-${suffix}`;

  while (takenIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }

  return candidate;
}

function toOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampSpan(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(GRID_COLUMN_MAX, Math.round(value)));
}
