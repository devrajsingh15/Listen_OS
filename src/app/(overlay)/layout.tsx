import { GeistSans } from "geist/font/sans";
import "../globals.css";

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`assistant-mode ${GeistSans.variable}`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        {/* Force-hide Next.js dev indicator in the assistant window */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            const style = document.createElement('style');
            style.innerHTML = 'nextjs-portal, [data-nextjs-dialog], [data-nextjs-toast], [data-nextjs-toast-wrapper], #__next-build-watcher, #__next-prerender-indicator { display: none !important; visibility: hidden !important; }';
            document.head.appendChild(style);
            
            const hideDevOverlay = () => {
              const elements = document.querySelectorAll('nextjs-portal, [data-nextjs-dialog], [data-nextjs-toast]');
              elements.forEach(el => {
                if (el.style) el.style.display = 'none';
              });
            };
            
            setInterval(hideDevOverlay, 100);
          })();
        `}} />
      </head>
      <body className="assistant-mode" suppressHydrationWarning>
        <main className="assistant-mode">
          {children}
        </main>
      </body>
    </html>
  );
}

