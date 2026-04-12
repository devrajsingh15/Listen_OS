"use client";

interface FeatureTipProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FeatureTip({
  title,
  description,
  actionLabel = "Open guide",
  onAction,
}: FeatureTipProps) {
  return (
    <section className="animate-fade-in ui-surface-panel rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Workflow Tip</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        </div>

        {actionLabel && (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-85"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}

