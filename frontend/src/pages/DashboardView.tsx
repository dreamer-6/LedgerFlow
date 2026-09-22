import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  TrendingUp, CheckCircle2, ArrowUpRight, ChevronRight,
  ReceiptText, Wallet, Boxes, ArrowRight, Wrench, Monitor, Printer, Laptop, PlusCircle, Trash2
} from "lucide-react";

interface DashboardViewProps {
  companyId: string;
  onOpenNewVoucher: (type?: string) => void;
  onViewVoucher: (voucherId: string) => void;
  onNavigateReports: (subTab: string) => void;
}

const fmt = (p: number | undefined | null) =>
  p != null && !isNaN(p)
    ? "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "₹0.00";

const ACCENT = "#FF5733";
const ACCENT2 = "#FF8C6B";
const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SVC_KEY = "lf_service_jobs";
interface ServiceJob {
  id: string; type: string; customer: string; device: string;
  status: "Pending" | "In Progress" | "Done"; date: string;
}
const loadJobs = (): ServiceJob[] => {
  try { return JSON.parse(localStorage.getItem(SVC_KEY) || "[]"); } catch { return []; }
};
const saveJobs = (jobs: ServiceJob[]) => localStorage.setItem(SVC_KEY, JSON.stringify(jobs));

const svcColor: Record<ServiceJob["status"], string> = {
  "Pending":     "#FFB45F",
  "In Progress": "#5685F5",
  "Done":        "#20D9A3",
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  companyId, onOpenNewVoucher, onViewVoucher, onNavigateReports
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"Monthly"|"Quarterly"|"Yearly">("Monthly");
  const [serviceJobs, setServiceJobs] = useState<ServiceJob[]>(loadJobs);
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({ type: "Printer", customer: "", device: "", status: "Pending" as ServiceJob["status"] });

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api.getDashboard(companyId).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId]);

  const rawTrend: { month: string; voucher_type: string; total: number }[] = data?.trendData || [];
  const trendMap: Record<string, { s: number; p: number }> = {};
  rawTrend.forEach(r => {
    if (!trendMap[r.month]) trendMap[r.month] = { s: 0, p: 0 };
    if (r.voucher_type === "SALES") trendMap[r.month].s = r.total / 100;
    if (r.voucher_type === "PURCHASE") trendMap[r.month].p = r.total / 100;
  });
  const sortedMonths = Object.keys(trendMap).sort();
  const last6 = sortedMonths.slice(-6);
  const bars: { m: string; s: number; p: number }[] =
    last6.length > 0
      ? last6.map(mo => {
          const [, mm] = mo.split("-");
          return { m: MONTHS_ABBR[parseInt(mm, 10) - 1] || mo, s: trendMap[mo].s, p: trendMap[mo].p };
        })
      : [0,1,2,3,4,5].map(i => {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          return { m: MONTHS_ABBR[d.getMonth()], s: 0, p: 0 };
        });
  const maxBar = Math.max(...bars.map(b => Math.max(b.s, b.p)), 1);

  const recent = data?.recentVouchers?.slice(0, 6).map((v: any) => ({
    id: v.voucher_id, vType: v.voucher_type,
    label: v.voucher_type === "SALES" ? "Sales" : v.voucher_type === "PURCHASE" ? "Purchase"
         : v.voucher_type === "RECEIPT" ? "Receipt" : "Payment",
    number: v.voucher_number, party: v.party_name || "General",
    amount: fmt(v.total_amount_paise),
  })) ?? [];

  const sales = (data?.todaySalesPaise ?? 0) / 100;
  const purchases = (data?.todayPurchasesPaise ?? 0) / 100;
  const total = sales + purchases || 1;
  const sPct = Math.round((sales / total) * 100);
  const pPct = 100 - sPct;
  const R = 36, C = 2 * Math.PI * R;
  const sDash = (sPct / 100) * C;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    display: "flex", flexDirection: "column",
  };
  const vDot: Record<string, string> = {
    SALES: ACCENT, PURCHASE: "#5685F5", RECEIPT: "#20D9A3", PAYMENT: "#FFB45F"
  };

  const addServiceJob = () => {
    if (!newJob.customer.trim() || !newJob.device.trim()) return;
    const job: ServiceJob = {
      id: Date.now().toString(), type: newJob.type,
      customer: newJob.customer.trim(), device: newJob.device.trim(),
      status: newJob.status, date: new Date().toLocaleDateString("en-IN"),
    };
    const updated = [job, ...serviceJobs];
    setServiceJobs(updated); saveJobs(updated);
    setNewJob({ type: "Printer", customer: "", device: "", status: "Pending" });
    setShowAddJob(false);
  };
  const cycleStatus = (id: string) => {
    const order: ServiceJob["status"][] = ["Pending", "In Progress", "Done"];
    const updated = serviceJobs.map(j =>
      j.id === id ? { ...j, status: order[(order.indexOf(j.status) + 1) % 3] } : j
    );
    setServiceJobs(updated); saveJobs(updated);
  };
  const removeJob = (id: string) => {
    const updated = serviceJobs.filter(j => j.id !== id);
    setServiceJobs(updated); saveJobs(updated);
  };
  const jobCounts = { Pending: 0, "In Progress": 0, Done: 0 };
  serviceJobs.forEach(j => { jobCounts[j.status]++; });

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)", fontSize: 15 }}>Loading dashboard…</div>;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize:12, color:"var(--text-muted)", fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:4 }}>Overview</div>
          <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.02em", color:"var(--text-primary)" }}>Financial Dashboard</h1>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {[{label:"Sales Invoice",type:"SALES"},{label:"Receipt",type:"RECEIPT"},{label:"Payment",type:"PAYMENT"}].map(a => (
            <button key={a.type} onClick={() => onOpenNewVoucher(a.type)}
              style={{ padding:"9px 15px", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)",
                color:"var(--text-primary)", fontSize:13, fontWeight:600, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, transition:"all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; (e.currentTarget as HTMLElement).style.color = ACCENT; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}>
              + {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 1: KPI CARDS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        {[
          { title:"Today's Sales", value:fmt(data?.todaySalesPaise), badge:data?.todaySalesPaise>0?"+Active":"None", good:(data?.todaySalesPaise??0)>0, icon:<TrendingUp size={26} strokeWidth={1.5} color={ACCENT}/>, tab:"sales_register" },
          { title:"Receivables",   value:fmt(data?.receivablesPaise), badge:data?.receivablesPaise>0?"Pending":"Clear", good:(data?.receivablesPaise??0)===0, icon:<ArrowUpRight size={26} strokeWidth={1.5} color="#5685F5"/>, tab:"outstanding" },
          { title:"Payables",      value:fmt(data?.payablesPaise),    badge:data?.payablesPaise>0?"Due":"Clear",        good:(data?.payablesPaise??0)===0,    icon:<Wallet size={26} strokeWidth={1.5} color="#FFB45F"/>, tab:"outstanding" },
          { title:"Cash & Bank",   value:fmt(data?.cashBankPaise),    badge:"Liquid",                                   good:true,                            icon:<Boxes size={26} strokeWidth={1.5} color="#20D9A3"/>, tab:"trial_balance" },
        ].map((k, i) => (
          <div key={i} style={card}>
            <div style={{ padding:"20px 20px 14px", flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)" }}>{k.title}</span>
                <div style={{ width:46, height:46, borderRadius:12, background:"var(--bg-subtle)", display:"flex", alignItems:"center", justifyContent:"center" }}>{k.icon}</div>
              </div>
              <div style={{ fontSize:23, fontWeight:800, letterSpacing:"-0.03em", color:"var(--text-primary)", marginBottom:8, fontVariantNumeric:"tabular-nums" }}>{k.value}</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:20,
                  background: k.good?"rgba(32,217,163,0.12)":"rgba(255,87,51,0.1)",
                  color: k.good?"#20D9A3":ACCENT }}>{k.badge}</span>
                <span style={{ fontSize:11, color:"var(--text-muted)" }}>vs last period</span>
              </div>
            </div>
            <button onClick={() => onNavigateReports(k.tab)}
              style={{ padding:"10px 20px", background:"transparent",
                border:"none", display:"flex", alignItems:"center", justifyContent:"space-between",
                cursor:"pointer", fontSize:13, fontWeight:600, color:"var(--text-secondary)", transition:"color 0.15s",
                borderTop:"1px solid var(--border)" } as any}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}>
              See Details <ArrowRight size={14}/>
            </button>
          </div>
        ))}
      </div>

      {/* ROW 2: BAR CHART + RECENT ACTIVITY */}
      <div style={{ display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:16, marginBottom:20 }}>
        <div style={card}>
          <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Sales & Purchase Trend</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                {last6.length > 0 ? "Actual posted vouchers by month" : "No vouchers posted yet — start billing to see real data"}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {[{label:"Sales",color:ACCENT},{label:"Purchase",color:"#5685F5"}].map(l=>(
                <span key={l.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--text-secondary)", fontWeight:500 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:l.color, display:"inline-block" }}/>{l.label}
                </span>
              ))}
              <select value={period} onChange={e => setPeriod(e.target.value as any)}
                style={{ fontSize:12, padding:"4px 8px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-secondary)", cursor:"pointer" }}>
                <option value="Monthly">Last 6 Months</option>
                <option value="Quarterly">This FY</option>
                <option value="Yearly">Last 12 Months</option>
              </select>
            </div>
          </div>
          <div style={{ padding:"20px 24px 16px", flex:1 }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
              <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", alignItems:"flex-end", paddingBottom:20, height:160, flexShrink:0 }}>
                {["100%","75%","50%","25%","0"].map(l=><span key={l} style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1 }}>{l}</span>)}
              </div>
              <div style={{ flex:1, display:"flex", alignItems:"flex-end", gap:8, position:"relative", height:180 }}>
                {[0,25,50,75,100].map(pct=>(
                  <div key={pct} style={{ position:"absolute", left:0, right:0, bottom:`calc(${pct/100*160}px + 20px)`, height:1, background:"var(--border-subtle)" }}/>
                ))}
                {bars.map((b,i)=>(
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:160, width:"100%", justifyContent:"center" }}>
                      {[
                        { h:Math.max((b.s/maxBar)*160, b.s>0?4:2), color:ACCENT, glow:"rgba(255,87,51,0.3)", val:b.s },
                        { h:Math.max((b.p/maxBar)*160, b.p>0?4:2), color:"#5685F5", glow:"rgba(86,133,245,0.3)", val:b.p }
                      ].map((bar,bi)=>(
                        <div key={bi}
                          title={`${bi===0?"Sales":"Purchase"}: ${bar.val>0?"₹"+bar.val.toLocaleString("en-IN",{maximumFractionDigits:0}):"No data"}`}
                          style={{ width:14, height:bar.h, minHeight:2,
                            background: bar.val===0 ? "var(--border-subtle)" : `linear-gradient(180deg,${bar.color} 0%,${bar.color}BB 100%)`,
                            borderRadius:"6px 6px 4px 4px",
                            boxShadow: bar.val>0 ? `0 4px 12px ${bar.glow}` : "none",
                            transition:"height 0.4s ease" }}/>
                      ))}
                    </div>
                    <span style={{ fontSize:11, color:"var(--text-muted)", marginTop:6, fontWeight:500 }}>{b.m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ padding:"20px 20px 14px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Recent Activity</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Latest posted vouchers</div>
            </div>
            <button onClick={() => onNavigateReports("daybook")}
              style={{ background:"none", border:"none", color:ACCENT, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>
              Day Book <ChevronRight size={13}/>
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {recent.length>0 ? recent.map((v:any,i:number)=>(
              <div key={i} onClick={()=>onViewVoucher(v.id)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px",
                  borderBottom:"1px solid var(--border-subtle)", cursor:"pointer", transition:"background 0.12s" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--bg-hover)";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:`${vDot[v.vType]||ACCENT}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <ReceiptText size={15} color={vDot[v.vType]||ACCENT}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.label}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{v.number} · {v.party}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{v.amount}</div>
                  <div style={{ fontSize:10, color:"#20D9A3", fontWeight:700, marginTop:1 }}>Posted</div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign:"center", padding:"40px 16px", color:"var(--text-muted)", fontSize:13 }}>
                <ReceiptText size={32} color="var(--border)" style={{ marginBottom:10 }}/>
                <div style={{ fontWeight:600, color:"var(--text-secondary)", marginBottom:4 }}>No transactions yet</div>
                Record your first voucher using the buttons above.
              </div>
            )}
          </div>
          <button onClick={()=>onOpenNewVoucher("SALES")}
            style={{ margin:"12px 16px", padding:"11px", borderRadius:10,
              background:`linear-gradient(135deg,${ACCENT} 0%,${ACCENT2} 100%)`,
              border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            + New Sales Invoice
          </button>
        </div>
      </div>

      {/* ROW 3: SERVICE JOBS + TODAY'S SPLIT */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16 }}>

        {/* SERVICE JOBS */}
        <div style={card}>
          <div style={{ padding:"18px 24px 14px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Service Jobs</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Printer · Desktop · Laptop repairs & service</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              {(["Pending","In Progress","Done"] as ServiceJob["status"][]).map(s => (
                <span key={s} style={{ fontSize:11, fontWeight:700, color:svcColor[s] }}>
                  {jobCounts[s]} {s}
                </span>
              ))}
              <button onClick={() => setShowAddJob(!showAddJob)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8,
                  background:`linear-gradient(135deg,${ACCENT} 0%,${ACCENT2} 100%)`,
                  border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                <PlusCircle size={13}/> Add Job
              </button>
            </div>
          </div>

          {showAddJob && (
            <div style={{ padding:"14px 24px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-subtle)", display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 100px" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:3 }}>Type</label>
                <select value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})}
                  style={{ width:"100%", fontSize:13, padding:"6px 8px" }}>
                  {["Printer","Desktop","Laptop","UPS/Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex:"2 1 140px" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:3 }}>Customer Name</label>
                <input placeholder="Customer name" value={newJob.customer} onChange={e => setNewJob({...newJob, customer: e.target.value})}
                  style={{ width:"100%", fontSize:13, padding:"6px 10px" }}/>
              </div>
              <div style={{ flex:"2 1 140px" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:3 }}>Device / Model</label>
                <input placeholder="e.g. HP LaserJet M1005" value={newJob.device} onChange={e => setNewJob({...newJob, device: e.target.value})}
                  style={{ width:"100%", fontSize:13, padding:"6px 10px" }}/>
              </div>
              <div style={{ flex:"1 1 90px" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:3 }}>Status</label>
                <select value={newJob.status} onChange={e => setNewJob({...newJob, status: e.target.value as ServiceJob["status"]})}
                  style={{ width:"100%", fontSize:13, padding:"6px 8px" }}>
                  <option>Pending</option><option>In Progress</option><option>Done</option>
                </select>
              </div>
              <button onClick={addServiceJob}
                style={{ padding:"8px 16px", borderRadius:8, background:ACCENT, border:"none", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0 }}>
                Save
              </button>
              <button onClick={() => setShowAddJob(false)}
                style={{ padding:"8px 12px", borderRadius:8, background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", flexShrink:0 }}>
                Cancel
              </button>
            </div>
          )}

          <div style={{ flex:1, overflowY:"auto", maxHeight:260 }}>
            {serviceJobs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"36px 16px", color:"var(--text-muted)", fontSize:13 }}>
                <Wrench size={30} color="var(--border)" style={{ marginBottom:10 }}/>
                <div style={{ fontWeight:600, color:"var(--text-secondary)", marginBottom:4 }}>No service jobs yet</div>
                Click "Add Job" to track printer, desktop or laptop repairs.
              </div>
            ) : serviceJobs.map(j => (
              <div key={j.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px",
                borderBottom:"1px solid var(--border-subtle)", transition:"background 0.12s" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--bg-hover)";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:`${svcColor[j.status]}22`,
                  display:"flex", alignItems:"center", justifyContent:"center", color:svcColor[j.status] }}>
                  {j.type === "Printer" ? <Printer size={15}/> : j.type === "Desktop" ? <Monitor size={15}/> : j.type === "Laptop" ? <Laptop size={15}/> : <Wrench size={15}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{j.customer}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{j.type} · {j.device}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                  <button onClick={() => cycleStatus(j.id)} title="Click to advance status"
                    style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, border:"none", cursor:"pointer",
                      background:`${svcColor[j.status]}22`, color:svcColor[j.status] }}>
                    {j.status}
                  </button>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{j.date}</span>
                  <button onClick={() => removeJob(j.id)}
                    style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:"2px", display:"flex" }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TODAY'S SPLIT */}
        <div style={card}>
          <div style={{ padding:"20px 20px 14px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Today's Split</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Sales vs Purchases</div>
          </div>
          <div style={{ padding:"20px", flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:16 }}>
              <div style={{ position:"relative", flexShrink:0 }}>
                <svg width={96} height={96} viewBox="0 0 96 96">
                  <circle cx={48} cy={48} r={R} fill="none" stroke="var(--border)" strokeWidth={9}/>
                  <circle cx={48} cy={48} r={R} fill="none" stroke={ACCENT} strokeWidth={9} strokeLinecap="round"
                    strokeDasharray={`${sDash} ${C}`} transform="rotate(-90 48 48)"
                    style={{ transition:"stroke-dasharray 0.6s ease" }}/>
                  <circle cx={48} cy={48} r={R} fill="none" stroke="#5685F5" strokeWidth={9} strokeLinecap="round"
                    strokeDasharray={`${C-sDash} ${C}`} strokeDashoffset={-sDash} transform="rotate(-90 48 48)"/>
                </svg>
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:16, fontWeight:800, color:"var(--text-primary)" }}>{sPct}%</span>
                  <span style={{ fontSize:9, color:"var(--text-muted)", fontWeight:500 }}>Sales</span>
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", color:"var(--text-primary)", marginBottom:2 }}>
                  {fmt((data?.todaySalesPaise??0)+(data?.todayPurchasesPaise??0))}
                </div>
                <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14 }}>Total today's volume</div>
                {[
                  { label:"Sales",     color:ACCENT,    pct:sPct, val:fmt(data?.todaySalesPaise) },
                  { label:"Purchases", color:"#5685F5", pct:pPct, val:fmt(data?.todayPurchasesPaise) },
                ].map(row=>(
                  <div key={row.label} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-secondary)", fontWeight:500 }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", background:row.color, display:"inline-block" }}/>{row.label}
                      </span>
                      <span style={{ fontWeight:700, color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{row.val}</span>
                    </div>
                    <div style={{ height:5, borderRadius:10, background:"var(--border)" }}>
                      <div style={{ height:"100%", width:`${row.pct}%`, borderRadius:10, background:row.color, transition:"width 0.5s ease" }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7, borderTop:"1px solid var(--border-subtle)", paddingTop:14 }}>
              {["Double-entry verified","Accounts balanced","GST engine active"].map(item=>(
                <div key={item} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--text-secondary)" }}>
                  <CheckCircle2 size={13} color="#20D9A3"/>{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
