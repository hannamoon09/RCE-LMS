import { NavLink } from "react-router-dom";
import { designOptions } from "@/data/mockData";
import { cn } from "@/lib/utils";

export function RouteTabs() {
  return (
    <nav aria-label="Dashboard designs" className="flex gap-2 overflow-x-auto px-5 py-4 sm:px-8">
      {designOptions.map((option) => (
        <NavLink
          key={option.id}
          to={option.href}
          className={({ isActive }) =>
            cn(
              "shrink-0 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              isActive && "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )
          }
        >
          {option.title}
        </NavLink>
      ))}
    </nav>
  );
}
