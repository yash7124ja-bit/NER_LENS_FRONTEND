import {useEffect, useState} from "react";

import {ApiError, request} from "./api";

import {reportStore} from "./offline";

type Media = {slot:number; scan_state:string; scan_reason:string; upload_state:string};

export default function ReportMedia({reportId, owner, upload=false}: {reportId:string; owner:string; upload?:boolean}) {

  const [media,setMedia]=useState<Media[]>([]),[saved,setSaved]=useState<number[]>([]);

  const [error,setError]=useState(""),[busy,setBusy]=useState(false);

  async function refresh() {

    const queued=await reportStore.media.where("reportId").equals(reportId).toArray();

    setSaved(queued.filter(r=>r.owner===owner).map(r=>r.slot));

    if(navigator.onLine) setMedia((await request<{media:Media[]}>(`/v1/field-reports/${reportId}/media`)).media);

  }

  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[reportId,owner]);

  async function save(file:File|undefined,slot:number){

    if(!file)return;setBusy(true);setError("");

    try{

      if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>2*1024*1024||!file.size)

        throw Error("Choose a JPEG, PNG or WebP image up to 2 MB.");

      const key=`${owner}:${reportId}:${slot}`;

      if(await reportStore.media.get(key))throw Error("This slot already has a saved photo. Retry its upload.");

      const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");

      await reportStore.media.add({key,owner,reportId,slot,blob:file,sha256});

      await refresh();

    }catch(e){setError(e instanceof Error?e.message:"Could not save photo.");}finally{setBusy(false);}

  }

  async function synchronize(){

    setBusy(true);setError("");

    try{

      for(const row of await reportStore.media.where("reportId").equals(reportId).toArray()){

        if(row.owner!==owner)continue;

        const r=await fetch(`/v1/field-reports/${reportId}/media/${row.slot}`,{method:"PUT",credentials:"same-origin",

          headers:{"Content-Type":row.blob.type,"Idempotency-Key":row.sha256,"X-Media-SHA256":row.sha256},

          body:row.blob,signal:AbortSignal.timeout(30000)});

        if(!r.ok)throw new ApiError(r.status);

        await reportStore.media.delete(row.key);

      }

      await refresh();

    }catch(e){setError(e instanceof Error?e.message:"Upload failed. Photos remain saved for retry.");}finally{setBusy(false);}

  }

  return <details className="report-media"><summary>Report photos ({media.length} received · {saved.length} saved on device)</summary>

    <p>Photos are private. They become viewable only after the server scanner clears them; display copies exclude EXIF metadata.</p>

    {error&&<p role="alert">{error}</p>}

    {media.map(m=><p key={m.slot}>Photo {m.slot+1}: {m.upload_state} · {m.scan_state.replaceAll("_"," ")}

      {m.scan_reason==="scanner_not_configured"&&" — awaiting deployment of the malware scanner"}

      {m.scan_state==="clean"&&<a href={`/v1/field-reports/${reportId}/media/${m.slot}`} target="_blank" rel="noreferrer"> View photo</a>}</p>)}

    {upload&&<>{[0,1,2,3].filter(slot=>!media.some(m=>m.slot===slot)&&!saved.includes(slot)).map(slot=><label key={slot}>Photo {slot+1}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>void save(e.target.files?.[0],slot)}/></label>)}

      <p>Up to four photos, 2 MB each. Saved photos survive reload on this browser.</p>

      <button type="button" disabled={busy||!navigator.onLine||!saved.length} onClick={()=>void synchronize()}>Upload saved photos</button></>}

    <button type="button" disabled={busy||!navigator.onLine} onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh scan status</button>

  </details>;

}

