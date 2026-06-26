// POC: captura mic do browser → streama para Deepgram via WebSocket → mostra
// transcript interim/final + mede latência.

const $start = document.getElementById("start");
const $stop = document.getElementById("stop");
const $transcript = document.getElementById("transcript");
const $log = document.getElementById("log");
const $status = document.getElementById("status");
const $dot = document.getElementById("dot");
const $latAvg = document.getElementById("lat-avg");
const $latSuggest = document.getElementById("lat-suggest");
const $finals = document.getElementById("finals");
const $suggestionsCount = document.getElementById("suggestions-count");
const $suggestionsBody = document.getElementById("suggestions-body");
const $lgpdOverlay = document.getElementById("lgpd-overlay");
const $lgpdConfirm = document.getElementById("lgpd-confirm");
const $lgpdCancel = document.getElementById("lgpd-cancel");
const $lgpdBadge = document.getElementById("lgpd-badge");

// LGPD: bloqueia "Iniciar captura" até consentimento explícito
$start.disabled = true;

function registerConsent() {
  const ts = new Date().toISOString();
  sessionStorage.setItem("lgpd_consent", JSON.stringify({ granted: true, at: ts }));
  $lgpdOverlay.classList.add("hidden");
  $lgpdBadge.classList.add("active");
  $lgpdBadge.title = `Consentimento registrado em ${new Date(ts).toLocaleTimeString()}`;
  $start.disabled = false;
  log(`Consentimento LGPD registrado — ${new Date(ts).toLocaleTimeString()}`);
}

$lgpdConfirm.addEventListener("click", registerConsent);
$lgpdCancel.addEventListener("click", () => {
  window.location.href = "about:blank";
});

const BUFFER_WINDOW_MS = 30_000;
const BUFFER_MAX_TURNS = 4;
const SUGGEST_DEBOUNCE_MS = 600;
const SUGGEST_MIN_WORDS = 3;

const state = {
  ws: null,
  mediaRecorder: null,
  mediaStream: null,
  finals: [], // array de strings (transcrições finalizadas)
  interim: "", // string atual interim
  latencies: [],
  finalCount: 0,
  lastChunkSentAt: 0,
  // buffer com timestamp para janela rolante de 30s
  bufferTurns: [],
  suggestInflight: false,
  suggestDebounceTimer: null,
  suggestionCount: 0,
};

function log(msg, isErr = false) {
  const line = document.createElement("div");
  if (isErr) line.classList.add("err");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  $log.prepend(line);
}

function setStatus(text, live = false) {
  $status.textContent = text;
  $dot.classList.toggle("live", live);
}

function render() {
  $transcript.innerHTML = "";
  for (const f of state.finals) {
    const span = document.createElement("span");
    span.className = "final";
    span.textContent = f + " ";
    $transcript.appendChild(span);
  }
  if (state.interim) {
    const span = document.createElement("span");
    span.className = "interim";
    span.textContent = state.interim;
    $transcript.appendChild(span);
  }
  $transcript.scrollTop = $transcript.scrollHeight;

  if (state.latencies.length > 0) {
    const avg = Math.round(
      state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length,
    );
    $latAvg.textContent = `${avg}ms`;
  }
  $finals.textContent = state.finalCount;
  $suggestionsCount.textContent = state.suggestionCount;
}

function pruneBuffer() {
  // Janela rolante: máximo de BUFFER_MAX_TURNS turnos OU BUFFER_WINDOW_MS,
  // o que for menor. Menos contexto = menos tokens = menor latência.
  const cutoff = Date.now() - BUFFER_WINDOW_MS;
  state.bufferTurns = state.bufferTurns.filter((t) => t.ts >= cutoff);
  while (state.bufferTurns.length > BUFFER_MAX_TURNS) {
    state.bufferTurns.shift();
  }
}

function bufferText() {
  return state.bufferTurns.map((t) => t.text).join(" ").trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function sendFeedback(payload) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    log(`Falha ao enviar feedback: ${err.message}`, true);
  }
}

function renderSuggestionCard({ suggestion, gatilhos, latencyMs, costBrl }) {
  const placeholder = $suggestionsBody.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const suggestionId = genId();
  const bufferExcerpt = bufferText().slice(-300);

  const card = document.createElement("div");
  card.className = "suggestion-card";
  const gatilhoBadges = (gatilhos ?? [])
    .map((g) => `<span class="gatilho-badge">${escapeHtml(g)}</span>`)
    .join("");
  const costText = costBrl != null ? ` · R$ ${costBrl.toFixed(4)}` : "";
  card.innerHTML = `
    <div class="suggestion-meta">
      ${gatilhoBadges}
      <span>${latencyMs}ms${costText}</span>
    </div>
    <div class="suggestion-text">${escapeHtml(suggestion)}</div>
    <div class="suggestion-actions">
      <button class="accept" title="Você usou essa fala">👍 Aceitar</button>
      <button class="reject" title="Sugestão inadequada">👎 Refutar</button>
      <button class="dismiss" title="Não se aplicava agora">✓ Dispensar</button>
    </div>
  `;

  const sendAndMark = (action) => {
    if (card.classList.contains("handled")) return;
    card.classList.add("handled");
    sendFeedback({
      suggestion_id: suggestionId,
      action,
      suggestion_text: suggestion,
      gatilhos: gatilhos ?? [],
      buffer_excerpt: bufferExcerpt,
      latency_ms: latencyMs,
      cost_brl: costBrl,
    });
    log(`Feedback: ${action} → "${suggestion.slice(0, 60)}..."`);
  };

  card.querySelector(".accept").addEventListener("click", () => sendAndMark("accepted"));
  card.querySelector(".reject").addEventListener("click", () => sendAndMark("rejected"));
  card.querySelector(".dismiss").addEventListener("click", () => sendAndMark("dismissed"));

  $suggestionsBody.prepend(card);

  state.suggestionCount++;
  $latSuggest.textContent = `${latencyMs}ms`;
  render();
}

