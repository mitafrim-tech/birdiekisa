import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" strokeWidth={2} />
      </div>
      <h3 className="font-display text-2xl mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 text-balance">{description}</p>
      {action}
    </div>
  );
}