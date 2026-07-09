// ==================== VIDEOEXPORT.JS v3 ====================
// Fixes:
//  1. Capture direto do canvas WebGL do renderer (não offscreen canvas)
//  2. requestFrame() no track correto (captureStream(0) = controle manual)
//  3. EBML patcher para inserir Duration no WebM (corrige "0 segundos")
//  4. WebCodecs MP4 como caminho primário (duração correta nativa)
//  5. Loop de render pausado durante captura (sem race condition)

window._exportPaused = false;
let _rendering = false, _cancelled = false;

const getApp = () => window._app;
// Await one rAF cycle — GPU flushes + browser gets a breath
function rafYield() { return new Promise(r => requestAnimationFrame(r)); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

function triggerDownload(url, name) {
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 6000);
}

// ── Renderiza um frame na canvas do THREE.js ───────────────────────────────
function renderOneFrame(frameNum, fps) {
    const app = getApp(); if (!app?.renderer) return;
    if (window.AnimationSystem)    window.AnimationSystem.goToFrame(frameNum);
    if (window._nexusParticleLab) window._nexusParticleLab.update(1 / fps);
    if (app.scene && app.camera)   app.renderer.render(app.scene, app.camera);
}

// ── EBML Duration patcher ──────────────────────────────────────────────────
// Chrome MediaRecorder gera WebM com Duration = 0 ou sem Duration.
// Essa função encontra e corrige o elemento Duration no cabeçalho EBML.
async function fixWebMDuration(blob, durationMs) {
    try {
        const buf  = await blob.arrayBuffer();
        const u8   = new Uint8Array(buf);
        const view = new DataView(buf);
        const limit = Math.min(u8.length - 12, 32768);

        for (let i = 0; i < limit; i++) {
            // Duration EBML ID = 0x44 0x89
            if (u8[i] !== 0x44 || u8[i + 1] !== 0x89) continue;
            const sizeCode = u8[i + 2];
            let dataOff, byteLen;

            // VINT decoding (1 ou 2 bytes de tamanho)
            if ((sizeCode & 0x80) !== 0) {
                byteLen = sizeCode & 0x7F;
                dataOff = i + 3;
            } else if ((sizeCode & 0x40) !== 0) {
                byteLen = ((sizeCode & 0x3F) << 8) | u8[i + 3];
                dataOff = i + 4;
            } else {
                continue;
            }

            if (byteLen === 8 && dataOff + 8 <= u8.length) {
                view.setFloat64(dataOff, durationMs, false); // big-endian float64
                return new Blob([buf], { type: blob.type });
            }
            if (byteLen === 4 && dataOff + 4 <= u8.length) {
                view.setFloat32(dataOff, durationMs, false);
                return new Blob([buf], { type: blob.type });
            }
        }
        console.warn('[VideoExport] Elemento Duration não encontrado no WebM para patch.');
    } catch (e) {
        console.warn('[VideoExport] Falha no EBML patcher:', e);
    }
    return blob;
}

// ── PATH A: WebCodecs → MP4 (Chrome 94+, melhor qualidade e duração correta) ──
async function exportMP4(startF, endF, fps, bitrateMbps, onProgress) {
    if (typeof VideoEncoder === 'undefined') throw new Error('VideoEncoder não disponível');

    // Carregar mp4-muxer do CDN
    let Muxer, ArrayBufferTarget;
    for (const url of [
        'https://cdn.jsdelivr.net/npm/mp4-muxer@5/build/mp4-muxer.js',
        'https://unpkg.com/mp4-muxer@5/build/mp4-muxer.js',
        'https://cdn.jsdelivr.net/npm/mp4-muxer@4/build/mp4-muxer.js',
    ]) {
        try {
            const m = await Promise.race([
                import(url),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
            ]);
            Muxer            = m.Muxer            ?? m.default?.Muxer;
            ArrayBufferTarget = m.ArrayBufferTarget ?? m.default?.ArrayBufferTarget;
            if (typeof Muxer === 'function') break;
        } catch { /* tenta próximo */ }
    }
    if (typeof Muxer !== 'function') throw new Error('mp4-muxer indisponível');

    const canvas = getApp().renderer.domElement;
    // H.264 exige dimensões pares
    const w = canvas.width  - (canvas.width  % 2);
    const h = canvas.height - (canvas.height % 2);

    // Detectar melhor perfil H.264 suportado
    let codec = 'avc1.42001f'; // baseline - mais compatível
    for (const c of ['avc1.640028', 'avc1.4d001f', 'avc1.42001f']) {
        try {
            if ((await VideoEncoder.isConfigSupported({ codec: c, width: w, height: h })).supported) {
                codec = c; break;
            }
        } catch {}
    }

    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });
    const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error:  e => { throw e; },
    });
    encoder.configure({ codec, width: w, height: h, bitrate: bitrateMbps * 1_000_000, framerate: fps });

    const total     = endF - startF;
    const usPerFrame = 1_000_000 / fps;

    for (let i = 0; i < total; i++) {
        if (_cancelled) break;

        // Backpressure: don't let the internal encode queue balloon —
        // this is what caused stutter/jank on longer exports, since we
        // were pushing frames in faster than libaom/openh264 could eat
        // them, building up unbounded memory pressure.
        while (encoder.encodeQueueSize > 4) await rafYield();

        renderOneFrame(startF + i, fps);

        // Pass the canvas directly as the VideoFrame source — this avoids
        // the createImageBitmap() copy entirely (one less GPU→CPU→GPU
        // round-trip per frame). VideoFrame snapshots the pixels at
        // construction time, so it's safe even though we redraw the same
        // canvas again next iteration.
        const vf = new VideoFrame(canvas, {
            timestamp: Math.round(i * usPerFrame),
            duration:  Math.round(usPerFrame),
        });
        encoder.encode(vf, { keyFrame: i % Math.max(1, fps) === 0 });
        vf.close();

        onProgress?.(i / total, `MP4: frame ${startF + i} / ${endF - 1}`);
        if (i % 6 === 5) await rafYield(); // let the GPU/compositor breathe
    }

    await encoder.flush();
    muxer.finalize();
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
}

