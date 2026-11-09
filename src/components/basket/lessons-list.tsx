import { formatDay } from "@/domain/dates";
import type { Lesson } from "@/domain/lessons";
import { Sparkle } from "../ui/icons";

export function LessonsList({ lessons }: { lessons: readonly Lesson[] }) {
  return (
    <ul className="grid gap-4">
      {lessons.map((l) => (
        <li key={`${l.key}-${l.learnedAt}`} className="flex gap-3">
          <Sparkle className="mt-1 size-4 shrink-0 text-action" />
          <span>
            <span className="text-soft">{l.text}</span>
            <span className="mt-0.5 block text-sm text-muted">Learned {formatDay(l.learnedAt, { year: true })}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
