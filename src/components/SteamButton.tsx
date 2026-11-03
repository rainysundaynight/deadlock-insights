export function SteamButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} className={compact ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-secondary px-4 text-sm font-medium hover:border-primary/50" : "inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 font-semibold text-background hover:opacity-90"}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-9.96 9.2l5.35 2.21a2.83 2.83 0 0 1 1.6-.5l2.39-3.46v-.05a3.79 3.79 0 1 1 3.79 3.79h-.09l-3.4 2.43a2.84 2.84 0 0 1-5.63.6L2.3 14.6A10 10 0 1 0 12 2Zm-4.72 15.2-1.23-.5a2.13 2.13 0 1 0 1.17-2.9l1.27.53a1.57 1.57 0 1 1-1.2 2.9Zm9.5-7.22a2.53 2.53 0 1 0-2.53 2.52 2.53 2.53 0 0 0 2.53-2.52Zm-4.42 0a1.9 1.9 0 1 1 1.9 1.9 1.9 1.9 0 0 1-1.9-1.9Z" /></svg>
      {compact ? "Войти" : "Войти через Steam"}
    </button>
  );
}
