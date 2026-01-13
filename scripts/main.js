const MODULE_ID = "downtime-training";

console.log(`${MODULE_ID} | main.js loaded (top-level)`);

function getActorFromContext() {
  return canvas.tokens.controlled[0]?.actor ?? game.user.character ?? null;
}

async function runDowntimeTraining(actor) {
  if (!actor) return ui.notifications.error("No actor found. Select a token or set a character.");
  if (!actor.system?.abilities) return ui.notifications.error("This macro is designed for the D&D 5e system.");

  const abilityLabels = { str:"Strength", dex:"Dexterity", con:"Constitution", int:"Intelligence", wis:"Wisdom", cha:"Charisma" };
  const damageLabels = {
    acid:"Acid", cold:"Cold", fire:"Fire", force:"Force", lightning:"Lightning",
    necrotic:"Necrotic", poison:"Poison", psychic:"Psychic", radiant:"Radiant",
    thunder:"Thunder", bludgeoning:"Bludgeoning", piercing:"Piercing", slashing:"Slashing"
  };

  const ensureTrack = (root, key) => {
    if (!root[key]) root[key] = { rank: 0, successes: 0 };
    root[key].rank = Number(root[key].rank ?? 0);
    root[key].successes = Number(root[key].successes ?? 0);
    return root[key];
  };

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

    const currentScore = abilities[ability].value ?? 0;
    if (currentScore >= 30) {
      ui.notifications.warn(`${ability.toUpperCase()} is already 30 and cannot be trained further.`);
      return;
    }

    const trainingBands = [
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

    const band = trainingBands.find(b => currentScore >= b.min && currentScore <= b.max);
    if (!band) return ui.notifications.error("No training band found. Check trainingBands.");

    const dc = band.dc;
    const needed = band.successes;

    const flagKey = "downtimeTraining";
    const allTrainingData = actor.getFlag(MODULE_ID, flagKey) || {};
    const abilityTraining = allTrainingData[ability] || { successes: 0 };
    let successes = Number(abilityTraining.successes ?? 0);

    const roll = await new Roll(`1d20 + @abilities.${ability}.mod`, actor.getRollData()).evaluate({ async: true });
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Downtime Training: ${ability.toUpperCase()} (DC ${dc})`
    });

    let chat = `<p><b>Ability Score Training: ${ability.toUpperCase()}</b></p>`;
    chat += `<p>Result: <b>${roll.total}</b> vs DC <b>${dc}</b></p>`;

    if (roll.total >= dc) {
      successes += 1;
      chat += `<p style="color:green;"><b>Success!</b> +1 progress.</p>`;
    } else {
      chat += `<p style="color:red;"><b>Failure.</b> No progress.</p>`;
    }

    if (successes >= needed) {
      const newScore = currentScore + 1;
      await actor.update({ [`system.abilities.${ability}.value`]: newScore });
      chat += `<hr><p><b>${ability.toUpperCase()} increases ${currentScore} → ${newScore}!</b></p>`;
      successes = 0;
    }

    allTrainingData[ability] = { successes };
    await actor.setFlag(MODULE_ID, flagKey, allTrainingData);

    chat += `<p>Progress: <b>${successes} / ${needed}</b></p>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chat });
    return;
  }

  if (trainingType === "hp") {
    const level = actor.system.details?.level ?? 1;
    const hpData = actor.system.attributes?.hp;
    if (!hpData) return ui.notifications.error("Could not find HP data on this actor.");

    const flagKey = "hpPerLevelTraining";
    const t = actor.getFlag(MODULE_ID, flagKey) || { ranks: 0, successes: 0 };
    let ranks = Number(t.ranks ?? 0);
    let successes = Number(t.successes ?? 0);

    const dc = 15 + 2 * ranks;
    const needed = 5 + ranks;

    const roll = await new Roll(
      "1d20 + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod",
      actor.getRollData()
    ).evaluate({ async: true });

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Endurance Training (Rank ${ranks}) — DC ${dc}`
    });

    let chat = `<p><b>Endurance Training (+1 HP per Level)</b></p>`;
    chat += `<p>Rank: <b>${ranks}</b> — DC: <b>${dc}</b> — Successes Needed: <b>${needed}</b></p>`;
    chat += `<p>Result: <b>${roll.total}</b> vs DC <b>${dc}</b></p>`;

    if (roll.total >= dc) {
      successes += 1;
      chat += `<p style="color:green;"><b>Success!</b> +1 progress.</p>`;
    } else {
      chat += `<p style="color:red;"><b>Failure.</b> No progress.</p>`;
    }

    if (successes >= needed) {
      ranks += 1;
      successes = 0;

      const currentPerLevel = Number(hpData.bonuses?.level || 0);
      const newPerLevel = currentPerLevel + 1;
      await actor.update({ "system.attributes.hp.bonuses.level": newPerLevel });

      chat += `<hr><p><b>New Endurance Rank Achieved!</b></p>`;
      chat += `<p>Endurance Ranks: <b>${ranks - 1} → ${ranks}</b></p>`;
      chat += `<p>Bonus HP per level increased: <b>${currentPerLevel} → ${newPerLevel}</b></p>`;
      chat += `<p>At current level (${level}), this is effectively +<b>${level}</b> max HP (and continues scaling).</p>`;
      chat += `<p>Next: DC <b>${15 + 2 * ranks}</b>, need <b>${5 + ranks}</b> successes.</p>`;
    } else {
      chat += `<p>Progress: <b>${successes} / ${needed}</b></p>`;
    }

    await actor.setFlag(MODULE_ID, flagKey, { ranks, successes });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chat });
    return;
  }

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
    if (!trainingData.new) trainingData.new = { successes: 0 };
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
      if (!refineOptions.length) {
        ui.notifications.warn("No resistances available to refine (either none, or all are already immunities).");
        return;
      }

      const refineHtmlOptions = refineOptions
        .map(dt => `<option value="${dt}">${damageLabels[dt] ?? dt}</option>`)
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
      if (!trainingData.refine[targetDamageType]) trainingData.refine[targetDamageType] = { successes: 0 };
    }

    const dc = (mode === "new") ? (18 + 2 * resilienceRank) : (20 + 2 * resilienceRank);
    const needed = (mode === "new") ? (5 + resilienceRank) : (8 + resilienceRank);

    let successes = (mode === "new")
      ? Number(trainingData.new.successes ?? 0)
      : Number(trainingData.refine[targetDamageType].successes ?? 0);

    const roll = await new Roll(
      "1d20 + @abilities.str.mod + @abilities.dex.mod + @abilities.con.mod + @abilities.int.mod + @abilities.wis.mod + @abilities.cha.mod",
      actor.getRollData()
    ).evaluate({ async: true });

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Resilience Training (${mode === "new" ? "New Resistance" : "Refine to Immunity"}) — DC ${dc}`
    });

    let chat = `<p><b>Resilience Training</b></p>`;
    chat += `<p>Resilience Rank (Resists + 2×Immunities): <b>${resilienceRank}</b></p>`;
    chat += `<p>Mode: <b>${mode === "new" ? "New Resistance" : `Refine ${damageLabels[targetDamageType] ?? targetDamageType} → Immunity`}</b></p>`;
    chat += `<p>Result: <b>${roll.total}</b> vs DC <b>${dc}</b></p>`;

    if (roll.total >= dc) {
      successes += 1;
      chat += `<p style="color:green;"><b>Success!</b> +1 progress.</p>`;
    } else {
      chat += `<p style="color:red;"><b>Failure.</b> No progress.</p>`;
    }

    const damageTypes = [
      "acid", "cold", "fire", "force", "lightning", "necrotic",
      "poison", "psychic", "radiant", "thunder",
      "bludgeoning", "piercing", "slashing"
    ];

    if (successes >= needed) {
      successes = 0;

      if (mode === "new") {
        const unavailable = new Set([...resists, ...immunes]);
        const available = damageTypes.filter(dt => !unavailable.has(dt));

        if (!available.length) {
          chat += `<hr><p><b>No available damage types remain to gain resistance to.</b></p>`;
        } else {
          const gained = available[Math.floor(Math.random() * available.length)];
          const newResists = Array.from(new Set([...resists, gained]));
          await actor.update({ "system.traits.dr.value": newResists });
          chat += `<hr><p><b>New Resistance Gained:</b> ${damageLabels[gained] ?? gained}</p>`;
        }
      } else {
        const refined = targetDamageType;
        const newResists = resists.filter(dt => dt !== refined);
        const newImmunes = Array.from(new Set([...immunes, refined]));

        await actor.update({
          "system.traits.dr.value": newResists,
          "system.traits.di.value": newImmunes
        });

        chat += `<hr><p><b>Resistance Refined!</b> ${damageLabels[refined] ?? refined} is now an <b>Immunity</b>.</p>`;
      }
    }

    if (mode === "new") trainingData.new.successes = successes;
    else trainingData.refine[targetDamageType].successes = successes;

    await actor.setFlag(MODULE_ID, flagKey, trainingData);

    chat += `<p>Progress: <b>${successes} / ${needed}</b></p>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chat });
    return;
  }

  if (trainingType === "haki") {
    if (!actor.system?.skills) return ui.notifications.error("Could not find skills on this actor.");

    const FLAG_KEY = "hakiFruitTraining";
    const data = actor.getFlag(MODULE_ID, FLAG_KEY) || {};
    if (!data.haki) data.haki = {};
    if (!data.fruits) data.fruits = {};

    const dcFor = (rank) => 15 + rank;
    const neededFor = (rank) => 5 + rank;

    const skills = actor.system.skills;
    const skillOptions = Object.entries(skills)
      .map(([k, v]) => `<option value="${k}">${v.label ?? k.toUpperCase()}</option>`)
      .join("");

    const abilityOptions = Object.keys(actor.system.abilities)
      .map(k => `<option value="${k}">${abilityLabels[k] ?? k.toUpperCase()}</option>`)
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
    let rollFormula = "";
    let trackObj = null;
    let trackKey = null;
    let extraInfo = "";

    if (mode === "armament") {
      title = "Haki Training: Armament";
      rollFormula = "1d20 + @abilities.str.mod + @abilities.con.mod";
      trackObj = data.haki;
      trackKey = "armament";
      ensureTrack(trackObj, trackKey);
    } else if (mode === "observation") {
      title = "Haki Training: Observation";
      rollFormula = "1d20 + @abilities.dex.mod + @abilities.int.mod";
      trackObj = data.haki;
      trackKey = "observation";
      ensureTrack(trackObj, trackKey);
    } else if (mode === "conquerors") {
      title = "Haki Training: Conqueror's";
      rollFormula = "1d20 + @abilities.wis.mod + @abilities.cha.mod";
      trackObj = data.haki;
      trackKey = "conquerors";
      ensureTrack(trackObj, trackKey);
    } else if (mode === "devilfruit") {
      const active = data.fruits.__activeFruit;

      if (active?.name && active?.ability && active?.skill) {
        active.rank = Number(active.rank ?? 0);
        active.successes = Number(active.successes ?? 0);

        title = `Devil Fruit Training: ${active.name}`;
        rollFormula = `1d20 + @abilities.${active.ability}.mod + @skills.${active.skill}.mod`;

        trackObj = data.fruits;
        trackKey = "__activeFruit";

        const skillLabel = actor.system.skills[active.skill]?.label ?? active.skill.toUpperCase();
        extraInfo = `<p>Fruit Roll Uses: <b>${abilityLabels[active.ability] ?? active.ability.toUpperCase()}</b> + <b>${skillLabel}</b></p>`;
      } else {
        if (!game.user.isGM) {
          ui.notifications.warn("No Devil Fruit is set for this actor yet. Ask the GM to set it once.");
          return;
        }

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
                <p style="font-size:0.9em;opacity:0.85;">Roll: <b>1d20 + Ability mod + Skill mod</b></p>
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
          successes: 0
        };

        title = `Devil Fruit Training: ${data.fruits.__activeFruit.name}`;
        rollFormula = `1d20 + @abilities.${data.fruits.__activeFruit.ability}.mod + @skills.${data.fruits.__activeFruit.skill}.mod`;

        const skillLabel = actor.system.skills[data.fruits.__activeFruit.skill]?.label ?? data.fruits.__activeFruit.skill.toUpperCase();
        extraInfo = `<p>Fruit Roll Uses: <b>${abilityLabels[data.fruits.__activeFruit.ability] ?? data.fruits.__activeFruit.ability.toUpperCase()}</b> + <b>${skillLabel}</b></p>`;
      }

      trackObj = data.fruits;
      trackKey = "__activeFruit";
      ensureTrack(trackObj, trackKey);
    }

    const track = ensureTrack(trackObj, trackKey);
    const rank = track.rank;
    const successes = track.successes;
    const dc = dcFor(rank);
    const needed = neededFor(rank);

    const roll = await new Roll(rollFormula, actor.getRollData()).evaluate({ async: true });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${title} (DC ${dc})`
    });

    let newSuccesses = successes;
    let newRank = rank;

    let chat = `<p><b>${title}</b></p>`;
    chat += `<p>Rank: <b>${rank}</b> — DC: <b>${dc}</b> — Successes Needed: <b>${needed}</b></p>`;
    chat += `<p style="opacity:0.85;">Scaling: DC = 15 + Rank, Successes = 5 + Rank</p>`;
    if (extraInfo) chat += extraInfo;
    chat += `<p>Result: <b>${roll.total}</b> vs DC <b>${dc}</b></p>`;

    if (roll.total >= dc) {
      newSuccesses += 1;
      chat += `<p style="color:green;"><b>Success!</b> +1 progress.</p>`;
    } else {
      chat += `<p style="color:red;"><b>Failure.</b> No progress.</p>`;
    }

    if (newSuccesses >= needed) {
      newRank += 1;
      newSuccesses = 0;
      chat += `<hr><p><b>Rank Increased!</b> New Rank: <b>${newRank}</b></p>`;
      chat += `<p>Next: DC <b>${dcFor(newRank)}</b>, need <b>${neededFor(newRank)}</b> successes.</p>`;
    } else {
      chat += `<p>Progress: <b>${newSuccesses} / ${needed}</b></p>`;
    }

    trackObj[trackKey] = { ...(trackObj[trackKey] || {}), rank: newRank, successes: newSuccesses };
    await actor.setFlag(MODULE_ID, FLAG_KEY, data);

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chat });
    return;
  }
}

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (!mod) return console.error(`${MODULE_ID} | module not found in game.modules`);

  mod.api = {
    run: (actor = getActorFromContext()) => runDowntimeTraining(actor),
    MODULE_ID
  };

  console.log(`${MODULE_ID} | API ready`);
});

