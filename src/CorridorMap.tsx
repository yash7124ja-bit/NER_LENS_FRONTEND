import {useEffect, useRef, useState} from "react";
import {Map, NavigationControl, setWorkerUrl, type GeoJSONSource} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(mapWorkerUrl);
import {request, type Segment} from "./api";

export default function CorridorMap({segments, selectedId, onSelect}: {
  segments: Segment[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const fitted = useRef("");
  const selected = useRef(onSelect);
  selected.current = onSelect;
  const [config, setConfig] = useState<{style_url: string | null} | null>(null);
  useEffect(() => {const c = new AbortController(); request<{style_url: string | null}>("/v1/maps/config", c.signal).then(setConfig).catch(() => {if (!c.signal.aborted) setConfig({style_url: null});}); return () => c.abort();}, []);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current || !config) return;
    fitted.current = "";
    setReady(false);
    let instance: Map;
    try {
      instance = new Map({container: container.current, style: config.style_url || {version: 8,
        sources: {}, layers: [{id: "background", type: "background", paint: {
          "background-color": "#eeefe9"}}]}, center: [0, 0], zoom: 1,
        attributionControl: {compact: true}});
      map.current = instance;
      instance.addControl(new NavigationControl({showCompass: false}), "top-right");
      instance.on("load", () => {
        instance.addSource("corridors", {type: "geojson", data: {type: "FeatureCollection", features: []}});
        instance.addLayer({id: "segments", type: "line", source: "corridors", paint: {
          "line-color": ["match", ["get", "status"], "closed", "#a32a22", "restricted", "#8a5a00", "open", "#0e6b3d", "#777b70"],
          "line-width": ["case", ["==", ["get", "selected"], true], 7, 4]}});
        instance.on("click", "segments", event => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") selected.current(id);
        });
        setReady(true);
      });
      instance.on("error", () => setFailed(true));
    } catch { setFailed(true); }
    return () => { instance?.remove(); map.current = null; };
  }, [config]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource("corridors") as GeoJSONSource)?.setData({type: "FeatureCollection",
      features: segments.map(segment => ({type: "Feature", geometry: segment.geometry,
        properties: {id: segment.segment_id, status: segment.operational_status.value, selected: segment.segment_id === selectedId}}))});
    const points = segments.flatMap(segment => segment.geometry.coordinates);
    const boundsKey = JSON.stringify(points);
    if (points.length && fitted.current !== boundsKey) {
      fitted.current = boundsKey;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      instance.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
        {padding: 45, maxZoom: 12, duration: 0});
    }
  }, [ready, segments, selectedId]);
  return <div>
    {!config && <p role="status">Loading map configuration…</p>}
    <div ref={container} style={{height: 350}} aria-label="Interactive corridor map" />
    {failed && <p role="status">The interactive map is unavailable. Use the segment table below.</p>}
    <p className="help">Grey: unknown · Red: closed · Amber: restricted · Green: authority open. A thicker line marks the selected band.</p>
    <p className="help">{config?.style_url ? "Online basemap with synthetic corridor overlay" : "Synthetic corridor overlay; basemap unavailable"} · offline basemap not downloaded. <a href="#segments">Use the accessible segment table</a>.</p>
  </div>;
}
