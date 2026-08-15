import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AGENT_DEFINITIONS, type AgentId } from "@shared/factory";
import { ArrowLeft, Bot, CheckCircle2, CircleDotDashed, Clock3, FileText, GitBranch, Loader2, Pause, Play, RefreshCcw, ShieldAlert, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

const statusClass = (status: string) => {
  if (status === "SUCCEEDED" || status === "COMPLETED" || status === "APPROVED") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (status === "RUNNING" || status === "RETRYING" || status === "PLANNING") return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  if (status === "AWAITING_HUMAN_APPROVAL") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "FAILED" || status === "REJECTED") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
};

const statusIcon = (status: string) => {
  if (status === "SUCCEEDED" || status === "COMPLETED" || status === "APPROVED") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "FAILED" || status === "REJECTED") return <XCircle className="h-4 w-4" />;
  if (status === "RUNNING" || status === "RETRYING") return <Loader2 className="h-4 w-4 animate-spin" />;
  return <CircleDotDashed className="h-4 w-4" />;
};

export default function ProjectDetail({ projectId }: { projectId: number }) {
  const [, setLocation] = useLocation();
  const [retryLimit, setRetryLimit] = useState("");
  const [reviewLimit, setReviewLimit] = useState("");
  const utils = trpc.useUtils();
  const projectQuery = trpc.factory.get.useQuery({ projectId }, { refetchInterval: 5_000 });
  const runMutation = trpc.factory.run.useMutation({
    onSuccess: () => { toast.success("Workflow cycle completed."); utils.factory.get.invalidate({ projectId }); utils.factory.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const pauseMutation = trpc.factory.pause.useMutation({
    onSuccess: () => { toast.message("Workflow paused."); utils.factory.get.invalidate({ projectId }); },
    onError: error => toast.error(error.message),
  });
  const resolveMutation = trpc.factory.approvals.resolve.useMutation({
    onSuccess: ({ workflow }) => { toast.success(workflow ? workflow.message : "Approval recorded."); utils.factory.get.invalidate({ projectId }); utils.factory.approvals.listOpen.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const settingsMutation = trpc.factory.updateSettings.useMutation({
    onSuccess: () => { toast.success("Workflow limits saved."); setRetryLimit(""); setReviewLimit(""); utils.factory.get.invalidate({ projectId }); },
    onError: error => toast.error(error.message),
  });

  if (projectQuery.isLoading) return <ProjectDetailSkeleton />;
  if (projectQuery.error || !projectQuery.data?.project) {
    return <div className="mx-auto max-w-xl py-20 text-center text-slate-300"><TriangleAlert className="mx-auto mb-4 h-10 w-10 text-amber-300" /><h1 className="text-xl font-semibold">Project unavailable</h1><p className="mt-2 text-sm text-slate-400">This project could not be loaded or you do not have access to it.</p><Button className="mt-6" onClick={() => setLocation("/")}>Back to projects</Button></div>;
  }

  const { project, tasks, runs, events, approvals, artifacts, architectureDecisions, reviews, securityFindings, deployments, backgroundJobs } = projectQuery.data;
  const completed = tasks.filter(task => task.status === "SUCCEEDED").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const activeApprovals = approvals.filter(approval => approval.status === "AWAITING_HUMAN_APPROVAL");
  const settings = project.settings as { maxRetries?: number; maxReviewIterations?: number; defaultModel?: string };
  const maxRetries = settings.maxRetries ?? 3;
  const maxReviewIterations = settings.maxReviewIterations ?? 3;
  const activeBackgroundJob = backgroundJobs.find(job => job.status === "LEASED" || job.status === "QUEUED");

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-cyan-200"><ArrowLeft className="h-3.5 w-3.5" /> All projects</Link>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{project.name}</h1><Badge className={cn("gap-1.5 rounded-full px-2.5 py-1 font-medium", statusClass(project.status))}>{statusIcon(project.status)} {project.status.replaceAll("_", " ")}</Badge></div>
          <p className="max-w-3xl text-sm leading-6 text-slate-400">{project.rawRequirement}</p>
        </div>
        <div className="flex items-center gap-2"><Button variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800" disabled={pauseMutation.isPending} onClick={() => pauseMutation.mutate({ projectId })}><Pause className="mr-2 h-4 w-4" />Pause</Button><Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={runMutation.isPending || project.status === "AWAITING_HUMAN_APPROVAL"} onClick={() => runMutation.mutate({ projectId })}>{runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run workflow</Button></div>
      </div>

      {activeBackgroundJob && <Card className={cn("border-cyan-300/20 bg-cyan-300/[0.05]", activeBackgroundJob.status === "LEASED" && "shadow-[0_0_36px_rgba(34,211,238,0.06)]")}><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Loader2 className={cn("h-4 w-4", activeBackgroundJob.status === "LEASED" && "animate-spin")} /></div><div><p className="text-sm font-medium text-cyan-100">Persistent worker {activeBackgroundJob.status === "LEASED" ? "is processing this project" : "has queued this project"}</p><p className="mt-0.5 text-xs text-slate-400">{activeBackgroundJob.status === "LEASED" ? "A durable lease protects this work if the service restarts." : "The worker will claim this workflow without holding your browser request open."}</p></div></div><Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/10 font-mono text-[10px] text-cyan-100">{activeBackgroundJob.status} · attempt {activeBackgroundJob.attemptCount}/{activeBackgroundJob.maxAttempts}</Badge></CardContent></Card>}

      {activeApprovals.map(approval => (
        <Card key={approval.id} className="overflow-hidden border-amber-300/30 bg-amber-300/[0.07] shadow-[0_0_45px_rgba(251,191,36,0.08)]">
          <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-transparent" />
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4"><div className="mt-0.5 rounded-xl bg-amber-300/15 p-2.5 text-amber-200"><ShieldAlert className="h-5 w-5" /></div><div><p className="text-sm font-medium text-amber-100">Human decision required</p><h2 className="mt-1 text-lg font-semibold text-white">{approval.requestedAction}</h2><p className="mt-1 text-sm leading-6 text-amber-100/70">{approval.rationale}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.15em] text-amber-200/70">{approval.action.replaceAll("_", " ")}</p></div></div>
            <div className="flex shrink-0 gap-2"><Button variant="outline" className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate({ approvalId: approval.id, approved: false })}>Reject</Button><Button className="bg-amber-300 text-slate-950 hover:bg-amber-200" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate({ approvalId: approval.id, approved: true })}>Approve and continue</Button></div>
          </CardContent>
        </Card>
      ))}

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-950/60 shadow-2xl shadow-black/20"><CardHeader className="pb-4"><div className="flex items-center justify-between"><div><CardTitle className="text-base text-white">Workflow execution graph</CardTitle><CardDescription className="mt-1 text-slate-400">Live refresh every five seconds from the durable event store.</CardDescription></div><span className="font-mono text-xs text-cyan-200">{completed}/{tasks.length} agents complete</span></div><Progress value={progress} className="mt-4 h-2 bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-violet-400" /></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{tasks.map(task => { const definition = AGENT_DEFINITIONS[task.agentId as AgentId]; return <div key={task.id} className={cn("group rounded-xl border p-3 transition", task.status === "RUNNING" ? "border-cyan-400/40 bg-cyan-400/[0.07]" : "border-slate-800 bg-slate-900/45 hover:border-slate-700")}><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Bot className={cn("h-4 w-4 shrink-0", task.status === "SUCCEEDED" ? "text-emerald-300" : task.status === "RUNNING" ? "text-cyan-300" : "text-slate-500")} /><span className="truncate text-sm font-medium text-slate-200">{definition.label}</span></div><Badge variant="outline" className={cn("shrink-0 border text-[10px]", statusClass(task.status))}>{task.status}</Badge></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{definition.purpose}</p>{task.attemptCount > 0 && <p className="mt-2 font-mono text-[10px] text-slate-500">attempt {task.attemptCount}/{task.maxAttempts}</p>}</div>})}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Sparkles className="h-4 w-4 text-violet-300" />Project intelligence</CardTitle></CardHeader><CardContent className="space-y-4"><Metric label="Current phase" value={project.currentPhase} /><Metric label="Configured retries" value={`${maxRetries}`} /><Metric label="Review iterations" value={`${maxReviewIterations}`} /><Metric label="Selected model" value={settings.defaultModel ?? "gpt-5-mini"} mono /><Separator className="bg-slate-800" /><div className="grid grid-cols-2 gap-2"><div><label className="text-[11px] text-slate-500">Max retries</label><Input min={0} max={8} type="number" value={retryLimit} placeholder={String(maxRetries)} onChange={event => setRetryLimit(event.target.value)} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-slate-100 placeholder:text-slate-600" /></div><div><label className="text-[11px] text-slate-500">Review cycles</label><Input min={1} max={10} type="number" value={reviewLimit} placeholder={String(maxReviewIterations)} onChange={event => setReviewLimit(event.target.value)} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-slate-100 placeholder:text-slate-600" /></div></div><Button size="sm" variant="outline" className="w-full border-violet-400/20 bg-violet-400/5 text-violet-100 hover:bg-violet-400/15" disabled={settingsMutation.isPending || (!retryLimit && !reviewLimit)} onClick={() => settingsMutation.mutate({ projectId, settings: { ...(retryLimit ? { maxRetries: Number(retryLimit) } : {}), ...(reviewLimit ? { maxReviewIterations: Number(reviewLimit) } : {}) } })}>{settingsMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}Save workflow limits</Button><div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.06] p-3"><p className="text-xs font-medium text-violet-200">Durable by design</p><p className="mt-1 text-xs leading-5 text-slate-400">Task state, attempts, decisions, approvals, and artifacts are persisted so this workflow can resume after a restart.</p></div></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-slate-950/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Clock3 className="h-4 w-4 text-cyan-300" />Execution trace</CardTitle><CardDescription className="text-slate-500">Every state transition is recorded for auditability.</CardDescription></CardHeader><CardContent><ScrollArea className="h-[380px] pr-4"><div className="relative space-y-1 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-slate-800">{events.map(event => <div key={event.id} className="relative flex gap-3 py-2.5 pl-0"><span className={cn("z-10 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950", event.eventType.includes("FAILED") ? "bg-rose-400" : event.eventType.includes("APPROVAL") ? "bg-amber-300" : "bg-cyan-400")} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm text-slate-200">{event.summary}</p><span className="font-mono text-[10px] uppercase tracking-wide text-slate-600">{event.eventType}</span></div><p className="mt-0.5 text-xs text-slate-500">{event.actor} · {new Date(event.createdAt).toLocaleString()}</p></div></div>)}{events.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No events recorded yet.</p>}</div></ScrollArea></CardContent></Card>
        <div className="space-y-4"><Card className="border-slate-800 bg-slate-950/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><FileText className="h-4 w-4 text-emerald-300" />Generated artifacts</CardTitle></CardHeader><CardContent className="space-y-2">{artifacts.slice(0, 6).map(artifact => <a key={artifact.id} href={artifact.storageUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 transition hover:border-emerald-300/30 hover:bg-slate-900"><div className="min-w-0"><p className="truncate text-sm text-slate-200">{artifact.name}</p><p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{artifact.kind}</p></div><FileText className="h-4 w-4 shrink-0 text-slate-500" /></a>)}{artifacts.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Artifacts will appear as agents complete.</p>}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><GitBranch className="h-4 w-4 text-violet-300" />Recent agent runs</CardTitle></CardHeader><CardContent className="space-y-2">{runs.slice(0, 5).map(run => <div key={run.id} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2"><div><p className="text-sm text-slate-200">{AGENT_DEFINITIONS[run.agentId as AgentId].label}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{run.model ?? "model pending"} · attempt {run.attempt}</p></div><Badge variant="outline" className={cn("border text-[10px]", statusClass(run.status))}>{run.status}</Badge></div>)}{runs.length === 0 && <p className="py-5 text-center text-sm text-slate-500">No agent runs recorded yet.</p>}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/60"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><ShieldAlert className="h-4 w-4 text-amber-300" />Governance findings</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Architecture decisions</p><p className="mt-1 text-sm text-slate-300">{architectureDecisions.length ? `${architectureDecisions.length} proposed decision${architectureDecisions.length === 1 ? "" : "s"}` : "Awaiting architect output"}</p></div><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Code review</p><p className="mt-1 text-sm text-slate-300">{reviews.length ? `${reviews.length} review finding${reviews.length === 1 ? "" : "s"}` : "Awaiting reviewer output"}</p></div><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Security review</p><p className="mt-1 text-sm text-slate-300">{securityFindings.length ? `${securityFindings.length} finding${securityFindings.length === 1 ? "" : "s"}` : "Awaiting security output"}</p></div><Separator className="bg-slate-800" /><div className="flex items-center justify-between"><span className="text-xs text-slate-500">Deployment record</span><Badge variant="outline" className={cn("border text-[10px]", deployments[0] ? statusClass(deployments[0].status) : "border-slate-700 text-slate-500")}>{deployments[0]?.status ?? "NOT PREPARED"}</Badge></div></CardContent></Card></div>
      </section>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-center justify-between gap-4"><span className="text-xs text-slate-500">{label}</span><span className={cn("max-w-[180px] truncate text-right text-sm font-medium text-slate-200", mono && "font-mono text-xs text-cyan-200")}>{value}</span></div>; }

function ProjectDetailSkeleton() { return <div className="mx-auto max-w-[1440px] space-y-6"><Skeleton className="h-5 w-28 bg-slate-800" /><Skeleton className="h-10 w-2/5 bg-slate-800" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-80 bg-slate-900" /><Skeleton className="h-80 bg-slate-900 lg:col-span-2" /></div></div>; }
