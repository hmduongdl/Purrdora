import { memo, useRef, type ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  fullscreen?: boolean;
}

const Layout = memo(function Layout({ children, fullscreen = false }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null);

  return (
    <div className="app-page-frame flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0a0a0f] text-[#e4e1e9]">
      <main
        ref={mainRef}
        className={`dashboard-main custom-scrollbar min-h-0 flex-1 overflow-y-auto${fullscreen ? " dashboard-fullscreen" : ""}`}
      >
        <div className="dashboard-columns w-full">
          {children}
        </div>
      </main>
    </div>
  );
});

export default Layout;
