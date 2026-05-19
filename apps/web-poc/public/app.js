// POC: captura mic do browser → streama para Deepgram via WebSocket → mostra
// transcript interim/final + mede latência.

const $start = document.getElementById("start");
const $stop = document.getElementById("stop");
const $transcript = document.getElementById("transcript");
const $log = document.getElementById("log");
const $status = document.getElementById("status");
const $dot = document.getElementById("dot");
const $latAvg = document.getElementById("lat-avg");
const $latMax = document.getElementById("lat-max");
const $chunks = document.getElementById("chunks");
const $finals = document.getElementById("finals");

const state = {
  ws: null,
  mediaRecorder: null,
  mediaStream: null,
  finals: [], // array de strings (transcrições finalizadas)
  interim: "", // string atual interim
  latencies: [],
  chunkCount: 0,
  finalCount: 0,
  lastChunkSentAt: 0,
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
    const max = Math.max(...state.latencies);
    $latAvg.textContent = `${avg}ms`;
    $latMax.textContent = `${max}ms`;
  }
  $chunks.textContent = state.chunkCount;
  $finals.textContent = state.finalCount;
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
      state.chunkCount++;
      state.lastChunkSentAt = performance.now();
      render();
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
