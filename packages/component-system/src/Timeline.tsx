import { VirtualList } from './virtualization/VirtualList';
import styles from './Timeline.module.css';
import { buildDummyTimelineEntries } from './dummy-data';

export interface TimelineEntry {
  id: string;
  title: string;
  timestamp?: string;
  description?: string;
}

export interface TimelineProps {
  items: TimelineEntry[];
  height?: number;
  retentionKey?: string;
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
  useDummyDataWhenEmpty?: boolean;
}

export function Timeline({
  items,
  height = 420,
  retentionKey,
  hasNextPage,
  nextCursor,
  onRequestNextPage,
  useDummyDataWhenEmpty = true,
}: TimelineProps) {
  const resolvedItems = items.length > 0 || !useDummyDataWhenEmpty ? items : buildDummyTimelineEntries(12);
  return (
    <VirtualList
      items={resolvedItems}
      height={height}
      estimateItemHeight={64}
      overscan={8}
      retentionKey={retentionKey}
      hasNextPage={hasNextPage}
      nextCursor={nextCursor}
      onRequestNextPage={onRequestNextPage}
      className={styles.timeline}
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <article className={styles.item}>
          <span className={styles.dot} aria-hidden="true" />
          <div>
            <p className={styles.title}>{item.title}</p>
            {item.description ? <p>{item.description}</p> : null}
            {item.timestamp ? <p className={styles.meta}>{item.timestamp}</p> : null}
          </div>
        </article>
      )}
    />
  );
}
