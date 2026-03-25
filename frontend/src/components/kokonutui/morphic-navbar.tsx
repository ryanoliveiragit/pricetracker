"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  name: string;
}

interface MorphicNavbarProps {
  items?: NavItem[];
}

const defaultItems: NavItem[] = [
  { href: "/", name: "home" },
  { href: "/works", name: "works" },
  { href: "/blog", name: "blog" },
  { href: "/about", name: "about" }
];

export function MorphicNavbar({ items = defaultItems }: MorphicNavbarProps) {
  const pathname = usePathname();

  const isActiveLink = (path: string) => {
    if (!pathname) {
      return false;
    }

    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-center">
        <div className="glass flex items-center justify-between overflow-hidden rounded-xl border border-[#2e2250] bg-black/30 backdrop-blur-sm">
          {items.map(({ href, name }, index, array) => {
            const path = href;
            const isActive = isActiveLink(path);
            const isFirst = index === 0;
            const isLast = index === array.length - 1;
            const prevPath = index > 0 ? array[index - 1].href : null;
            const nextPath = index < array.length - 1 ? array[index + 1].href : null;

            return (
              <Link
                className={clsx(
                  "flex items-center justify-center bg-transparent p-1.5 px-4 text-sm text-violet-100 transition-all duration-300",
                  isActive
                    ? "mx-2 rounded-xl bg-brand-500/20 font-semibold text-white"
                    : clsx(
                        (isActiveLink(prevPath || "") || isFirst) &&
                          "rounded-l-xl",
                        (isActiveLink(nextPath || "") || isLast) &&
                          "rounded-r-xl"
                      )
                )}
                href={path}
                key={path}
              >
                {name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default MorphicNavbar;
