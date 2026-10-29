(function () {
  let ctx = null;
  let box = null;
  let mode = "idle";
  let remain = 0;
  let span = 5 * 60 * 1000;
  let tickAt = 0;
  let beat = 0;
  let audio = null;
  let playersOn = false;
  let fightOn = false;
  let size = 40;
  let shape = "square";
  let pushTimer = 0;
  let seq = 0;
  let pushedAt = 0;
  let fxOn = false;
  let kind = "";
  let power = 50;
  let speed = 40;
  let hand = "#1a2744";
  let face = "#f4e7c8";
  let storm = false;
  let free = false;
  let digits = false;
  let endTextVal = "";
  let endImageVal = "";
  let backVal = "";
  let nodes = null;

  function take(next) {
    if (!next) return;
    ctx = ctx || {};
    ["roomId", "headers", "upload", "keep", "library", "saveNote", "campaign", "save"].forEach(function (key) {
      if (next[key] != null) ctx[key] = next[key];
    });
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function digitHtml(text) {
    return String(text).split("").map(function (ch) {
      return '<span class="' + (ch === ":" ? "colon" : "digit") + '">' + ch + "</span>";
    }).join("");
  }

  function paintCss() {
    if (document.getElementById("timer-plugin-css")) return;
    const style = document.createElement("style");
    style.id = "timer-plugin-css";
    style.textContent = ".clock-layer.is-embedded { position: static; z-index: auto; top: auto; right: auto; width: 100%; max-width: 420px; box-shadow: none; } .clock-layer.is-embedded h2 { margin: 0; padding: 10px 14px 0; font-weight: 500; font-size: 16px; color: var(--brass); }";
    document.head.appendChild(style);
  }

  function library() {
    try { return ctx && ctx.library ? ctx.library() : { images: [], notes: [] }; }
    catch (err) { return { images: [], notes: [] }; }
  }

  function picName(url) {
    const lib = library();
    const hit = (lib.images || []).find(function (item) { return item && item.url === url; });
    if (hit) return hit.name || "Картинка";
    if (!url) return "Нет";
    return String(url).split("/").pop() || "Картинка";
  }

  function readSet(commit) {
    if (!nodes) return span;
    const minutes = Math.min(599, Math.max(0, Math.round(Number(nodes.min.value) || 0)));
    const seconds = Math.min(59, Math.max(0, Math.round(Number(nodes.sec.value) || 0)));
    if (commit) {
      nodes.min.value = String(minutes);
      nodes.sec.value = String(seconds);
    }
    return (minutes * 60 + seconds) * 1000;
  }

  function showLeft(ms) {
    if (!nodes) return;
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    nodes.left.innerHTML = digitHtml(hours ? pad2(hours) + ":" + pad2(minutes) + ":" + pad2(seconds) : pad2(minutes) + ":" + pad2(seconds));
  }

  function snapshot(resetFx) {
    const running = mode === "run";
    const left = mode === "idle" ? readSet(false) : remain;
    return {
      type: "timer",
      on: true,
      running: running,
      until: running ? Date.now() + Math.max(0, left) : 0,
      remain: Math.max(0, Math.round(left)),
      size: size,
      shape: shape,
      done: mode === "done",
      span: mode === "idle" ? left : Math.max(left, span),
      effect: (free ? fxOn : !!kind) ? (kind || "") : "",
      linked: !free,
      fxRun: free ? fxOn : true,
      fxReset: !!resetFx,
      power: power,
      speed: speed,
      hand: hand,
      face: face,
      storm: storm,
      digits: digits,
      endText: endTextVal || "",
      endImage: endImageVal || "",
      back: backVal || "",
      fight: fightOn
    };
  }

  function postPlayers(body) {
    if (!ctx || !ctx.roomId) return;
    seq += 1;
    body.seq = seq;
    pushedAt = Date.now();
    fetch("/api/rooms/" + ctx.roomId + "/events", {
      method: "POST",
      headers: ctx.headers || { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).catch(function () {});
  }

  function pushPlayers() {
    if (!playersOn || !ctx || !ctx.roomId) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      if (!playersOn) return;
      postPlayers(snapshot());
    }, 120);
  }

  function sendPlayers(body) {
    if (!ctx || !ctx.roomId) return;
    clearTimeout(pushTimer);
    postPlayers(body);
  }

  function maybeLive() {
    if (!playersOn || mode !== "run") return;
    if (Date.now() - pushedAt < 1000) return;
    postPlayers(snapshot());
  }

  function paint() {
    if (mode === "run") remain = Math.max(0, remain - (Date.now() - tickAt));
    tickAt = Date.now();
    if (mode === "run" && remain <= 0) {
      mode = "done";
      remain = 0;
      ring();
      pushPlayers();
    }
    showLeft(mode === "idle" ? readSet(false) : remain);
    maybeLive();
    if (!nodes) return;
    nodes.left.classList.toggle("is-run", mode === "run");
    nodes.left.classList.toggle("is-done", mode === "done");
    nodes.run.textContent = mode === "run" ? "Пауза" : "Старт";
    nodes.min.disabled = mode === "run";
    nodes.sec.disabled = mode === "run";
  }

  function armAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (err) { /* без звука */ }
  }

  function ring() {
    if (!audio) return;
    try {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 880;
      tone.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.06, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.7);
      tone.start();
      tone.stop(audio.currentTime + 0.7);
    } catch (err) { /* без звука */ }
  }

  function wake() {
    if (beat) return;
    paint();
    beat = setInterval(paint, 250);
  }

  function syncFxBoxes() {
    if (!box) return;
    const magic = box.querySelector("[data-fx=magic]");
    const flood = box.querySelector("[data-fx=flood]");
    const speedRow = box.querySelector("[data-fx=speed-row]");
    const freeActs = box.querySelector("[data-fx=free-acts]");
    if (magic) magic.hidden = kind !== "magic";
    if (flood) flood.hidden = kind !== "flood";
    if (speedRow) speedRow.hidden = !free;
    if (freeActs) freeActs.hidden = !free;
  }

  function applyLook() {
    if (!box) return;
    box.style.setProperty("--clock-size", size + "px");
    box.classList.remove("shape-square", "shape-round", "shape-narrow", "shape-segment");
    box.classList.add("shape-" + shape);
    box.querySelectorAll("[data-clock-shape]").forEach(function (button) {
      button.classList.toggle("is-on", button.getAttribute("data-clock-shape") === shape);
    });
  }

  function markPlayers() {
    if (!nodes) return;
    nodes.players.textContent = playersOn ? "Убрать таймер у игроков" : "Вывести таймер для игроков";
    nodes.players.classList.toggle("is-on", playersOn);
  }

  function showPic() {
    if (!nodes) return;
    nodes.endName.textContent = picName(endImageVal);
    nodes.backName.textContent = picName(backVal);
  }

  function publishApi() {
    window.ShirmoClock = {
      read: function () {
        const left = mode === "run" || mode === "pause" ? Math.max(0, remain) : readSet(false);
        return { running: mode === "run", left: left };
      },
      arm: function (seconds, forceRun) {
        const total = Math.max(0, Math.round(Number(seconds) || 0));
        if (!total) return;
        const was = mode === "run" || forceRun === true;
        span = total * 1000;
        if (nodes) {
          nodes.min.value = String(Math.floor(total / 60));
          nodes.sec.value = String(total % 60);
        }
        if (was) {
          remain = span;
          mode = "run";
          tickAt = Date.now();
          armAudio();
        } else {
          mode = "idle";
          remain = 0;
        }
        paint();
        pushPlayers();
        wake();
      },
      pause: function () {
        if (mode !== "run") return;
        mode = "pause";
        paint();
        pushPlayers();
      },
      stopFx: function () {
        if (!fightOn) return;
        fightOn = false;
        clearTimeout(pushTimer);
        if (mode === "run") mode = "pause";
        paint();
        try { if (window.ShirmoPlugins) window.ShirmoPlugins.effect(""); } catch (err) {}
        if (!playersOn) return;
        playersOn = false;
        markPlayers();
        sendPlayers({ type: "timer", on: false });
      },
      drive: function (opts) {
        opts = opts || {};
        const kinds = { "": 1, sand: 1, magic: 1, smoke: 1, blizzard: 1, fire: 1, flood: 1 };
        if (opts.kind != null && kinds[opts.kind] === 1) {
          kind = opts.kind;
          if (nodes) nodes.kind.value = kind;
          syncFxBoxes();
        }
        const total = Math.max(0, Math.round(Number(opts.seconds) || 0));
        if (total) {
          span = total * 1000;
          if (nodes) {
            nodes.min.value = String(Math.floor(total / 60));
            nodes.sec.value = String(total % 60);
          }
        }
        const left = Math.max(0, Number(opts.left) || 0);
        if (opts.running && (left || span)) {
          remain = left || span;
          mode = "run";
          tickAt = Date.now();
        } else if (opts.paused) {
          remain = left;
          mode = remain ? "pause" : "idle";
        }
        if (opts.showPlayers === false) {
          const hide = fightOn;
          fightOn = false;
          paint();
          wake();
          if (hide && playersOn) {
            playersOn = false;
            markPlayers();
            sendPlayers({ type: "timer", on: false });
          }
          try { if (window.ShirmoPlugins) window.ShirmoPlugins.effect(""); } catch (err) {}
          return;
        }
        if (opts.showPlayers) {
          fightOn = true;
          if (!playersOn) {
            playersOn = true;
            markPlayers();
          }
        }
        paint();
        wake();
        if (opts.resetFx && playersOn) sendPlayers(snapshot(true));
        else pushPlayers();
        try { if (opts.showPlayers && window.ShirmoPlugins) window.ShirmoPlugins.effect(kind || ""); } catch (err) {}
      }
    };
  }

  function build() {
    const minutes = Math.floor(span / 60000);
    const seconds = Math.floor(span / 1000) % 60;
    box = document.createElement("div");
    box.id = "timer-layer";
    box.className = "clock-layer timer-layer is-embedded";
    box.setAttribute("aria-label", "Таймер");
    box.innerHTML = '<h2>Таймер</h2>' +
      '<p class="clock-timer" data-clock="left">05:00</p>' +
      '<div class="clock-set"><label>мин<input data-clock="min" type="number" min="0" max="599" value="' + minutes + '"></label>' +
      '<label>сек<input data-clock="sec" type="number" min="0" max="59" value="' + seconds + '"></label></div>' +
      '<div class="clock-presets"><button type="button" data-clock-min="1">1</button><button type="button" data-clock-min="5">5</button><button type="button" data-clock-min="10">10</button><button type="button" data-clock-min="30">30</button></div>' +
      '<label class="clock-size">Размер<input data-clock="size" type="range" min="28" max="120" value="' + size + '"></label>' +
      '<div class="clock-shapes" role="group" aria-label="Форма цифр">' +
      '<button type="button" data-clock-shape="square">Прямые</button>' +
      '<button type="button" data-clock-shape="round">Круглые</button>' +
      '<button type="button" data-clock-shape="narrow">Узкие</button>' +
      '<button type="button" data-clock-shape="segment">Сегмент</button></div>' +
      '<div class="clock-acts"><button type="button" data-clock="run">Старт</button><button type="button" data-clock="reset">Сброс</button></div>' +
      '<button type="button" class="clock-players" data-clock="players">Вывести таймер для игроков</button>' +
      '<label class="check"><input data-fx="digits" type="checkbox"' + (digits ? " checked" : "") + '> Цифры поверх эффекта</label>' +
      '<p class="clock-cap">Эффект</p>' +
      '<label class="clock-size">Вид<select data-fx="kind">' +
      '<option value="">Нет</option><option value="sand">Песочные часы</option><option value="magic">Магические часы</option>' +
      '<option value="smoke">Дым</option><option value="blizzard">Вьюга</option><option value="fire">Пожар</option><option value="flood">Потоп</option></select></label>' +
      '<label class="check"><input data-fx="free" type="checkbox"' + (free ? " checked" : "") + '> Отвязать от таймера</label>' +
      '<label class="clock-size">Интенсивность<input data-fx="power" type="range" min="1" max="100" value="' + power + '"></label>' +
      '<label class="clock-size" data-fx="speed-row" hidden>Скорость заполнения<input data-fx="speed" type="range" min="1" max="100" value="' + speed + '"></label>' +
      '<div class="fx-extra" data-fx="magic" hidden><label class="clock-size">Стрелки<input data-fx="hand" type="color" value="' + hand + '"></label>' +
      '<label class="clock-size">Фон часов<input data-fx="face" type="color" value="' + face + '"></label></div>' +
      '<label class="check fx-extra" data-fx="flood" hidden><input data-fx="storm" type="checkbox"' + (storm ? " checked" : "") + '> Дождь и ураган</label>' +
      '<div class="clock-acts" data-fx="free-acts" hidden><button type="button" data-fx="play">Запустить эффект</button><button type="button" data-fx="halt">Стоп</button></div>' +
      '<label class="clock-size">Текст в конце<textarea data-fx="end-text" rows="2" placeholder="Время вышло"></textarea></label>' +
      '<div class="clock-acts"><button type="button" data-fx="pick-note">Из заметок</button><button type="button" data-fx="save-note">В справочник</button></div>' +
      '<div class="clock-file"><span>Картинка в конце <b data-fx="end-image-name">Нет</b></span>' +
      '<div class="clock-acts"><button type="button" data-fx="pick-end">Справочник</button>' +
      '<label class="clock-upload">Файл<input type="file" accept="image/*" data-fx="file-end" aria-label="Загрузить картинку в конец"></label></div></div>' +
      '<div class="clock-file"><span>Фон таймера <b data-fx="back-name">Нет</b></span>' +
      '<div class="clock-acts"><button type="button" data-fx="pick-back">Справочник</button>' +
      '<label class="clock-upload">Файл<input type="file" accept="image/*" data-fx="file-back" aria-label="Загрузить фон таймера"></label></div></div>';
    nodes = {
      left: box.querySelector("[data-clock=left]"),
      run: box.querySelector("[data-clock=run]"),
      min: box.querySelector("[data-clock=min]"),
      sec: box.querySelector("[data-clock=sec]"),
      kind: box.querySelector("[data-fx=kind]"),
      power: box.querySelector("[data-fx=power]"),
      speed: box.querySelector("[data-fx=speed]"),
      hand: box.querySelector("[data-fx=hand]"),
      face: box.querySelector("[data-fx=face]"),
      storm: box.querySelector("[data-fx=storm]"),
      free: box.querySelector("[data-fx=free]"),
      endText: box.querySelector("[data-fx=end-text]"),
      endName: box.querySelector("[data-fx=end-image-name]"),
      backName: box.querySelector("[data-fx=back-name]"),
      digits: box.querySelector("[data-fx=digits]"),
      players: box.querySelector("[data-clock=players]")
    };
    nodes.kind.value = kind;
    nodes.endText.value = endTextVal;
    nodes.hand.value = hand;
    nodes.face.value = face;
    showPic();
    nodes.kind.addEventListener("change", function () { kind = nodes.kind.value; syncFxBoxes(); pushPlayers(); });
    nodes.power.addEventListener("input", function () { power = Number(nodes.power.value) || 50; pushPlayers(); });
    nodes.speed.addEventListener("input", function () { speed = Number(nodes.speed.value) || 40; pushPlayers(); });
    nodes.hand.addEventListener("input", function () { hand = nodes.hand.value; pushPlayers(); });
    nodes.face.addEventListener("input", function () { face = nodes.face.value; pushPlayers(); });
    nodes.storm.addEventListener("change", function () { storm = nodes.storm.checked; pushPlayers(); });
    nodes.free.addEventListener("change", function () { free = nodes.free.checked; syncFxBoxes(); pushPlayers(); });
    nodes.endText.addEventListener("input", function () { endTextVal = nodes.endText.value; pushPlayers(); });
    nodes.digits.addEventListener("change", function () { digits = nodes.digits.checked; pushPlayers(); });
    function chooseImage(which) {
      if (!window.ShirmoShelf || !window.ShirmoShelf.pick) return;
      const lib = library();
      window.ShirmoShelf.pick({
        kind: "image",
        images: lib.images || [],
        onPick: function (url, name) {
          if (which === "end") endImageVal = url || "";
          else backVal = url || "";
          showPic();
          if (name && ctx && ctx.keep && url) ctx.keep(url, name);
          pushPlayers();
        }
      });
    }
    box.querySelector("[data-fx=pick-end]").addEventListener("click", function () { chooseImage("end"); });
    box.querySelector("[data-fx=pick-back]").addEventListener("click", function () { chooseImage("back"); });
    box.querySelector("[data-fx=pick-note]").addEventListener("click", function () {
      if (!window.ShirmoShelf || !window.ShirmoShelf.pick) return;
      const lib = library();
      window.ShirmoShelf.pick({
        kind: "note",
        notes: lib.notes || [],
        onPick: function (note) {
          endTextVal = note && note.text || "";
          nodes.endText.value = endTextVal;
          pushPlayers();
        }
      });
    });
    box.querySelector("[data-fx=save-note]").addEventListener("click", function () {
      const text = endTextVal || "";
      if (!text.trim() || !ctx || !ctx.saveNote) return;
      const name = window.prompt("Название заметки", "Таймер") || "";
      if (!name.trim()) return;
      ctx.saveNote(name.trim(), text);
    });
    function takeFile(input, which) {
      const file = input.files && input.files[0];
      input.value = "";
      if (!file || !ctx || !ctx.upload) return;
      ctx.upload(file).then(function (url) {
        if (!url) return;
        if (which === "end") endImageVal = url;
        else backVal = url;
        if (ctx.keep) ctx.keep(url, file.name || "Картинка");
        showPic();
        pushPlayers();
      }).catch(function () {});
    }
    box.querySelector("[data-fx=file-end]").addEventListener("change", function (event) { takeFile(event.target, "end"); });
    box.querySelector("[data-fx=file-back]").addEventListener("change", function (event) { takeFile(event.target, "back"); });
    box.querySelector("[data-fx=play]").addEventListener("click", function () {
      if (!kind) return;
      fxOn = true;
      if (!playersOn) {
        playersOn = true;
        markPlayers();
      }
      sendPlayers(snapshot(true));
    });
    box.querySelector("[data-fx=halt]").addEventListener("click", function () {
      fxOn = false;
      pushPlayers();
    });
    nodes.run.addEventListener("click", function () {
      if (mode === "run") {
        mode = "pause";
        paint();
        pushPlayers();
        return;
      }
      if (mode === "idle" || mode === "done" || remain <= 0) {
        remain = readSet(true);
        span = remain;
        if (!remain) return;
      }
      armAudio();
      mode = "run";
      tickAt = Date.now();
      paint();
      pushPlayers();
    });
    box.querySelector("[data-clock=reset]").addEventListener("click", function () {
      mode = "idle";
      remain = 0;
      paint();
      pushPlayers();
    });
    box.querySelectorAll("[data-clock-min]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (mode === "run") return;
        nodes.min.value = button.getAttribute("data-clock-min");
        nodes.sec.value = "0";
        mode = "idle";
        remain = 0;
        span = readSet(false);
        paint();
        pushPlayers();
      });
    });
    box.querySelector("[data-clock=size]").addEventListener("input", function (event) {
      size = Math.min(120, Math.max(28, Math.round(Number(event.target.value) || 40)));
      applyLook();
      pushPlayers();
    });
    box.querySelectorAll("[data-clock-shape]").forEach(function (button) {
      button.addEventListener("click", function () {
        shape = button.getAttribute("data-clock-shape") || "square";
        applyLook();
        pushPlayers();
      });
    });
    nodes.players.addEventListener("click", function () {
      playersOn = !playersOn;
      if (!playersOn) fightOn = false;
      markPlayers();
      if (playersOn) sendPlayers(snapshot());
      else sendPlayers({ type: "timer", on: false });
    });
    syncFxBoxes();
    applyLook();
    markPlayers();
    document.body.appendChild(box);
    publishApi();
    paint();
  }

  function ensure(host) {
    paintCss();
    if (!box || !box.isConnected) build();
    else publishApi();
    box.classList.add("is-embedded");
    if (host) {
      box.hidden = false;
      if (box.parentElement !== host) host.append(box);
    } else if (box.parentElement === document.body) box.hidden = true;
    wake();
  }

  function stop() {
    if (playersOn || fightOn) sendPlayers({ type: "timer", on: false });
    playersOn = false;
    fightOn = false;
    clearInterval(beat);
    beat = 0;
    clearTimeout(pushTimer);
    if (box) box.remove();
    box = null;
    nodes = null;
    try { delete window.ShirmoClock; } catch (err) { window.ShirmoClock = undefined; }
    try { if (window.ShirmoPlugins) window.ShirmoPlugins.effect(""); } catch (err) {}
  }

  function install(host) {
    host.add({
      id: "timer",
      boot: function (env) { take(env); ensure(null); },
      module: {
        title: "Таймер",
        icon: '<circle cx="12" cy="13" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 10v3h2M9 5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        mount: function (hostNode, next) { take(next); ensure(hostNode); },
        stop: stop
      }
    });
  }

  if (window.ShirmoHost) install(window.ShirmoHost);
  else window.addEventListener("shirmo-host", function () { install(window.ShirmoHost); }, { once: true });
})();
