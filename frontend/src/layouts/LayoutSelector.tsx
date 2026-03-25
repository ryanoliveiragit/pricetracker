"use client";

import type { ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";
import SidebarLayout from "./SidebarLayout";
import TopbarLayout from "./TopbarLayout";
import CompactLayout from "./CompactLayout";
import WideLayout from "./WideLayout";
import MinimalLayout from "./MinimalLayout";

export default function LayoutSelector({ children }: { children: ReactNode }) {
  const { layout } = useTheme();

  switch (layout) {
    case "topbar":
      return <TopbarLayout>{children}</TopbarLayout>;
    case "compact":
      return <CompactLayout>{children}</CompactLayout>;
    case "wide":
      return <WideLayout>{children}</WideLayout>;
    case "minimal":
      return <MinimalLayout>{children}</MinimalLayout>;
    case "sidebar":
    default:
      return <SidebarLayout>{children}</SidebarLayout>;
  }
}