// ── PATH B: MediaRecorder → WebM (fallback universal) ─────────────────────
// KEY FIX: captura diretamente do canvas do renderer (não offscreen canvas)
// usando captureStream(0) + requestFrame() para controle manual de frame.
//
// SMOOTHNESS FIX: MediaRecorder derives each recorded frame's real timing
// from the wall-clock moment you call requestFrame() — unlike the MP4 path,
// there's no synthetic-timestamp escape hatch here, so pacing quality
// directly determines output smoothness. The previous version mixed
// setTimeout(ms) with rAF, and setTimeout drifts (browsers coalesce/clamp
// it, especially under load) — that drift is exactly what caused jerky
// motion. This version paces frames using ONLY requestAnimationFrame ticks
// (which fire at the display's true refresh rate) and accumulates target
// time without ever resetting the baseline, so timing errors never
// compound frame-to-frame.
function exportWebM(startF, endF, fps, bitrateMbps, onProgress) {
    const app = getApp();
    if (!app?.renderer?.domElement) return Promise.reject(new Error('Renderer não disponível'));

    const canvas = app.renderer.domElement;
    const total  = endF - startF;
    const frameDurMs = 1000 / fps;

    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

    const stream = canvas.captureStream(0);   // 0 = manual frame control
    const track  = stream.getVideoTracks()[0];
    if (!track) return Promise.reject(new Error('captureStream não retornou track de vídeo'));

    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrateMbps * 1_000_000,
    });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };

    return new Promise((resolve, reject) => {
        let frameIdx = 0;
        let nextDue  = null; // accumulator target (ms), never reset — prevents drift

        async function finish() {
            try {
                recorder.requestData();
                await new Promise(r => { recorder.onstop = r; recorder.stop(); });
                stream.getTracks().forEach(t => t.stop());

                onProgress?.(0.97, 'Corrigindo metadados…');
                const durationMs = (total / fps) * 1000;
                const raw   = new Blob(chunks, { type: mimeType });
                const fixed = await fixWebMDuration(raw, durationMs);
                resolve({ blob: fixed, ext: 'webm' });
            } catch (e) { reject(e); }
        }

        function rafLoop(now) {
            if (_cancelled) { finish(); return; }
            if (frameIdx >= total) { finish(); return; }

            if (nextDue === null) nextDue = now; // first tick fires immediately

            if (now >= nextDue) {
                renderOneFrame(startF + frameIdx, fps);
                if (track.readyState === 'live') track.requestFrame();
                onProgress?.(frameIdx / total, `WebM: frame ${startF + frameIdx} / ${endF - 1}`);
                frameIdx++;
                nextDue += frameDurMs; // accumulate — never drifts from real elapsed time
            }
            requestAnimationFrame(rafLoop);
        }

        // Pre-warm: render 2 frames before recording so the GPU pipeline is
        // hot and the very first captured frame isn't a partially-primed one.
        renderOneFrame(startF, fps);
        requestAnimationFrame(() => {
            renderOneFrame(startF, fps);
            requestAnimationFrame(() => {
                recorder.start(); // no timeslice — all data collected on stop()
                requestAnimationFrame(rafLoop);
            });
        });
    });
}

