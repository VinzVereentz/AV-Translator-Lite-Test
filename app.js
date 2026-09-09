import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

const $ = id => document.getElementById(id);
const src = $("src"), out = $("out"), file = $("file"), status = $("status");
const bar = $("progress"), btn = $("translate"), dl = $("download"), copy = $("copy"), errorBox = $("error");
let translator = null;
let busy = false;

function progress(n, text, cls="") {
  bar.style.width = Math.max(0, Math.min(100, n)) + "%";
  status.textContent = text;
  status.className = cls;
}

function clearError(){ errorBox.textContent = ""; }

function parseSRT(text){
  text = text.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  const blocks = text.split(/\n{2,}/);
  const result = [];
  for(const block of blocks){
    const lines = block.split("\n");
    const timeIndex = lines.findIndex(x => x.includes("-->"));
    if(timeIndex < 0) continue;
    const time = lines[timeIndex].trim();
    const body = lines.slice(timeIndex + 1).join(" ").replace(/\s+/g," ").trim();
    if(body) result.push({head: lines.slice(0,timeIndex), time, text: body});
  }
  return result;
}

function makeSRT(items){
  return items.map((b,i) => {
    const head = b.head.length ? b.head.join("\n") + "\n" : (String(i+1) + "\n");
    return head + b.time + "\n" + b.translated;
  }).join("\n\n");
}

async function loadModel(){
  const model = "Xenova/nllb-200-distilled-600M";
  progress(1, "Memulai mesin AI...", "status-working");

  // WASM/CPU is intentionally used for maximum compatibility on Android.
  // This avoids WebGPU driver failures that can leave the UI at 100%.
  const pipe = await pipeline("translation", model, {
    device: "wasm",
    dtype: "q8",
    progress_callback: data => {
      if(typeof data?.progress === "number"){
        progress(Math.round(data.progress), `Mengunduh model: ${Math.round(data.progress)}%`, "status-working");
      }
    }
  });

  progress(100, "Model siap. Sekarang siap menerjemahkan.", "status-ready");
  return pipe;
}

async function translateAll(text){
  const blocks = parseSRT(text);
  if(!blocks.length) throw new Error("Format subtitle tidak dikenali. Pastikan file adalah SRT.");

  const result = [];
  for(let i=0;i<blocks.length;i++){
    const b = blocks[i];
    progress(Math.round((i / blocks.length) * 100), `Menerjemahkan subtitle ${i+1} dari ${blocks.length}...`, "status-working");

    // Keep each subtitle as one unit whenever possible.
    const r = await translator(b.text, {
      src_lang: "jpn_Jpan",
      tgt_lang: "ind_Latn"
    });

    const translated = Array.isArray(r)
      ? (r[0]?.translation_text || "")
      : (r?.translation_text || "");

    result.push({...b, translated: translated.trim()});
  }

  progress(100, "Selesai. Semua subtitle sudah diterjemahkan.", "status-ready");
  return result;
}

btn.addEventListener("click", async () => {
  if(busy) return;
  clearError();

  if(!src.value.trim()){
    errorBox.textContent = "Pilih file SRT atau tempel subtitle terlebih dahulu.";
    return;
  }

  busy = true;
  btn.disabled = true;

  try{
    if(!translator){
      btn.textContent = "Memuat model...";
      translator = await loadModel();
      btn.textContent = "Terjemahkan SRT";
    }

    const items = await translateAll(src.value.trim());
    out.value = makeSRT(items);
    dl.disabled = false;
    copy.disabled = false;
    btn.textContent = "Terjemahkan Lagi";
  }catch(e){
    console.error(e);
    errorBox.textContent = "Gagal: " + (e?.message || e);
    status.textContent = "Terjadi kesalahan.";
  }finally{
    busy = false;
    btn.disabled = false;
  }
});

file.addEventListener("change", async () => {
  const f = file.files?.[0];
  if(!f) return;
  $("filename").textContent = f.name;
  src.value = await f.text();
  clearError();
});

$("example").addEventListener("click", () => {
  src.value = `1
00:00:01,000 --> 00:00:03,000
こんにちは、元気ですか？

2
00:00:04,000 --> 00:00:06,000
今日はいい天気ですね。`;
  $("filename").textContent = "Contoh.srt";
  clearError();
});

$("clear").addEventListener("click", () => {
  src.value = "";
  out.value = "";
  dl.disabled = true;
  copy.disabled = true;
  $("filename").textContent = "Belum ada file";
  clearError();
});

copy.addEventListener("click", async () => {
  if(!out.value) return;
  try{
    await navigator.clipboard.writeText(out.value);
    copy.textContent = "Tersalin ✓";
    setTimeout(() => copy.textContent = "Salin Hasil", 1200);
  }catch{
    errorBox.textContent = "Gagal menyalin. Silakan tekan lama pada hasil dan pilih Salin.";
  }
});

dl.addEventListener("click", () => {
  if(!out.value) return;
  const url = URL.createObjectURL(new Blob([out.value], {type:"text/plain;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url;
  a.download = "translated-id.srt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
