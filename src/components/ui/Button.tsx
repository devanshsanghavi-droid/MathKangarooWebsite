import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from '@/components/AppLink';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'ui inline-flex cursor-pointer items-center justify-center gap-2 rounded-control font-semibold no-underline ' +
  'transition-colors motion-reduce:transition-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

/*
 * primary   the single teal (docs/06 §1). --on-accent clears 4.5:1 on --accent-600 and on the
 *           --accent-700 hover fill in both themes; asserted in tokens.test.ts.
 * secondary a bordered neutral. --rule-strong is the 3:1 control boundary.
 * ghost     no chrome until hover. For low-emphasis actions in toolbars and card headers.
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border border-accent-600 bg-accent-600 text-on-accent hover:border-accent-700 hover:bg-accent-700',
  secondary: 'border border-rule-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'border border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
};

/* Every size clears the 44px tap target except `sm`, which is for dense desktop toolbars. */
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cx(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className);
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Icon before the label. Decorative: give it aria-hidden. */
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * A real <button>, `type="button"` unless told otherwise, so it never submits a form by
 * accident. No hooks, so it renders from a Server Component as-is and becomes interactive
 * inside a Client Component that passes onClick.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** A link that looks like a Button. Navigates, so it is an <a>, never a <button>. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
