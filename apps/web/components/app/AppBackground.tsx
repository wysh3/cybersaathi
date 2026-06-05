/**
 * AppBackground — soft sky/lake atmospheric gradient (pack §6 AppBackground).
 * Rendered once on <body> via globals.css .app-background; this component
 * provides a stacked gradient + optional noise overlay for surfaces that
 * need a stronger ambient feel (the desktop glass frame).
 */
export function AppBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 18% 8%, rgba(180, 222, 255, 0.55), transparent 60%), " +
            "radial-gradient(ellipse 60% 50% at 92% 14%, rgba(255, 255, 255, 0.85), transparent 60%), " +
            "radial-gradient(ellipse 70% 50% at 50% 96%, rgba(199, 224, 255, 0.45), transparent 60%), " +
            "linear-gradient(180deg, #eaf7ff 0%, #f8fcff 45%, #e6f5ff 100%)",
        }}
      />
    </div>
  );
}
