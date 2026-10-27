'use client';

import { useState } from 'react';

export function PluginBuildErrorPanel({ error, onEditDependencies, onAskAgent, agentBusy = false }: {
  error: string;
  onEditDependencies?: () => void;
  onAskAgent?: () => void;
  agentBusy?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(error);
      setCopyFailed(false);
    } catch { setCopyFailed(true); }
  };

  return (
    <div role="alert" className="w-full min-w-0 max-w-2xl flex flex-col gap-3 p-4 rounded-sm text-left"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
      <p className="text-xs font-semibold" style={{ color: '#F87171' }}>Preview failed</p>
      <pre className="w-full min-w-0 max-h-[45vh] overflow-auto whitespace-pre-wrap break-words select-text text-[11px] font-mono p-3 rounded-sm"
        style={{ color: '#FCA5A5', background: 'rgba(0,0,0,0.25)' }}>{error}</pre>
      <div className="flex flex-wrap gap-2 text-xs" style={{ color: '#FCA5A5' }}>
        {onEditDependencies && <button type="button" className="px-3 py-1.5 rounded-sm border border-red-400/25" onClick={onEditDependencies}>Edit dependencies</button>}
        <button type="button" className="px-3 py-1.5 rounded-sm border border-red-400/25" onClick={() => void copyError()}>{copied === error ? 'Copied' : 'Copy error'}</button>
        {onAskAgent && <button type="button" disabled={agentBusy} className="px-3 py-1.5 rounded-sm border border-red-400/25 disabled:opacity-40" onClick={onAskAgent}>Ask agent to fix</button>}
      </div>
      {copyFailed && <p className="text-[11px]" style={{ color: '#FCA5A5' }}>Could not copy automatically. Select the error text above to copy it.</p>}
    </div>
  );
}
