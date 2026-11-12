/* The Bly Team — Business Plan Calculator v2
   Same plan math (BlyPlan), redesigned in the Bly brand system
   from the Mortgage & PITI calculator. Loaded as text/babel. */
const { useState, useEffect, useMemo, useRef } = React;
const P = window.BlyPlan;
const F = window.SplitEngine.FEES;
const LBL = window.SplitEngine.LABELS;
const { fmtCurrency, fmtInt } = P;

function fmt1(n) {
  const x = Number(n);
  return (Number.isFinite(x) ? x : 0).toFixed(1);
}
function fmtPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0%";
  const rounded = Math.round(x * 10) / 10;
  return (rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)) + "%";
}
function clampRateInput(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(100, Math.max(1, n));
}
function plainMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? String(Math.round(x)) : "0";
}
function plainPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const rounded = Math.round(x * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}
function scrollToSisu() {
  const el = document.getElementById("sisu-goal-sheet");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- atoms ---------- */
function Slider({ label, value, min, max, step, onChange, format, fill, note }) {
  const c = fill || "var(--royal)";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sld">
      <div className="sld-head">
        <span className="sld-label">{label}</span>
        <span className="sld-val">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="rng" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--fill": c, "--pct": pct + "%" }} />
      {note && <div className="sld-note">{note}</div>}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }) {
  return (
    <div className={"toggle-row" + (checked ? " on" : "")} onClick={() => onChange(!checked)}>
      <span className="tg"></span>
      <span className="tg-label">{label}{sub && <small>{sub}</small>}</span>
    </div>
  );
}

