"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["/", "Search"],
  ["Esc", "Clear search"],
  ["j / k", "Next / previous card"],
  ["Enter", "Open details"],
  ["o", "Open on X"],
  ["p", "Pin or unpin"],
  ["n", "Edit note"],
  ["t", "Edit tags"],
  ["c", "Copy link"],
  ["?", "This sheet"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center">
        <DialogHeader className="items-center text-center">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-raised/60 px-3 py-2">
              <kbd className="font-mono text-sm text-brand">{key}</kbd>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
