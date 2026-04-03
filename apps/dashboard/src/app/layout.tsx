import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claude Cloud Agent — Command Center',
  description: 'Full autonomous AI agent dashboard with multi-model routing, MCP integration, and Obsidian AI brain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] antialiased">
        <div className="flex h-screen">
          {/* Sidebar */}
          <nav className="w-64 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col">
            <div className="p-4 border-b border-[var(--card-border)]">
              <h1 className="text-lg font-semibold text-white">Claude Agent</h1>
              <p className="text-xs text-[var(--muted)] mt-1">Command Center v2.0</p>
            </div>
            <div className="flex-1 p-3 space-y-1">
              <NavItem href="/" label="Dashboard" />
              <NavItem href="/sessions" label="Sessions" />
              <NavItem href="/agents" label="Agent Teams" />
              <NavItem href="/tools" label="Tools" />
              <NavItem href="/memory" label="Memory & Brain" />
              <NavItem href="/mcp" label="MCP Servers" />
              <NavItem href="/plugins" label="Plugins" />
              <NavItem href="/settings" label="Settings" />
            </div>
            <div className="p-3 border-t border-[var(--card-border)]">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)]">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                System Online
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 text-sm rounded-md text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
    >
      {label}
    </a>
  );
}
