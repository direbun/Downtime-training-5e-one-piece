const MODULE_ID = "downtime-training";

/* -------------------------------------------- */
/* Constants                                    */
/* -------------------------------------------- */

const ABILITY_LABELS = { str:"Strength", dex:"Dexterity", con:"Constitution", int:"Intelligence", wis:"Wisdom", cha:"Charisma" };

const DAMAGE_LABELS = {
  acid:"Acid", cold:"Cold", fire:"Fire", force:"Force", lightning:"Lightning",
  necrotic:"Necrotic", poison:"Poison", psychic:"Psychic", radiant:"Radiant",
  thunder:"Thunder", bludgeoning:"Bludgeoning", piercing:"Piercing", slashing:"Slashing"
};

const DAMAGE_TYPES = [
  "acid","cold","fire","force","lightning","necrotic","poison","psychic","radiant","thunder",
  "bludgeoning","piercing","slashing"
];

// Ability training bands
const ABILITY_BANDS = [
  { min: 0,  max: 13, dc: 10, successes: 3 },
  { min: 14, max: 15, dc: 12, successes: 4 },
  { min: 16, max: 17, dc: 14, successes: 5 },
  { min: 18, max: 19, dc: 16, successes: 6 },
  { min: 20, max: 21, dc: 18, successes: 7 },
  { min: 22, max: 23, dc: 20, successes: 8 },
  { min: 24, max: 25, dc: 22, successes: 9 },
  { min: 26, max: 27, dc: 24, successes: 10 },
  { min: 28, max: 29, dc: 26, successes: 11 },
  { min: 30, max: 30, dc: 999, successes: 999 }
];

/* -------------------------------------------- */
/* Settings                                     */
/* -------------------------------------------- */

const SETTINGS = {
  NAT20_DOUBLE: "nat20DoubleProgress",
  NAT1_BACK: "nat1BackProgress",
  ALWAYS_ADV: "alwaysAdvantage",
  SOFT_ABILITY: "softDcAbility",
  SOFT_HP: "softDcHp",
  SOFT_RES_NEW: "softDcResNew",
  SOFT_RES_REFINE: "softDcResRefine",
  SOFT_HAKI: "softDcHaki",
  HP_BASE: "hpBaseDc",
  HP_INC: "hpDcPerRank",
  RESNEW_BASE: "resNewBaseDc",
  RESNEW_INC: "resNewDcPerRank",
  RESREF_BASE: "resRefBaseDc",
  RESREF_INC: "resRefDcPerRank",
  HAKI_BASE: "hakiBaseDc",
  HAKI_INC: "hakiDcPerRank",
  RESTRICT_DMG: "restrictedDamageTypes",
  FANCY_CHAT: "fancyChatCards",
};

function S(key) { return game.settings.get(MODULE_ID, key); }

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);

  const regBool = (key, name, hint, def=false) => game.settings.register(MODULE_ID, key, {
    name, hint, scope: "world", config: true, type: Boolean, default: def
  });

  const regNum = (key, name, hint, def) => game.settings.register(MODULE_ID, key, {
    name, hint, scope: "world", config: true, type: Number, default: def
  });

  const regStr = (key, name, hint, def="") => game.settings.register(MODULE_ID, key, {
    name, hint, scope: "world", config: true, type: String, default: def
  });

  regBool(SETTINGS.FANCY_CHAT, "Fancy Chat Cards", "Use animated, stylized training chat cards.", true);

  regBool(
    SETTINGS.ALWAYS_ADV,
    "Training Rolls Always Advantage",
    "If enabled, all training rolls are made with advantage. If disabled, only checking Trainer? grants advantage.",
    false
  );

  regBool(SETTINGS.NAT20_DOUBLE, "Nat 20 = Double Progress", "If enabled, a natural 20 (kept d20) grants double progress on a success.", false);
  regBool(SETTINGS.NAT1_BACK, "Nat 1 = -1 Progress", "If enabled, a natural 1 (kept d20) reduces progress by 1 (min 0).", false);

  regBool(SETTINGS.SOFT_ABILITY, "Fail-Soft DC: Ability Training", "On failure, DC decreases by 1 (stacking) until the next success, then resets.", false);
  regBool(SETTINGS.SOFT_HP, "Fail-Soft DC: Endurance Training", "On failure, DC decreases by 1 (stacking) until the next success, then resets.", false);
  regBool(SETTINGS.SOFT_RES_NEW, "Fail-Soft DC: New Resistance", "On failure, DC decreases by 1 (stacking) until the next success, then resets.", false);
  regBool(SETTINGS.SOFT_RES_REFINE, "Fail-Soft DC: Refine to Immunity", "On failure, DC decreases by 1 (stacking) until the next success, then resets.", false);
  regBool(SETTINGS.SOFT_HAKI, "Fail-Soft DC: Haki / Fruit", "On failure, DC decreases by 1 (stacking) until the next success, then resets.", false);

  regNum(SETTINGS.HP_BASE, "Endurance: Base DC", "Base DC for Endurance Training rank 0.", 15);
  regNum(SETTINGS.HP_INC, "Endurance: DC per Rank", "How much DC increases per Endurance rank.", 2);

  regNum(SETTINGS.RESNEW_BASE, "Resistance (New): Base DC", "Base DC for New Resistance when Resilience Rank = 0.", 18);
  regNum(SETTINGS.RESNEW_INC, "Resistance (New): DC per Rank", "How much DC increases per Resilience Rank for New Resistance.", 2);

  regNum(SETTINGS.RESREF_BASE, "Resistance (Refine): Base DC", "Base DC for Refine to Immunity when Resilience Rank = 0.", 20);
  regNum(SETTINGS.RESREF_INC, "Resistance (Refine): DC per Rank", "How much DC increases per Resilience Rank for Refine to Immunity.", 2);

  regNum(SETTINGS.HAKI_BASE, "Haki/Fruit: Base DC", "Base DC for Haki/Fruit rank 0.", 15);
  regNum(SETTINGS.HAKI_INC, "Haki/Fruit: DC per Rank", "How much DC increases per Haki/Fruit rank.", 1);

  regStr(
    SETTINGS.RESTRICT_DMG,
    "Restricted Damage Types",
    "Comma-separated damage type IDs that cannot be gained (e.g. fire,force,necrotic). Valid: " + DAMAGE_TYPES.join(", "),
    ""
  );
});

/* -------------------------------------------- */
/* Style Injection (Chat + Sheet)               */
/* -------------------------------------------- */

