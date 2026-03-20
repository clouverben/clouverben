// ==================== render.js ====================
// Captura de imagem, exportação de vídeo MP4 e utilitários de render.
// Depende de scene.js e postprocess.js.

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { scene, camera, renderer, getViewW, getViewH, isMobile } from './scene.js';
import { smartRender, resizeComposers, depthRT, _postU } from './postprocess.js';

export let _pauseRender = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
export function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => document.body.removeChild(a), 300);
}

// ── Painel de qualidade de render ─────────────────────────────────────────────
export function updateFinalSizeBadge() {
    const badge = document.getElementById('rq-final-size'); if (!badge) return;
    try {
        const { outW, outH } = getRenderOutputSize();
        const aa = parseInt(document.getElementById('rq-aa')?.value || '1');
        if (aa > 1) badge.textContent = `${outW} × ${outH} px  (render: ${outW * aa} × ${outH * aa})`;
        else badge.textContent = `${outW} × ${outH} px`;
    } catch { badge.textContent = '—'; }
}

export function getRenderOutputSize() {
    const resVal = document.getElementById('rq-resolution')?.value || 'viewport';
    if (resVal === 'viewport') return { outW: getViewW(), outH: getViewH() };
    if (resVal === 'custom') {
        const w = parseInt(document.getElementById('rq-custom-w')?.value || '1920');
        const h = parseInt(document.getElementById('rq-custom-h')?.value || '1080');
        return { outW: Math.max(1, w), outH: Math.max(1, h) };
    }
    const [w, h] = resVal.split('x').map(Number); return { outW: w, outH: h };
}

export function getRenderQualitySettings() {
    const { outW, outH } = getRenderOutputSize();
    return {
        outW, outH,
        aa:      parseInt(document.getElementById('rq-aa')?.value || '2'),
        format:  document.getElementById('rq-format')?.value || 'png',
        quality: parseInt(document.getElementById('rq-quality')?.value || '92') / 100,
    };
}

// ── Wiring do painel de qualidade ─────────────────────────────────────────────
export function initRenderQualityPanel() {
    const renderQualityBtn   = document.getElementById('render-quality-btn');
    const renderQualityPanel = document.getElementById('render-quality-panel');
    if (renderQualityBtn && renderQualityPanel) {
        renderQualityBtn.addEventListener('click', e => {
            e.stopPropagation();
            renderQualityPanel.classList.toggle('hidden');
            if (!renderQualityPanel.classList.contains('hidden')) updateFinalSizeBadge();
        });
        document.addEventListener('click', e => {
            if (renderQualityPanel && !renderQualityPanel.contains(e.target) && e.target !== renderQualityBtn)
                renderQualityPanel.classList.add('hidden');
        });
        const rqResolution = document.getElementById('rq-resolution');
        const rqCustomRow  = document.getElementById('rq-custom-row');
        if (rqResolution) rqResolution.addEventListener('change', () => {
            if (rqCustomRow) rqCustomRow.style.display = rqResolution.value === 'custom' ? 'flex' : 'none';
            updateFinalSizeBadge();
        });
        ['rq-custom-w', 'rq-custom-h'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateFinalSizeBadge);
        });
        const rqAa = document.getElementById('rq-aa');
        if (rqAa) rqAa.addEventListener('change', updateFinalSizeBadge);
        const rqFormat   = document.getElementById('rq-format');
        const rqJpegRow  = document.getElementById('rq-jpeg-row');
        if (rqFormat && rqJpegRow) rqFormat.addEventListener('change', () => {
            rqJpegRow.style.display = (rqFormat.value === 'jpeg' || rqFormat.value === 'webp') ? 'flex' : 'none';
        });
        const rqQuality    = document.getElementById('rq-quality');
        const rqQualityVal = document.getElementById('rq-quality-val');
        if (rqQuality && rqQualityVal) rqQuality.addEventListener('input', () => {
            rqQualityVal.textContent = rqQuality.value + '%';
        });
    }
}

// ── Captura de cena ───────────────────────────────────────────────────────────
let _markDirtyRef = null;
export function setMarkDirtyRef(fn) { _markDirtyRef = fn; }

let _boneLayer = 2;
export function setBoneLayer(layer) { _boneLayer = layer; }