Hooks.on("renderCharacterActorSheet", (app) => {
  try {
    const MODULE_ID = "downtime-training";
    if (!app?.actor || app.actor.type !== "character") return;

    const tabId = "training";
    const tabGroup = "primary";

    const root = app.element; // <form>
    if (!root?.querySelector) return;

    // Find tabs nav reliably
    const tabsNav =
      app.parts?.tabs ||
      root.querySelector(`nav#${app.id}-tabs`) ||
      root.querySelector(`nav[id$="-tabs"].tabs`) ||
      root.querySelector('nav.tabs[data-application-part="tabs"]') ||
      root.querySelector("nav.tabs");

    if (!tabsNav) {
      console.warn(`${MODULE_ID} | Could not find tabs nav on sheet`, app);
      return;
    }

    // Don’t add twice
    if (tabsNav.querySelector(`[data-tab="${tabId}"][data-group="${tabGroup}"]`)) return;

    // Add tab button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("item", "tab");
    btn.dataset.action = "tab";
    btn.dataset.group = tabGroup;
    btn.dataset.tab = tabId;
    btn.innerHTML = `<i class="fa-solid fa-dumbbell"></i>`;
    tabsNav.appendChild(btn);

    // Find an existing panel to anchor from
    const detailsPanel =
      root.querySelector(`section.tab[data-group="${tabGroup}"][data-tab="details"]`) ||
      root.querySelector(`section.tab[data-tab="details"]`) ||
      root.querySelector("section.tab");

    if (!detailsPanel) return;
    const panelsContainer = detailsPanel.parentElement;
    if (!panelsContainer) return;

    // Don’t add panel twice
    if (panelsContainer.querySelector(`section.tab[data-group="${tabGroup}"][data-tab="${tabId}"]`)) return;

    // ---- constants ----
    const abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
    const abilityLabels = {
      str: "Strength", dex: "Dexterity", con: "Constitution",
      int: "Intelligence", wis: "Wisdom", cha: "Charisma"
    };

    const damageLabels = {
      acid: "Acid", cold: "Cold", fire: "Fire", force: "Force", lightning: "Lightning",
      necrotic: "Necrotic", poison: "Poison", psychic: "Psychic", radiant: "Radiant",
      thunder: "Thunder", bludgeoning: "Bludgeoning", piercing: "Piercing", slashing: "Slashing"
    };

    // Ability bands (must match your training macro)
    const abilityBands = [
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

    // Endurance scaling (must match your macro)
    const enduranceDc = (rank) => 15 + 2 * rank;
    const enduranceNeed = (rank) => 5 + rank;

    // Resistance scaling (must match your macro)
    const dcNew = (R) => 18 + 2 * R;
    const needNew = (R) => 5 + R;
    const dcRefine = (R) => 20 + 2 * R;
    const needRefine = (R) => 8 + R;

    // Haki/Fruit scaling (Option B)
    const hakiDc = (rank) => 15 + rank;
    const hakiNeed = (rank) => 5 + rank;

    const getSnapshot = (actor) => ({
      ability: actor.getFlag(MODULE_ID, "downtimeTraining") ?? {},
      endurance: actor.getFlag(MODULE_ID, "hpPerLevelTraining") ?? {},
      resist: actor.getFlag(MODULE_ID, "resistanceTraining") ?? {},
      haki: actor.getFlag(MODULE_ID, "hakiFruitTraining") ?? {}
    });

    const panel = document.createElement("section");
    panel.className = "tab flexcol";
    panel.dataset.group = tabGroup;
    panel.dataset.tab = tabId;

    panel.innerHTML = `
      <style>
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-wrap { padding: 0.95rem; gap: 0.95rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-top { display:flex; align-items:flex-start; justify-content:space-between; gap: 0.75rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-title { margin:0; font-size: 1.35rem; letter-spacing: 0.02em; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-sub { margin:0.25rem 0 0 0; opacity:0.75; font-size: 0.9rem; }

        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-grid { display:grid; grid-template-columns: 1fr; gap: 0.95rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-card { padding: 0.95rem; }

        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-section-title { margin:0; font-size: 1.05rem; letter-spacing: 0.01em; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-muted { opacity:0.75; margin: 0.25rem 0 0 0; font-size: 0.9rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-sep { height: 1px; background: currentColor; opacity: 0.12; margin: 0.75rem 0; }

        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-tiles { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 0.65rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-tile {
          padding: 0.7rem;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 12px;
          background: rgba(0,0,0,0.14);
        }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-tile h4 { margin:0; font-size: 0.92rem; opacity:0.85; font-weight: 650; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-big { margin:0.2rem 0 0 0; font-size: 1.25rem; font-weight: 750; letter-spacing: 0.01em; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-note { margin:0.25rem 0 0 0; font-size: 0.85rem; opacity:0.78; }

        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-chips { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top: 0.5rem; }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-chip {
          padding: 0.18rem 0.5rem;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          font-size: 0.82rem;
          opacity: 0.9;
          background: rgba(0,0,0,0.10);
        }

        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-mini-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.6rem;
        }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-mini-table th,
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-mini-table td {
          padding: 0.35rem 0.45rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          vertical-align: top;
        }
        section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-mini-table th { text-align:left; opacity:0.85; font-weight:650; }

        @media (max-width: 900px) {
          section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-tiles { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 620px) {
          section.tab[data-tab="${tabId}"][data-group="${tabGroup}"] .dt-tiles { grid-template-columns: 1fr; }
        }
      </style>

      <div class="dnd5e2 flexcol dt-wrap">
        <div class="dt-top">
          <div>
            <h2 class="dt-title">Downtime Training</h2>
            <p class="dt-sub">Review training progress for this character.</p>
          </div>
        </div>

        <div class="dt-grid">

          <div class="card dt-card">
            <h3 class="dt-section-title">Ability Score Training</h3>
            <p class="dt-muted">Each ability shows current score, progress, and the DC required for the next success.</p>
            <div class="dt-sep"></div>
            <div class="dt-tiles dt-abilities"></div>
          </div>

          <div class="card dt-card">
            <h3 class="dt-section-title">Endurance Training</h3>
            <p class="dt-muted">Progress toward +1 HP per level (rank-based).</p>
            <div class="dt-sep"></div>
            <div class="dt-tiles">
              <div class="dt-tile">
                <h4>Endurance</h4>
                <p class="dt-big dt-end-big">—</p>
                <p class="dt-note dt-end-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Bonus HP / Level</h4>
                <p class="dt-big dt-hppl-big">—</p>
                <p class="dt-note">This is the sheet field the training updates.</p>
              </div>
            </div>
          </div>

          <div class="card dt-card">
            <h3 class="dt-section-title">Resistance Training</h3>
            <p class="dt-muted">Split because New Resistance and Refine → Immunity use different DCs.</p>
            <div class="dt-sep"></div>

            <div class="dt-tiles">
              <div class="dt-tile">
                <h4>New Resistance</h4>
                <p class="dt-big dt-res-new-big">—</p>
                <p class="dt-note dt-res-new-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Refine → Immunity</h4>
                <p class="dt-big dt-res-ref-big">—</p>
                <p class="dt-note dt-res-ref-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Resilience Rank</h4>
                <p class="dt-big dt-res-rank-big">—</p>
                <p class="dt-note">Resists + 2×Immunities</p>
              </div>
            </div>

            <div class="dt-sep"></div>

            <h4 style="margin:0; opacity:0.9;">Current Resistances</h4>
            <div class="dt-chips dt-resists"></div>

            <h4 style="margin:0.75rem 0 0 0; opacity:0.9;">Current Immunities</h4>
            <div class="dt-chips dt-immunes"></div>

            <div class="dt-refine-wrap"></div>
          </div>

          <div class="card dt-card">
            <h3 class="dt-section-title">Haki / Devil Fruit Training</h3>
            <p class="dt-muted">Each track shows rank, progress, and its DC.</p>
            <div class="dt-sep"></div>
            <div class="dt-tiles">
              <div class="dt-tile">
                <h4>Armament</h4>
                <p class="dt-big dt-haki-arm-big">—</p>
                <p class="dt-note dt-haki-arm-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Observation</h4>
                <p class="dt-big dt-haki-obs-big">—</p>
                <p class="dt-note dt-haki-obs-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Conqueror's</h4>
                <p class="dt-big dt-haki-conq-big">—</p>
                <p class="dt-note dt-haki-conq-note">—</p>
              </div>
              <div class="dt-tile">
                <h4>Devil Fruit</h4>
                <p class="dt-big dt-fruit-big">—</p>
                <p class="dt-note dt-fruit-note">—</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    panelsContainer.appendChild(panel);

    const el = (sel) => panel.querySelector(sel);

    const renderChips = (container, list) => {
      container.innerHTML = "";
      if (!list.length) {
        container.innerHTML = `<span class="dt-chip" style="opacity:.75;">None</span>`;
        return;
      }
      for (const key of list) {
        const chip = document.createElement("span");
        chip.className = "dt-chip";
        chip.textContent = damageLabels[key] ?? key;
        container.appendChild(chip);
      }
    };

    const renderAbilities = (actor, snap) => {
      const wrap = el(".dt-abilities");
      if (!wrap) return;

      const abilities = actor.system?.abilities ?? {};
      wrap.innerHTML = "";

      for (const k of abilityOrder) {
        const score = Number(abilities?.[k]?.value ?? 0);

        let line1 = `${score >= 30 ? "CAP 30" : `Score ${score}`}`;
        let line2 = "";

        if (score >= 30) {
          line2 = "Training complete.";
        } else {
          const band = abilityBands.find(b => score >= b.min && score <= b.max);
          const prog = Number(snap.ability?.[k]?.successes ?? 0);
          if (!band) line2 = "No band found.";
          else line2 = `${prog}/${band.successes} • DC ${band.dc}`;
        }

        const tile = document.createElement("div");
        tile.className = "dt-tile";
        tile.innerHTML = `
          <h4>${abilityLabels[k] ?? k.toUpperCase()}</h4>
          <p class="dt-big">${line1}</p>
          <p class="dt-note">${line2}</p>
        `;
        wrap.appendChild(tile);
      }
    };

    const renderRefineTable = (snap, R) => {
      const wrap = panel.querySelector(".dt-refine-wrap");
      if (!wrap) return;

      const refine = snap.resist?.refine ?? {};
      const keys = Object.keys(refine);

      if (!keys.length) {
        wrap.innerHTML = `<p class="dt-muted" style="margin-top:0.75rem;">No ongoing refinement projects.</p>`;
        return;
      }

      const dc = dcRefine(R);
      const need = needRefine(R);

      const rows = keys
        .sort((a, b) => (damageLabels[a] ?? a).localeCompare(damageLabels[b] ?? b))
        .map((dt) => {
          const prog = Number(refine?.[dt]?.successes ?? 0);
          return `<tr><td>${damageLabels[dt] ?? dt}</td><td>${prog}/${need}</td></tr>`;
        })
        .join("");

      wrap.innerHTML = `
        <div class="dt-sep"></div>
        <h4 style="margin:0; opacity:0.9;">Refine Progress (per type)</h4>
        <p class="dt-muted">Target: DC <b>${dc}</b>, Need <b>${need}</b> successes.</p>
        <table class="dt-mini-table">
          <tr><th>Type</th><th>Progress</th></tr>
          ${rows}
        </table>
      `;
    };

    const refresh = () => {
      const actor = app.actor;
      const sys = actor.system ?? {};
      const snap = getSnapshot(actor);

      renderAbilities(actor, snap);

      const r = Number(snap.endurance?.ranks ?? 0);
      const s = Number(snap.endurance?.successes ?? 0);
      el(".dt-end-big").textContent = `Rank ${r}`;
      el(".dt-end-note").textContent = `${s}/${enduranceNeed(r)} • DC ${enduranceDc(r)}`;

      const hpBonusPerLevel = Number(sys.attributes?.hp?.bonuses?.level ?? 0);
      el(".dt-hppl-big").textContent = `${hpBonusPerLevel}`;

      const resists = Array.from(sys.traits?.dr?.value ?? []);
      const immunes = Array.from(sys.traits?.di?.value ?? []);
      const R = resists.length + (immunes.length * 2);
      el(".dt-res-rank-big").textContent = `${R}`;

      renderChips(panel.querySelector(".dt-resists"), resists);
      renderChips(panel.querySelector(".dt-immunes"), immunes);

      const newProg = Number(snap.resist?.new?.successes ?? 0);
      el(".dt-res-new-big").textContent = `${newProg}/${needNew(R)}`;
      el(".dt-res-new-note").textContent = `DC ${dcNew(R)}`;

      const refineKeys = Object.keys(snap.resist?.refine ?? {});
      if (!refineKeys.length) {
        el(".dt-res-ref-big").textContent = `None`;
        el(".dt-res-ref-note").textContent = `No active refinement`;
      } else {
        el(".dt-res-ref-big").textContent = `${refineKeys.length} active`;
        el(".dt-res-ref-note").textContent = `DC ${dcRefine(R)} • Need ${needRefine(R)}`;
      }

      renderRefineTable(snap, R);

      const hakiTracks = snap.haki?.haki ?? {};
      const fruit = snap.haki?.fruits?.__activeFruit ?? null;

      const showTrack = (key, bigSel, noteSel) => {
        const rr = Number(hakiTracks?.[key]?.rank ?? 0);
        const ss = Number(hakiTracks?.[key]?.successes ?? 0);
        el(bigSel).textContent = `Rank ${rr}`;
        el(noteSel).textContent = `${ss}/${hakiNeed(rr)} • DC ${hakiDc(rr)}`;
      };

      showTrack("armament", ".dt-haki-arm-big", ".dt-haki-arm-note");
      showTrack("observation", ".dt-haki-obs-big", ".dt-haki-obs-note");
      showTrack("conquerors", ".dt-haki-conq-big", ".dt-haki-conq-note");

      if (fruit?.name) {
        const fr = Number(fruit.rank ?? 0);
        const fs = Number(fruit.successes ?? 0);
        el(".dt-fruit-big").textContent = fruit.name;
        el(".dt-fruit-note").textContent = `Rank ${fr} • ${fs}/${hakiNeed(fr)} • DC ${hakiDc(fr)}`;
      } else {
        el(".dt-fruit-big").textContent = "Not set";
        el(".dt-fruit-note").textContent = "GM must lock a fruit before training.";
      }
    };

    refresh();
  } catch (err) {
    console.error("downtime-training | renderCharacterActorSheet hook error", err);
  }
});
