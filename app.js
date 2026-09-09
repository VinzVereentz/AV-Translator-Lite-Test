import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";
env.allowLocalModels=false;env.useBrowserCache=true;
const $=id=>document.getElementById(id),src=$("src"),out=$("out"),file=$("file"),status=$("status"),bar=$("progress"),btn=$("translate"),dl=$("download");
let translator=null,busy=false;
function setP(n,t){bar.style.width=Math.max(0,Math.min(100,n))+"%";status.textContent=t}
function cb(p){if(typeof p?.progress==="number")setP(p.progress,`Mengunduh model: ${Math.round(p.progress)}%`)}
async function loadModel(){
 const model="Xenova/nllb-200-distilled-600M";
 if(navigator.gpu){
  try{setP(100,"Unduhan selesai. Menyiapkan mesin WebGPU...");return await pipeline("translation",model,{device:"webgpu",dtype:"q4f16",progress_callback:cb})}
  catch(e){console.warn("WebGPU gagal:",e);setP(100,"WebGPU gagal. Beralih ke CPU/WASM...")}
 }
 setP(100,"Menyiapkan mesin CPU/WASM...");
 return await pipeline("translation",model,{dtype:"q8",progress_callback:cb})
}
function parse(text){text=text.replace(/^\uFEFF/,"").replace(/\r/g,"");return text.split(/\n{2,}/).map(b=>{let a=b.split("\n"),ti=a.findIndex(x=>x.includes("-->"));if(ti<0)return null;return{head:a.slice(0,ti),time:a[ti],text:a.slice(ti+1).join(" ").replace(/\s+/g," ").trim()}}).filter(Boolean)}
async function translateAll(text){
 const blocks=parse(text);if(!blocks.length)throw Error("Format subtitle tidak dikenali. Gunakan SRT.");
 const res=[];
 for(let i=0;i<blocks.length;i++){let b=blocks[i];if(!b.text){res.push({...b,translated:""});continue}
  setP(Math.round(i/blocks.length*100),`Menerjemahkan ${i+1}/${blocks.length}...`);
  let pieces=b.text.match(/.{1,220}(?:[。！？!?]|$)/g)||[b.text],tr=[];
  for(const piece of pieces){let r=await translator(piece,{src_lang:"jpn_Jpan",tgt_lang:"ind_Latn"});tr.push(Array.isArray(r)?(r[0]?.translation_text||""):(r?.translation_text||""))}
  res.push({...b,translated:tr.join(" ").trim()})
 }
 setP(100,"Selesai. Model siap digunakan.");return res
}
btn.onclick=async()=>{if(busy)return;busy=true;btn.disabled=true;try{
 if(!translator){setP(1,"Memulai model AI...");translator=await loadModel();setP(100,"Model siap. Memulai terjemahan...")}
 if(!src.value.trim())throw Error("Pilih atau tempel subtitle terlebih dahulu.");
 let r=await translateAll(src.value.trim());out.value=r.map(b=>`${b.head.length?b.head.join("\n")+"\n":""}${b.time}\n${b.translated}`).join("\n\n");dl.disabled=false
}catch(e){console.error(e);status.textContent="Gagal: "+(e.message||e)}finally{busy=false;btn.disabled=false}};
file.onchange=async()=>{let f=file.files?.[0];if(!f)return;$("filename").textContent=f.name;src.value=await f.text()};
$("example").onclick=()=>{src.value=`1\n00:00:01,000 --> 00:00:03,000\nこんにちは、元気ですか？\n\n2\n00:00:04,000 --> 00:00:06,000\n今日はいい天気ですね。`;$("filename").textContent="Contoh.srt"};
$("clear").onclick=()=>{src.value="";out.value="";dl.disabled=true;$("filename").textContent="Belum ada file"};
$("copy").onclick=async()=>{if(out.value)await navigator.clipboard.writeText(out.value)};
dl.onclick=()=>{let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out.value],{type:"text/plain;charset=utf-8"}));a.download="translated-id.srt";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
