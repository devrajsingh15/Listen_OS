"use client";

import * as React from "react";
import * as ScrollAreaPrimitives from "@radix-ui/react-scroll-area";
import * as SelectPrimitives from "@radix-ui/react-select";
import { Slottable } from "@radix-ui/react-slot";
import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@/utils/cn";
import type { PolymorphicComponentProps } from "@/utils/polymorphic";
import { tv, type VariantProps } from "@/utils/tv";

export const selectVariants = tv({
  slots: {
    triggerRoot: [
      "group/trigger min-w-0 shrink-0 border border-border text-sm font-medium text-foreground",
      "flex items-center text-left outline-none transition-colors duration-200",
      "disabled:pointer-events-none disabled:opacity-50 data-[placeholder]:text-muted",
      "focus:border-primary focus:outline-none",
    ],
    triggerArrow: [
      "ml-auto size-4 shrink-0 text-muted transition duration-200 ease-out",
      "group-data-[state=open]/trigger:rotate-180 group-hover/trigger:text-foreground",
      "group-disabled/trigger:text-muted",
    ],
    triggerIcon: [
      "h-4 w-auto min-w-0 shrink-0 object-contain text-muted transition duration-200 ease-out",
      "group-hover/trigger:text-foreground group-disabled/trigger:text-muted",
    ],
    selectItemIcon: [
      "size-4 shrink-0 text-muted [[data-disabled]_&]:text-muted/60",
    ],
  },
  variants: {
    size: {
      medium: {},
      small: {},
      xsmall: {},
    },
    variant: {
      default: {
        triggerRoot: "w-full rounded-lg bg-card hover:bg-sidebar-hover",
      },
      compact: {
        triggerRoot: "w-auto rounded-lg bg-card hover:bg-sidebar-hover",
      },
      compactForInput: {
        triggerRoot:
          "w-auto rounded-md border-0 bg-transparent shadow-none hover:bg-sidebar-hover",
      },
      inline: {
        triggerRoot:
          "h-5 min-h-5 w-auto gap-0 rounded-none border-0 bg-transparent p-0 text-muted hover:bg-transparent hover:text-foreground data-[state=open]:text-foreground",
        triggerIcon:
          "mr-1.5 text-muted group-hover/trigger:text-foreground group-data-[state=open]/trigger:text-foreground",
        triggerArrow:
          "ml-1 text-muted group-hover/trigger:text-foreground group-data-[state=open]/trigger:text-foreground",
      },
    },
    hasError: {
      true: {
        triggerRoot:
          "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20",
      },
    },
  },
  compoundVariants: [
    {
      size: "medium",
      variant: "default",
      class: {
        triggerRoot: "h-10 min-h-10 gap-2 px-3",
      },
    },
    {
      size: "small",
      variant: "default",
      class: {
        triggerRoot: "h-9 min-h-9 gap-2 px-3",
      },
    },
    {
      size: "xsmall",
      variant: "default",
      class: {
        triggerRoot: "h-8 min-h-8 gap-1.5 px-2.5 text-xs",
      },
    },
    {
      size: "medium",
      variant: "compact",
      class: {
        triggerRoot: "h-10 gap-2 px-3",
      },
    },
    {
      size: "small",
      variant: "compact",
      class: {
        triggerRoot: "h-9 gap-2 px-3",
      },
    },
    {
      size: "xsmall",
      variant: "compact",
      class: {
        triggerRoot: "h-8 gap-1.5 px-2.5 text-xs",
      },
    },
    {
      size: "medium",
      variant: "compactForInput",
      class: {
        triggerRoot: "h-10 px-2.5",
      },
    },
    {
      size: "small",
      variant: "compactForInput",
      class: {
        triggerRoot: "h-9 px-2",
      },
    },
    {
      size: "xsmall",
      variant: "compactForInput",
      class: {
        triggerRoot: "h-8 px-1.5 text-xs",
      },
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "medium",
  },
});

type SelectContextType = Pick<
  VariantProps<typeof selectVariants>,
  "variant" | "size" | "hasError"
>;

const SelectContext = React.createContext<SelectContextType>({
  size: "medium",
  variant: "default",
  hasError: false,
});

const useSelectContext = () => React.useContext(SelectContext);

const SelectRoot = ({
  size = "medium",
  variant = "default",
  hasError,
  ...rest
}: React.ComponentProps<typeof SelectPrimitives.Root> & SelectContextType) => {
  return (
    <SelectContext.Provider value={{ size, variant, hasError }}>
      <SelectPrimitives.Root {...rest} />
    </SelectContext.Provider>
  );
};
SelectRoot.displayName = "SelectRoot";

const SelectGroup = SelectPrimitives.Group;
SelectGroup.displayName = "SelectGroup";

const SelectValue = SelectPrimitives.Value;
SelectValue.displayName = "SelectValue";

const SelectSeparator = SelectPrimitives.Separator;
SelectSeparator.displayName = "SelectSeparator";

const SelectGroupLabel = SelectPrimitives.Label;
SelectGroupLabel.displayName = "SelectGroupLabel";

const SELECT_TRIGGER_ICON_NAME = "SelectTriggerIcon";

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Trigger>
>(({ className, children, ...rest }, forwardedRef) => {
  const { size, variant, hasError } = useSelectContext();
  const { triggerRoot, triggerArrow } = selectVariants({
    size,
    variant,
    hasError,
  });

  return (
    <SelectPrimitives.Trigger
      ref={forwardedRef}
      className={triggerRoot({ class: className })}
      {...rest}
    >
      <Slottable>{children}</Slottable>
      <SelectPrimitives.Icon asChild>
        <span className={triggerArrow()}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
        </span>
      </SelectPrimitives.Icon>
    </SelectPrimitives.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

function TriggerIcon<T extends React.ElementType = "div">({
  as,
  className,
  ...rest
}: PolymorphicComponentProps<T>) {
  const Component = as || "div";
  const { size, variant, hasError } = useSelectContext();
  const { triggerIcon } = selectVariants({ size, variant, hasError });

  return <Component className={triggerIcon({ class: className })} {...rest} />;
}
TriggerIcon.displayName = SELECT_TRIGGER_ICON_NAME;

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Content>
>(
  (
    {
      className,
      position = "popper",
      children,
      sideOffset = 8,
      collisionPadding = 8,
      ...rest
    },
    forwardedRef,
  ) => (
    <SelectPrimitives.Portal>
      <SelectPrimitives.Content
        ref={forwardedRef}
        className={cn(
          "relative z-50 overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
          "min-w-[--radix-select-trigger-width] max-w-[max(var(--radix-select-trigger-width),320px)]",
          "max-h-[--radix-select-content-available-height]",
          className,
        )}
        sideOffset={sideOffset}
        position={position}
        collisionPadding={collisionPadding}
        {...rest}
      >
        <ScrollAreaPrimitives.Root type="auto">
          <SelectPrimitives.Viewport asChild>
            <ScrollAreaPrimitives.Viewport
              style={{ overflowY: undefined }}
              className="max-h-[220px] w-full overflow-auto p-1.5"
            >
              {children}
            </ScrollAreaPrimitives.Viewport>
          </SelectPrimitives.Viewport>
          <ScrollAreaPrimitives.Scrollbar
            orientation="vertical"
            className="flex w-2 touch-none p-0.5"
          >
            <ScrollAreaPrimitives.Thumb className="w-1 rounded-full bg-border" />
          </ScrollAreaPrimitives.Scrollbar>
        </ScrollAreaPrimitives.Root>
      </SelectPrimitives.Content>
    </SelectPrimitives.Portal>
  ),
);

SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitives.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitives.Item>
>(({ className, children, ...rest }, forwardedRef) => {
  const { size } = useSelectContext();

  return (
    <SelectPrimitives.Item
      ref={forwardedRef}
      className={cn(
        "group relative cursor-pointer select-none rounded-lg px-3 py-2 pr-9 text-sm text-foreground",
        "flex items-center gap-2 outline-none transition-colors",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[highlighted]:bg-sidebar-hover data-[highlighted]:outline-0",
        "data-[state=checked]:bg-primary/10",
        size === "xsmall" && "gap-1.5 py-1.5 text-xs",
        className,
      )}
      {...rest}
    >
      <SelectPrimitives.ItemText asChild>
        <span
          className={cn(
            "flex flex-1 items-center gap-2",
            size === "xsmall" && "gap-1.5",
          )}
        >
          {typeof children === "string" ? (
            <span className="line-clamp-1">{children}</span>
          ) : (
            children
          )}
        </span>
      </SelectPrimitives.ItemText>
      <SelectPrimitives.ItemIndicator asChild>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-primary">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
        </span>
      </SelectPrimitives.ItemIndicator>
    </SelectPrimitives.Item>
  );
});

SelectItem.displayName = "SelectItem";

function SelectItemIcon<T extends React.ElementType = "div">({
  as,
  className,
  ...rest
}: PolymorphicComponentProps<T>) {
  const { size, variant } = useSelectContext();
  const { selectItemIcon } = selectVariants({ size, variant });
  const Component = as || "div";

  return (
    <Component className={selectItemIcon({ class: className })} {...rest} />
  );
}

export {
  SelectRoot as Root,
  SelectContent as Content,
  SelectGroup as Group,
  SelectGroupLabel as GroupLabel,
  SelectItem as Item,
  SelectItemIcon as ItemIcon,
  SelectSeparator as Separator,
  SelectTrigger as Trigger,
  TriggerIcon,
  SelectValue as Value,
};
