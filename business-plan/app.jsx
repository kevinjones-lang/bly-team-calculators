/* The Bly Team — Business Plan Calculator (UI)
   Drives BlyPlan.computePlan() from a sidebar of controls and
   renders the reverse-engineered plan. Loaded as text/babel. */
const { useState, useEffect, useMemo, useRef } = React;
const P = window.BlyPlan;
const { fmtCurrency, fmtInt } = P;

function fmt1(n) {
  const x = Number(n);
  return (Number.isFinite(x) ? x : 0).toFixed(1);
}
function clampRateInput(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(100, Math.max(1, n));
}

/* ---------- atoms ---------- */
function Slider({ label, value, min, max, step, onChange, format, accent }) {
  const colors = { royal: "#00519B", green: "#1a8a5a", slate: "#6b85a4", amber: "#c9822a", red: "#c2553f" };
  const c = colors[accent || "royal"];
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sld">
      <div className="sld-head">
        <span className="sld-label">{label}</span>
        <span className="sld-val" style={{ color: c }}>{format ? format(value) : value}</span>
      </div>
      <input type="range" className="rng" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--fill": c, "--pct": pct + "%" }} />
    </div>
  );
}

function ChipTog({ label, checked, onChange }) {
  return (
    <label className="chip-tog">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="tick"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg></span>
      {label}
    </label>
  );
}

/* ---------- sidebar ---------- */
function Sidebar({ s, set }) {
  const w = P.sourceWeights(s);
  const fc = (v) => fmtCurrency(v);
  const fp = (v) => v + "%";
  return (
    <aside className="side">
      <div className="side-group">
        <div className="side-group-title"><span className="n">01</span> Your Goal</div>
        <Slider label="Annual take-home goal" value={s.incomeGoal} min={50000} max={500000} step={5000}
          onChange={(v) => set("incomeGoal", v)} format={fc} accent="green" />
        <p style={{ fontSize: "11.5px", color: "var(--ink-faint)", fontWeight: 600, lineHeight: 1.5, marginTop: "-4px" }}>
          What you keep after splits &amp; eXp fees — before your own business expenses.
        </p>
      </div>

      <div className="side-group">
        <div className="side-group-title"><span className="n">02</span> Your Deal</div>
        <Slider label="Average sale price" value={s.avgPrice} min={100000} max={1500000} step={10000}
          onChange={(v) => set("avgPrice", v)} format={fc} accent="royal" />
        <Slider label="Commission rate" value={s.commissionPct} min={1} max={5} step={0.1}
          onChange={(v) => set("commissionPct", v)} format={(v) => v.toFixed(1) + "%"} accent="royal" />
        <div className="sld" style={{ marginBottom: "4px" }}>
          <div className="sld-head"><span className="sld-label">Your level / tier</span></div>
          <select className="sel" value={s.level} onChange={(e) => set("level", e.target.value)}>
            <option value="3">Level 3</option>
            <option value="2">Level 2</option>
            <option value="1">Level 1</option>
            <option value="new5">Brand-new — first 5 deals</option>
            <option value="exp3">Experienced — first 3 deals</option>
          </select>
        </div>
      </div>

      <div className="side-group">
        <div className="side-group-title"><span className="n">03</span> Business Mix</div>
        <Slider label="Listing side" value={s.listingPct} min={0} max={100} step={5}
          onChange={(v) => set("listingPct", v)} format={(v) => `${v}% / ${100 - v}% buyer`} accent="royal" />
      </div>

      <div className="side-group">
        <div className="side-group-title"><span className="n">04</span> Lead Source Mix</div>
        <div className="alloc-bar">
          <span style={{ width: w.soi * 100 + "%", background: "#00519b" }} title="Sphere / SOI" />
          <span style={{ width: w.office * 100 + "%", background: "#6b85a4" }} title="Office" />
          <span style={{ width: w.zillow * 100 + "%", background: "#c9822a" }} title="Zillow" />
        </div>
        <Slider label="Sphere / SOI" value={s.mixSOI} min={0} max={100} step={5}
          onChange={(v) => set("mixSOI", v)} format={() => Math.round(w.soi * 100) + "%"} accent="royal" />
        <Slider label="Office generated" value={s.mixOffice} min={0} max={100} step={5}
          onChange={(v) => set("mixOffice", v)} format={() => Math.round(w.office * 100) + "%"} accent="slate" />
        <Slider label="Zillow Preferred" value={s.mixZillow} min={0} max={100} step={5}
          onChange={(v) => set("mixZillow", v)} format={() => Math.round(w.zillow * 100) + "%"} accent="amber" />
      </div>

      <div className="side-group">
        <div className="side-group-title"><span className="n">05</span> Conversion Rates</div>
        <Slider label="Conversations → Appointment Set" value={s.convSetPct} min={1} max={100} step={1}
          onChange={(v) => set("convSetPct", clampRateInput(v))} format={fp} accent="royal" />
        <Slider label="Appointment Set → Appointment Met" value={s.setHeldPct} min={1} max={100} step={1}
          onChange={(v) => set("setHeldPct", clampRateInput(v))} format={fp} accent="royal" />
        <Slider label="Appointment Met → Signed" value={s.heldTakenPct} min={1} max={100} step={1}
          onChange={(v) => set("heldTakenPct", clampRateInput(v))} format={fp} accent="royal" />
        <Slider label="Signed → Under Contract" value={s.signedUcPct} min={1} max={100} step={1}
          onChange={(v) => set("signedUcPct", clampRateInput(v))} format={fp} accent="royal" />
        <Slider label="Under Contract → Closed" value={s.ucClosePct} min={1} max={100} step={1}
          onChange={(v) => set("ucClosePct", clampRateInput(v))} format={fp} accent="royal" />
      </div>

      <div className="side-group">
        <div className="side-group-title"><span className="n">06</span> Adjustments</div>
        <div className="chips">
          <ChipTog label="ISA-converted leads" checked={s.isaConverted} onChange={(v) => set("isaConverted", v)} />
          <ChipTog label="Mentor on deals" checked={s.mentor} onChange={(v) => set("mentor", v)} />
          <ChipTog label="Model annual cap" checked={s.modelCap} onChange={(v) => set("modelCap", v)} />
        </div>
      </div>
    </aside>
  );
}

