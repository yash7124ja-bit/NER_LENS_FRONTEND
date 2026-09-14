import {useEffect, useRef, useState} from "react";
import {Map, NavigationControl, type GeoJSONSource} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {Segment} from "./api";

export default function CorridorMap({segments, selectedId, onSelect}: {
  segments: Segment[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const selected = useRef(onSelect);
  selected.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let instance: Map;
    try {
      instance = new Map({container: container.current, style: {version: 8,
        sources: {}, layers: [{id: "background", type: "background", paint: {
          "background-color": "#eeefe9"}}]}, center: [0, 0], zoom: 1,
        attributionControl: false});
      map.current = instance;
      instance.addControl(new NavigationControl({showCompass: false}), "top-right");
      instance.on("load", () => {
        instance.addSource("corridors", {type: "geojson", data: {type: "FeatureCollection", features: []}});
        instance.addLayer({id: "segments", type: "line", source: "corridors", paint: {
          "line-color": ["case", ["==", ["get", "selected"], true], "#d67437", "#777b70"],
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
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource("corridors") as GeoJSONSource)?.setData({type: "FeatureCollection",
      features: segments.map(segment => ({type: "Feature", geometry: segment.geometry,
        properties: {id: segment.segment_id, selected: segment.segment_id === selectedId}}))});
    const points = segments.flatMap(segment => segment.geometry.coordinates);
    if (points.length) {
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      instance.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
        {padding: 45, maxZoom: 12, duration: 0});
    }
  }, [ready, segments, selectedId]);
  return <div>
    <div ref={container} style={{height: 350}} aria-label="Interactive corridor map" />
    {failed && <p role="status">The interactive map is unavailable. Use the segment table below.</p>}
    <p className="help">Replay geometry · no offline basemap coverage. <a href="#segments">Use the accessible segment table</a>.</p>
  </div>;
}
