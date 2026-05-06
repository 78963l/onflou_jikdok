'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin/textbooks', label: '교재 관리' },
  { href: '/admin/sentences', label: '문장 관리' },
  { href: '/admin/tools', label: '문장 도구' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 min-h-screen bg-white border-r border-zinc-200 flex flex-col shrink-0">
      <div className="px-5 py-4 border-b border-zinc-200">
        <span className="text-sm font-semibold text-zinc-900 tracking-tight">직독직해 Admin</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 text-sm rounded transition-colors ${
                isActive
                  ? 'bg-zinc-100 text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-zinc-900 mr-2.5 shrink-0" />
              )}
              {!isActive && <span className="w-1 h-1 mr-2.5 shrink-0" />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t border-zinc-200">
        <span className="text-xs text-zinc-400">v1.0.0</span>
      </div>
    </aside>
  );
}
