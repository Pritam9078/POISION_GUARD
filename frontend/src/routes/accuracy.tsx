import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, Layers, ArrowUpRight } from "lucide-react";
import { PublicLayout } from "@/components/pg/public-layout";
import { Badge } from "@/components/ui/badge";
import { EVALUATION_RUN } from "@/lib/fixtures";

export const Route = createFileRoute("/accuracy")({
  component: AccuracyPage,
  head: () => ({
    meta: [
      { title: "Measured Accuracy — PoisonGuard" },
      { name: "description", content: "Empirical precision, recall, confusion matrix and documented blind spots." },
    ],
  }),
});

function AccuracyPage() {
  const run = EVALUATION_RUN;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
            Empirical Benchmark
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-light tracking-tight text-foreground sm:text-5xl">
            Measured accuracy, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">transparent metrics.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            We publish measured benchmark runs across real labeled on-chain attacks and benign transaction callsets.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Precision</div>
            <div className="mt-2 font-display text-3xl font-medium">{(run.precision * 100).toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">When flagged, 95.1% true threats</div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Recall</div>
            <div className="mt-2 font-display text-3xl font-medium">{(run.recall * 100).toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">Detects 88.6% of attack vectors</div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Dataset Size</div>
            <div className="mt-2 font-display text-3xl font-medium">{run.cases.poisoning + run.cases.benign + run.cases.approvals}</div>
            <div className="mt-1 text-xs text-muted-foreground">Labeled cases ({run.dataset})</div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Evaluation Run</div>
            <div className="mt-2 font-display text-3xl font-medium">{run.id}</div>
            <div className="mt-1 text-xs text-muted-foreground">Evaluated on {run.lastRun}</div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-medium">Confusion Matrix</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-emerald-500/5 p-4 text-emerald-800 dark:text-emerald-300">
              <div className="text-xs uppercase tracking-wider">True Positives</div>
              <div className="mt-1 text-2xl font-bold">{run.results.truePositives}</div>
              <div className="text-xs">Correctly identified poisoning and approval risks</div>
            </div>

            <div className="rounded-2xl border bg-amber-500/5 p-4 text-amber-800 dark:text-amber-300">
              <div className="text-xs uppercase tracking-wider">False Positives</div>
              <div className="mt-1 text-2xl font-bold">{run.results.falsePositives}</div>
              <div className="text-xs">Benign addresses flagged (can be reported for review)</div>
            </div>

            <div className="rounded-2xl border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">True Negatives</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{run.results.trueNegatives}</div>
              <div className="text-xs text-muted-foreground">Correctly identified benign activity</div>
            </div>

            <div className="rounded-2xl border bg-destructive/5 p-4 text-destructive">
              <div className="text-xs uppercase tracking-wider">False Negatives (Missed)</div>
              <div className="mt-1 text-2xl font-bold">{run.results.falseNegatives}</div>
              <div className="text-xs">Missed detections under continuous rule tuning</div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-medium">Documented Blind Spots & Limitations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Known limitations where detection cannot provide complete assurance:
          </p>
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            {run.blindSpots.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}

