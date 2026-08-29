import { CheckIcon } from "@/components/icons";

function goalToggleClass(done: boolean) {
  return `now-goal-check flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
    done
      ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
      : "border-[var(--border)] text-transparent"
  }`;
}

/** Static in production; an in-place bilingual checkbox on localhost. */
export default async function DevNowGoalToggleSlot(props: {
  source: string;
  sourceUk?: string;
  index: number;
  label: string;
  done: boolean;
}) {
  if (process.env.NODE_ENV !== "development") {
    return (
      <span aria-hidden className={goalToggleClass(props.done)}>
        <CheckIcon className="h-[17px] w-[17px]" />
      </span>
    );
  }
  const { default: DevNowGoalToggle } = await import("@/components/DevNowGoalToggle");
  return <DevNowGoalToggle {...props} />;
}
