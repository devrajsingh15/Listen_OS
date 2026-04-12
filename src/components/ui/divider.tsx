import * as React from "react";

import { tv, type VariantProps } from "@/utils/tv";

const DIVIDER_ROOT_NAME = "DividerRoot";

export const dividerVariants = tv({
  base: "relative flex w-full items-center",
  variants: {
    variant: {
      line: "h-px w-full bg-border",
      "line-spacing": [
        "h-3",
        "before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:-translate-y-1/2 before:bg-border",
      ],
      "line-text": [
        "gap-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted",
        "before:h-px before:w-full before:flex-1 before:bg-border",
        "after:h-px after:w-full after:flex-1 after:bg-border",
      ],
      content: [
        "gap-2.5",
        "before:h-px before:w-full before:flex-1 before:bg-border",
        "after:h-px after:w-full after:flex-1 after:bg-border",
      ],
      text: "px-2 py-1 text-xs text-muted",
      "solid-text":
        "rounded-full bg-sidebar-hover px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted",
    },
  },
  defaultVariants: {
    variant: "line",
  },
});

function Divider({
  className,
  variant,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof dividerVariants>) {
  return (
    <div
      role="separator"
      className={dividerVariants({ variant, class: className })}
      {...rest}
    />
  );
}
Divider.displayName = DIVIDER_ROOT_NAME;

export { Divider as Root };
