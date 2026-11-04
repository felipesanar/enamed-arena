export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:min-h-11 focus:rounded-lg focus:bg-background focus:px-4 focus:py-3 focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
      onClick={() => {
        const main = document.getElementById('main-content');
        main?.focus({ preventScroll: true });
        main?.scrollIntoView?.({ behavior: 'instant', block: 'start' });
      }}
    >
      Pular para o conteúdo
    </a>
  );
}
