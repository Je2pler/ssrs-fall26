(() => {
  "use strict";

  const SMS_NUMBER = "0701440820";
  const STORAGE_KEY = "bonus6-ovning-state-v1";

  const BASE_SCENARIOS = [
    {
      id: 1,
      title: "Person i vattnet",
      text: "En person har fallit från en fritidsbåt. Personen har flytväst men båten har tappat personen ur sikte. Platsen ligger uppskattningsvis 15 minuter bort.",
    },
    {
      id: 2,
      title: "Båt driver mot grund",
      text: "En motorbåt med fyra personer har motorproblem och driver mot ett grundområde. Ingen är skadad och alla har flytväst. Cirka 5 minuter bort.",
    },
    {
      id: 3,
      title: "Sjuk person",
      text: "En person ombord på en segelbåt har blivit plötsligt mycket yr och har svårt att stå upp. Personen är vaken och talbar. Cirka 10 minuter bort.",
    },
  ];

  const TASKS = [
    {
      n: 1,
      label: "Uppgift 1",
      title: "Prioritera scenarierna",
      duration: 300,
      newInfo: null,
    },
    {
      n: 2,
      label: "Uppgift 2",
      title: "Ny information – ombedöm",
      duration: 90,
      newInfo: {
        scenarioId: 1,
        text: "Personen i vattnet har återfunnits och hålls fast vid sidan av båten – men kan inte tas ombord.",
      },
    },
    {
      n: 3,
      label: "Uppgift 3",
      title: "Ny information – ombedöm",
      duration: 90,
      newInfo: {
        scenarioId: 2,
        text: "Motorbåten som driver mot grund rapporterar att en person har fallit och slagit huvudet. Personen är omtöcknad.",
      },
    },
  ];

  const defaultState = () => ({
    screen: "landing",
    group: "",
    taskIndex: 0, // index into TASKS
    scenarioUpdates: {}, // scenarioId -> update text (accumulated)
    priorities: {}, // taskN -> [scenarioId, scenarioId, scenarioId]
    motivations: {}, // taskN -> string
    timerEndAt: null, // epoch ms
    timerRunning: false,
    timerStoppedEarly: false,
  });

  let state = loadState();

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  function setState(patch) {
    state = { ...state, ...patch };
    saveState();
    render();
  }

  function currentScenarios() {
    return BASE_SCENARIOS.map((s) => ({
      ...s,
      update: state.scenarioUpdates[s.id] || null,
    }));
  }

  function currentTask() {
    return TASKS[state.taskIndex];
  }

  function getOrder(task) {
    const stored = state.priorities[task.n];
    if (stored && stored.length === 3) return stored;
    return [1, 2, 3];
  }

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // ---------- Timer engine ----------
  let timerInterval = null;

  // ---------- Drag reorder engine ----------
  let dragCtx = null;

  function startTimer(durationSeconds) {
    const endAt = Date.now() + durationSeconds * 1000;
    setState({ timerEndAt: endAt, timerRunning: true, timerStoppedEarly: false });
  }

  function stopTimer(early) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    setState({ timerRunning: false, timerStoppedEarly: !!early });
  }

  function remainingSeconds() {
    if (!state.timerEndAt) return currentTask() ? currentTask().duration : 0;
    return Math.max(0, (state.timerEndAt - Date.now()) / 1000);
  }

  function ensureTicking() {
    if (timerInterval) clearInterval(timerInterval);
    if (!state.timerRunning) return;
    timerInterval = setInterval(() => {
      const remaining = remainingSeconds();
      updateTimerDisplay(remaining);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        setState({ timerRunning: false });
      }
    }, 250);
  }

  function updateTimerDisplay(remaining) {
    const valueEl = document.querySelector("[data-timer-value]");
    const boxEl = document.querySelector("[data-timer-box]");
    if (valueEl) valueEl.textContent = formatTime(remaining);
    if (boxEl) boxEl.classList.toggle("low", remaining <= 20 && remaining > 0);
  }

  // ---------- Message building ----------
  function buildMessage(taskN, group, priorityIds, motivation) {
    return (
      `BONUS 6 – Båt ${group}\n` +
      `Prioritering: ${priorityIds.join(" → ")}\n` +
      `Vi går mot: Händelse ${priorityIds[0]}\n` +
      `Motivering: ${motivation}`
    );
  }

  function smsHref(body) {
    const encoded = encodeURIComponent(body);
    // ?body= works on Android; iOS Safari also accepts ? for single-recipient sms links.
    return `sms:${SMS_NUMBER}?body=${encoded}`;
  }

  // ---------- Screens ----------
  function screenLanding() {
    const disabled = !state.group.trim();
    return `
      <div class="screen landing">
        <div class="brand">
          <p class="brand-kicker">RS Uppsala</p>
          <h1>BONUS&nbsp;6</h1>
          <p>Sjöräddningsövning &middot; Prioriteringsscenario</p>
        </div>

        <div class="field">
          <label for="group-input">Gruppnummer</label>
          <input id="group-input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="t.ex. 4" value="${esc(state.group)}" autocomplete="off" />
        </div>

        <div class="notice">
          <strong>Innan ni börjar:</strong> samla hela besättningen. Övningen ska genomföras tillsammans – öppna inte uppgiften förrän alla är på plats.
        </div>

        <button class="btn-primary btn-block" id="start-btn" ${disabled ? "disabled" : ""}>Öppna utmaning</button>
      </div>
    `;
  }

  function statusBar() {
    const task = currentTask();
    return `
      <div class="status-bar">
        <span><span class="dot"></span>BONUS 6 &middot; Båt ${esc(state.group)}</span>
        <span>${task ? esc(task.label) : ""}</span>
      </div>
    `;
  }

  function rankItem(s, position) {
    const hasUpdate = !!s.update;
    return `
      <div class="rank-item" data-id="${s.id}">
        <div class="rank-badge" aria-hidden="true">${position}</div>
        <div class="rank-body">
          <p class="scenario-title">${esc(s.title)}<span class="scenario-id">Händelse ${s.id}</span></p>
          <p class="scenario-text ${hasUpdate ? "updated" : ""}">${esc(s.text)}</p>
          ${hasUpdate ? `<p class="scenario-update">${esc(s.update)}</p>` : ""}
        </div>
        <div class="reorder-controls">
          <button type="button" class="drag-handle" data-drag-handle aria-label="Dra ${esc(s.title)} för att ändra ordning">
            <span class="grip-dots" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </span>
          </button>
          <div class="nudge-group">
            <button type="button" class="nudge-btn" data-nudge="up" data-id="${s.id}" aria-label="Flytta upp" ${position === 1 ? "disabled" : ""}>▲</button>
            <button type="button" class="nudge-btn" data-nudge="down" data-id="${s.id}" aria-label="Flytta ned" ${position === 3 ? "disabled" : ""}>▼</button>
          </div>
        </div>
      </div>
    `;
  }

  function screenBrief() {
    const task = currentTask();
    const scenarios = currentScenarios();
    const order = getOrder(task);
    const remaining = remainingSeconds();
    const timerStopped = !state.timerRunning;

    const newInfoBlock = task.newInfo
      ? `<div class="alert">
           <span class="alert-label">Ny information</span>
           <p>${esc(task.newInfo.text)}</p>
         </div>`
      : "";

    return `
      <div class="screen">
        ${statusBar()}
        <div class="task-header">
          <span class="task-label">${esc(task.label)}</span>
          <h2 class="task-title">${esc(task.title)}</h2>
        </div>

        ${newInfoBlock}

        <div class="timer ${timerStopped ? "stopped" : ""}" data-timer-box>
          <div class="timer-value" data-timer-value>${formatTime(remaining)}</div>
        </div>
        <div class="timer-sub">${
          timerStopped ? "Tiden är ute" : "Dra i greppet för att ändra prioriteringsordning – högst upp går ni mot"
        }</div>

        <div class="scenarios" id="rank-list">
          ${order
            .map((id, i) => rankItem(scenarios.find((s) => s.id === id), i + 1))
            .join("")}
        </div>

        <div class="actions">
          <div class="actions-row">
            <button class="btn-secondary" id="reset-rank-btn">Återställ ordning</button>
            <button class="btn-primary" id="continue-brief-btn">Fortsätt</button>
          </div>
        </div>
      </div>
    `;
  }

  function screenMotivation() {
    const task = currentTask();
    const priorities = getOrder(task);
    const motivation = state.motivations[task.n] || "";
    return `
      <div class="screen">
        ${statusBar()}
        <div class="task-header">
          <span class="task-label">${esc(task.label)}</span>
          <h2 class="task-title">Motivering</h2>
        </div>

        <div class="notice">
          Er prioritering: <strong>${priorities.join(" → ")}</strong>
        </div>

        <div class="field">
          <label for="motivation-input">Beskriv varför ni valde denna prioritering, och varför de andra fick lägre prioritet</label>
          <textarea id="motivation-input" placeholder="Vi valde att gå mot händelse ${priorities[0] ?? "…"} eftersom …">${esc(motivation)}</textarea>
        </div>

        <button class="btn-primary btn-block" id="submit-motivation-btn" ${motivation.trim() ? "" : "disabled"}>Skicka</button>
      </div>
    `;
  }

  function screenSend() {
    const task = currentTask();
    const priorities = getOrder(task);
    const motivation = state.motivations[task.n] || "";
    const message = buildMessage(task.n, state.group, priorities, motivation);
    const isLast = state.taskIndex === TASKS.length - 1;

    return `
      <div class="screen">
        ${statusBar()}
        <div class="task-header">
          <span class="task-label">${esc(task.label)}</span>
          <h2 class="task-title">Skicka rapport</h2>
        </div>

        <div class="notice">Skicka meddelandet nedan till <strong>070-144 08 20</strong>.</div>

        <div class="message-box">${esc(message)}</div>

        <div class="actions">
          <a class="btn-secondary btn-block" style="text-align:center; display:block; text-decoration:none;" href="${smsHref(message)}" id="sms-link">Öppna SMS</a>
          <button class="btn-ghost btn-block" id="copy-btn">Kopiera meddelande</button>
          <div class="copied-tag" id="copied-tag"></div>
          <button class="btn-primary btn-block" id="advance-btn">${isLast ? "Slutför övningen" : "Nästa uppgift"}</button>
        </div>
      </div>
    `;
  }

  function screenDone() {
    const items = TASKS.map((t) => {
      const priorities = getOrder(t);
      const motivation = state.motivations[t.n] || "";
      return `
        <div class="recap-item">
          <h3>${esc(t.label)} &middot; Händelse ${priorities[0] ?? "–"}</h3>
          <p><strong>Prioritering:</strong> ${priorities.join(" → ")}</p>
          <p>${esc(motivation)}</p>
        </div>
      `;
    }).join("");

    return `
      <div class="screen">
        ${statusBar()}
        <div class="task-header">
          <span class="task-label">Övning slutförd</span>
          <h2 class="task-title">Bra jobbat, Båt ${esc(state.group)}</h2>
        </div>

        <div class="notice">Samtliga rapporter är skickade. Här är en sammanfattning av era beslut.</div>

        <div class="recap">${items}</div>

        <div class="footer-nav">
          <button class="btn-ghost" id="restart-btn">Starta om övningen</button>
        </div>
      </div>
    `;
  }

  // ---------- Render ----------
  function render() {
    const app = document.getElementById("app");
    let html = "";
    switch (state.screen) {
      case "landing":
        html = screenLanding();
        break;
      case "brief":
        html = screenBrief();
        break;
      case "motivation":
        html = screenMotivation();
        break;
      case "send":
        html = screenSend();
        break;
      case "done":
        html = screenDone();
        break;
      default:
        html = screenLanding();
    }
    app.innerHTML = html;
    bindEvents();
    if (state.screen === "brief") {
      ensureTicking();
      updateTimerDisplay(remainingSeconds());
    }
  }

  function nudgePriority(id, dir) {
    const task = currentTask();
    const order = [...getOrder(task)];
    const idx = order.indexOf(id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    setState({ priorities: { ...state.priorities, [task.n]: order } });
  }

  function bindRankList() {
    const list = document.getElementById("rank-list");
    if (!list) return;

    list.querySelectorAll("[data-nudge]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const dir = btn.getAttribute("data-nudge") === "up" ? -1 : 1;
        nudgePriority(id, dir);
      });
    });

    list.querySelectorAll("[data-drag-handle]").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => startDrag(e, handle.closest(".rank-item"), list));
    });
  }

  function startDrag(e, item, list) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();

    const task = currentTask();
    const order = [...getOrder(task)];
    const itemEls = Array.from(list.querySelectorAll(".rank-item"));
    const rects = itemEls.map((el) => ({
      id: Number(el.dataset.id),
      el,
      top: el.offsetTop,
      height: el.offsetHeight,
    }));
    const startIndex = order.indexOf(Number(item.dataset.id));
    if (startIndex === -1) return;

    dragCtx = {
      pointerId: e.pointerId,
      order,
      rects,
      startIndex,
      currentIndex: startIndex,
      startY: e.clientY,
      draggedId: Number(item.dataset.id),
      draggedEl: item,
      list,
    };

    item.classList.add("dragging");
    item.style.transition = "none";
    try {
      item.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    item.addEventListener("pointermove", handleDragMove);
    item.addEventListener("pointerup", endDrag);
    item.addEventListener("pointercancel", endDrag);
  }

  function handleDragMove(e) {
    if (!dragCtx || e.pointerId !== dragCtx.pointerId) return;
    const deltaY = e.clientY - dragCtx.startY;
    dragCtx.draggedEl.style.transform = `translateY(${deltaY}px)`;

    const draggedRect = dragCtx.rects[dragCtx.startIndex];
    const draggedCenterNow = draggedRect.top + draggedRect.height / 2 + deltaY;

    let newIndex = dragCtx.currentIndex;
    let bestDist = Infinity;
    dragCtx.rects.forEach((r, i) => {
      const slotCenter = r.top + r.height / 2;
      const dist = Math.abs(slotCenter - draggedCenterNow);
      if (dist < bestDist) {
        bestDist = dist;
        newIndex = i;
      }
    });

    if (newIndex !== dragCtx.currentIndex) {
      const order = [...dragCtx.order];
      const [movedId] = order.splice(dragCtx.currentIndex, 1);
      order.splice(newIndex, 0, movedId);
      dragCtx.order = order;
      dragCtx.currentIndex = newIndex;
    }

    dragCtx.rects.forEach((r) => {
      if (r.id === dragCtx.draggedId) return;
      const slotIndex = dragCtx.order.indexOf(r.id);
      const targetTop = dragCtx.rects[slotIndex].top;
      const offset = targetTop - r.top;
      r.el.style.transition = "transform 150ms ease";
      r.el.style.transform = `translateY(${offset}px)`;
    });
  }

  function endDrag(e) {
    if (!dragCtx || e.pointerId !== dragCtx.pointerId) return;
    const ctx = dragCtx;
    dragCtx = null;

    ctx.draggedEl.removeEventListener("pointermove", handleDragMove);
    ctx.draggedEl.removeEventListener("pointerup", endDrag);
    ctx.draggedEl.removeEventListener("pointercancel", endDrag);
    try {
      ctx.draggedEl.releasePointerCapture(ctx.pointerId);
    } catch {
      /* ignore */
    }

    ctx.rects.forEach((r) => {
      r.el.style.transition = "";
      r.el.style.transform = "";
      r.el.classList.remove("dragging");
    });

    const task = currentTask();
    setState({ priorities: { ...state.priorities, [task.n]: ctx.order } });
  }

  function bindEvents() {
    const groupInput = document.getElementById("group-input");
    if (groupInput) {
      groupInput.addEventListener("input", (e) => {
        const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
        if (digitsOnly !== e.target.value) e.target.value = digitsOnly;
        state.group = digitsOnly;
        saveState();
        const btn = document.getElementById("start-btn");
        if (btn) btn.disabled = !state.group.trim();
      });
    }

    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (!state.group.trim()) return;
        setState({ screen: "brief", taskIndex: 0, priorities: { ...state.priorities, 1: [1, 2, 3] } });
        startTimer(TASKS[0].duration);
      });
    }

    bindRankList();

    const resetBtn = document.getElementById("reset-rank-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const task = currentTask();
        const newPriorities = { ...state.priorities, [task.n]: [1, 2, 3] };
        setState({ priorities: newPriorities });
      });
    }

    const continueBriefBtn = document.getElementById("continue-brief-btn");
    if (continueBriefBtn) {
      continueBriefBtn.addEventListener("click", () => {
        if (state.timerRunning) stopTimer(true);
        setState({ screen: "motivation" });
      });
    }

    const motivationInput = document.getElementById("motivation-input");
    if (motivationInput) {
      motivationInput.addEventListener("input", (e) => {
        const task = currentTask();
        state.motivations = { ...state.motivations, [task.n]: e.target.value };
        saveState();
        const btn = document.getElementById("submit-motivation-btn");
        if (btn) btn.disabled = !e.target.value.trim();
      });
    }

    const submitMotivationBtn = document.getElementById("submit-motivation-btn");
    if (submitMotivationBtn) {
      submitMotivationBtn.addEventListener("click", () => {
        const task = currentTask();
        if (!(state.motivations[task.n] || "").trim()) return;
        setState({ screen: "send" });
      });
    }

    const copyBtn = document.getElementById("copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const task = currentTask();
        const priorities = getOrder(task);
        const motivation = state.motivations[task.n] || "";
        const message = buildMessage(task.n, state.group, priorities, motivation);
        const tag = document.getElementById("copied-tag");
        try {
          await navigator.clipboard.writeText(message);
          if (tag) tag.textContent = "Kopierat";
        } catch {
          if (tag) tag.textContent = "Kunde inte kopiera – markera texten manuellt";
        }
        if (tag) setTimeout(() => (tag.textContent = ""), 2500);
      });
    }

    const advanceBtn = document.getElementById("advance-btn");
    if (advanceBtn) {
      advanceBtn.addEventListener("click", () => {
        const isLast = state.taskIndex === TASKS.length - 1;
        if (isLast) {
          setState({ screen: "done" });
          return;
        }
        const nextIndex = state.taskIndex + 1;
        const nextTask = TASKS[nextIndex];
        const scenarioUpdates = { ...state.scenarioUpdates };
        if (nextTask.newInfo) {
          scenarioUpdates[nextTask.newInfo.scenarioId] = nextTask.newInfo.text;
        }
        const carriedOrder = getOrder(currentTask());
        setState({
          screen: "brief",
          taskIndex: nextIndex,
          scenarioUpdates,
          priorities: { ...state.priorities, [nextTask.n]: carriedOrder },
        });
        startTimer(nextTask.duration);
      });
    }

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        if (!confirm("Starta om hela övningen? All data raderas.")) return;
        stopTimer(false);
        state = defaultState();
        saveState();
        render();
      });
    }
  }

  render();
})();
