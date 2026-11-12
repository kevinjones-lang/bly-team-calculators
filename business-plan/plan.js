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
  var F = E.FEES;
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
  function blendedDeal(s, level) {
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
          level: level,
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

  // Team split is shown to 2 decimals. Pick the hundredth of a percent whose
  // reverse (income / (gci% × teamSplit%)) rounds back to the same closed volume.
  function teamSplitForVolume(income, volume, commissionPct) {
    var gciRate = Number(commissionPct) / 100;
    if (!(volume > 0) || !(gciRate > 0) || !(income > 0)) return 0;
    var exactHundredths = (income / (volume * gciRate)) * 10000;
    var base = Math.round(exactHundredths);
    function volumeFrom(hundredths) {
      return income / ((hundredths / 10000) * gciRate);
    }
    var best = base;
    var bestScore = Infinity;
    for (var h = base - 50; h <= base + 50; h++) {
      if (h <= 0) continue;
      var dollarOff = Math.abs(Math.round(volumeFrom(h)) - Math.round(volume));
      var score = dollarOff * 100000 + Math.abs(h - exactHundredths);
      if (score < bestScore) {
        best = h;
        bestScore = score;
      }
    }
    return best / 100;
  }

  // ---- Main: reverse from income goal to a full plan ----
  function computePlan(s) {
    // Brand-new and Experienced apply only to the first N deals, then Level 1.
    var introCount = E.dealsAtTier(s.level);
    var introDeal = blendedDeal(s, s.level);
    var laterDeal = introCount ? blendedDeal(s, "1") : introDeal;
    function dealFor(n) {
      return introCount && n <= introCount ? introDeal : laterDeal;
    }
    var grossPerDeal = introDeal.gross;
    var goal = Math.max(0, s.incomeGoal);

    var cumCompany = 0, cumRisk = 0, cumTake = 0, units = 0, postTxPaid = 0, capDeal = null;
    var agg = { gross: 0, office: 0, referral: 0, mentor: 0, company: 0, flat: 0, take: 0 };
    var GUARD = 2000;
    var firstTake = (introDeal.agentBase - introDeal.mentor) - introDeal.agentBase * F.EXP_SPLIT_RATE - F.RISK_FEE - F.BROKER_REVIEW;
    var unreachable = firstTake <= 0 && !(s.modelCap);

    while (cumTake < goal && units < GUARD) {
      units++;
      var deal = dealFor(units);
      var companyFull = deal.agentBase * F.EXP_SPLIT_RATE; // 20% before the mentor cut
      var company, postTx = 0;
      var capActive = s.modelCap && cumCompany >= F.EXP_CAP;
      if (capActive) {
        company = 0;
        postTx = postTxPaid < F.POSTCAP_FEE_CAP ? F.POSTCAP_TX : F.POSTCAP_TX_LO;
        if (capDeal === null) capDeal = units;
      } else if (s.modelCap) {
        var remainingCap = F.EXP_CAP - cumCompany;
        company = Math.min(companyFull, remainingCap);
        if (company < companyFull && capDeal === null) capDeal = units;
      } else {
        company = companyFull;
      }
      var riskRoom = F.RISK_ANNUAL_CAP - cumRisk;
      var risk = riskRoom > 0 ? Math.min(F.RISK_FEE, riskRoom) : 0;
      var flat = risk + F.BROKER_REVIEW + postTx;
      var take = (deal.agentBase - deal.mentor) - company - flat;
      if (take <= 0 && units > 1) { units--; unreachable = true; break; }

      cumCompany += company;
      cumRisk += risk;
      cumTake += take;
      postTxPaid += postTx;
      agg.gross    += deal.gross;
      agg.office   += deal.office;
      agg.referral += deal.referral;
      agg.mentor   += deal.mentor;
      agg.company  += company;
      agg.flat     += flat;
      agg.take     += take;
    }

    var expFeesTotal = agg.company + agg.flat;
    var gci = agg.gross;
    var avgTakePerDeal = units > 0 ? agg.take / units : 0;
    var preCapTake = firstTake;
    var postCapTake = (laterDeal.agentBase - laterDeal.mentor) - F.BROKER_REVIEW - F.POSTCAP_TX;

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

    function stages(close) {
      var uc = close / rUcClose;
      var signed = uc / rSignedUc;
      var met = signed / rMetSigned;
      var set = met / rSetMet;
      var conversations = set / rConvSet;
      return { close: close, uc: uc, signed: signed, met: met, set: set, conversations: conversations };
    }
    // Listing closings round to the nearest deal; buyers take the remainder so the sides sum to units.
    var lClose = Math.round(units * sellerPct);
    var bClose = units - lClose;
    var L = stages(lClose); L.gci = gci * sellerPct;
    var B = stages(bClose); B.gci = gci * buyerPct;

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
    var teamSplitPct = teamSplitForVolume(grossAgentPaidIncome, closedVolume, s.commissionPct);
    var overRange = units >= GUARD && cumTake < goal;

    return {
      units: units,
      unreachable: unreachable,
      overRange: overRange,
      gci: gci,
      avgComm: grossPerDeal,
      avgTakePerDeal: avgTakePerDeal,
      takeTotal: agg.take,
      goal: goal,
      // annual "where the commission goes"
      breakdown: {
        take: agg.take,
        expFees: expFeesTotal,
        office: agg.office,
        mentor: agg.mentor,
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
