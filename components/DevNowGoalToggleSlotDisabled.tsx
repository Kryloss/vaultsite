import { CheckIcon } from "@/components/icons";

function goalToggleClass(done: boolean) {
  return `now-goal-check flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
    done
      ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
      : "border-[var(--border)] text-transparent"
  }`;
}

/** Production-only static goal marker; it contains no local editor code. */
export default function DevNowGoalToggleSlotDisabled({ done }: { done: boolean }) {
  return (
    <span aria-hidden className={goalToggleClass(done)}>
      <CheckIcon className="h-[17px] w-[17px]" />
    </span>
  );
}
