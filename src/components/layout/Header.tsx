import { Database, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  activeViewTitle: string;
}

export function Header({ activeViewTitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white/95 px-6 backdrop-blur transition-all">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">{activeViewTitle}</h1>
        <span className="hidden text-sm text-gray-400 md:inline">|</span>
        <span className="hidden text-xs text-gray-500 md:inline font-medium">
          GamifyTL Professor Outreach Platform
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <Database className="h-3.5 w-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Supabase Live:</span>
          <span className="font-mono text-[11px]">kiowzydhojinqonuvaxq</span>
        </div>

        <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 py-1 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
          <span>RLS Enforced</span>
        </Badge>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <picture>
            <source srcSet="/email-logo.webp" type="image/webp" />
            <img src="/email-logo.webp" alt="GamifyTL" className="h-8 w-8 rounded-full object-contain p-0.5 border border-gray-200 bg-white shadow-xs" />
          </picture>
        </div>
      </div>
    </header>
  );
}