/* ---------- inputs panel ---------- */
function Inputs({ s, set, onReset }) {
  const w = P.sourceWeights(s);
  const fc = (v) => fmtCurrency(v);
  const fp = (v) => v + "%";
  return (
    <div className="panel panel-pad inputs-col">
      <div className="block" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <h3 className="section-label"><b>01</b> Timeframe &amp; Goal</h3>
        <div className="seg cols-4" style={{ marginBottom: "16px" }}>
          {[[12, "12 mo"], [6, "6 mo"], [3, "90 day"], [1, "1 mo"]].map(([v, l]) => (
            <button key={v} className={"seg-btn" + (s.timeframe === v ? " active" : "")}
              onClick={() => set("timeframe", v)}>{l}</button>
          ))}
        </div>
        <Slider label="Take-home income goal" value={s.incomeGoal} min={50000} max={500000} step={5000}
          onChange={(v) => set("incomeGoal", v)} format={fc} fill="#1d7d54"
          note="What you keep after splits & eXp fees — before your own business expenses." />
      </div>

      <div className="block">
        <h3 className="section-label"><b>02</b> Your Deal</h3>
        <Slider label="Average sale price" value={s.avgPrice} min={100000} max={1500000} step={10000}
          onChange={(v) => set("avgPrice", v)} format={fc} />
        <Slider label="Commission rate" value={s.commissionPct} min={1} max={5} step={0.1}
          onChange={(v) => set("commissionPct", v)} format={(v) => v.toFixed(1) + "%"} />
        <div className="sld" style={{ marginBottom: 0 }}>
          <div className="sld-head"><span className="sld-label">Your level / tier</span></div>
          <div className="select-wrap">
            <select value={s.level} onChange={(e) => set("level", e.target.value)}>
              <option value="3">Level 3</option>
              <option value="2">Level 2</option>
              <option value="1">Level 1</option>
              <option value="new5">Brand-new — first 5 deals</option>
              <option value="exp3">Experienced — first 3 deals</option>
            </select>
          </div>
        </div>
      </div>

      <div className="block">
        <h3 className="section-label"><b>03</b> Business Mix</h3>
        <Slider label="Listing side" value={s.listingPct} min={0} max={100} step={5}
          onChange={(v) => set("listingPct", v)} format={(v) => `${v}% / ${100 - v}%`} />
      </div>

      <div className="block">
        <h3 className="section-label"><b>04</b> Lead Sources</h3>
        <div className="alloc-bar">
          <span style={{ width: w.soi * 100 + "%", background: "#123461" }} title="Sphere / SOI" />
          <span style={{ width: w.office * 100 + "%", background: "#4f8bcf" }} title="Office" />
          <span style={{ width: w.zillow * 100 + "%", background: "#c79a3e" }} title="Zillow" />
        </div>
        <Slider label="Sphere / SOI" value={s.mixSOI} min={0} max={100} step={5}
          onChange={(v) => set("mixSOI", v)} format={() => Math.round(w.soi * 100) + "%"} fill="#123461" />
        <Slider label="Office generated" value={s.mixOffice} min={0} max={100} step={5}
          onChange={(v) => set("mixOffice", v)} format={() => Math.round(w.office * 100) + "%"} fill="#4f8bcf" />
        <Slider label="Zillow Preferred" value={s.mixZillow} min={0} max={100} step={5}
          onChange={(v) => set("mixZillow", v)} format={() => Math.round(w.zillow * 100) + "%"} fill="#c79a3e" />
      </div>

      <div className="block">
        <h3 className="section-label"><b>05</b> Conversion Rates</h3>
        <Slider label="Conversations → Appointment Set" value={s.convSetPct} min={1} max={100} step={1}
          onChange={(v) => set("convSetPct", clampRateInput(v))} format={fp} />
        <Slider label="Appointment Set → Appointment Met" value={s.setHeldPct} min={1} max={100} step={1}
          onChange={(v) => set("setHeldPct", clampRateInput(v))} format={fp} />
        <Slider label="Appointment Met → Signed" value={s.heldTakenPct} min={1} max={100} step={1}
          onChange={(v) => set("heldTakenPct", clampRateInput(v))} format={fp} />
        <Slider label="Signed → Under Contract" value={s.signedUcPct} min={1} max={100} step={1}
          onChange={(v) => set("signedUcPct", clampRateInput(v))} format={fp} />
        <Slider label="Under Contract → Closed" value={s.ucClosePct} min={1} max={100} step={1}
          onChange={(v) => set("ucClosePct", clampRateInput(v))} format={fp} />
      </div>

      <div className="block">
        <h3 className="section-label"><b>06</b> Adjustments</h3>
        <Toggle label="ISA-converted leads" sub="Inside sales agent set the appointment" checked={s.isaConverted} onChange={(v) => set("isaConverted", v)} />
        <Toggle label="Mentor on deals" sub="eXp mentor program deduction" checked={s.mentor} onChange={(v) => set("mentor", v)} />
        <Toggle label="Model annual cap" sub={LBL.companyCap} checked={s.modelCap} onChange={(v) => set("modelCap", v)} />
        <button type="button" className="seg-btn" onClick={onReset} style={{ width: "100%", marginTop: "14px" }}>Reset</button>
      </div>
    </div>
  );
}