export function captureSceneToCanvas(outW, outH) {
    const origW = getViewW(), origH = getViewH();
    const origAspect = camera.aspect, origDPR = renderer.getPixelRatio();
    renderer.domElement.style.visibility = 'hidden';
    const _hiddenIconChildren = [];
    // Esconde ícones de luzes invisíveis no render
    if (window.sceneObjects) {
        window.sceneObjects.forEach(obj => {
            if (!obj.userData?.isLight) return;
            if (obj.userData?.renderVisible !== false) return;
            obj.traverse(child => {
                if (child === obj) return;
                if (child.isLight) return;
                if (child.visible) { child.visible = false; _hiddenIconChildren.push(child); }
            });
        });
    }
    try {
        renderer.setPixelRatio(1);
        renderer.setSize(outW, outH, false);
        resizeComposers(outW, outH);
        camera.aspect = outW / outH;
        camera.updateProjectionMatrix();
        camera.layers.disable(_boneLayer);

        // Depth pass + pipeline completo
        renderer.setRenderTarget(depthRT);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        _postU.cameraNear.value = camera.near;
        _postU.cameraFar.value  = camera.far;
        smartRender();

        const gl = renderer.getContext(); gl.finish();
        const buffer = new Uint8Array(outW * outH * 4);
        gl.readPixels(0, 0, outW, outH, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        const out = document.createElement('canvas');
        out.width = outW; out.height = outH;
        const ctx = out.getContext('2d');
        const imgData = ctx.createImageData(outW, outH);
        const rowBytes = outW * 4;
        for (let y = 0; y < outH; y++)
            imgData.data.set(buffer.subarray((outH - 1 - y) * rowBytes, (outH - y) * rowBytes), y * rowBytes);
        ctx.putImageData(imgData, 0, 0);
        return out;
    } finally {
        _hiddenIconChildren.forEach(child => { child.visible = true; });
        camera.layers.enable(_boneLayer);
        renderer.setPixelRatio(origDPR);
        renderer.setSize(origW, origH, false);
        resizeComposers(origW, origH);
        camera.aspect = origAspect;
        camera.updateProjectionMatrix();
        renderer.domElement.style.visibility = 'visible';
        _markDirtyRef?.(4);
    }
}

export async function downloadWithQuality() {
    const { outW, outH, aa, format, quality } = getRenderQualitySettings();
    const MAX_RENDER_PIXELS = 4_000_000;
    let renderW = outW * aa, renderH = outH * aa;
    if (renderW * renderH > MAX_RENDER_PIXELS) {
        const scale = Math.sqrt(MAX_RENDER_PIXELS / (renderW * renderH));
        renderW = Math.max(Math.floor(renderW * scale), outW);
        renderH = Math.max(Math.floor(renderH * scale), outH);
        while (renderW * renderH > MAX_RENDER_PIXELS && renderW > outW) {
            renderW = Math.max(Math.floor(renderW * 0.95), outW);
            renderH = Math.max(Math.floor(renderH * 0.95), outH);
        }
    }
    _pauseRender = true;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let srcCanvas;
    try {
        if (renderW !== outW || renderH !== outH) {
            const hiRes = captureSceneToCanvas(renderW, renderH);
            srcCanvas = document.createElement('canvas');
            srcCanvas.width = outW; srcCanvas.height = outH;
            const ctx = srcCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(hiRes, 0, 0, outW, outH);
        } else {
            srcCanvas = captureSceneToCanvas(outW, outH);
        }
    } catch (err) {
        console.error('[Download] Captura falhou:', err);
        alert('Erro ao capturar: ' + (err.message || err));
        return;
    } finally {
        _pauseRender = false;
        _markDirtyRef?.(4);
    }
    try {
        let mimeType, ext;
        if (format === 'jpeg')  { mimeType = 'image/jpeg'; ext = 'jpg'; }
        else if (format === 'webp') { mimeType = 'image/webp'; ext = 'webp'; }
        else { mimeType = 'image/png'; ext = 'png'; }
        const useQuality = (format === 'jpeg' || format === 'webp') ? quality : undefined;
        triggerDownload(
            srcCanvas.toDataURL(mimeType, useQuality),
            `render-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}_${outW}x${outH}.${ext}`
        );
    } catch (err) { alert('Erro ao gerar arquivo:\n' + (err.message || err)); }
}

// ==================== EXPORTAÇÃO DE VÍDEO MP4 ====================
export const VideoExport = (() => {
    let gearBtn = null, panelEl = null, overlayEl = null;
    let cancelled = false, rendering = false, phaseT0 = 0;
    const realNow = performance.now.bind(performance);
    const SIM_SUBSTEPS = 3;
    const RESOLUTIONS = [
        ['Viewport (atual)', 0, 0], ['720p  (1280×720)', 1280, 720],
        ['1080p (1920×1080)', 1920, 1080], ['2K    (2560×1440)', 2560, 1440],
        ['4K    (3840×2160)', 3840, 2160],
    ];
    const QUALITIES = [
        ['Rascunho —  4 Mbps', 4], ['Boa     — 12 Mbps', 12],
        ['Alta    — 24 Mbps', 24], ['Máxima  — 40 Mbps', 40],
    ];

    function injectCSS() {
        if (document.getElementById('_vex_css')) return;
        const s = document.createElement('style'); s.id = '_vex_css';
        s.textContent = `
        #_vex_btn{display:none;background:rgba(100,180,255,.12);border:1px solid rgba(100,180,255,.28);color:#7edfff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;margin-left:6px;font-weight:600;letter-spacing:.3px;}
        #_vex_btn:hover{background:rgba(100,180,255,.22);}
        #_vex_panel{display:none;margin-top:10px;padding:14px;background:rgba(7,9,24,.96);border:1px solid rgba(100,180,255,.18);border-radius:10px;font-size:12px;color:#bbb;}
        #_vex_panel h4{margin:0 0 12px;font-size:13px;color:#7edfff;}
        .vx-r{display:flex;gap:8px;align-items:center;margin-bottom:9px;flex-wrap:wrap;}
        .vx-l{color:#777;white-space:nowrap;min-width:58px;}
        .vx-s,.vx-i{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#ddd;border-radius:5px;padding:4px 7px;font-size:12px;flex:1;min-width:0;}
        .vx-tip{font-size:10px;color:#444;line-height:1.55;margin-bottom:10px;}
        .vx-go{width:100%;padding:9px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600;background:linear-gradient(135deg,rgba(100,200,255,.18),rgba(60,120,255,.22));border:1px solid rgba(100,180,255,.35);color:#7edfff;transition:background .14s;}
        .vx-go:hover{background:linear-gradient(135deg,rgba(100,200,255,.27),rgba(60,120,255,.3));}
        .vx-go:disabled{opacity:.38;cursor:not-allowed;}
        .vx-cancel{width:100%;padding:8px;border-radius:7px;cursor:pointer;font-size:12px;background:rgba(255,65,65,.1);border:1px solid rgba(255,65,65,.25);color:#f87;}
        #_vex_ov{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);}
        #_vex_modal{background:#090b1c;border:1px solid rgba(100,180,255,.22);border-radius:14px;padding:30px 34px;width:440px;max-width:92vw;color:#ccc;font-size:13px;}
        #_vex_modal h3{margin:0 0 20px;font-size:15px;color:#7edfff;text-align:center;}
        ._vx_ph{font-size:10px;color:#555;text-align:center;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;}
        ._vx_lb{text-align:center;margin-bottom:9px;color:#ddd;font-size:13px;min-height:18px;}
        ._vx_bg{background:rgba(255,255,255,.05);border-radius:20px;height:10px;overflow:hidden;margin-bottom:11px;}
        ._vx_fill{height:100%;border-radius:20px;transition:width .07s linear;background:linear-gradient(90deg,#1d4ed8,#7edfff);}
        ._vx_st{display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:20px;}`;
        document.head.appendChild(s);
    }

    async function buildUI(parent) {
        injectCSS();
        gearBtn = document.createElement('button');
        gearBtn.id = '_vex_btn'; gearBtn.textContent = '🎬 Vídeo';
        gearBtn.title = 'Exportar vídeo MP4';
        gearBtn.addEventListener('click', e => {
            e.stopPropagation();
            panelEl.style.display = panelEl.style.display === 'none' ? 'block' : 'none';
        });
        panelEl = document.createElement('div'); panelEl.id = '_vex_panel';
        panelEl.innerHTML = `<h4>🎬 Exportar Vídeo MP4</h4>
            <div class="vx-r"><span class="vx-l">Frames:</span>
            <input id="_vx_s" class="vx-i" type="number" min="0" value="0" style="width:58px;flex:none">
            <span style="color:#444">→</span>
            <input id="_vx_e" class="vx-i" type="number" min="1" value="120" style="width:58px;flex:none">
            <span class="vx-l" style="min-width:28px">FPS:</span>
            <select id="_vx_fps" class="vx-s" style="max-width:66px"><option>24</option><option selected>30</option><option>60</option></select></div>
            <div class="vx-r"><span class="vx-l">Resolução:</span>
            <select id="_vx_res" class="vx-s">${RESOLUTIONS.map((r,i) => `<option value="${i}">${r[0]}</option>`).join('')}</select></div>
            <div class="vx-r"><span class="vx-l">Qualidade:</span>
            <select id="_vx_q" class="vx-s">${QUALITIES.map((q,i) => `<option value="${i}"${i===2?' selected':''}>${q[0]}</option>`).join('')}</select></div>
            <button class="vx-go" id="_vx_go">▶ Exportar Vídeo</button>`;
        if (parent) { parent.appendChild(gearBtn); parent.appendChild(panelEl); }
        document.getElementById('_vx_go')?.addEventListener('click', startExport);
    }

    function yieldUI() { return new Promise(r => setTimeout(r, 0)); }

    async function preSimulate(startF, fps) {
        if (!window.AnimationSystem) return;
        window.AnimationSystem.goToFrame?.(startF);
    }

    async function phase1(startF, endF, fps, rW, rH) {
        const frames = [];
        const totalF = endF - startF;
        for (let i = 0; i < totalF; i++) {
            if (cancelled) break;
            const frame = startF + i;
            window.AnimationSystem?.goToFrame?.(frame);
            const cvs = captureSceneToCanvas(rW, rH);
            const bmp = await createImageBitmap(cvs);
            frames.push(bmp);
            if (i % 5 === 4) await yieldUI();
        }
        return frames;
    }

    async function phase2_encode(frames, fps, w, h, bitrateMbps) {
        if (typeof VideoEncoder !== 'undefined') {
            return _encodeWebCodecs(frames, fps, w, h, bitrateMbps);
        }
        for (const mt of ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']) {
            if (MediaRecorder.isTypeSupported(mt)) return _recordMedia(frames, fps, w, h, bitrateMbps, mt, 'webm');
        }
        throw new Error('Nenhum codec de vídeo disponível no seu browser.');
    }

    async function _encodeWebCodecs(frames, fps, w, h, bitrateMbps) {
        const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@4/build/mp4-muxer.js');
        const target  = new ArrayBufferTarget();
        const muxer   = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });
        const encoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error:  (e) => { throw e; },
        });
        encoder.configure({ codec: 'avc1.42001f', width: w, height: h, bitrate: bitrateMbps * 1_000_000, framerate: fps });
        const frameDur = 1_000_000 / fps;
        for (let i = 0; i < frames.length; i++) {
            if (cancelled) break;
            const vf = new VideoFrame(frames[i], { timestamp: Math.round(i * frameDur), duration: Math.round(frameDur) });
            encoder.encode(vf, { keyFrame: i % Math.max(1, fps * 2) === 0 });
            vf.close();
            if (i % 10 === 9) await yieldUI();
        }
        await encoder.flush(); muxer.finalize();
        return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
    }

    async function _recordMedia(frames, fps, w, h, bitrateMbps, mimeType, ext) {
        const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d', { alpha: false });
        const stream = cvs.captureStream(0);
        const track  = stream.getVideoTracks()[0];
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrateMbps * 1_000_000 });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.start(100);
        const frameDurMs = 1000 / fps;
        for (let idx = 0; idx < frames.length; idx++) {
            if (cancelled) break;
            ctx.drawImage(frames[idx], 0, 0);
            if (typeof track.requestFrame === 'function') track.requestFrame();
            if (idx % 8 === 7) await yieldUI();
            await new Promise(r => setTimeout(r, frameDurMs));
        }
        await new Promise(r => { recorder.onstop = r; recorder.stop(); });
        stream.getTracks().forEach(t => t.stop());
        return { blob: new Blob(chunks, { type: mimeType }), ext };
    }

    async function startExport() {
        if (rendering) return;
        const startF = parseInt(document.getElementById('_vx_s')?.value ?? '0');
        const endF   = parseInt(document.getElementById('_vx_e')?.value ?? '120');
        const fps    = parseInt(document.getElementById('_vx_fps')?.value ?? '30');
        const resIdx = parseInt(document.getElementById('_vx_res')?.value ?? '0');
        const qIdx   = parseInt(document.getElementById('_vx_q')?.value ?? '2');
        if (startF >= endF) { alert('Frame início deve ser menor que Frame fim.'); return; }
        const [, resW, resH] = RESOLUTIONS[resIdx];
        const rW = resW || getViewW(), rH = resH || getViewH();
        const bitrate = QUALITIES[qIdx][1];
        rendering = true; cancelled = false; _pauseRender = true;
        let frames = [], result = null;
        try {
            await preSimulate(startF, fps); if (cancelled) return;
            frames = await phase1(startF, endF, fps, rW, rH); if (cancelled || !frames.length) return;
            result = await phase2_encode(frames, fps, rW, rH, bitrate);
            if (cancelled) return;
            const ts = new Date().toISOString().slice(0,19).replace(/:/g,'-');
            const fn = `render_${ts}_${rW}x${rH}_${fps}fps.${result.ext}`;
            triggerDownload(URL.createObjectURL(result.blob), fn);
        } catch (err) {
            console.error('[VEX]', err); alert('Erro na exportação: ' + (err.message || err));
        } finally {
            rendering = false; _pauseRender = false; _markDirtyRef?.(4);
            frames.forEach(bmp => { try { bmp.close(); } catch {} });
        }
    }

    return {
        init(parent) { buildUI(parent); },
        show() { if (gearBtn) gearBtn.style.display = 'inline-block'; },
    };
})();

console.log('[render.js] ✅ Sistema de render/exportação inicializado');