// ── UI de progresso ────────────────────────────────────────────────────────
function makeProgressUI() {
    const ov = document.createElement('div');
    ov.id    = '_vex_ov';
    ov.style.cssText = [
        'position:fixed;inset:0;z-index:99999',
        'background:rgba(0,0,0,.9)',
        'display:flex;align-items:center;justify-content:center',
        'backdrop-filter:blur(10px)',
    ].join(';');
    ov.innerHTML = `
      <div style="
        background:#06080f;border:1px solid rgba(100,180,255,.25);
        border-radius:18px;padding:32px;width:min(400px,90vw);
        box-shadow:0 24px 70px rgba(0,0,0,.95);
        font-family:system-ui,-apple-system,sans-serif;color:#ccc
      ">
        <div style="font-size:32px;text-align:center;margin-bottom:16px;filter:drop-shadow(0 0 12px #7edfff88)">🎬</div>
        <h3 style="margin:0 0 18px;font-size:16px;color:#7edfff;text-align:center;font-weight:700;letter-spacing:.02em">
          Exportando Vídeo
        </h3>
        <p id="_vex_phase" style="font-size:10px;color:#555;text-align:center;
           text-transform:uppercase;letter-spacing:.9px;margin:0 0 5px">Preparando…</p>
        <p id="_vex_label" style="text-align:center;margin:0 0 14px;color:#999;
           font-size:12px;min-height:18px"></p>
        <div style="background:rgba(255,255,255,.06);border-radius:100px;height:8px;
             overflow:hidden;margin-bottom:8px">
          <div id="_vex_bar" style="height:100%;border-radius:100px;width:0%;
               transition:width .15s ease;
               background:linear-gradient(90deg,#1d4ed8 0%,#38bdf8 60%,#7edfff 100%)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;
             font-size:11px;color:#555;margin-bottom:20px">
          <span id="_vex_pct">0%</span>
          <span id="_vex_eta"></span>
        </div>
        <button id="_vex_cancel" style="
          width:100%;padding:10px;border-radius:9px;cursor:pointer;
          font-size:13px;font-weight:600;letter-spacing:.02em;
          background:rgba(255,60,60,.08);
          border:1px solid rgba(255,60,60,.28);color:#f88;
          transition:background .15s
        ">✕ Cancelar</button>
      </div>`;
    document.body.appendChild(ov);

    const t0 = Date.now();
    ov.querySelector('#_vex_cancel').addEventListener('click', () => { _cancelled = true; });

    const $  = id => document.getElementById(id);
    return {
        phase(s)    { $('_vex_phase').textContent = s; },
        label(s)    { $('_vex_label').textContent = s; },
        progress(p) {
            const v = Math.round(p * 100);
            $('_vex_bar').style.width = v + '%';
            $('_vex_pct').textContent  = v + '%';
            if (p > 0.06) {
                const el  = (Date.now() - t0) / 1000;
                const rem = Math.max(0, (el / p) * (1 - p));
                $('_vex_eta').textContent = `~${Math.ceil(rem)}s restantes`;
            }
        },
        done() { ov.remove(); },
    };
}

// ── Configurações disponíveis ──────────────────────────────────────────────
export const RESOLUTIONS = [
    ['Viewport (atual)',    0,    0   ],
    ['720p   (1280×720)',   1280, 720 ],
    ['1080p  (1920×1080)', 1920, 1080],
];
export const QUALITIES = [
    ['Rascunho —  4 Mbps',  4],
    ['Boa     — 12 Mbps',  12],
    ['Alta    — 24 Mbps',  24],
    ['Máxima  — 40 Mbps',  40],
];

