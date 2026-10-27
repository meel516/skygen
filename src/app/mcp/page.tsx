'use client';

import { ArrowLeft, Video, Key, Code, Terminal } from '@/components/ui/studio-icons';
import Link from 'next/link';

export default function McpGuidePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--background)',
        color: 'var(--foreground)',
        backgroundImage: 'none',
      }}
    >
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b"
        style={{
          background: 'var(--background)',
          backdropFilter: 'none',
          borderColor: 'var(--border)',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div
            className="w-8 h-8 rounded-sm flex items-center justify-center shadow-none"
            style={{ background: `var(--primary)` }}
          >
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">SKYGEN</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] font-medium  hover:text-white"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-16 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Connect to your IDE with MCP
          </h1>
          <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>
            Use the Model Context Protocol to control SkyGen directly from Cursor, Claude Desktop, or any compatible AI assistant.
          </p>
        </div>

        {/* Step 1: Get an API Key */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/20 text-primary border border-primary/30">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold">1. Generate an API Key</h2>
          </div>
          <p style={{ color: 'var(--muted-foreground)' }}>
            First, you need a Personal Access Token. Log into your account, go to Account Settings &gt; API Keys, and click "Generate Key".
          </p>
          <div className="rounded-sm overflow-hidden border border-white/10 shadow-none">
            <img src="/api-keys.png" alt="API Keys Page" className="w-full h-auto" />
          </div>
        </section>

        {/* Step 2: Configure your IDE */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Code className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold">2. Configure your IDE</h2>
          </div>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Depending on your AI assistant, configure the MCP server by adding this to your <code>.mcp.json</code> or Claude Desktop config.
          </p>
          <div className="bg-black/50 p-6 rounded-sm border border-white/10 font-mono text-sm overflow-x-auto text-green-400">
            <pre>{`{
  "mcpServers": {
    "skygen": {
      "command": "npx",
      "args": ["-y", "@skygen/mcp"],
      "env": {
        "VIDEOGEN_API_KEY": "sk-vg-your-key-here"
      }
    }
  }
}`}</pre>
          </div>
        </section>

        {/* Step 3: Start Building */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold">3. Start Building!</h2>
          </div>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Once connected, you can ask your AI IDE to:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4" style={{ color: 'var(--foreground)' }}>
            <li>Fetch the latest cinematic patterns and story arcs.</li>
            <li>Render videos directly to MP4 from your local project.</li>
            <li>Update your video's metadata and visual style.</li>
            <li>Create, modify, and package custom plugins.</li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
        © 2026 SKYGEN
      </footer>
    </div>
  );
}
