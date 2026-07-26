import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legilimens Overlay",
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
