'use client';

import { AudioTracksPanel } from './AudioTracksPanel';

export function AudioPanelTab() {
  return (
    <div className="w-[280px] h-full overflow-hidden bg-card dark:bg-[var(--card)]">
      <AudioTracksPanel />
    </div>
  );
}