/* ---------- results ---------- */
function ResultHero({ plan, s }) {
  const months = s.timeframe;
  return (
    <div className="result-hero">
      <div className="rh-inner">
        <div className="rh-label">Closings needed</div>
        <div className="rh-amount">{plan.unreachable ? "—" : fmtInt(plan.units)} <span className="per">closings</span></div>
        <div className="rh-sub">
          to take home <em>{fmtCurrency(s.incomeGoal)}</em> over {months === 12 ? "the next 12 months" : months === 1 ? "one month" : `${months} months`}
        </div>
        {plan.overRange && (
          <div id="range-warning" className="rh-sub" style={{ marginTop: "10px", background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)", borderRadius: "12px", padding: "8px 12px" }}>
            This goal is beyond the calculator's range.
          </div>
        )}
        <div className="rh-chips">
          <div className="rh-chip">Gross commission<b>{fmtCurrency(plan.gci)}</b></div>
          <div className="rh-chip">Closed volume<b>{fmtCurrency(plan.sisu.closedVolume)}</b></div>
          <div className="rh-chip">Avg take-home / deal<b>{fmtCurrency(plan.avgTakePerDeal)}</b></div>
          <div className="rh-chip">{plan.cap.modeled
            ? (plan.cap.capDeal ? <>You cap at deal<b>#{plan.cap.capDeal}</b></> : <>Annual cap<b>Not reached</b></>)
            : <>Cap modeling<b>Off</b></>}</div>
          <button type="button" id="sisu-jump" className="rh-chip" onClick={scrollToSisu} style={{ textAlign: "left", font: "inherit", cursor: "pointer" }}>
            Open<b>Sisu goal sheet</b>
          </button>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ plan }) {
  const b = plan.breakdown;
  const tot = Math.max(b.gross, 1);
  const segs = [
    { key: "take", color: "var(--seg-keep)", name: "You keep", sub: "after every split & fee", val: b.take },
    { key: "exp", color: "var(--seg-exp)", name: "eXp Realty", sub: "company split + transaction fees", val: b.expFees },
    { key: "office", color: "var(--seg-office)", name: "Team / office", sub: "Bly Team split", val: b.office },
    { key: "mentor", color: "#7a5ea7", name: "Mentor", sub: LBL.mentorPct + " of your share", val: b.mentor },
    { key: "ref", color: "var(--seg-ref)", name: "Zillow referral", sub: LBL.zillowPct + " off the top on Zillow deals", val: b.referral },
  ];
  const visible = segs.filter((x) => x.val > 0.5);
  return (
    <div className="panel panel-pad" style={{ borderRadius: "0 0 var(--radius) var(--radius)", borderTop: "none" }}>
      <div className="sc-head" style={{ marginBottom: "12px" }}>
        <div className="sc-title">Where your commission <em>goes</em></div>
        <div className="sc-tag">across {fmtInt(plan.units)} closings</div>
      </div>
      <div className="split-bar">
        {visible.map((x) => (
          <div key={x.key} className="split-seg" style={{ width: (x.val / tot) * 100 + "%", background: x.color }} />
        ))}
      </div>
      <div className="breakdown">
        {visible.map((x) => (
          <div key={x.key} className="bd-row">
            <span className="bd-dot" style={{ background: x.color }}></span>
            <span className="bd-name">{x.name}<small>{x.sub}</small></span>
            <span className="bd-val">{fmtCurrency(x.val)}</span>
          </div>
        ))}
        <div className="bd-row total">
          <span className="bd-dot" style={{ background: "var(--navy-700)" }}></span>
          <span className="bd-name">Total gross commission</span>
          <span className="bd-val">{fmtCurrency(b.gross)}</span>
        </div>
      </div>
    </div>
  );
}

function Funnels({ plan, s }) {
  const rates = plan.sisu.rates;
  const conv = [
    ["Conversations", null, "conversations"],
    ["Appointment Set", rates.convSet, "set"],
    ["Appointment Met", rates.setMet, "met"],
    ["Signed", rates.metSigned, "signed"],
    ["Under Contract", rates.signedUc, "uc"],
    ["Closed", rates.ucClose, "close"],
  ];
  const sides = [
    { tone: "navy", label: "Listing side", pct: s.listingPct, d: plan.listings },
    { tone: "royal", label: "Buyer side", pct: 100 - s.listingPct, d: plan.buyers },
  ];
  return (
    <div className="panel panel-pad" style={{ marginTop: "20px" }}>
      <div className="sc-head">
        <div className="sc-title">Production <em>funnel</em></div>
        <div className="sc-tag">{s.timeframe === 12 ? "12-month plan" : s.timeframe + "-month plan"}</div>
      </div>
      <div className="funnel-grid">
        {sides.map((side) => (
          <div key={side.tone} className={"fun " + side.tone}>
            <div className="fun-head">
              <div>
                <div className="fh-side">{side.label}</div>
                <div className="fh-pct">{side.pct}% of business</div>
              </div>
              <div className="fh-gci">{fmtCurrency(side.d.gci)}<small>gross commission</small></div>
            </div>
            <div className="fun-rows">
              {conv.map(([label, rate, key], i) => {
                const count = side.d[key];
                const volume = key === "uc" ? fmtCurrency(count * s.avgPrice) : null;
                return (
                  <div key={key} className={"frow" + (i === conv.length - 1 ? " hl" : "")}>
                    <span className="frl">
                      {label}
                      <small>
                        {rate ? fmtPct(rate) + " convert from previous" : "top of funnel"}
                        {volume ? " · " + volume : ""}
                      </small>
                    </span>
                    <span className="frv">{key === "conversations" ? fmtInt(count) : fmt1(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="sld-note" style={{ marginTop: "10px" }}>{fmtInt(plan.sisu.conversations)} conversations total</div>
    </div>
  );
}

function SheetList({ rows, onCopy }) {
  return (
    <div className="breakdown">
      {rows.map(([name, val, copy]) => (
        <div key={name} className="bd-row">
          <span className="bd-name">{name}</span>
          <span className="bd-val" style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            <span>{val}</span>
            {copy != null && (
              <button type="button" className="seg-btn" data-copy={copy} onClick={() => onCopy(copy)}
                style={{ padding: "5px 10px", fontSize: "12px", lineHeight: 1.2, flex: "none" }}>
                Copy
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function monthRows(side, avgPrice, months, labels) {
  const vol = (count) => fmtCurrency((count * avgPrice) / months);
  const n = (count) => fmt1(count / months);
  return [
    ["Closed Volume ($)", vol(side.close)],
    ["Under Contract Volume ($)", vol(side.uc)],
    [labels.closed, n(side.close)],
    [labels.uc, n(side.uc)],
    [labels.signed, n(side.signed)],
    [labels.met, n(side.met)],
    [labels.set, n(side.set)],
    ["Conversations", n(side.conversations)],
  ];
}

function SisuSheet({ plan, s, onCopy }) {
  const g = plan.sisu;
  const months = s.timeframe > 0 ? s.timeframe : 12;
  const rates = g.rates;
  const gciPct = Number(s.commissionPct).toFixed(1);
  const teamPct = g.teamSplitPct.toFixed(2);
  const inputs = [
    ["Gross Agent Paid Income Goal ($)", fmtCurrency(g.grossAgentPaidIncome), plainMoney(g.grossAgentPaidIncome)],
    ["Average Price Point ($)", fmtCurrency(s.avgPrice), plainMoney(s.avgPrice)],
    ["Average GCI %", gciPct + "%", gciPct],
    ["Team Split %", teamPct + "%", teamPct],
    ["% of your Business that are Buyers", fmtPct(g.buyerPct), plainPct(g.buyerPct)],
    ["Under Contract to Closed %", fmtPct(rates.ucClose), plainPct(rates.ucClose)],
    ["Signed to Under Contract %", fmtPct(rates.signedUc), plainPct(rates.signedUc)],
    ["Appointment Met to Signed %", fmtPct(rates.metSigned), plainPct(rates.metSigned)],
    ["Appointment Set to Appointment Met %", fmtPct(rates.setMet), plainPct(rates.setMet)],
    ["Conversations to Appointment Set %", fmtPct(rates.convSet), plainPct(rates.convSet)],
  ];
  const show = [
    ["Closed Volume Goal", fmtCurrency(g.closedVolume)],
    ["Average Price Point", fmtCurrency(s.avgPrice)],
    ["Commission Goal", fmtCurrency(g.grossAgentPaidIncome)],
    ["Sum of Monthly Listings", fmtInt(plan.listings.close)],
    ["Sum of Monthly Buyers", fmtInt(plan.buyers.close)],
  ];
  const sides = [
    ["Listing", plan.listings, {
      closed: "Listings Closed", uc: "Listings Under Contract", signed: "Listings Signed",
      met: "Listing Appointments Met", set: "Listing Appointments Set",
    }],
    ["Buyer", plan.buyers, {
      closed: "Buyers Closed", uc: "Buyers Under Contract", signed: "Buyers Signed",
      met: "Buyer Appointments Met", set: "Buyer Appointments Set",
    }],
  ];
  return (
    <div className="panel panel-pad" id="sisu-goal-sheet" style={{ marginTop: "20px" }}>
      <div className="sc-head">
        <div className="sc-title">Sisu <em>goal sheet</em></div>
        <div className="sc-tag">Goal Calculator</div>
      </div>
      {s.timeframe !== 12 && (
        <div className="sld-note" style={{ marginBottom: "12px" }}>Sisu goals are annual: switch to 12 mo before copying.</div>
      )}
      <div className="cad-title">Type these into Sisu</div>
      <SheetList rows={inputs} onCopy={onCopy} />
      <div className="sld-note" style={{ marginTop: "8px" }}>Increase your business % is optional, leave 0 unless you want growth.</div>
      <div className="cad-title" style={{ marginTop: "18px" }}>What Sisu should show back</div>
      <SheetList rows={show} />
      <div className="cad-grid" style={{ marginTop: "16px" }}>
        {sides.map(([title, side, labels]) => (
          <div key={title} className="cad">
            <div className="cad-title">Monthly · {title}</div>
            {monthRows(side, s.avgPrice, months, labels).map(([label, val]) => (
              <div key={label} className="cad-row"><span>{label}</span><strong>{val}</strong></div>
            ))}
          </div>
        ))}
      </div>
      <div className="bd-row total">
        <span className="bd-name">Closed volume / mo</span>
        <span className="bd-val">{fmtCurrency(g.closedVolume / months)}</span>
      </div>
    </div>
  );
}

function Cadence({ plan, s }) {
  const m = plan.monthly, wk = plan.weekly;
  return (
    <div className="panel panel-pad" style={{ marginTop: "20px" }}>
      <div className="sc-head">
        <div className="sc-title">Your <em>rhythm</em></div>
        <div className="sc-tag">monthly &amp; weekly pace</div>
      </div>
      <div className="cad-grid">
        <div className="cad">
          <div className="cad-title">Monthly · Listing side</div>
          <div className="cad-row"><span>Closed</span><strong>{fmt1(m.lClose)}</strong></div>
          <div className="cad-row"><span>Under Contract</span><strong>{fmt1(m.lUc)}</strong></div>
          <div className="cad-row"><span>Signed</span><strong>{fmt1(m.lSigned)}</strong></div>
          <div className="cad-row"><span>Appointment Met</span><strong>{fmt1(m.lMet)}</strong></div>
          <div className="cad-row"><span>Appointment Set</span><strong>{fmt1(m.lSet)}</strong></div>
          <div className="cad-row hl"><span>Conversations</span><strong>{fmt1(m.lConv)}</strong></div>
        </div>
        <div className="cad">
          <div className="cad-title">Monthly · Buyer side</div>
          <div className="cad-row"><span>Closed</span><strong>{fmt1(m.bClose)}</strong></div>
          <div className="cad-row"><span>Under Contract</span><strong>{fmt1(m.bUc)}</strong></div>
          <div className="cad-row"><span>Signed</span><strong>{fmt1(m.bSigned)}</strong></div>
          <div className="cad-row"><span>Appointment Met</span><strong>{fmt1(m.bMet)}</strong></div>
          <div className="cad-row"><span>Appointment Set</span><strong>{fmt1(m.bSet)}</strong></div>
          <div className="cad-row hl"><span>Conversations</span><strong>{fmt1(m.bConv)}</strong></div>
        </div>
      </div>
      <div className="grand-total">
        <div className="gt-l">
          <span>Weekly target</span>
          <small>{fmt1(wk.totalSet)} set · {fmt1(wk.totalMet)} met · {fmt1(wk.totalSigned)} signed per week</small>
        </div>
        <b>{fmt1(wk.totalConv)} <span className="per">conversations / wk</span></b>
      </div>
    </div>
  );
}

function MetaBar({ plan }) {
  const items = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
      t: "Real split math", b: "Bly Team schedule",
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
      t: fmtCurrency(F.EXP_CAP) + " team cap", b: plan.cap.capDeal ? `Met at deal #${plan.cap.capDeal}` : "Modeled deal-by-deal",
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>,
      t: "Live plan", b: "Every slider re-balances",
    },
  ];
  return (
    <div className="meta-bar">
      {items.map((x, i) => (
        <div key={i} className="meta-item">
          <span className="meta-ic">{x.icon}</span>
          <span className="mt"><b>{x.t}</b>{x.b}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- state: URL + localStorage (same keys as v1) ---------- */
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) { /* ignore */ }
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
  // Older share links stored takenClosePct ("tc"). The close is two rates now; ignore the old one.
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
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));
  const plan = useMemo(() => P.computePlan(s), [s]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }, [s]);

  const showToast = (msg) => {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove("show"), 1900);
  };
  const onShare = () => {
    const url = encodeState(s);
    history.replaceState(null, "", url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard"), () => showToast("Copy this URL from the address bar"));
    else showToast("Copy this URL from the address bar");
  };
  const copyPlain = (text) => {
    const value = String(text);
    const done = () => showToast("Copied " + value);
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      el.remove();
      showToast(ok ? "Copied " + value : value);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done, fallback);
      return;
    }
    fallback();
  };
  const onReset = () => {
    setS({ ...P.STATE_DEFAULTS });
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    history.replaceState(null, "", location.pathname);
  };

  return (
    <div className="app-wrap">
      <header className="app-head">
        <div className="brand-lockup">
          <img className="logo" src={(window.__resources && window.__resources.blyLogoWhite) || "assets/bly-white.png"} alt="The Bly Team" />
          <div className="brand-div"></div>
          <div className="brand-exp">
            <span className="ex1">eXp</span>
            <span className="ex2">Realty</span>
          </div>
        </div>
        <div className="head-titles">
          <div className="he-eye">Goal Setting · The Bly Team</div>
          <div className="he-title">Business Plan <em>calculator</em></div>
        </div>
      </header>

      <div className="grid">
        <Inputs s={s} set={set} onReset={onReset} />
        <div>
          <ResultHero plan={plan} s={s} />
          <Breakdown plan={plan} />
          <Funnels plan={plan} s={s} />
          <SisuSheet plan={plan} s={s} onCopy={copyPlain} />
          <Cadence plan={plan} s={s} />
          <MetaBar plan={plan} />
          <p className="disclaim">
            Estimates only, based on The Bly Team commission schedule and standard eXp Realty fees ({fmtCurrency(F.EXP_CAP)} team company-dollar cap, {fmtCurrency(F.RISK_FEE)} risk-management until {fmtCurrency(F.RISK_ANNUAL_CAP)} a year, {fmtCurrency(F.BROKER_REVIEW)} broker-review per transaction). Actual results vary with cap status, conversion, market conditions, and brokerage policy. This is a planning tool, not a guarantee of compensation.
          </p>
        </div>
      </div>

      <div className="sticky-cta">
        <div className="scta-text">
          <b>{plan.unreachable ? "—" : fmtInt(plan.units)} closings → {fmtCurrency(s.incomeGoal)}</b>
          <span>{fmt1(plan.weekly.totalConv)} conversations per week</span>
        </div>
        <button className="scta-ghost" onClick={() => window.print()}>PDF</button>
        <button className="scta-btn" onClick={onShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
          Share plan
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
