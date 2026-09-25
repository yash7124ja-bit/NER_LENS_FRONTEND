import {useEffect, useRef, useState} from "react";
import {Map, NavigationControl, setWorkerUrl, type GeoJSONSource} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(mapWorkerUrl);
import {request, type Segment} from "./api";

export default function CorridorMap({segments, selectedId, onSelect, corridorId}: {
  corridorId: string; segments: Segment[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const fitted = useRef("");
  const selected = useRef(onSelect);
  selected.current = onSelect;
  const [config, setConfig] = useState<{style_url: string | null} | null>(null);
  useEffect(() => {const c = new AbortController(); request<{style_url: string | null}>("/v1/maps/config", c.signal).then(setConfig).catch(() => {if (!c.signal.aborted) setConfig({style_url: null});}); return () => c.abort();}, []);
  const [road, setRoad] = useState<{retrieved_at: string; route: {geometry: Segment["geometry"]; distance_m: number; duration_seconds: number}} | null>(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController(); setRoad(null); setRouteError(""); setRouteLoading(true);
    request<{retrieved_at: string; route: {geometry: Segment["geometry"]; distance_m: number; duration_seconds: number}}>(`/v1/corridors/${encodeURIComponent(corridorId)}/map-route`, c.signal)
      .then(setRoad).catch(e => { if (!c.signal.aborted) setRouteError(e.message); })
      .finally(() => { if (!c.signal.aborted) setRouteLoading(false); });
    return () => c.abort();
  }, [corridorId, retry]);
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
        instance.addSource("mappls-route", {type: "geojson", data: {type: "FeatureCollection", features: []}});
        instance.addLayer({id: "mappls-road", type: "line", source: "mappls-route",
          paint: {"line-color": "#176d9b", "line-width": 5, "line-opacity": 0.85}});
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
    (instance.getSource("mappls-route") as GeoJSONSource)?.setData({type: "FeatureCollection",
      features: road ? [{type: "Feature", geometry: road.route.geometry, properties: {}}] : []});
    const points = segments.flatMap(segment => segment.geometry.coordinates);
    const boundsKey = JSON.stringify(points);
    if (points.length && fitted.current !== boundsKey) {
      fitted.current = boundsKey;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      instance.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
        {padding: 45, maxZoom: 12, duration: 0});
    }
  }, [ready, segments, selectedId, road]);
  return <div>
    {routeLoading && <p role="status">Loading road geometry from Mappls…</p>}
    {road && <p className="help"><strong>Blue: Mappls driving route</strong> · {(road.route.distance_m / 1000).toFixed(1)} km · Retrieved {new Date(road.retrieved_at).toLocaleString()}. Route geometry does not certify road conditions.</p>}
    {routeError && <p role="alert">Mappls road layer: {routeError} <button onClick={() => setRetry(v => v + 1)}>Retry road layer</button></p>}
    {!config && <p role="status">Loading map configuration…</p>}
    <div ref={container} style={{height: 350}} aria-label="Interactive corridor map" />
    {failed && <p role="status">The interactive map is unavailable. Use the segment table below.</p>}
    <p className="help">Grey: unknown · Red: closed · Amber: restricted · Green: authority open. A thicker line marks the selected band.</p>
    <p className="help">{config?.style_url ? "Online basemap · Mappls road layer and assessment bands" : "Synthetic corridor overlay; basemap unavailable"} · offline basemap not downloaded. <a href="#segments">Use the accessible segment table</a>.</p>
  </div>;
}