function ensureStyles() {
  const id = `${MODULE_ID}-styles`;
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;

  // Minified CSS (same rules as your original; just compact to keep the macro manageable)
  style.textContent =
`.dt-chatcard{border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:12px 12px 10px;background:linear-gradient(135deg,rgba(0,0,0,.22),rgba(0,0,0,.08));box-shadow:0 10px 30px rgba(0,0,0,.28);position:relative;overflow:hidden}
.dt-chatcard:before{content:"";position:absolute;inset:-60px;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),transparent 45%),radial-gradient(circle at 70% 80%,rgba(255,255,255,.10),transparent 55%);opacity:.9;pointer-events:none}
.dt-chatcard .dt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;position:relative;z-index:1}
.dt-chatcard .dt-title{margin:0;font-size:1.05rem;letter-spacing:.02em}
.dt-chatcard .dt-sub{margin:2px 0 0;opacity:.78;font-size:.86rem}
.dt-chatcard .dt-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.18);margin-right:8px}
.dt-chatcard .dt-left{display:flex;gap:10px;align-items:flex-start}
.dt-chatcard .dt-badge{border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 9px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.18)}
.dt-chatcard.dt-success .dt-badge{box-shadow:0 0 0 2px rgba(0,255,140,.10) inset}
.dt-chatcard.dt-fail .dt-badge{box-shadow:0 0 0 2px rgba(255,70,70,.12) inset}
.dt-chatcard .dt-body{margin-top:10px;position:relative;z-index:1}
.dt-chatcard .dt-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dt-chatcard .dt-kpi{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:8px 10px;background:rgba(0,0,0,.14)}
.dt-chatcard .dt-kpi h4{margin:0;font-size:.78rem;opacity:.78}
.dt-chatcard .dt-kpi p{margin:2px 0 0;font-size:1.05rem;font-weight:750}
.dt-chatcard .dt-note{margin:8px 0 0;opacity:.82;font-size:.86rem}
.dt-chatcard .dt-sep{height:1px;background:rgba(255,255,255,.16);margin:10px 0}
.dt-chatcard .dt-progress{margin-top:8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;height:10px;background:rgba(0,0,0,.28);overflow:hidden}
.dt-chatcard .dt-progress>span{display:block;height:100%;width:var(--dt-pct,0%);background:linear-gradient(90deg,rgba(0,255,140,.90),rgba(0,255,140,.35));box-shadow:0 0 18px rgba(0,255,140,.45);position:relative}
.dt-chatcard .dt-progress>span:after{content:"";position:absolute;inset:0;transform:translateX(-40%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:dtShine 1.2s linear infinite;opacity:.45}
@keyframes dtShine{to{transform:translateX(120%)}}
.dt-chatcard.dt-success{animation:dtPop 260ms ease-out}
.dt-chatcard.dt-fail{animation:dtShake 240ms ease-out}
@keyframes dtPop{from{transform:translateY(6px) scale(.99);filter:brightness(.98)}to{transform:translateY(0) scale(1);filter:brightness(1)}}
@keyframes dtShake{0%{transform:translateX(0)}25%{transform:translateX(-2px)}50%{transform:translateX(2px)}75%{transform:translateX(-2px)}100%{transform:translateX(0)}}
.dt-chatcard.dt-crit:after{content:"";position:absolute;inset:-40px;background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.40),transparent 40%),radial-gradient(circle at 80% 60%,rgba(255,255,255,.20),transparent 45%);opacity:.45;pointer-events:none;animation:dtSpark 1.6s ease-in-out infinite}
@keyframes dtSpark{0%,100%{transform:rotate(0deg);opacity:.30}50%{transform:rotate(8deg);opacity:.55}}
.dt-roll-details summary{cursor:pointer;opacity:.9}
.dt-roll-details{margin-top:8px;border:1px dashed rgba(255,255,255,.18);border-radius:14px;padding:8px 10px;background:rgba(0,0,0,.10)}
.dt-training-wrap{padding:.95rem;gap:.95rem}
.dt-training-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem}
.dt-training-title{margin:0;font-size:1.35rem;letter-spacing:.02em}
.dt-training-sub{margin:.25rem 0 0;opacity:.75;font-size:.9rem}
.dt-grid{display:grid;grid-template-columns:1fr;gap:.95rem}
.dt-card{padding:.95rem;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(0,0,0,.10)}
.dt-section-title{margin:0;font-size:1.05rem;letter-spacing:.01em}
.dt-muted{opacity:.75;margin:.25rem 0 0;font-size:.9rem}
.dt-sep{height:1px;background:currentColor;opacity:.12;margin:.75rem 0}
.dt-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem}
.dt-tile{padding:.7rem;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(0,0,0,.12)}
.dt-tile h4{margin:0;font-size:.92rem;opacity:.85;font-weight:650}
.dt-big{margin:.2rem 0 0;font-size:1.25rem;font-weight:750;letter-spacing:.01em}
.dt-note{margin:.25rem 0 0;font-size:.85rem;opacity:.78}
.dt-chips{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
.dt-chip{padding:.18rem .5rem;border:1px solid rgba(255,255,255,.15);border-radius:999px;font-size:.82rem;opacity:.9;background:rgba(0,0,0,.10)}
@media (max-width:900px){.dt-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:620px){.dt-tiles{grid-template-columns:1fr}}`;

  document.head.appendChild(style);
}

/* -------------------------------------------- */
/* Utilities                                    */
/* -------------------------------------------- */

