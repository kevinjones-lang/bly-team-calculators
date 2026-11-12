/* ============================================================
   The Bly Team × eXp Realty — Business Plan Engine
   Wraps the commission SplitEngine and runs it IN REVERSE:
   from a take-home income goal back to closings, then to a
   listing/buyer production funnel and a weekly cadence.

   Depends on window.SplitEngine (engine.js, loaded first).
   ============================================================ */
(function (global) {
  "use strict";
  var E = global.SplitEngine;

  // eXp annual caps / flat fees (per transaction unless noted)
  var EXP_CAP        = 4000;  // TEAM-member company-dollar cap: 20% split stops once cumulative split hits this
  var RISK_FEE       = 40;    // risk-management fee, per tx, pre-cap
  var BROKER_REVIEW  = 25;    // flat per tx, always
  var POSTCAP_TX     = 250;   // per tx after capping, until $5k paid...
  var POSTCAP_TX_LO  = 75;    // ...then drops to $75 per tx
  var POSTCAP_FEE_CAP = 5000; // total post-cap tx fees before the rate drops
  var EXP_SPLIT_RATE = 0.20;
  var WEEKS_PER_MONTH = 52 / 12; // 4.333…

  // Map the friendly mix keys to the engine's lead-source names
  var SOURCE_KEYS = [
    { key: "soi",    name: "SOI Generated",    label: "Sphere / SOI" },
    { key: "office", name: "Office Generated", label: "Office" },
    { key: "zillow", name: "Zillow Preferred", label: "Zillow" },
  ];

  var STATE_DEFAULTS = {
    timeframe: 12,          // months
    incomeGoal: 100000,     // annual take-home target ($)
    avgPrice: 350000,
    commissionPct: 3.0,
    level: "2",
    listingPct: 50,         // % of closings that are listing (seller) side
    mixSOI: 50, mixOffice: 30, mixZillow: 20, // relative weights, normalized
    setHeldPct: 70,         // Appointment Set -> Appointment Met
    heldTakenPct: 80,       // Appointment Met -> Signed
    signedUcPct: 85,        // Signed -> Under Contract
    ucClosePct: 90,         // Under Contract -> Closed
    convSetPct: 10,         // Conversations -> Appointment Set
    isaConverted: false,
    mentor: false,
    modelCap: true,         // model the eXp cap across the year
  };

  // ---- Formatters ----
  var fmtCurrency = function (n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0);
  };
  var fmtNum1 = function (n) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(isFinite(n) ? n : 0);
  };
  var fmtInt = function (n) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0);
  };

  // Normalize the three lead-source weights to fractions summing to 1.
  function sourceWeights(s) {
    var raw = { soi: Math.max(0, s.mixSOI), office: Math.max(0, s.mixOffice), zillow: Math.max(0, s.mixZillow) };
    var sum = raw.soi + raw.office + raw.zillow;
    if (sum <= 0) return { soi: 1 / 3, office: 1 / 3, zillow: 1 / 3 };
    return { soi: raw.soi / sum, office: raw.office / sum, zillow: raw.zillow / sum };
  }

  // Blend the PERCENTAGE-based commission components across the
  // (source × side) mix. These don't depend on cap state — the cap only
  // touches the flat eXp company split + per-tx fees, handled in the sim.
  function blendedDeal(s) {
    var w = sourceWeights(s);
    var sellerW = clampPct(s.listingPct) / 100;
    var buyerW = 1 - sellerW;
    var sides = [
      { side: "Seller", w: sellerW },
      { side: "Buyer", w: buyerW },
    ];

    var acc = { gross: 0, agentBase: 0, office: 0, referral: 0, mentor: 0 };
    SOURCE_KEYS.forEach(function (src) {
      var sw = w[src.key];
      if (sw <= 0) return;
      sides.forEach(function (sd) {
        if (sd.w <= 0) return;
        var r = E.compute({
          price: s.avgPrice,
          commission: s.commissionPct / 100,
          leadSource: src.name,
          level: s.level,
          side: sd.side,
          isaConverted: s.isaConverted,
          mentor: s.mentor,
          cappedExp: false,
          cappedRisk: false,
          postCapFee: "N/A",
        });
        var ww = sw * sd.w;
        acc.gross    += ww * r.gross;
        acc.agentBase+= ww * r.agentBaseShare; // before mentor
        acc.office   += ww * r.officeShare;
        acc.referral += ww * r.zillowReferral;
        acc.mentor   += ww * r.mentorCut;
      });
    });
    acc.agentGross = acc.agentBase - acc.mentor; // agent's share after mentor, before eXp fees
    return acc;
  }

  function clampPct(v) { return Math.max(0, Math.min(100, v)); }

  // Sisu rejects 0 and anything over 100. Missing values fall back to the default.
  function clampRate(v, fallback) {
    var n = Number(v);
    if (!isFinite(n)) n = fallback;
    return Math.max(1, Math.min(100, n));
  }

  // ---- Main: reverse from income goal to a full plan ----
  function computePlan(s) {
    var deal = blendedDeal(s);
    var grossPerDeal = deal.gross;
    var Wags = deal.agentGross;                 // weighted agent gross share / deal
    var companyPerDealPre = Wags * EXP_SPLIT_RATE;
    var goal = Math.max(0, s.incomeGoal);

    // Deal-by-deal simulation accumulating take-home until the goal is met.
    var cumCompany = 0, cumTake = 0, units = 0, postTxPaid = 0, capDeal = null;
    var agg = { gross: 0, office: 0, referral: 0, mentor: 0, company: 0, flat: 0, take: 0 };
    var GUARD = 2000;
    var preCapTake = Wags - companyPerDealPre - (RISK_FEE + BROKER_REVIEW);
    var unreachable = preCapTake <= 0 && !(s.modelCap); // can't ever reach goal

    while (cumTake < goal && units < GUARD) {
      units++;
      var company, flat, postTx = 0;
      var capActive = s.modelCap && cumCompany >= EXP_CAP;
      if (capActive) {
        company = 0;
        postTx = postTxPaid < POSTCAP_FEE_CAP ? POSTCAP_TX : POSTCAP_TX_LO;
        flat = BROKER_REVIEW + postTx;
        if (capDeal === null) capDeal = units;
      } else {
        if (s.modelCap) {
          var remaining = EXP_CAP - cumCompany;
          company = Math.min(companyPerDealPre, remaining);
          if (company < companyPerDealPre && capDeal === null) capDeal = units;
        } else {
          company = companyPerDealPre;
        }
        flat = RISK_FEE + BROKER_REVIEW;
      }
      var take = Wags - company - flat;
      // Guard against non-converging (deal nets ≤ 0): stop adding deals.
      if (take <= 0 && units > 1) { units--; unreachable = true; break; }

      cumCompany += company;
      cumTake += take;
      postTxPaid += postTx;
      agg.gross    += grossPerDeal;
      agg.office   += deal.office;
      agg.referral += deal.referral;
      agg.mentor   += deal.mentor;
      agg.company  += company;
      agg.flat     += flat;
      agg.take     += take;
    }

    var expFeesTotal = agg.company + agg.flat;
    var othersTotal = agg.office + agg.mentor; // team/office slice (mentor folded in, like the calc)
    var gci = agg.gross;
    var avgTakePerDeal = units > 0 ? agg.take / units : 0;
    var postCapTake = Wags - (BROKER_REVIEW + POSTCAP_TX); // a representative post-cap deal

    // ---- Production funnel (listing vs buyer) ----
    // Conversations -> Appointment Set -> Appointment Met -> Signed -> Under Contract -> Closed.
    // takenClosePct from older share links is ignored; the close is split into two rates.
    var sellerPct = clampPct(s.listingPct) / 100;
    var buyerPct = 1 - sellerPct;
    var rates = {
      convSet: clampRate(s.convSetPct, STATE_DEFAULTS.convSetPct),
      setMet: clampRate(s.setHeldPct, STATE_DEFAULTS.setHeldPct),
      metSigned: clampRate(s.heldTakenPct, STATE_DEFAULTS.heldTakenPct),
      signedUc: clampRate(s.signedUcPct, STATE_DEFAULTS.signedUcPct),
      ucClose: clampRate(s.ucClosePct, STATE_DEFAULTS.ucClosePct),
    };
    var rSetMet = rates.setMet / 100;
    var rMetSigned = rates.metSigned / 100;
    var rSignedUc = rates.signedUc / 100;
    var rUcClose = rates.ucClose / 100;
    var rConvSet = rates.convSet / 100;

    function funnel(unitShare) {
      var close = Math.ceil(units * unitShare);
      var uc = Math.ceil(close / rUcClose);
      var signed = Math.ceil(uc / rSignedUc);
      var met = Math.ceil(signed / rMetSigned);
      var set = Math.ceil(met / rSetMet);
      var conversations = Math.ceil(set / rConvSet);
      return { close: close, uc: uc, signed: signed, met: met, set: set, conversations: conversations };
    }
    var L = funnel(sellerPct); L.gci = gci * sellerPct;
    var B = funnel(buyerPct);  B.gci = gci * buyerPct;

    // ---- Cadence ----
    var d = s.timeframe > 0 ? s.timeframe : 12;
    var monthly = {
      lClose: L.close / d, lUc: L.uc / d, lSigned: L.signed / d, lMet: L.met / d, lSet: L.set / d, lConv: L.conversations / d,
      bClose: B.close / d, bUc: B.uc / d, bSigned: B.signed / d, bMet: B.met / d, bSet: B.set / d, bConv: B.conversations / d,
    };
    var weekly = {
      totalConv: (L.conversations + B.conversations) / d / WEEKS_PER_MONTH,
      totalSet: (L.set + B.set) / d / WEEKS_PER_MONTH,
      totalMet: (L.met + B.met) / d / WEEKS_PER_MONTH,
      totalSigned: (L.signed + B.signed) / d / WEEKS_PER_MONTH,
      totalUc: (L.uc + B.uc) / d / WEEKS_PER_MONTH,
    };

    // Numbers an agent types into Sisu's Goal Calculator. Money math above is untouched.
    var closedVolume = units * s.avgPrice;
    var grossAgentPaidIncome = agg.take + expFeesTotal;
    var volumeCommission = closedVolume * (s.commissionPct / 100);
    var teamSplitPct = volumeCommission > 0 ? (grossAgentPaidIncome / volumeCommission) * 100 : 0;

    return {
      units: units,
      unreachable: unreachable,
      gci: gci,
      avgComm: grossPerDeal,
      avgTakePerDeal: avgTakePerDeal,
      takeTotal: agg.take,
      goal: goal,
      // annual "where the commission goes"
      breakdown: {
        take: agg.take,
        expFees: expFeesTotal,
        office: othersTotal,
        referral: agg.referral,
        gross: gci,
      },
      cap: {
        modeled: !!s.modelCap,
        capDeal: capDeal,           // closing # at which the eXp split is met (null = never)
        preCapTake: preCapTake,
        postCapTake: postCapTake,
        uplift: postCapTake - preCapTake,
      },
      listings: L,
      buyers: B,
      monthly: monthly,
      weekly: weekly,
      sisu: {
        closedVolume: closedVolume,
        grossAgentPaidIncome: grossAgentPaidIncome,
        teamSplitPct: teamSplitPct,
        buyerPct: 100 - clampPct(s.listingPct),
        conversations: L.conversations + B.conversations,
        rates: rates,
      },
    };
  }

  global.BlyPlan = {
    STATE_DEFAULTS: STATE_DEFAULTS,
    SOURCE_KEYS: SOURCE_KEYS,
    sourceWeights: sourceWeights,
    computePlan: computePlan,
    fmtCurrency: fmtCurrency,
    fmtNum1: fmtNum1,
    fmtInt: fmtInt,
    LEVEL_LABELS: E.LEVEL_LABELS,
  };
})(window);
