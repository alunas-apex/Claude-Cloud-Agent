'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/agents', label: 'Agent Teams' },
  { href: '/tools', label: 'Tools' },
  { href: '/memory', label: 'Memory & Brain' },
  { href: '/mcp', label: 'MCP Servers' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-64 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col">
      <div className="p-4 border-b border-[var(--card-border)]">
        <h1 className="text-lg font-semibold text-white">Claude Agent</h1>
        <p className="text-xs text-[var(--muted)] mt-1">Command Center v2.0</p>
      </div>
      <div className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="p-3 border-t border-[var(--card-border)]">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)]">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          System Online
        </div>
      </div>
    </nav>
  );
}
