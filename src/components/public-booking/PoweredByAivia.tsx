export const PoweredByAivia = () => {
  return (
    <a
      href="https://aiviaapp.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
    >
      <span>Powered by</span>
      <img
        src="/favicon.png"
        alt=""
        className="h-3.5 w-3.5 rounded-sm opacity-80"
      />
      <span className="font-semibold tracking-tight">Aivia</span>
    </a>
  );
};