async function callSuggest() {
  if (state.suggestInflight) return;
  if (state.bufferTurns.length === 0) return;

  state.suggestInflight = true;
  const text = bufferText();
  const startedAt = performance.now();

  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buffer: text }),
    });
    const data = await res.json();
    const wallClock = Math.round(performance.now() - startedAt);

    // HTTP 500 não cai no catch (fetch só rejeita em erro de rede). Tratar aqui
    // para não engolir falhas do pipeline (ex: ANTHROPIC_API_KEY ausente).
    if (!res.ok || data.error) {
      log(`/api/suggest erro ${res.status}: ${data.error ?? "desconhecido"}`, true);
      return;
    }

    if (data.status === "ok" && data.suggestion) {
      renderSuggestionCard({
        suggestion: data.suggestion,
        gatilhos: data.gatilhos,
        latencyMs: wallClock,
        costBrl: data.cost_brl,
      });
    } else if (data.status === "blocked_by_guardian") {
      log(`Guardian bloqueou: ${data.blocked_reason}`, true);
    } else if (data.status === "no_chunks") {
      log(`Gatilho ${JSON.stringify(data.gatilhos)} detectado, mas sem material no corpus`, true);
    }
    // status === "no_gatilho" → silêncio é correto, não logar
  } catch (err) {
    log(`Falha em /api/suggest: ${err.message}`, true);
  } finally {
    state.suggestInflight = false;
  }
}

function scheduleSuggest() {
  if (state.suggestDebounceTimer) clearTimeout(state.suggestDebounceTimer);
  state.suggestDebounceTimer = setTimeout(callSuggest, SUGGEST_DEBOUNCE_MS);
}

async function start() {
  $start.disabled = true;
  setStatus("Pedindo permissão de microfone…");

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    log("Microfone OK");
  } catch (err) {
    log(`Falha no getUserMedia: ${err.message}`, true);
    setStatus("Erro de microfone");
    $start.disabled = false;
    return;
  }

  setStatus("Buscando chave Deepgram…");
  let key;
  try {
    const resp = await fetch("/api/dg-key");
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
    key = data.key;
    log("Chave Deepgram OK");
  } catch (err) {
    log(`Falha ao buscar chave: ${err.message}`, true);
    setStatus("Erro de chave");
    $start.disabled = false;
    return;
  }

  setStatus("Conectando à Deepgram…");
  const params = new URLSearchParams({
    model: "nova-3",
    language: "pt-BR",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    endpointing: "300",
  });
  const url = `wss://api.deepgram.com/v1/listen?${params}`;

  // Deepgram aceita auth via subprotocolo no browser.
  state.ws = new WebSocket(url, ["token", key]);

  state.ws.onopen = () => {
    log("WebSocket Deepgram aberto");
    setStatus("Capturando — fale algo", true);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    log(`MediaRecorder mimeType: ${mimeType}`);

    state.mediaRecorder = new MediaRecorder(state.mediaStream, { mimeType });

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      if (state.ws?.readyState !== WebSocket.OPEN) return;
      state.ws.send(e.data);
      state.lastChunkSentAt = performance.now();
    };

    state.mediaRecorder.start(250); // chunks de 250ms
    $stop.disabled = false;
  };

  state.ws.onmessage = (msg) => {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (data.type !== "Results") return;

    const alt = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript ?? "";
    if (!transcript) return;

    if (data.is_final) {
      // Mede latência do final em relação ao último chunk enviado.
      if (state.lastChunkSentAt > 0) {
        const lat = Math.round(performance.now() - state.lastChunkSentAt);
        state.latencies.push(lat);
        if (state.latencies.length > 50) state.latencies.shift();
      }
      state.finals.push(transcript);
      state.finalCount++;
      state.interim = "";
      // Atualiza buffer rolante de 30s e dispara /api/suggest (debounced)
      state.bufferTurns.push({ text: transcript, ts: Date.now() });
      pruneBuffer();
      const wordCount = transcript.trim().split(/\s+/).length;
      if (wordCount >= SUGGEST_MIN_WORDS) {
        scheduleSuggest();
      }
    } else {
      state.interim = transcript;
    }
    render();
  };

  state.ws.onerror = (e) => {
    log(`WebSocket error: ${e.message ?? "(sem mensagem)"}`, true);
  };

  state.ws.onclose = (e) => {
    log(`WebSocket fechado (code=${e.code}, reason=${e.reason || "—"})`);
    setStatus("Encerrado");
    $start.disabled = false;
    $stop.disabled = true;
  };
}

function stop() {
  log("Parando captura…");
  $stop.disabled = true;
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
  }
  state.mediaStream?.getTracks().forEach((t) => t.stop());

  // Envia close frame para Deepgram (eles requerem JSON {type:'CloseStream'}).
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: "CloseStream" }));
  }
  setStatus("Encerrando…");
}

$start.addEventListener("click", start);
$stop.addEventListener("click", stop);
