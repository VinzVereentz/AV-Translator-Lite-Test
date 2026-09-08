import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels=false; env.allowRemoteModels=true; env.useBrowserCache=true;
let translator=null;

const $=x=>document.getElementById(x);
function blocks(t){return t.replace(/^\uFEFF/,"").split(/\r?\n\r?\n+/).filter(Boolean)}
function lines(block){let a=block.split(/\r?\n/);let idx=0;if(/^\d+$/.test((a[0]||"").trim()))idx=1;while(idx<a.length && !a[idx].includes("-->"))idx++;return {a,idx,textStart:idx+1}}
function clean(s){return s.replace(/<[^>]+>/g,"").trim()}

$("file").onchange=async e=>{let f=e.target.files[0];if(!f)return;$("src").value=await f.text();$("filename").textContent=f.name}
$("example").onclick=()=>{$("src").value=`1
00:00:01,000 --> 00:00:03,500
今日は来てくれてありがとう。

2
00:00:04,000 --> 00:00:06,500
本当に助かりました。`}

async function getTranslator(){
 if(translator)return translator;
 $("status").textContent="Mengunduh model AI (pertama kali bisa besar)...";
 let device = navigator.gpu ? "webgpu" : "wasm";
 translator=await pipeline("translation","Xenova/nllb-200-distilled-600M",{
   device,
   dtype: device==="webgpu" ? "q4f16" : "q8",
   progress_callback:p=>{if(p?.progress!=null){$("progress").style.width=Math.round(p.progress)+"%";$("status").textContent=`Memuat model: ${Math.round(p.progress)}%`}}
 });
 return translator;
}
$("translate").onclick=async()=>{
 let input=$("src").value.trim();if(!input){$("status").textContent="Masukkan subtitle dulu.";return}
 $("translate").disabled=true;
 try{
  let tr=await getTranslator(), bs=blocks(input), output=[];
  $("status").textContent=`Menerjemahkan ${bs.length} blok...`;
  for(let n=0;n<bs.length;n++){
   let {a,idx,textStart}=lines(bs[n]); if(idx>=a.length){output.push(bs[n]);continue}
   let texts=a.slice(textStart), joined=texts.join(" ").trim();
   if(!joined){output.push(bs[n]);continue}
   // Keep subtitle translation sentences short for mobile memory/latency.
   let parts=joined.match(/.{1,280}(?:[。！？!?]|$)/g)||[joined];
   let translatedParts=[];
   try{
    for(const part of parts){
      let r=await tr(part,{src_lang:"jpn_Jpan",tgt_lang:"ind_Latn"});
      translatedParts.push(Array.isArray(r)?(r[0]?.translation_text||""):r.translation_text||"");
    }
    let translated=translatedParts.join(" ").trim();
    a.splice(textStart); a.push(translated);
   }catch(e){console.warn(e)}
   output.push(a.join("\n")); $("progress").style.width=Math.round((n+1)/bs.length*100)+"%";
   $("status").textContent=`Menerjemahkan ${n+1}/${bs.length}...`;
  }
  $("out").value=output.join("\n\n");$("download").disabled=false;$("status").textContent="Selesai.";
 }catch(e){$("status").textContent="Gagal: "+e.message;console.error(e)}
 finally{$("translate").disabled=false}
};
$("download").onclick=()=>{let b=new Blob([$("out").value],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="AV_Translator_ID.srt";a.click();URL.revokeObjectURL(a.href)}
$("copy").onclick=()=>navigator.clipboard.writeText($("out").value);
$("clear").onclick=()=>{$("src").value="";$("out").value="";$("filename").textContent="Belum ada file";$("download").disabled=true;$("status").textContent="Model siap digunakan kembali jika sudah cache."}
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");
let deferred;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;$("install").hidden=false});$("install").onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$("install").hidden=true}}
