import type { ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

/** Character counter. Turns into an error style when over the limit. */
export function Counter({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const over = value > max
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        over ? "font-medium text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {value}/{max}
    </span>
  )
}

/** Inline message under a field. Polite live region so screen readers hear changes. */
export function FieldMessage({
  id,
  tone = "error",
  role,
  children,
}: {
  id?: string
  tone?: "error" | "warning" | "hint"
  /** "alert" for a problem that blocks publishing: announced at once and linked from the control. */
  role?: "alert"
  children: ReactNode
}) {
  return (
    <p
      id={id}
      role={role}
      aria-live={role ? undefined : "polite"}
      className={cn(
        "text-xs leading-relaxed",
        tone === "error" && "text-destructive",
        tone === "warning" && "text-amber-600 dark:text-amber-400",
        tone === "hint" && "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

/**
 * Red message for a publish problem at its element (a control that has no input of its own,
 * such as a button or a section). Renders nothing without a message. Link it with
 * aria-describedby={id} on the element.
 */
export function IssueMessage({ id, message }: { id: string; message: string | null | undefined }) {
  if (!message) return null
  return (
    <FieldMessage id={id} role="alert">
      {message}
    </FieldMessage>
  )
}

export function SectionHeading({
  id,
  title,
  description,
  aside,
}: {
  id: string
  title: string
  description?: string
  aside?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {aside}
    </div>
  )
}

/** Native checkbox row: the whole label is the hit target (no dead zones). */
export function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-2",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {description && (
          <span className="block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

/** Generic confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
