import type { PropsWithChildren } from "react";

export function Layout({ children }: PropsWithChildren) {
  return <main className="app-shell">{children}</main>;
}