/* ---------- hero ---------- */
function Hero({ plan, s }) {
  return (
    <div className="hero">
      <div className="hero-eyebrow">To take home <b>{fmtCurrency(s.incomeGoal)}</b> in {s.timeframe === 12 ? "a year" : `${s.timeframe} months`}, you need…</div>
      <div className="hero-figs">
        <div className="hero-big">
          <span className="v">{plan.unreachable ? "—" : fmtInt(plan.units)}</span>
          <span className="l">closings</span>
        </div>
        <div className="hero-sep" />
        <div className="hero-sub">
          <span className="v">{fmtCurrency(plan.gci)}</span>
          <span className="l">in gross commission you'll generate</span>
        </div>
        <div className="hero-sub">
          <span className="v">{fmtCurrency(plan.avgTakePerDeal)}</span>
          <span className="l">average take-home per deal</span>
        </div>
      </div>
      <p className="hero-note">
        Every number below is connected to your real Bly Team splits. {plan.cap.modeled && plan.cap.capDeal
          ? <>You hit your eXp cap around <b>closing #{plan.cap.capDeal}</b> — each deal after that nets you about <b>{fmtCurrency(plan.cap.uplift)}</b> more.</>
          : <>Move any slider and the whole plan re-balances instantly.</>}
      </p>
    </div>
  );
}

