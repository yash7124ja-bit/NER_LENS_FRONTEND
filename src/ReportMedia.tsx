import { useEffect, useState } from "react";
import { request } from "./api";
import { reportStore, savePhoto, syncPhotos, type QueuedPhoto } from "./offline";

type Media = { slot: number; scan_state: string; scan_reason: string; upload_state: string };

export default function ReportMedia({ reportId, localId, owner, upload = false }: {
  reportId?: string; localId?: string; owner: string; upload?: boolean;
}) {
  const [media, setMedia] = useState<Media[]>([]);
  const [saved, setSaved] = useState<QueuedPhoto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const keys = [localId, reportId];
    setSaved((await reportStore.media.where("owner").equals(owner).toArray())
      .filter(row => keys.includes(row.reportId)));
    if (reportId && navigator.onLine)
      setMedia((await request<{media: Media[]}>(`/v1/field-reports/${reportId}/media`)).media);
  }

  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [reportId, localId, owner]);

  async function save(file: File | undefined, slot: number) {
    if (!file || !localId) return;
    setBusy(true); setError("");
    try { await savePhoto(owner, localId, slot, file); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save photo."); }
    finally { setBusy(false); }
  }

  async function synchronize() {
    setBusy(true); setError("");
    try { await syncPhotos(owner); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed; photos remain on this device."); }
    finally { setBusy(false); }
  }

  return <details className="report-media"><summary>Report photos ({media.length} received · {saved.length} saved on device)</summary>
    <p>Photos are private. They become viewable only after the server scanner clears them; display copies exclude EXIF metadata.</p>
    {error && <p role="alert">{error}</p>}
    {saved.map(row => <p key={row.key}>Photo {row.slot + 1}: {row.state?.replaceAll("_", " ") || "saved on device"} · {row.message}</p>)}
    {media.map(row => <p key={row.slot}>Photo {row.slot + 1}: {row.upload_state} · {row.scan_state.replaceAll("_", " ")}
      {row.scan_reason === "scanner_not_configured" && " — awaiting deployment of the malware scanner"}
      {row.scan_state === "clean" && <a href={`/v1/field-reports/${reportId}/media/${row.slot}`} target="_blank" rel="noreferrer"> View photo</a>}</p>)}
    {upload && localId && <>{[0, 1, 2, 3].filter(slot => !media.some(row => row.slot === slot) && !saved.some(row => row.slot === slot))
      .map(slot => <label key={slot}>Photo {slot + 1}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={event => void save(event.target.files?.[0], slot)} /></label>)}
      <p>Up to four photos, 2 MB each. Saved photos survive reload on this browser.</p>
      <button type="button" disabled={busy || !navigator.onLine || !reportId || !saved.length} onClick={() => void synchronize()}>Upload saved photos</button></>}
    {reportId && <button type="button" disabled={busy || !navigator.onLine} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh scan status</button>}
  </details>;
}