function getActorFromContext() {
  return canvas.tokens.controlled[0]?.actor ?? game.user.character ?? null;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function parseRestrictedDamageTypes() {
  const raw = (S(SETTINGS.RESTRICT_DMG) || "").trim();
  if (!raw) return new Set();
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  const set = new Set();
  for (const p of parts) if (DAMAGE_TYPES.includes(p)) set.add(p);
  return set;
}

function adjustDc(dcBase, failMod, enabled) {
  if (!enabled) return dcBase;
  const fm = Number(failMod ?? 0);
  return Math.max(0, dcBase - fm);
}

function ensureTrack(root, key) {
  if (!root[key]) root[key] = { rank: 0, successes: 0, failMod: 0 };
  root[key].rank = Number(root[key].rank ?? 0);
  root[key].successes = Number(root[key].successes ?? 0);
  root[key].failMod = Number(root[key].failMod ?? 0);
  return root[key];
}

function getKeptD20(roll) {
  try {
    const terms = roll?.terms ?? [];
    for (const t of terms) {
      const faces = t?.faces;
      const results = t?.results;
      if (faces === 20 && Array.isArray(results)) {
        const active = results.find(r => r.active) ?? results[0];
        return Number(active?.result ?? null);
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Spend a GP cost from mixed coin denominations.
 * Conversions (D&D 5e):
 *  1 pp = 10 gp = 1000 cp
 *  1 gp = 10 sp = 100 cp
 *  1 ep = 5 sp = 50 cp
 *  1 sp = 10 cp
 */
async function spendGp(actor, gpCost) {
  const costGp = Number(gpCost ?? 0);
  if (!costGp || costGp <= 0) return { ok: true, spent: 0 };

  const cur = actor.system?.currency;
  if (!cur) {
    ui.notifications.warn("Could not find currency on this actor (system.currency).");
    return { ok: false, spent: 0 };
  }

  const toInt = (v) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };

  const costCp = Math.round(costGp * 100);

  let wallet = {
    pp: toInt(cur.pp),
    gp: toInt(cur.gp),
    ep: toInt(cur.ep),
    sp: toInt(cur.sp),
    cp: toInt(cur.cp),
  };

  const totalCp =
    wallet.pp * 1000 +
    wallet.gp * 100 +
    wallet.ep * 50 +
    wallet.sp * 10 +
    wallet.cp;

  if (totalCp < costCp) {
    const totalGpEq = (totalCp / 100).toFixed(2);
    ui.notifications.warn(`Not enough money. Need ${costGp} gp (you have ~${totalGpEq} gp total in mixed coins).`);
    return { ok: false, spent: 0 };
  }

  if (costCp % 100 === 0 && wallet.gp * 100 >= costCp) {
    const gpToSpend = costCp / 100;
    wallet.gp = Math.max(0, wallet.gp - gpToSpend);

    await actor.update({
      "system.currency.pp": wallet.pp,
      "system.currency.gp": wallet.gp,
      "system.currency.ep": wallet.ep,
      "system.currency.sp": wallet.sp,
      "system.currency.cp": wallet.cp,
    });

    return { ok: true, spent: costGp };
  }

  let remainingCp = costCp;

  const gpSpendWhole = Math.min(wallet.gp, Math.floor(remainingCp / 100));
  wallet.gp -= gpSpendWhole;
  remainingCp -= gpSpendWhole * 100;

  if (remainingCp > 0 && remainingCp < 100 && wallet.gp > 0) {
    wallet.gp -= 1;
    const changeCp = 100 - remainingCp;
    remainingCp = 0;

    const addEp = Math.floor(changeCp / 50);
    const remAfterEp = changeCp - addEp * 50;
    const addSp = Math.floor(remAfterEp / 10);
    const addCp = remAfterEp - addSp * 10;

    wallet.ep += addEp;
    wallet.sp += addSp;
    wallet.cp += addCp;
  }

  if (remainingCp > 0) {
    const otherCp =
      wallet.pp * 1000 +
      wallet.ep * 50 +
      wallet.sp * 10 +
      wallet.cp;

    let poolCp = otherCp - remainingCp;

    const rebuilt = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    rebuilt.pp = Math.floor(poolCp / 1000);
    poolCp -= rebuilt.pp * 1000;

    rebuilt.gp = Math.floor(poolCp / 100);
    poolCp -= rebuilt.gp * 100;

    rebuilt.ep = Math.floor(poolCp / 50);
    poolCp -= rebuilt.ep * 50;

    rebuilt.sp = Math.floor(poolCp / 10);
    poolCp -= rebuilt.sp * 10;

    rebuilt.cp = poolCp;

    wallet.pp = rebuilt.pp;
    wallet.gp = wallet.gp + rebuilt.gp;
    wallet.ep = rebuilt.ep;
    wallet.sp = rebuilt.sp;
    wallet.cp = rebuilt.cp;
  }

  await actor.update({
    "system.currency.pp": wallet.pp,
    "system.currency.gp": wallet.gp,
    "system.currency.ep": wallet.ep,
    "system.currency.sp": wallet.sp,
    "system.currency.cp": wallet.cp,
  });

  return { ok: true, spent: costGp };
}

/* -------------------------------------------- */
/* Fancy Chat Card Builder                      */
/* -------------------------------------------- */

async function postTrainingCard({
  actor,
  icon = "fa-solid fa-dumbbell",
  title,
  subtitle = "",
  badge = "",
  outcome = "success",
  roll,
  nat = null,
  dcBase,
  dcUsed,
  failModBefore = 0,
  progressText = "",
  progressPct = 0,
  extraHtml = "",
  trainerSpent = 0,
  autoPass = false
}) {
  const speaker = ChatMessage.getSpeaker({ actor });
  const isCrit = nat === 20;
  const isFumble = nat === 1;

  const cls = [
    "dt-chatcard",
    outcome === "success" ? "dt-success" : "dt-fail",
    isCrit ? "dt-crit" : "",
    isFumble ? "dt-fumble" : ""
  ].filter(Boolean).join(" ");

  const showDcLine =
    (dcBase !== dcUsed)
      ? `DC <b>${dcUsed}</b> <span style="opacity:.75">(base ${dcBase}${failModBefore ? `, fail-soft -${failModBefore}` : ""})</span>`
      : `DC <b>${dcUsed}</b>`;

  const natTag = (nat === 20) ? `<span class="dt-chip" style="margin-left:.35rem;">NAT 20</span>`
               : (nat === 1)  ? `<span class="dt-chip" style="margin-left:.35rem;">NAT 1</span>`
               : "";

  const rollTotal = Number(roll?.total ?? 0);
  const rollTotalDisplay = autoPass ? "AUTO" : rollTotal;
  const rollHtml = (roll && !autoPass) ? await roll.render() : "";

  const trainerLine = trainerSpent > 0
    ? `<p class="dt-note"><i class="fa-solid fa-coins"></i> Training cost paid: <b>${trainerSpent} gp</b></p>`
    : "";

  const autoLine = autoPass
    ? `<p class="dt-note"><i class="fa-solid fa-check"></i> <b>Auto Pass</b> selected (no roll made).</p>`
    : "";

  const content = `
<article class="${cls}" style="--dt-pct:${clamp(progressPct,0,100)}%;">
  <div class="dt-head">
    <div class="dt-left">
      <div class="dt-icon"><i class="${icon}"></i></div>
      <div>
        <h3 class="dt-title">${title} ${natTag}</h3>
        ${subtitle ? `<p class="dt-sub">${subtitle}</p>` : ""}
      </div>
    </div>
    <div class="dt-badge">${badge}</div>
  </div>

  <div class="dt-body">
    <div class="dt-kpis">
      <div class="dt-kpi">
        <h4>Roll Total</h4>
        <p>${rollTotalDisplay}</p>
      </div>
      <div class="dt-kpi">
        <h4>Difficulty</h4>
        <p>${dcUsed}</p>
      </div>
      <div class="dt-kpi">
        <h4>Progress</h4>
        <p>${progressText || "—"}</p>
      </div>
    </div>

    <p class="dt-note">${showDcLine}</p>
    ${trainerLine}
    ${autoLine}

    <div class="dt-progress"><span></span></div>

    ${extraHtml ? `<div class="dt-sep"></div>${extraHtml}` : ""}

    ${rollHtml ? `
      <details class="dt-roll-details">
        <summary><i class="fa-solid fa-dice-d20"></i> Roll details</summary>
        <div style="margin-top:.5rem;">${rollHtml}</div>
      </details>
    ` : ""}
  </div>
</article>
  `;

  const msgData = {
    speaker,
    content,
    type: roll ? CONST.CHAT_MESSAGE_TYPES.ROLL : CONST.CHAT_MESSAGE_TYPES.OTHER,
    rolls: roll ? [roll] : []
  };

  return ChatMessage.create(msgData);
}

/* -------------------------------------------- */
/* Trainer Prompt (now includes Auto Pass)      */
/* -------------------------------------------- */

async function promptTrainerCost() {
  return new Promise((resolve) => {
    new Dialog({
      title: "Training Options",
      content: `
        <p>Optional: charge gold for training. If Trainer? is checked, the roll also gains advantage (unless Always Advantage is enabled anyway).</p>
        <form>
          <div class="form-group">
            <label><input type="checkbox" id="dt-trainer"> Trainer?</label>
          </div>
          <div class="form-group">
            <label>Training Cost (GP)</label>
            <input id="dt-gp" type="number" min="0" step="1" value="0" style="width:100%">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: "Continue",
          callback: (html) => resolve({
            trainer: Boolean(html.find("#dt-trainer")[0]?.checked),
            gp: Number(html.find("#dt-gp").val() || 0),
            autoPass: false
          })
        },
        auto: {
          label: "Auto Pass",
          callback: (html) => resolve({
            trainer: Boolean(html.find("#dt-trainer")[0]?.checked),
            gp: Number(html.find("#dt-gp").val() || 0),
            autoPass: true
          })
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

/* -------------------------------------------- */
/* Main Training Runner                         */
/* -------------------------------------------- */

async function runDowntimeTraining(actor) {
  if (!actor) return ui.notifications.error("No actor found. Select a token or set a character.");
  if (!actor.system?.abilities) return ui.notifications.error("This macro is designed for the D&D 5e system.");

  ensureStyles();

  const trainingType = await new Promise((resolve) => {
    new Dialog({
      title: "Downtime Training",
      content: `
        <p>What type of training is this?</p>
        <form>
          <div class="form-group">
            <select id="training-type" style="width:100%">
              <option value="stat">Ability Score Training (to 30)</option>
              <option value="hp">Endurance Training (+1 HP per level)</option>
              <option value="resist">Resistance / Immunity Training</option>
              <option value="haki">Haki / Devil Fruit Training</option>
            </select>
          </div>
        </form>
      `,
      buttons: {
        ok: { label: "Continue", callback: (html) => resolve(html.find("#training-type").val()) },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
  if (!trainingType) return;

  const trainerInfo = await promptTrainerCost();
  if (!trainerInfo) return;
  const autoPass = !!trainerInfo.autoPass;

  let trainerSpent = 0;
  if (trainerInfo.trainer && trainerInfo.gp > 0) {
    const pay = await spendGp(actor, trainerInfo.gp);
    if (!pay.ok) return;
    trainerSpent = pay.spent;
  }

  // Advantage ONLY if setting is on OR Trainer? checked
  const adv = !!S(SETTINGS.ALWAYS_ADV) || !!trainerInfo?.trainer;

  const nat20Double = !!S(SETTINGS.NAT20_DOUBLE);
  const nat1Back = !!S(SETTINGS.NAT1_BACK);

  /* ---------- Ability Score Training ---------- */
  if (trainingType === "stat") {
    const abilities = actor.system.abilities;

    const abilityOptions = Object.entries(abilities)
      .map(([key, data]) => `<option value="${key}">${key.toUpperCase()} (${data.value})</option>`)
      .join("");

    const ability = await new Promise((resolve) => {
      new Dialog({
        title: "Ability Score Training",
        content: `
          <p>Select the ability score to train:</p>
          <form>
            <div class="form-group">
              <label>Ability</label>
              <select id="train-ability" style="width:100%">${abilityOptions}</select>
            </div>
          </form>
        `,
        buttons: {
          train: { label: "Train", callback: (html) => resolve(html.find("#train-ability").val()) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "train",
        close: () => resolve(null)
      }).render(true);
    });
    if (!ability) return;

    const currentScore = Number(abilities[ability].value ?? 0);
    if (currentScore >= 30) return ui.notifications.warn(`${ability.toUpperCase()} is already 30 and cannot be trained further.`);

    const band = ABILITY_BANDS.find(b => currentScore >= b.min && currentScore <= b.max);
    if (!band) return ui.notifications.error("No training band found. Check ability bands.");

    const flagKey = "downtimeTraining";
    const allTrainingData = actor.getFlag(MODULE_ID, flagKey) || {};
    const track = allTrainingData[ability] || { successes: 0, failMod: 0 };

    let successes = Number(track.successes ?? 0);
    let failMod = Number(track.failMod ?? 0);
    const failModBefore = failMod;

    const dcBase = band.dc;
    const dcUsed = adjustDc(dcBase, failModBefore, !!S(SETTINGS.SOFT_ABILITY));

    const formula = adv
      ? `2d20kh + @abilities.${ability}.mod`
      : `1d20 + @abilities.${ability}.mod`;

    let roll = null;
    let nat = null;
    let success = true;

    if (!autoPass) {
      roll = await new Roll(formula, actor.getRollData()).evaluate({ async: true });
      nat = getKeptD20(roll);

      success = roll.total >= dcUsed;
      if (nat1Back && nat === 1) success = false;
    }

    let gained = 0;

    if (success) {
      gained = (!autoPass && nat20Double && nat === 20) ? 2 : 1;
      successes += gained;
      failMod = 0;
    } else {
      if (nat1Back && nat === 1) successes = Math.max(0, successes - 1);
      if (S(SETTINGS.SOFT_ABILITY)) failMod += 1;
    }

    const needed = band.successes;
    let leveledUp = false;

    if (successes >= needed) {
      leveledUp = true;
      const newScore = currentScore + 1;
      await actor.update({ [`system.abilities.${ability}.value`]: newScore });
      successes = 0;
      failMod = 0;
    }

    allTrainingData[ability] = { successes, failMod };
    await actor.setFlag(MODULE_ID, flagKey, allTrainingData);

    const pct = needed ? Math.floor((successes / needed) * 100) : 0;

    const extra = leveledUp
      ? `<p class="dt-note"><b>Power Up!</b> ${ability.toUpperCase()} increases <b>${currentScore} → ${currentScore + 1}</b>.</p>`
      : (success
        ? `<p class="dt-note"><b>${autoPass ? "Auto Pass!" : "Success!"}</b> +${gained} progress.</p>`
        : `<p class="dt-note"><b>Failure.</b> ${nat1Back && nat === 1 ? "Nat 1: -1 progress." : "No progress."}</p>`);

    await postTrainingCard({
      actor,
      icon: "fa-solid fa-chart-simple",
      title: `Ability Training: ${ability.toUpperCase()}`,
      subtitle: `Score ${currentScore} • Need ${needed} successes`,
      badge: autoPass ? "AUTO PASS" : (success ? "SUCCESS" : "FAILURE"),
      outcome: success ? "success" : "fail",
      roll,
      nat,
      dcBase,
      dcUsed,
      failModBefore,
      progressText: `${successes}/${needed}`,
      progressPct: pct,
      extraHtml: extra,
      trainerSpent,
      autoPass
    });

    return;
  }

  /* ---------- Endurance Training ---------- */
  if (trainingType === "hp") {
    const level = Number(actor.system.details?.level ?? 1);
    const hpData = actor.system.attributes?.hp;
    if (!hpData) return ui.notifications.error("Could not find HP data on this actor.");

    const flagKey = "hpPerLevelTraining";
    const t = actor.getFlag(MODULE_ID, flagKey) || { ranks: 0, successes: 0, failMod: 0 };
    let ranks = Number(t.ranks ?? 0);
    let successes = Number(t.successes ?? 0);
    let failMod = Number(t.failMod ?? 0);
    const failModBefore = failMod;

    const dcBase = Number(S(SETTINGS.HP_BASE)) + Number(S(SETTINGS.HP_INC)) * ranks;
    const dcUsed = adjustDc(dcBase, failModBefore, !!S(SETTINGS.SOFT_HP));
    const needed = 5 + ranks;

    const formula = adv
      ? "2d20kh + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod"
      : "1d20 + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod";

    let roll = null;
    let nat = null;
    let success = true;

    if (!autoPass) {
      roll = await new Roll(formula, actor.getRollData()).evaluate({ async: true });
      nat = getKeptD20(roll);

      success = roll.total >= dcUsed;
      if (nat1Back && nat === 1) success = false;
    }

    let gained = 0;

    if (success) {
      gained = (!autoPass && nat20Double && nat === 20) ? 2 : 1;
      successes += gained;
      failMod = 0;
    } else {
      if (nat1Back && nat === 1) successes = Math.max(0, successes - 1);
      if (S(SETTINGS.SOFT_HP)) failMod += 1;
    }

    let extra = "";

    if (successes >= needed) {
      ranks += 1;
      successes = 0;
      failMod = 0;

      const currentPerLevel = Number(hpData.bonuses?.level || 0);
      const newPerLevel = currentPerLevel + 1;
      await actor.update({ "system.attributes.hp.bonuses.level": newPerLevel });

      extra = `
        <p class="dt-note"><b>Rank Up!</b> Endurance ranks: <b>${ranks - 1} → ${ranks}</b></p>
        <p class="dt-note">Bonus HP/level: <b>${currentPerLevel} → ${newPerLevel}</b> (at level ${level}: +<b>${level}</b> max HP)</p>
      `;
    } else {
      extra = success
        ? `<p class="dt-note"><b>${autoPass ? "Auto Pass!" : "Success!"}</b> +${gained} progress.</p>`
        : `<p class="dt-note"><b>Failure.</b> ${nat1Back && nat === 1 ? "Nat 1: -1 progress." : "No progress."}</p>`;
    }

    await actor.setFlag(MODULE_ID, flagKey, { ranks, successes, failMod });

    const pct = needed ? Math.floor((successes / needed) * 100) : 0;

    await postTrainingCard({
      actor,
      icon: "fa-solid fa-heart-pulse",
      title: "Endurance Training",
      subtitle: `Rank ${ranks} • Need ${needed} successes`,
      badge: autoPass ? "AUTO PASS" : (success ? "SUCCESS" : "FAILURE"),
      outcome: success ? "success" : "fail",
      roll,
      nat,
      dcBase,
      dcUsed,
      failModBefore,
      progressText: `${successes}/${needed}`,
      progressPct: pct,
      extraHtml: extra,
      trainerSpent,
      autoPass
    });

    return;
  }

  /* ---------- Resistance / Immunity ---------- */
  if (trainingType === "resist") {
    if (!actor.system?.traits?.dr || !actor.system?.traits?.di) {
      return ui.notifications.error("Could not find resistance/immunity trait fields on this actor.");
    }

    const drData = actor.system.traits.dr;
    const diData = actor.system.traits.di;
    const resists = Array.from(drData.value ?? []);
    const immunes = Array.from(diData.value ?? []);

    const resilienceRank = resists.length + (immunes.length * 2);

    const flagKey = "resistanceTraining";
    const trainingData = actor.getFlag(MODULE_ID, flagKey) || {};
    if (!trainingData.new) trainingData.new = { successes: 0, failMod: 0 };
    if (!trainingData.refine) trainingData.refine = {};

    const mode = await new Promise((resolve) => {
      new Dialog({
        title: "Resistance / Immunity Training",
        content: `
          <p>Choose the type of resilience training:</p>
          <form>
            <div class="form-group">
              <label><input type="radio" name="mode" value="new" checked> Train a <b>new random resistance</b></label><br>
              <label><input type="radio" name="mode" value="refine"> Refine an existing <b>resistance into immunity</b></label>
            </div>
          </form>
        `,
        buttons: {
          ok: { label: "Continue", callback: (html) => resolve(html.find('input[name="mode"]:checked').val()) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
    if (!mode) return;

    let targetDamageType = null;
    if (mode === "refine") {
      const refineOptions = resists.filter(dt => !immunes.includes(dt));
      if (!refineOptions.length) return ui.notifications.warn("No resistances available to refine.");

      const refineHtmlOptions = refineOptions
        .map(dt => `<option value="${dt}">${DAMAGE_LABELS[dt] ?? dt}</option>`)
        .join("");

      targetDamageType = await new Promise((resolve) => {
        new Dialog({
          title: "Refine Resistance → Immunity",
          content: `
            <p>Select which resistance to refine:</p>
            <form>
              <div class="form-group">
                <label>Resistance</label>
                <select id="resistance-choice" style="width:100%">${refineHtmlOptions}</select>
              </div>
            </form>
          `,
          buttons: {
            refine: { label: "Train Refinement", callback: (html) => resolve(html.find("#resistance-choice").val()) },
            cancel: { label: "Cancel", callback: () => resolve(null) }
          },
          default: "refine",
          close: () => resolve(null)
        }).render(true);
      });
      if (!targetDamageType) return;

      if (!trainingData.refine[targetDamageType]) trainingData.refine[targetDamageType] = { successes: 0, failMod: 0 };
    }

    const isNew = mode === "new";
    const base = isNew ? Number(S(SETTINGS.RESNEW_BASE)) : Number(S(SETTINGS.RESREF_BASE));
    const inc  = isNew ? Number(S(SETTINGS.RESNEW_INC))  : Number(S(SETTINGS.RESREF_INC));

    const dcBase = base + inc * resilienceRank;

    const failModBefore = isNew
      ? Number(trainingData.new.failMod ?? 0)
      : Number(trainingData.refine[targetDamageType].failMod ?? 0);

    const dcUsed = adjustDc(
      dcBase,
      failModBefore,
      isNew ? !!S(SETTINGS.SOFT_RES_NEW) : !!S(SETTINGS.SOFT_RES_REFINE)
    );

    const needed = isNew ? (5 + resilienceRank) : (8 + resilienceRank);

    const formula = adv
      ? "2d20kh + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod + @abilities.int.mod + @abilities.wis.mod + @abilities.cha.mod"
      : "1d20 + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod + @abilities.int.mod + @abilities.wis.mod + @abilities.cha.mod";

    let roll = null;
    let nat = null;
    let success = true;

    if (!autoPass) {
      roll = await new Roll(formula, actor.getRollData()).evaluate({ async: true });
      nat = getKeptD20(roll);

      success = roll.total >= dcUsed;
      if (nat1Back && nat === 1) success = false;
    }

    let successes = isNew
      ? Number(trainingData.new.successes ?? 0)
      : Number(trainingData.refine[targetDamageType].successes ?? 0);

    let failMod = failModBefore;

    let gained = 0;
    if (success) {
      gained = (!autoPass && nat20Double && nat === 20) ? 2 : 1;
      successes += gained;
      failMod = 0;
    } else {
      if (nat1Back && nat === 1) successes = Math.max(0, successes - 1);
      if (isNew ? S(SETTINGS.SOFT_RES_NEW) : S(SETTINGS.SOFT_RES_REFINE)) failMod += 1;
    }

    let extra = "";

    if (successes >= needed) {
      successes = 0;
      failMod = 0;

      if (isNew) {
        const restricted = parseRestrictedDamageTypes();
        const unavailable = new Set([...resists, ...immunes, ...restricted]);
        const available = DAMAGE_TYPES.filter(dt => !unavailable.has(dt));

        if (!available.length) {
          extra = `<p class="dt-note"><b>No available damage types remain</b> (restricted or already owned).</p>`;
        } else {
          const gainedType = available[Math.floor(Math.random() * available.length)];
          const newResists = Array.from(new Set([...resists, gainedType]));
          await actor.update({ "system.traits.dr.value": newResists });
          extra = `<p class="dt-note"><b>New Resistance Gained:</b> ${DAMAGE_LABELS[gainedType] ?? gainedType}</p>`;
        }
      } else {
        const refined = targetDamageType;
        const newResists = resists.filter(dt => dt !== refined);
        const newImmunes = Array.from(new Set([...immunes, refined]));

        await actor.update({
          "system.traits.dr.value": newResists,
          "system.traits.di.value": newImmunes
        });

        extra = `<p class="dt-note"><b>Refined!</b> ${DAMAGE_LABELS[refined] ?? refined} is now an <b>Immunity</b>.</p>`;
      }
    } else {
      extra = success
        ? `<p class="dt-note"><b>${autoPass ? "Auto Pass!" : "Success!"}</b> +${gained} progress.</p>`
        : `<p class="dt-note"><b>Failure.</b> ${nat1Back && nat === 1 ? "Nat 1: -1 progress." : "No progress."}</p>`;
    }

    if (isNew) {
      trainingData.new.successes = successes;
      trainingData.new.failMod = failMod;
    } else {
      trainingData.refine[targetDamageType].successes = successes;
      trainingData.refine[targetDamageType].failMod = failMod;
    }

    await actor.setFlag(MODULE_ID, flagKey, trainingData);

    const pct = needed ? Math.floor((successes / needed) * 100) : 0;

    await postTrainingCard({
      actor,
      icon: "fa-solid fa-shield-halved",
      title: isNew ? "Resilience Training: New Resistance" : `Resilience Training: Refine ${DAMAGE_LABELS[targetDamageType] ?? targetDamageType}`,
      subtitle: `Resilience Rank ${resilienceRank} • Need ${needed} successes`,
      badge: autoPass ? "AUTO PASS" : (success ? "SUCCESS" : "FAILURE"),
      outcome: success ? "success" : "fail",
      roll,
      nat,
      dcBase,
      dcUsed,
      failModBefore,
      progressText: `${successes}/${needed}`,
      progressPct: pct,
      extraHtml: extra,
      trainerSpent,
      autoPass
    });

    return;
  }

  /* ---------- Haki / Devil Fruit ---------- */
  if (trainingType === "haki") {
    const FLAG_KEY = "hakiFruitTraining";
    const data = actor.getFlag(MODULE_ID, FLAG_KEY) || {};
    if (!data.haki) data.haki = {};
    if (!data.fruits) data.fruits = {};

    const skills = actor.system.skills;
    const skillOptions = Object.entries(skills)
      .map(([k, v]) => `<option value="${k}">${v.label ?? k.toUpperCase()}</option>`)
      .join("");

    const abilityOptions = Object.keys(actor.system.abilities)
      .map(k => `<option value="${k}">${ABILITY_LABELS[k] ?? k.toUpperCase()}</option>`)
      .join("");

    const mode = await new Promise((resolve) => {
      new Dialog({
        title: "Haki / Devil Fruit Training",
        content: `
          <p>What are you training?</p>
          <form>
            <div class="form-group">
              <select id="train-mode" style="width:100%">
                <option value="armament">Haki: Armament</option>
                <option value="observation">Haki: Observation</option>
                <option value="conquerors">Haki: Conqueror's</option>
                <option value="devilfruit">Devil Fruit</option>
              </select>
            </div>
          </form>
        `,
        buttons: {
          ok: { label: "Continue", callback: (html) => resolve(html.find("#train-mode").val()) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
    if (!mode) return;

    let title = "";
    let icon = "fa-solid fa-hand-fist";
    let rollFormula = "";
    let trackObj = null;
    let trackKey = null;
    let extraInfo = "";

    if (mode === "armament") {
      title = "Haki: Armament";
      rollFormula = adv ? "2d20kh + @abilities.str.mod + @abilities.con.mod" : "1d20 + @abilities.str.mod + @abilities.con.mod";
      trackObj = data.haki;
      trackKey = "armament";
      ensureTrack(trackObj, trackKey);
    } else if (mode === "observation") {
      title = "Haki: Observation";
      rollFormula = adv ? "2d20kh + @abilities.dex.mod + @abilities.int.mod" : "1d20 + @abilities.dex.mod + @abilities.int.mod";
      trackObj = data.haki;
      trackKey = "observation";
      ensureTrack(trackObj, trackKey);
    } else if (mode === "conquerors") {
      title = "Haki: Conqueror's";
      rollFormula = adv ? "2d20kh + @abilities.wis.mod + @abilities.cha.mod" : "1d20 + @abilities.wis.mod + @abilities.cha.mod";
      trackObj = data.haki;
      trackKey = "conquerors";
      ensureTrack(trackObj, trackKey);
      icon = "fa-solid fa-bolt";
    } else if (mode === "devilfruit") {
      icon = "fa-solid fa-apple-whole";
      const active = data.fruits.__activeFruit;

      if (active?.name && active?.ability && active?.skill) {
        active.rank = Number(active.rank ?? 0);
        active.successes = Number(active.successes ?? 0);
        active.failMod = Number(active.failMod ?? 0);

        title = `Devil Fruit: ${active.name}`;
        rollFormula = adv
          ? `2d20kh + @abilities.${active.ability}.mod + @skills.${active.skill}.mod`
          : `1d20 + @abilities.${active.ability}.mod + @skills.${active.skill}.mod`;

        const skillLabel = actor.system.skills[active.skill]?.label ?? active.skill.toUpperCase();
        extraInfo = `<p class="dt-note">Uses: <b>${ABILITY_LABELS[active.ability] ?? active.ability.toUpperCase()}</b> + <b>${skillLabel}</b></p>`;
      } else {
        if (!game.user.isGM) return ui.notifications.warn("No Devil Fruit is set for this actor yet. Ask the GM to set it once.");

        const dfConfig = await new Promise((resolve) => {
          new Dialog({
            title: "Set Devil Fruit (GM Only)",
            content: `
              <p><b>GM:</b> Set and lock this actor's Devil Fruit training roll.</p>
              <form>
                <div class="form-group">
                  <label>Fruit Name</label>
                  <input id="fruit-name" type="text" placeholder="e.g., Mera Mera no Mi" style="width:100%"/>
                </div>
                <div class="form-group">
                  <label>Ability Modifier</label>
                  <select id="df-ability" style="width:100%">${abilityOptions}</select>
                </div>
                <div class="form-group">
                  <label>Skill Modifier</label>
                  <select id="df-skill" style="width:100%">${skillOptions}</select>
                </div>
              </form>
            `,
            buttons: {
              ok: {
                label: "Lock Fruit",
                callback: (html) => resolve({
                  name: (html.find("#fruit-name").val() || "").trim() || "Unnamed Fruit",
                  ability: html.find("#df-ability").val(),
                  skill: html.find("#df-skill").val()
                })
              },
              cancel: { label: "Cancel", callback: () => resolve(null) }
            },
            default: "ok",
            close: () => resolve(null)
          }).render(true);
        });

        if (!dfConfig) return;

        data.fruits.__activeFruit = {
          name: dfConfig.name,
          ability: dfConfig.ability,
          skill: dfConfig.skill,
          rank: 0,
          successes: 0,
          failMod: 0
        };

        title = `Devil Fruit: ${data.fruits.__activeFruit.name}`;
        rollFormula = adv
          ? `2d20kh + @abilities.${data.fruits.__activeFruit.ability}.mod + @skills.${data.fruits.__activeFruit.skill}.mod`
          : `1d20 + @abilities.${data.fruits.__activeFruit.ability}.mod + @skills.${data.fruits.__activeFruit.skill}.mod`;

        const skillLabel = actor.system.skills[data.fruits.__activeFruit.skill]?.label ?? data.fruits.__activeFruit.skill.toUpperCase();
        extraInfo = `<p class="dt-note">Uses: <b>${ABILITY_LABELS[data.fruits.__activeFruit.ability] ?? data.fruits.__activeFruit.ability.toUpperCase()}</b> + <b>${skillLabel}</b></p>`;
      }

      trackObj = data.fruits;
      trackKey = "__activeFruit";
      ensureTrack(trackObj, trackKey);
    }

    const track = ensureTrack(trackObj, trackKey);
    const rank = Number(track.rank ?? 0);
    let successes = Number(track.successes ?? 0);
    let failMod = Number(track.failMod ?? 0);
    const failModBefore = failMod;

    const dcBase = Number(S(SETTINGS.HAKI_BASE)) + Number(S(SETTINGS.HAKI_INC)) * rank;
    const dcUsed = adjustDc(dcBase, failModBefore, !!S(SETTINGS.SOFT_HAKI));
    const needed = 5 + rank;

    let roll = null;
    let nat = null;
    let success = true;

    if (!autoPass) {
      roll = await new Roll(rollFormula, actor.getRollData()).evaluate({ async: true });
      nat = getKeptD20(roll);

      success = roll.total >= dcUsed;
      if (nat1Back && nat === 1) success = false;
    }

    let gained = 0;

    if (success) {
      gained = (!autoPass && nat20Double && nat === 20) ? 2 : 1;
      successes += gained;
      failMod = 0;
    } else {
      if (nat1Back && nat === 1) successes = Math.max(0, successes - 1);
      if (S(SETTINGS.SOFT_HAKI)) failMod += 1;
    }

    let extra = extraInfo || "";
    if (successes >= needed) {
      successes = 0;
      failMod = 0;
      track.rank = rank + 1;
      extra += `<p class="dt-note"><b>Rank Up!</b> New rank: <b>${rank + 1}</b></p>`;
    } else {
      extra += success
        ? `<p class="dt-note"><b>${autoPass ? "Auto Pass!" : "Success!"}</b> +${gained} progress.</p>`
        : `<p class="dt-note"><b>Failure.</b> ${nat1Back && nat === 1 ? "Nat 1: -1 progress." : "No progress."}</p>`;
    }

    track.successes = successes;
    track.failMod = failMod;

    await actor.setFlag(MODULE_ID, FLAG_KEY, data);

    const pct = needed ? Math.floor((successes / needed) * 100) : 0;

    await postTrainingCard({
      actor,
      icon,
      title: `Training: ${title}`,
      subtitle: `Rank ${track.rank ?? rank} • Need ${needed} successes`,
      badge: autoPass ? "AUTO PASS" : (success ? "SUCCESS" : "FAILURE"),
      outcome: success ? "success" : "fail",
      roll,
      nat,
      dcBase,
      dcUsed,
      failModBefore,
      progressText: `${successes}/${needed}`,
      progressPct: pct,
      extraHtml: extra,
      trainerSpent,
      autoPass
    });

    return;
  }
}

/* -------------------------------------------- */
/* Core Module API                              */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  ensureStyles();

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      run: (actor = getActorFromContext()) => runDowntimeTraining(actor),
      MODULE_ID
    };
  }

  console.log(`${MODULE_ID} | ready`);
});

/* -------------------------------------------- */
/* Training Tab: Shared HTML Builder            */
/* -------------------------------------------- */

function getSnapshot(actor) {
  return {
    ability: actor.getFlag(MODULE_ID, "downtimeTraining") ?? {},
    endurance: actor.getFlag(MODULE_ID, "hpPerLevelTraining") ?? {},
    resist: actor.getFlag(MODULE_ID, "resistanceTraining") ?? {},
    haki: actor.getFlag(MODULE_ID, "hakiFruitTraining") ?? {}
  };
}

function buildTrainingTabHTML(actor) {
  const sys = actor.system ?? {};
  const snap = getSnapshot(actor);

  const abilityOrder = ["str","dex","con","int","wis","cha"];
  const abilities = sys.abilities ?? {};

  const rRanks = Number(snap.endurance?.ranks ?? 0);
  const rSucc = Number(snap.endurance?.successes ?? 0);
  const hpNeeded = 5 + rRanks;
  const hpBase = Number(S(SETTINGS.HP_BASE));
  const hpInc  = Number(S(SETTINGS.HP_INC));
  const hpDcBase = hpBase + hpInc * rRanks;

  const resists = Array.from(sys.traits?.dr?.value ?? []);
  const immunes = Array.from(sys.traits?.di?.value ?? []);
  const R = resists.length + (immunes.length * 2);

  const resNewSucc = Number(snap.resist?.new?.successes ?? 0);
  const resNewNeed = 5 + R;
  const resNewDc = Number(S(SETTINGS.RESNEW_BASE)) + Number(S(SETTINGS.RESNEW_INC)) * R;

  const refineKeys = Object.keys(snap.resist?.refine ?? {});
  const resRefNeed = 8 + R;
  const resRefDc = Number(S(SETTINGS.RESREF_BASE)) + Number(S(SETTINGS.RESREF_INC)) * R;

  const hakiTracks = snap.haki?.haki ?? {};
  const fruit = snap.haki?.fruits?.__activeFruit ?? null;

  const hakiBase = Number(S(SETTINGS.HAKI_BASE));
  const hakiInc  = Number(S(SETTINGS.HAKI_INC));

  const hakiLine = (key) => {
    const rr = Number(hakiTracks?.[key]?.rank ?? 0);
    const ss = Number(hakiTracks?.[key]?.successes ?? 0);
    const need = 5 + rr;
    const dc = hakiBase + hakiInc * rr;
    return { rr, ss, need, dc };
  };

  const arm = hakiLine("armament");
  const obs = hakiLine("observation");
  const conq = hakiLine("conquerors");

  const hpBonusPerLevel = Number(sys.attributes?.hp?.bonuses?.level ?? 0);

  const renderChips = (list) => {
    if (!list.length) return `<span class="dt-chip" style="opacity:.75;">None</span>`;
    return list.map(k => `<span class="dt-chip">${DAMAGE_LABELS[k] ?? k}</span>`).join("");
  };

  const abilityTiles = abilityOrder.map((k) => {
    const score = Number(abilities?.[k]?.value ?? 0);
    if (score >= 30) {
      return `
        <div class="dt-tile">
          <h4>${ABILITY_LABELS[k] ?? k.toUpperCase()}</h4>
          <p class="dt-big">CAP 30</p>
          <p class="dt-note">Training complete.</p>
        </div>
      `;
    }
    const band = ABILITY_BANDS.find(b => score >= b.min && score <= b.max);
    const prog = Number(snap.ability?.[k]?.successes ?? 0);
    const line2 = band ? `${prog}/${band.successes} • DC ${band.dc}` : "No band found.";
    return `
      <div class="dt-tile">
        <h4>${ABILITY_LABELS[k] ?? k.toUpperCase()}</h4>
        <p class="dt-big">Score ${score}</p>
        <p class="dt-note">${line2}</p>
      </div>
    `;
  }).join("");

  const refineTable = (() => {
    if (!refineKeys.length) return `<p class="dt-muted" style="margin-top:0.75rem;">No ongoing refinement projects.</p>`;
    const rows = refineKeys
      .sort((a, b) => (DAMAGE_LABELS[a] ?? a).localeCompare(DAMAGE_LABELS[b] ?? b))
      .map(dt => {
        const prog = Number(snap.resist?.refine?.[dt]?.successes ?? 0);
        return `<tr><td>${DAMAGE_LABELS[dt] ?? dt}</td><td>${prog}/${resRefNeed}</td></tr>`;
      }).join("");
    return `
      <div class="dt-sep"></div>
      <h4 style="margin:0; opacity:0.9;">Refine Progress (per type)</h4>
      <p class="dt-muted">Target: DC <b>${resRefDc}</b>, Need <b>${resRefNeed}</b> successes.</p>
      <table class="dt-mini-table" style="width:100%; border-collapse:collapse; margin-top:.6rem;">
        <tr><th style="text-align:left; opacity:.85;">Type</th><th style="text-align:left; opacity:.85;">Progress</th></tr>
        ${rows}
      </table>
    `;
  })();

  const fruitLine = (() => {
    if (!fruit?.name) return { big: "Not set", note: "GM must lock a fruit before training." };
    const rr = Number(fruit.rank ?? 0);
    const ss = Number(fruit.successes ?? 0);
    const need = 5 + rr;
    const dc = hakiBase + hakiInc * rr;
    return { big: fruit.name, note: `Rank ${rr} • ${ss}/${need} • DC ${dc}` };
  })();

  return `
    <div class="dt-training-wrap dnd5e2 flexcol">
      <div class="dt-training-top">
        <div>
          <h2 class="dt-training-title">Downtime Training</h2>
          <p class="dt-training-sub">Review training progress for this character.</p>
        </div>
      </div>

      <div class="dt-grid">
        <div class="dt-card">
          <h3 class="dt-section-title">Ability Score Training</h3>
          <p class="dt-muted">Current score, progress, and the DC required for the next success.</p>
          <div class="dt-sep"></div>
          <div class="dt-tiles">${abilityTiles}</div>
        </div>

        <div class="dt-card">
          <h3 class="dt-section-title">Endurance Training</h3>
          <p class="dt-muted">Progress toward +1 HP per level (rank-based).</p>
          <div class="dt-sep"></div>
          <div class="dt-tiles">
            <div class="dt-tile">
              <h4>Endurance</h4>
              <p class="dt-big">Rank ${rRanks}</p>
              <p class="dt-note">${rSucc}/${hpNeeded} • DC ${hpDcBase}</p>
            </div>
            <div class="dt-tile">
              <h4>Bonus HP / Level</h4>
              <p class="dt-big">${hpBonusPerLevel}</p>
              <p class="dt-note">This is the sheet field the training updates.</p>
            </div>
            <div class="dt-tile">
              <h4>Scaling</h4>
              <p class="dt-big">DC ${hpBase}+${hpInc}×Rank</p>
              <p class="dt-note">Need = 5 + Rank</p>
            </div>
          </div>
        </div>

        <div class="dt-card">
          <h3 class="dt-section-title">Resistance Training</h3>
          <p class="dt-muted">New Resistance and Refine → Immunity use different DCs.</p>
          <div class="dt-sep"></div>

          <div class="dt-tiles">
            <div class="dt-tile">
              <h4>New Resistance</h4>
              <p class="dt-big">${resNewSucc}/${resNewNeed}</p>
              <p class="dt-note">DC ${resNewDc}</p>
            </div>
            <div class="dt-tile">
              <h4>Refine → Immunity</h4>
              <p class="dt-big">${refineKeys.length ? `${refineKeys.length} active` : "None"}</p>
              <p class="dt-note">${refineKeys.length ? `DC ${resRefDc} • Need ${resRefNeed}` : "No active refinement"}</p>
            </div>
            <div class="dt-tile">
              <h4>Resilience Rank</h4>
              <p class="dt-big">${R}</p>
              <p class="dt-note">Resists + 2×Immunities</p>
            </div>
          </div>

          <div class="dt-sep"></div>

          <h4 style="margin:0; opacity:0.9;">Current Resistances</h4>
          <div class="dt-chips">${renderChips(resists)}</div>

          <h4 style="margin:0.75rem 0 0 0; opacity:0.9;">Current Immunities</h4>
          <div class="dt-chips">${renderChips(immunes)}</div>

          ${refineTable}
        </div>

        <div class="dt-card">
          <h3 class="dt-section-title">Haki / Devil Fruit Training</h3>
          <p class="dt-muted">Each track shows rank, progress, and its DC.</p>
          <div class="dt-sep"></div>
          <div class="dt-tiles">
            <div class="dt-tile">
              <h4>Armament</h4>
              <p class="dt-big">Rank ${arm.rr}</p>
              <p class="dt-note">${arm.ss}/${arm.need} • DC ${arm.dc}</p>
            </div>
            <div class="dt-tile">
              <h4>Observation</h4>
              <p class="dt-big">Rank ${obs.rr}</p>
              <p class="dt-note">${obs.ss}/${obs.need} • DC ${obs.dc}</p>
            </div>
            <div class="dt-tile">
              <h4>Conqueror's</h4>
              <p class="dt-big">Rank ${conq.rr}</p>
              <p class="dt-note">${conq.ss}/${conq.need} • DC ${conq.dc}</p>
            </div>
            <div class="dt-tile">
              <h4>Devil Fruit</h4>
              <p class="dt-big">${fruitLine.big}</p>
              <p class="dt-note">${fruitLine.note}</p>
            </div>
            <div class="dt-tile">
              <h4>Scaling</h4>
              <p class="dt-big">DC ${hakiBase}+${hakiInc}×Rank</p>
              <p class="dt-note">Need = 5 + Rank</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* -------------------------------------------- */
/* Default (Core) Sheet Tab Injection           */
/* -------------------------------------------- */

Hooks.on("renderCharacterActorSheet", (app) => {
  try {
    if (!app?.actor || app.actor.type !== "character") return;

    const tabId = "training";
    const tabGroup = "primary";

    const root = app.element;
    if (!root?.querySelector) return;

    const tabsNav =
      app.parts?.tabs ||
      root.querySelector(`nav#${app.id}-tabs`) ||
      root.querySelector(`nav[id$="-tabs"].tabs`) ||
      root.querySelector('nav.tabs[data-application-part="tabs"]') ||
      root.querySelector("nav.tabs");

    if (!tabsNav) return;

    if (!tabsNav.querySelector(`[data-tab="${tabId}"][data-group="${tabGroup}"]`)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("item", "tab");
      btn.dataset.action = "tab";
      btn.dataset.group = tabGroup;
      btn.dataset.tab = tabId;
      btn.innerHTML = `<i class="fa-solid fa-dumbbell"></i>`;
      tabsNav.appendChild(btn);
    }

    const detailsPanel =
      root.querySelector(`section.tab[data-group="${tabGroup}"][data-tab="details"]`) ||
      root.querySelector(`section.tab[data-tab="details"]`) ||
      root.querySelector("section.tab");

    if (!detailsPanel) return;
    const panelsContainer = detailsPanel.parentElement;
    if (!panelsContainer) return;

    let panel = panelsContainer.querySelector(`section.tab[data-group="${tabGroup}"][data-tab="${tabId}"]`);
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "tab flexcol";
      panel.dataset.group = tabGroup;
      panel.dataset.tab = tabId;
      panelsContainer.appendChild(panel);
    }

    ensureStyles();
    panel.innerHTML = buildTrainingTabHTML(app.actor);
  } catch (err) {
    console.error(`${MODULE_ID} | renderCharacterActorSheet hook error`, err);
  }
});

/* -------------------------------------------- */
/* Tidy 5e Support: Register Tab via API        */
/* -------------------------------------------- */

Hooks.once("tidy5e-sheet.ready", (api) => {
  try {
    ensureStyles();

    const tabId = `${MODULE_ID}-training-tab`;

    api.registerCharacterTab(
      new api.models.HtmlTab({
        title: "Training",
        iconClass: "fa-solid fa-dumbbell",
        tabId,
        renderScheme: "handlebars",
        tabContentsClasses: ["dt-training-tab"],
        html: () => `<div class="dt-training-host"></div>`,
        onRender: ({ app, tabContentsElement }) => {
          const actor = app?.document ?? app?.actor ?? app?.object ?? null;
          if (!actor?.system) return;
          tabContentsElement.innerHTML = buildTrainingTabHTML(actor);
        }
      })
    );

    console.log(`${MODULE_ID} | Registered Training tab for Tidy 5e Sheets`);
  } catch (err) {
    console.warn(`${MODULE_ID} | Tidy 5e tab registration failed`, err);
  }
});
