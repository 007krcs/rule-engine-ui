import React from 'react';
import Link from 'next/link';
import { WorkspaceHeader } from '../../../components/WorkspaceHeader';

export default function LegacyBuilderPage() {
  return (
    <div>
      <WorkspaceHeader
        title='Legacy Builder'
        subtitle='Access the previous single-screen builder experience while the new console matures.'
      />
      <p>
        This view preserves the earlier builder features. For the latest capabilities, use the workspace console
        navigation on the left.
      </p>
      <p>
        <Link href="/">Return to home</Link>
      </p>
    </div>
  );
}