// ── Entrada principal ──────────────────────────────────────────────────────
export async function startVideoExport(opts = {}) {
    if (_rendering) { alert('Já há uma exportação em andamento.'); return; }
    const { startF = 0, endF = 30, fps = 30, resIdx = 0, qIdx = 1 } = opts;

    if (startF >= endF) { alert('Frame início deve ser menor que Frame fim.'); return; }
    if ((endF - startF) > 1800) {
        if (!confirm(`${endF - startF} frames pode demorar muito. Continuar?`)) return;
    }

    const [, rW, rH] = RESOLUTIONS[resIdx] ?? RESOLUTIONS[0];
    const bitrate    = QUALITIES[qIdx]?.[1] ?? 12;
    const app        = getApp();

    _rendering = true; _cancelled = false;
    window._exportPaused = true;

    const ui = makeProgressUI();

    // Redimensionamento opcional
    let origW, origH, origAsp;
    if (rW && rH && app?.renderer && app?.camera) {
        origW   = app.renderer.domElement.width;
        origH   = app.renderer.domElement.height;
        origAsp = app.camera.aspect;
        app.renderer.setSize(rW, rH, false);
        app.camera.aspect = rW / rH;
        app.camera.updateProjectionMatrix();
    }

    try {
        // Aguarda o loop de render pausar (3 rAF cycles)
        await rafYield(); await rafYield(); await rafYield();

        let result = null;

        // ── Tenta WebCodecs MP4 (melhor) ──────────────────────────────────
        if (typeof VideoEncoder !== 'undefined') {
            try {
                ui.phase('Exportando MP4 • WebCodecs');
                result = await exportMP4(startF, endF, fps, bitrate, (p, lbl) => {
                    ui.progress(p * 0.95); ui.label(lbl);
                });
            } catch (e) {
                console.warn('[VideoExport] WebCodecs/MP4 falhou, tentando WebM:', e.message);
                result = null;
            }
        }

        // ── Fallback: MediaRecorder WebM ──────────────────────────────────
        if (!result && !_cancelled) {
            ui.phase('Exportando WebM • MediaRecorder');
            result = await exportWebM(startF, endF, fps, bitrate, (p, lbl) => {
                ui.progress(p * 0.97); ui.label(lbl);
            });
        }

        if (_cancelled) { ui.label('Cancelado.'); await sleep(900); return; }
        if (!result?.blob) throw new Error('Exportação não produziu dados.');

        ui.progress(1); ui.label('Download iniciando…');
        const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fn = `render_${ts}_${endF - startF}f_${fps}fps.${result.ext}`;
        triggerDownload(URL.createObjectURL(result.blob), fn);
        await sleep(1200);

    } catch (err) {
        console.error('[VideoExport]', err);
        ui.label('❌ ' + (err.message || String(err)));
        ui.phase('Erro na exportação');
        await sleep(3500);
    } finally {
        if (rW && rH && app?.renderer && app?.camera) {
            app.renderer.setSize(origW, origH, false);
            app.camera.aspect = origAsp;
            app.camera.updateProjectionMatrix();
        }
        window.AnimationSystem?.goToFrame?.(opts.startF ?? 0);
        window._exportPaused = false;
        _rendering = false;
        ui.done();
    }
}

// ── Injeção do painel no Render ────────────────────────────────────────────
export function injectVideoExportPanel(parentEl) {
    if (!parentEl || document.getElementById('_vex_panel_inner')) return;
    const wrap = document.createElement('div');
    wrap.id    = '_vex_panel_inner';
    wrap.style.cssText = 'padding:10px 8px;border-top:1px solid rgba(255,255,255,.07);margin-top:6px';
    wrap.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#7edfff;margin-bottom:10px;
           display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
        </svg>
        Exportar Vídeo
      </div>
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:7px;flex-wrap:wrap">
        <span class="_vl">Frames</span>
        <input id="_vx_s" type="number" min="0" value="0" class="_vi" style="width:50px">
        <span style="color:#444;font-size:11px">→</span>
        <input id="_vx_e" type="number" min="1" value="30" class="_vi" style="width:50px">
        <span class="_vl" style="margin-left:4px">FPS</span>
        <select id="_vx_fps" class="_vs" style="max-width:58px">
          <option>24</option><option selected>30</option><option>60</option>
        </select>
      </div>
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:6px">
        <span class="_vl" style="min-width:62px">Resolução</span>
        <select id="_vx_res" class="_vs" style="flex:1">
          ${RESOLUTIONS.map((r,i)=>`<option value="${i}">${r[0]}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:10px">
        <span class="_vl" style="min-width:62px">Qualidade</span>
        <select id="_vx_q" class="_vs" style="flex:1">
          ${QUALITIES.map((q,i)=>`<option value="${i}"${i===1?' selected':''}>${q[0]}</option>`).join('')}
        </select>
      </div>
      <button id="_vx_go" style="
        width:100%;padding:9px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;
        background:linear-gradient(135deg,rgba(30,64,175,.35),rgba(56,189,248,.22));
        border:1px solid rgba(100,180,255,.35);color:#7edfff;
        display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s
      ">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Exportar Vídeo
      </button>
      <style>
        ._vl{font-size:10px;color:rgba(200,200,220,.45)}
        ._vi{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
             color:#ddd;border-radius:5px;padding:3px 6px;font-size:11px}
        ._vs{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
             color:#ddd;border-radius:5px;padding:3px 6px;font-size:11px}
        #_vx_go:hover{opacity:.82}
      </style>`;
    parentEl.appendChild(wrap);
    document.getElementById('_vx_go')?.addEventListener('click', () => {
        startVideoExport({
            startF: parseInt(document.getElementById('_vx_s')?.value   ?? '0'),
            endF:   parseInt(document.getElementById('_vx_e')?.value   ?? '30'),
            fps:    parseInt(document.getElementById('_vx_fps')?.value ?? '30'),
            resIdx: parseInt(document.getElementById('_vx_res')?.value ?? '0'),
            qIdx:   parseInt(document.getElementById('_vx_q')?.value   ?? '1'),
        });
    });
}