/* ---------- section wrapper ---------- */
function Section({ eyebrow, title, sub, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, accent, big, valueClass }) {
  return (
    <div className={"tile" + (accent ? " accent" : "")}>
      <div className="tile-label">{label}</div>
      <div className={"tile-value " + (valueClass || "") + (big ? " big" : "")}>{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

/* ---------- annual where-it-goes bar ---------- */
function FlowCard({ plan }) {
  const b = plan.breakdown;
  const tot = Math.max(b.gross, 1);
  const segs = [
    { key: "take", cls: "s-take", dot: "#178a59", label: "You keep", val: b.take },
    { key: "exp", cls: "s-exp", dot: "#1a6fc4", label: "eXp fees", val: b.expFees },
    { key: "office", cls: "s-office", dot: "#6b85a4", label: "Team / office", val: b.office },
    { key: "ref", cls: "s-ref", dot: "#c9822a", label: "Zillow referral", val: b.referral },
  ];
  const visible = segs.filter((x) => x.val > 0.5);
  return (
    <div className="flowcard">
      <div className="flowcard-head">
        <span className="h">Where your year's commission goes</span>
        <span className="s">Across <b>{fmtInt(plan.units)}</b> closings · <b>{fmtCurrency(b.gross)}</b> gross</span>
      </div>
      <div className="splbar">
        {visible.map((x) => {
          const p = x.val / tot;
          return (
            <div key={x.key} className={"splbar-seg " + x.cls} style={{ width: p * 100 + "%" }}>
              <span className="pc">{p > 0.07 ? Math.round(p * 100) + "%" : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="splkey" style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
        {visible.map((x) => (
          <div className="k" key={x.key}>
            <span className="kdot"><i style={{ background: x.dot }} />{x.label}</span>
            <div className="kv">{fmtCurrency(x.val)} <small>{Math.round((x.val / tot) * 100)}%</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- production funnel ---------- */
function FunnelCard({ side, data, pct, tone, conv }) {
  const isL = side === "listings";
  const steps = [
    { label: "Conversations", value: data.conversations, top: true },
    { label: "Appointment Set", value: data.set, conv: conv.convSet },
    { label: "Appointment Met", value: data.met, conv: conv.setMet },
    { label: "Signed", value: data.signed, conv: conv.metSigned },
    { label: "Under Contract", value: data.uc, conv: conv.signedUc },
    { label: "Closed", value: data.close, conv: conv.ucClose, hl: true },
  ];
  return (
    <div className={"funnel " + tone}>
      <div className="funnel-head">
        <div>
          <div className="fl">{isL ? "Listing side" : "Buyer side"}</div>
          <div className="fp">{pct}% of business</div>
        </div>
        <div className="fg">{fmtCurrency(data.gci)}<small>gross commission</small></div>
      </div>
      <div className="funnel-rows">
        {steps.map((st, i) => (
          <div key={i} className={"frow " + (st.top ? "top " : "") + (st.hl ? "hl" : "")}>
            <span className="frl">{st.label}{st.conv ? <b> · {st.conv}% convert</b> : ""}</span>
            <span className="frv">{fmtInt(st.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cadence({ title, rows }) {
  return (
    <div className="cad">
      <div className="cad-title">{title}</div>
      {rows.map(([label, val, hl], i) => (
        <div key={i} className={"cad-row " + (hl ? "hl" : "")}>
          <span>{label}</span><strong>{val}</strong>
        </div>
      ))}
    </div>
  );
}

/* ---------- dashboard ---------- */
function Dashboard({ s, set, plan, onShare, onPdf }) {
  const conv = plan.sisu.rates;
  return (
    <div className="main">
      <Hero plan={plan} s={s} />

      <Section eyebrow="01 — The Number" title="What it takes to hit your goal"
        sub="We run your Bly Team splits in reverse: from take-home back to closings, accounting for every fee and the eXp cap.">
        <div className="grid-4">
          <Tile label="Closings needed" value={plan.unreachable ? "—" : fmtInt(plan.units)} valueClass="royal" big
            sub={plan.unreachable ? "Goal unreachable at these inputs" : <>over {s.timeframe} months</>} accent />
          <Tile label="GCI generated" value={fmtCurrency(plan.gci)} sub={<>gross, across all deals</>} />
          <Tile label="Avg take-home / deal" value={fmtCurrency(plan.avgTakePerDeal)} valueClass="green"
            sub={<><b>{Math.round((plan.avgTakePerDeal / Math.max(plan.avgComm, 1)) * 100)}%</b> of gross commission</>} />
          <Tile label={plan.cap.modeled ? "You cap after" : "Cap modeling off"}
            value={plan.cap.modeled ? (plan.cap.capDeal ? "#" + plan.cap.capDeal : "—") : "—"}
            sub={plan.cap.modeled
              ? (plan.cap.capDeal ? <>then <b>+{fmtCurrency(plan.cap.uplift)}</b> / deal</> : "you don't reach the $4k team cap")
              : "every deal pays full eXp split"} />
        </div>
        <FlowCard plan={plan} />
      </Section>

      <Section eyebrow="02 — The Activity" title={s.timeframe === 12 ? "Your annual production funnel" : `Your ${s.timeframe}-month production funnel`}
        sub="Work backward from closings through under contract, signed, met, set, and conversations — split by listing and buyer side.">
        <div className="grid-2">
          <FunnelCard side="listings" data={plan.listings} pct={s.listingPct} tone="navy" conv={conv} />
          <FunnelCard side="buyers" data={plan.buyers} pct={100 - s.listingPct} tone="royal" conv={conv} />
        </div>
      </Section>

      <Section eyebrow="03 — The Rhythm" title="Monthly &amp; weekly cadence"
        sub="The plan only works if it becomes a routine. Here's the pace that gets you there.">
        <div className="grid-3">
          <Cadence title="Monthly · Listing side" rows={[
            ["Closed", fmt1(plan.monthly.lClose)],
            ["Under Contract", fmt1(plan.monthly.lUc)],
            ["Signed", fmt1(plan.monthly.lSigned)],
            ["Appointment Met", fmt1(plan.monthly.lMet)],
            ["Appointment Set", fmt1(plan.monthly.lSet)],
            ["Conversations", fmt1(plan.monthly.lConv), true],
          ]} />
          <Cadence title="Monthly · Buyer side" rows={[
            ["Closed", fmt1(plan.monthly.bClose)],
            ["Under Contract", fmt1(plan.monthly.bUc)],
            ["Signed", fmt1(plan.monthly.bSigned)],
            ["Appointment Met", fmt1(plan.monthly.bMet)],
            ["Appointment Set", fmt1(plan.monthly.bSet)],
            ["Conversations", fmt1(plan.monthly.bConv), true],
          ]} />
          <div className="weekly">
            <div className="we">Weekly target</div>
            <div className="wbig">{fmt1(plan.weekly.totalConv)}</div>
            <div className="wl">conversations every week</div>
            <div className="wsplit">
              <div><span>Set / wk</span><strong>{fmt1(plan.weekly.totalSet)}</strong></div>
              <div><span>Met / wk</span><strong>{fmt1(plan.weekly.totalMet)}</strong></div>
            </div>
          </div>
        </div>
      </Section>

      <footer className="foot">
        <div className="fdis">
          Estimates only, based on The Bly Team commission schedule and standard eXp Realty fees ($4,000 team company-dollar cap, $40 risk-management &amp; $25 broker-review per transaction). Actual results vary with cap status, conversion, market conditions, and brokerage policy. This is a planning tool, not a guarantee of compensation.
        </div>
        <div className="fbrand">The Bly Team · eXp Realty</div>
      </footer>
    </div>
  );
}

/* ---------- state: URL + localStorage ---------- */
const STORAGE_KEY = "bly-business-plan-v1";
const KEYMAP = {
  timeframe: "tf", incomeGoal: "g", avgPrice: "p", commissionPct: "c", level: "lv",
  listingPct: "ls", mixSOI: "so", mixOffice: "of", mixZillow: "zi",
  setHeldPct: "sh", heldTakenPct: "ht", signedUcPct: "su", ucClosePct: "uc", convSetPct: "cs",
  isaConverted: "isa", mentor: "m", modelCap: "cap",
};
const NUM_KEYS = ["timeframe", "incomeGoal", "avgPrice", "commissionPct", "listingPct", "mixSOI", "mixOffice", "mixZillow", "setHeldPct", "heldTakenPct", "signedUcPct", "ucClosePct", "convSetPct"];
const RATE_KEYS = ["setHeldPct", "heldTakenPct", "signedUcPct", "ucClosePct", "convSetPct"];
const BOOL_KEYS = ["isaConverted", "mentor", "modelCap"];

function loadState() {
  const base = { ...P.STATE_DEFAULTS };
  // localStorage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  // URL params win
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].length) {
    Object.keys(KEYMAP).forEach((k) => {
      const v = q.get(KEYMAP[k]);
      if (v === null) return;
      if (NUM_KEYS.includes(k)) base[k] = parseFloat(v);
      else if (BOOL_KEYS.includes(k)) base[k] = v === "1";
      else base[k] = v;
    });
  }
  delete base.takenClosePct;
  RATE_KEYS.forEach((k) => { base[k] = clampRateInput(base[k]); });
  return base;
}
function encodeState(s) {
  const q = new URLSearchParams();
  Object.keys(KEYMAP).forEach((k) => {
    let v = s[k];
    if (BOOL_KEYS.includes(k)) v = v ? 1 : 0;
    q.set(KEYMAP[k], v);
  });
  return location.origin + location.pathname + "?" + q.toString();
}

function App() {
  const [s, setS] = useState(loadState);
  const toastRef = useRef(null);
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const plan = useMemo(() => P.computePlan(s), [s]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }, [s]);

  const showToast = (msg) => {
    const t = toastRef.current; if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove("show"), 1900);
  };
  const onShare = () => {
    const url = encodeState(s);
    history.replaceState(null, "", url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard"), () => showToast("Copy this URL from the address bar"));
    else showToast("Copy this URL from the address bar");
  };
  const onPdf = () => window.print();

  useEffect(() => { toastRef.current = document.getElementById("toast"); }, []);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src="assets/bly-white.png" alt="The Bly Team" />
            <div className="divider" />
            <div className="wordmark">
              <span className="t1">Business Plan</span>
              <span className="t2">Goal Calculator</span>
            </div>
          </div>
          <div className="topbar-actions">
            <select className="tf-select" value={s.timeframe} onChange={(e) => set("timeframe", parseInt(e.target.value))}>
              <option value={12}>12-Month Plan</option>
              <option value={6}>6-Month Plan</option>
              <option value={3}>90-Day Plan</option>
              <option value={1}>1-Month Plan</option>
            </select>
            <button className="btn-pdf" onClick={onPdf}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              <span>PDF</span>
            </button>
            <button className="btn-share" onClick={onShare}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
              <span>Share plan</span>
            </button>
          </div>
        </div>
      </header>
      <div className="shell">
        <Sidebar s={s} set={set} />
        <Dashboard s={s} set={set} plan={plan} onShare={onShare} onPdf={onPdf} />
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
