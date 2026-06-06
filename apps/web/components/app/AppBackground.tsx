/**
 * AppBackground — single bg.png texture overlay.
 * Body already has the .app-background gradient from globals.css;
 * this just adds the subtle image texture on top.
 */
export function AppBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg.png')",
          opacity: 0.3,
        }}
      />
    </div>
  );
}
