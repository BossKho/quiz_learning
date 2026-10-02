import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  BookOpen, 
  Search, 
  Home, 
  HelpCircle, 
  Maximize, 
  GraduationCap
} from 'lucide-react';
import type { Deck } from '@/types/quiz';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: Deck[];
  onSelectDeck: (deck: Deck, mode: 'study' | 'exam') => void;
  onNavigate: (view: string) => void;
  onToggleZenMode: () => void;
  onOpenShortcutsHelp: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  decks,
  onSelectDeck,
  onNavigate,
  onToggleZenMode,
  onOpenShortcutsHelp,
}) => {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, deck name, or action..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => {
              onNavigate('dashboard');
              onOpenChange(false);
            }}
          >
            <Home className="size-4" />
            <span>Dashboard</span>
            <CommandShortcut>Esc</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNavigate('explorer');
              onOpenChange(false);
            }}
          >
            <Search className="size-4" />
            <span>Question Search & Leitner Explorer</span>
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onToggleZenMode();
              onOpenChange(false);
            }}
          >
            <Maximize className="size-4" />
            <span>Toggle Zen Focus Mode</span>
            <CommandShortcut>Ctrl+Shift+F</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenShortcutsHelp();
              onOpenChange(false);
            }}
          >
            <HelpCircle className="size-4" />
            <span>Keyboard Shortcuts Guide</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Study Decks (Instant Feedback)">
          {decks.map((deck) => (
            <CommandItem
              key={`study-${deck.id}`}
              onSelect={() => {
                onSelectDeck(deck, 'study');
                onOpenChange(false);
              }}
            >
              <BookOpen className="size-4 text-emerald-500" />
              <span>Study: {deck.title}</span>
              <span className="text-xs text-muted-foreground ml-1">({deck.total_questions} Qs)</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Exam Decks (Strict Simulation)">
          {decks.map((deck) => (
            <CommandItem
              key={`exam-${deck.id}`}
              onSelect={() => {
                onSelectDeck(deck, 'exam');
                onOpenChange(false);
              }}
            >
              <GraduationCap className="size-4 text-amber-500" />
              <span>Exam: {deck.title}</span>
              <span className="text-xs text-muted-foreground ml-1">({deck.total_questions} Qs, 60m)</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
