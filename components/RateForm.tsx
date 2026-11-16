// Employer rating after (or during) a job. Workers see averages only, never the comment.
import { rateWorker } from "@/app/crew-actions";
import type { Rating } from "@/lib/types";

export function RateForm({ assignmentId, placementId, existing }: { assignmentId?: string; placementId?: string; existing?: Rating }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold text-brand" data-testid="rate-toggle">
        {existing ? `Your rating: quality ${existing.quality}/5 · safety ${existing.safety}/5 · ${existing.rehire ? "would rehire" : "wouldn't rehire"} (edit)` : "Rate this worker"}
      </summary>
      <form action={rateWorker} className="mt-2 space-y-2" data-testid="rate-form">
        {assignmentId && <input type="hidden" name="assignmentId" value={assignmentId} />}
        {placementId && <input type="hidden" name="placementId" value={placementId} />}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Quality of work
            <select name="quality" defaultValue={existing?.quality ?? 4} className="input mt-1">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
          </label>
          <label className="text-sm">Safety
            <select name="safety" defaultValue={existing?.safety ?? 4} className="input mt-1">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" name="rehire" value="yes" defaultChecked={existing ? existing.rehire : true} /> Would rehire</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="rehire" value="no" defaultChecked={existing ? !existing.rehire : false} /> Wouldn't rehire</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="addToCrew" defaultChecked /> Add to my crew list</label>
        </div>
        <textarea name="comment" defaultValue={existing?.comment} placeholder="Private note for you and your recruiter (the worker doesn't see this)" className="input min-h-16 text-sm" />
        <button className="btn-soft btn-sm">Save rating</button>
      </form>
    </details>
  );
}
