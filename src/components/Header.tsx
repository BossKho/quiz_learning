import { Button } from '@/components/ui/button';
import { 
  Search, 
  Home, 
  Maximize2, 
  Minimize2 
} from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCommandPalette: () => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCommandPalette,
  isZenMode,
  onToggleZenMode,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-xs transition-transform group-hover:scale-105">
              Q
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                Quiz Learning <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Pro</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-none">
                Bilingual Enterprise Practice
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Button
              variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('dashboard')}
              className="gap-1.5"
            >
              <Home className="size-3.5" />
              Dashboard
            </Button>
            <Button
              variant={currentView === 'explorer' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('explorer')}
              className="gap-1.5"
            >
              <Search className="size-3.5" />
              Question Search
            </Button>
          </nav>
        </div>

        {/* Right: Search bar shortcut, Zen mode, Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="size-3.5" />
            <span>Search questions or decks...</span>
            <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-[9px]">Ctrl</span>K
            </kbd>
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleZenMode}
            title={isZenMode ? "Exit Zen Mode (Ctrl+Shift+F)" : "Enter Zen Mode (Ctrl+Shift+F)"}
            className="text-muted-foreground hover:text-foreground"
          >
            {isZenMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
};
