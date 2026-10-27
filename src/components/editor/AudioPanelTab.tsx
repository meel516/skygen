'use client';

import { AudioTracksPanel } from './AudioTracksPanel';

export function AudioPanelTab() {
  return (
    <div className="w-[280px] h-full overflow-hidden bg-white dark:bg-[#13131C] transition-colors">
      <AudioTracksPanel />
    </div>
  );
}
