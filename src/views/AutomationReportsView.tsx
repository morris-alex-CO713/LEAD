import { Fragment, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Check, CheckCircle2, Clock3, FileCheck2, FileText, Globe2, Mail, MessageCircle, Play, Radar, RefreshCw, Search, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { BusinessListing } from '@/types';

interface DeliveryResult {
  channel: 'email' | 'whatsapp' | 'telegram';
  sent: boolean;
  skipped?: boolean;
  detail?: string;
}

interface AutomationReport {
  id: string;
  date: string;
  scanned: number;
  newLeads: number;
  highPriority: number;
  failedSearches: number;
  status: 'complete' | 'partial' | 'failed';
  startedAt?: string;
  completedAt?: { toDate?: () => Date; seconds?: number };
  topLead?: { name: string; leadScore: number; category?: string };
  newLeadNames?: string[];
  deliveries?: DeliveryResult[];
  errors?: Array<{ target?: { keyword?: string; location?: string }; error: string }>;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const STAGES = [
  { label: 'Activating', detail: 'Authorizing and loading targets', icon: Zap },
  { label: 'Discovering', detail: 'Searching overseas markets', icon: Globe2 },
  { label: 'Auditing', detail: 'Inspecting digital presence', icon: Radar },
  { label: 'Scoring', detail: 'Ranking commercial opportunity', icon: Activity },
  { label: 'Verifying', detail: 'Removing duplicates and weak matches', icon: ShieldCheck },
  { label: 'Drafting', detail: 'Preparing outreach for review', icon: FileText },
  { label: 'Reporting', detail: 'Saving results and notifications', icon: Send },
];

interface ReviewLead extends BusinessListing {
  outreachApprovalStatus?: 'pending_review' | 'approved' | 'sent' | 'rejected';
  outreachSubject?: string;
  outreachEmail?: string;
}

export default function AutomationReportsView() {
  const [reports, setReports] = useState<AutomationReport[]>([]);
  const [reviewLeads, setReviewLeads] = useState<ReviewLead[]>([]);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewSort, setReviewSort] = useState('priority');
  const [reviewPage, setReviewPage] = useState(1);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const filteredLeads = useMemo(() => {
    const search = reviewSearch.trim().toLowerCase();
    return reviewLeads.filter(lead =>
      (reviewFilter === 'all' || lead.outreachApprovalStatus === reviewFilter) &&
      [lead.name, lead.address, lead.email].some(value => value?.toLowerCase().includes(search))
    ).sort((a, b) => reviewSort === 'name' ? a.name.localeCompare(b.name) : (b.leadScore || 0) - (a.leadScore || 0) || a.name.localeCompare(b.name));
  }, [reviewLeads, reviewSearch, reviewFilter, reviewSort]);
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / 10));
  const currentPage = Math.min(reviewPage, pageCount);
  const visibleLeadIds = new Set(filteredLeads.slice((currentPage - 1) * 10, currentPage * 10).map(lead => lead.id));
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'running' | 'complete' | 'failed'>('idle');
  const [activeStage, setActiveStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [markets, setMarkets] = useState(() => localStorage.getItem('automation_markets') || 'Austin, TX\nToronto, Canada');
  const [niches, setNiches] = useState(() => localStorage.getItem('automation_niches') || 'Dental Clinics\nRoofing Contractors');
  const [maxResults, setMaxResults] = useState(() => Number(localStorage.getItem('automation_max_results') || 10));

  useEffect(() => {
    const reportsQuery = query(collection(db, 'daily_reports'), orderBy('completedAt', 'desc'), limit(30));
    const unsubscribeReports = onSnapshot(reportsQuery, snapshot => {
      setReports(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AutomationReport)));
      setLoading(false);
      setLoadError('');
    }, error => {
      console.error(error);
      setLoadError(error.message);
      setLoading(false);
    });
    const unsubscribeLeads = onSnapshot(collection(db, 'business_listings'), snapshot => {
      const leads = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ReviewLead));
      setReviewLeads(leads.filter(lead => ['pending_review', 'approved'].includes(lead.outreachApprovalStatus || '')));
    });
    return () => { unsubscribeReports(); unsubscribeLeads(); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const stageTimer = window.setInterval(() => setActiveStage(stage => Math.min(stage + 1, STAGES.length - 1)), 3500);
    const elapsedTimer = window.setInterval(() => setElapsed(seconds => seconds + 1), 1000);
    return () => { window.clearInterval(stageTimer); window.clearInterval(elapsedTimer); };
  }, [running]);

  const totals = useMemo(() => reports.reduce((summary, report) => ({
    scanned: summary.scanned + (report.scanned || 0),
    newLeads: summary.newLeads + (report.newLeads || 0),
    highPriority: summary.highPriority + (report.highPriority || 0),
  }), { scanned: 0, newLeads: 0, highPriority: 0 }), [reports]);

  const buildTargets = () => {
    const locations = markets.split('\n').map(value => value.trim()).filter(Boolean);
    const categories = niches.split('\n').map(value => value.trim()).filter(Boolean);
    return locations.flatMap(location => categories.map(keyword => ({ location, keyword, radius: 15, maxResults })));
  };

  const runNow = async () => {
    if (!auth.currentUser) return toast.error('Please sign in again.');
    const targets = buildTargets();
    if (!targets.length) return toast.error('Add at least one market and niche.');
    localStorage.setItem('automation_markets', markets);
    localStorage.setItem('automation_niches', niches);
    localStorage.setItem('automation_max_results', String(maxResults));
    setRunning(true); setRunState('running'); setActiveStage(0); setElapsed(0);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${API_BASE}/daily-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Automation failed (${response.status})`);
      setActiveStage(STAGES.length - 1); setRunState('complete');
      toast.success(`Automation complete: ${result.report?.newLeads || 0} new leads require review.`);
    } catch (error) {
      setRunState('failed');
      toast.error(error instanceof Error ? error.message : 'Could not run automation.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Scheduled Intelligence</p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground lg:text-3xl">Automation Control</h1>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Configure overseas targets, watch every activation stage, then review outreach before sending.</p>
        </div>
        <Button onClick={runNow} disabled={running} className="h-10 gap-2 font-bold">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running automation...' : 'Run now'}
        </Button>
      </header>

      <Card className="overflow-hidden border-primary/20">
        <div className="grid lg:grid-cols-[340px_1fr]">
          <div className="space-y-4 border-b border-border bg-secondary/20 p-5 lg:border-b-0 lg:border-r">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Overseas targets</p><p className="mt-1 text-xs text-muted-foreground">Enter one market or niche per line.</p></div>
            <label className="block text-xs font-bold">Markets / cities<textarea value={markets} onChange={event => setMarkets(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
            <label className="block text-xs font-bold">Business niches<textarea value={niches} onChange={event => setNiches(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
            <label className="block text-xs font-bold">Results per target<Input type="number" min={1} max={25} value={maxResults} onChange={event => setMaxResults(Math.max(1, Math.min(25, Number(event.target.value))))} className="mt-2" /></label>
            <p className="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground"><strong className="text-foreground">{buildTargets().length}</strong> search combinations will run.</p>
          </div>
          <ActivationPanel running={running} state={runState} activeStage={activeStage} elapsed={elapsed} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Businesses scanned" value={totals.scanned} icon={Search} />
        <MetricCard label="New leads" value={totals.newLeads} icon={Zap} />
        <MetricCard label="Awaiting review" value={reviewLeads.length} icon={FileCheck2} />
      </div>

      <section className="space-y-4">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Human approval required</p><h2 className="text-xl font-black uppercase">Outreach review queue</h2></div>
        {reviewLeads.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No drafts are waiting. Run automation to discover overseas leads.</Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border bg-secondary/20 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search review leads" placeholder="Search name, location or email..." value={reviewSearch} onChange={event => { setReviewSearch(event.target.value); setReviewPage(1); }} className="pl-9" /></div>
              <select aria-label="Filter review status" value={reviewFilter} onChange={event => { setReviewFilter(event.target.value); setReviewPage(1); }} className="h-10 rounded-md border border-border bg-background px-3 text-sm"><option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option></select>
              <select aria-label="Sort review leads" value={reviewSort} onChange={event => { setReviewSort(event.target.value); setReviewPage(1); }} className="h-10 rounded-md border border-border bg-background px-3 text-sm"><option value="priority">Highest score first</option><option value="name">Name A-Z</option></select>
            </div>
            {filteredLeads.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No leads match your search or status filter.</p>}
            {reviewLeads.map(lead => <div key={lead.id} hidden={!visibleLeadIds.has(lead.id)}><ReviewCard lead={lead} expanded={expandedLeadId === lead.id} onToggle={() => setExpandedLeadId(current => current === lead.id ? null : lead.id)} /></div>)}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">{filteredLeads.length ? (currentPage - 1) * 10 + 1 : 0}-{Math.min(currentPage * 10, filteredLeads.length)} of {filteredLeads.length} leads</p>
              <div className="flex items-center gap-2"><Button variant="outline" size="sm" aria-label="Previous review page" disabled={currentPage === 1} onClick={() => { setReviewPage(currentPage - 1); setExpandedLeadId(null); }}><ChevronLeft className="h-4 w-4" /></Button><span className="text-xs">Page {currentPage} of {pageCount}</span><Button variant="outline" size="sm" aria-label="Next review page" disabled={currentPage === pageCount} onClick={() => { setReviewPage(currentPage + 1); setExpandedLeadId(null); }}><ChevronRight className="h-4 w-4" /></Button></div>
            </div>
          </Card>
        )}
      </section>

      {loadError && (
        <Card className="border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Could not load reports</div>
          <p className="mt-1 text-xs opacity-80">{loadError}</p>
        </Card>
      )}

      {loading ? (
        <Card className="flex min-h-48 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></Card>
      ) : reports.length === 0 ? (
        <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <Clock3 className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <h2 className="font-bold text-foreground">No automation runs yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Configure the server environment, deploy the API, then use Run now or wait for the daily schedule.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => <Fragment key={report.id}><ReportCard report={report} /></Fragment>)}
        </div>
      )}
    </div>
  );
}

function ActivationPanel({ running, state, activeStage, elapsed }: { running: boolean; state: 'idle' | 'running' | 'complete' | 'failed'; activeStage: number; elapsed: number }) {
  return (
    <div className="relative overflow-hidden p-5 sm:p-7">
      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary),transparent_42%)] transition-opacity ${running ? 'opacity-[0.08]' : 'opacity-[0.03]'}`} />
      <div className="relative flex items-center justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Activation sequence</p><h2 className="mt-1 text-lg font-black uppercase">{running ? STAGES[activeStage].label : state === 'complete' ? 'Run completed' : state === 'failed' ? 'Run failed' : 'Ready for activation'}</h2></div>
        <Badge variant={state === 'failed' ? 'destructive' : 'secondary'}>{running ? `${elapsed}s live` : state}</Badge>
      </div>
      <div className="relative mt-6 space-y-2">
        {STAGES.map((stage, index) => {
          const active = running && index === activeStage;
          const done = state === 'complete' || (running && index < activeStage);
          const Icon = stage.icon;
          return (
            <div key={stage.label} className={`flex items-center gap-4 rounded-lg border p-3 transition-all duration-500 ${active ? 'scale-[1.01] border-primary bg-primary/10 shadow-lg shadow-primary/10' : done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-background/50 opacity-60'}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? 'animate-pulse bg-primary text-primary-foreground' : done ? 'bg-emerald-500 text-white' : 'bg-secondary text-muted-foreground'}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
              <div><p className="text-xs font-black uppercase tracking-wide">{stage.label}</p><p className="text-[11px] text-muted-foreground">{stage.detail}</p></div>
              {active && <div className="ml-auto flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ lead, expanded, onToggle }: { lead: ReviewLead; expanded: boolean; onToggle: () => void }) {
  const [subject, setSubject] = useState(lead.outreachSubject || `A digital growth idea for ${lead.name}`);
  const [body, setBody] = useState(lead.outreachEmail || lead.outreachDrafts?.email || '');
  const [working, setWorking] = useState(false);

  const generate = async () => {
    setWorking(true);
    try {
      const response = await fetch(`${API_BASE}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead, tone: 'professional' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Draft generation failed');
      setBody(data.email);
      toast.success('Draft generated. Read and edit it before approval.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Draft generation failed'); }
    finally { setWorking(false); }
  };

  const approve = async () => {
    if (!body.trim()) return toast.error('Generate or write the email first.');
    await updateDoc(doc(db, 'business_listings', lead.id), { outreachApprovalStatus: 'approved', outreachSubject: subject, outreachEmail: body, outreachApprovedAt: Date.now() });
    toast.success('Draft approved. It has not been sent yet.');
  };
  const reject = async () => { await updateDoc(doc(db, 'business_listings', lead.id), { outreachApprovalStatus: 'rejected' }); toast.info('Lead removed from review.'); };
  const send = async () => {
    if (!lead.email) return toast.error('This lead has no email address.');
    if (lead.outreachApprovalStatus !== 'approved') return toast.error('Approve the draft before sending.');
    setWorking(true);
    try {
      const token = await auth.currentUser?.getIdToken(true);
      const response = await fetch(`${API_BASE}/send-outreach`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, to: lead.email, subject, email: body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Email sending failed');
      toast.success(`Email sent to ${lead.email}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Email sending failed'); }
    finally { setWorking(false); }
  };

  return (
    <div className="border-b border-border">
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={'review-editor-' + lead.id} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{lead.name}</span><Badge variant="outline">{lead.leadScore ?? 0}/100</Badge><Badge variant={lead.outreachApprovalStatus === 'approved' ? 'secondary' : 'outline'}>{lead.outreachApprovalStatus?.replace('_', ' ')}</Badge></span><span className="mt-1 block truncate text-xs text-muted-foreground">{lead.address} ? {lead.email || 'No email discovered'}</span></span>
        <span className="hidden text-xs font-medium text-muted-foreground sm:block">{expanded ? 'Close editor' : 'Review draft'}</span><ChevronDown className={'h-4 w-4 shrink-0 transition-transform ' + (expanded ? 'rotate-180' : '')} />
      </button>
      <div id={'review-editor-' + lead.id} hidden={!expanded}>
        <div className="space-y-3 border-t border-border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Review and edit your email before approving.</p><Button variant="outline" onClick={generate} disabled={working} className="shrink-0 gap-2"><Sparkles className="h-4 w-4" />{working ? 'Working...' : body ? 'Regenerate' : 'Generate draft'}</Button></div>
          <label className="block text-xs font-semibold">Subject<Input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Email subject" className="mt-1.5" /></label>
          <label className="block text-xs font-semibold">Email<textarea value={body} onChange={event => setBody(event.target.value)} rows={7} placeholder="Generate a draft, then review and edit it here." className="mt-1.5 w-full rounded-md border border-border bg-background p-3 text-sm font-normal leading-relaxed outline-none focus:ring-2 focus:ring-primary/20" /></label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reject} disabled={working}>Reject lead</Button><Button onClick={approve} disabled={working || !body.trim()} className="gap-2"><FileCheck2 className="h-4 w-4" />Approve draft</Button><Button onClick={send} disabled={working || lead.outreachApprovalStatus !== 'approved'} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Send className="h-4 w-4" />Send approved email</Button></div>
          <p className="text-[11px] text-muted-foreground">Approval never sends automatically. Sending is a separate action requiring your verified business email.</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
      <div><p className="text-2xl font-black text-foreground">{value.toLocaleString()}</p><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p></div>
    </Card>
  );
}

function ReportCard({ report }: { report: AutomationReport }) {
  const timestamp = report.completedAt?.toDate?.()
    || (report.completedAt?.seconds ? new Date(report.completedAt.seconds * 1000) : undefined)
    || (report.startedAt ? new Date(report.startedAt) : undefined);
  const statusVariant = report.status === 'complete' ? 'secondary' : report.status === 'failed' ? 'destructive' : 'outline';

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h2 className="font-bold text-foreground">{report.date || 'Automation run'}</h2><Badge variant={statusVariant}>{report.status || 'unknown'}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{timestamp ? timestamp.toLocaleString() : 'Completion time pending'}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>{report.scanned || 0}</strong> scanned</span>
          <span><strong>{report.newLeads || 0}</strong> new</span>
          <span><strong>{report.highPriority || 0}</strong> priority</span>
        </div>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delivery</p>
          {(['email', 'whatsapp', 'telegram'] as const).map(channel => {
            const delivery = report.deliveries?.find(item => item.channel === channel);
            const Icon = channel === 'email' ? Mail : MessageCircle;
            return (
              <div key={channel} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold capitalize">{channel}</span><DeliveryBadge delivery={delivery} /></div>
                  {delivery?.detail && <p className="mt-1 break-words text-[11px] text-muted-foreground">{delivery.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Results</p>
          {report.topLead && <p className="text-sm"><span className="text-muted-foreground">Top lead:</span> <strong>{report.topLead.name}</strong> � {report.topLead.leadScore}/100</p>}
          {report.newLeadNames?.length ? <p className="text-xs leading-relaxed text-muted-foreground">{report.newLeadNames.join(', ')}</p> : <p className="text-xs text-muted-foreground">No new lead names recorded.</p>}
          {report.errors?.map((item, index) => <p key={index} className="rounded bg-destructive/5 p-2 text-xs text-destructive">{item.target?.keyword || 'Search'}: {item.error}</p>)}
        </div>
      </div>
    </Card>
  );
}

function DeliveryBadge({ delivery }: { delivery?: DeliveryResult }) {
  if (!delivery) return <Badge variant="outline">pending</Badge>;
  if (delivery.sent) return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />sent</Badge>;
  if (delivery.skipped) return <Badge variant="outline">not configured</Badge>;
  return <Badge variant="destructive">failed</Badge>;
}
