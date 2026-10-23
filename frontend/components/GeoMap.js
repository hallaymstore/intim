'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * Ikki rejim:
 *  - places + onSelect: ommaviy joylarni ko'rsatadi va tanlatadi (uchrashuv)
 *  - pick + onPick: xaritadan taxminiy hudud tanlatadi (profil joylashuvi, ~1 km doira)
 */
export default function GeoMap({
  center = [41.3111, 69.2797],
  zoom = 11,
  places = [],
  selectedId,
  onSelect,
  pick,
  onPick,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const placeLayer = useRef(null);
  const pickLayer = useRef(null);
  const handlers = useRef({ onSelect, onPick });
  handlers.current = { onSelect, onPick };
  const [ready, setReady] = useState(false);

  // Xaritani bir marta yaratish (Leaflet faqat brauzerda yuklanadi)
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (disposed || !elRef.current) return;
      const map = L.map(elRef.current).setView(center, zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      placeLayer.current = L.layerGroup().addTo(map);
      pickLayer.current = L.layerGroup().addTo(map);
      map.on('click', (e) => handlers.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Joylar markerlari
  useEffect(() => {
    if (!ready) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    placeLayer.current.clearLayers();
    const pts = [];
    for (const p of places) {
      const selected = p.id === selectedId;
      L.circleMarker([p.lat, p.lng], {
        radius: selected ? 12 : 8,
        color: selected ? '#ffffff' : '#ff4f84',
        weight: 2,
        fillColor: selected ? '#ff4f84' : '#8b4dff',
        fillOpacity: 0.9,
      })
        .bindTooltip(p.name)
        .on('click', () => handlers.current.onSelect?.(p.id))
        .addTo(placeLayer.current);
      pts.push([p.lat, p.lng]);
    }
    const sel = places.find((p) => p.id === selectedId);
    if (sel) map.panTo([sel.lat, sel.lng]);
    else if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }, [ready, places, selectedId]);

  // Tanlangan hudud: aniq nuqta emas, ~1 km doira
  useEffect(() => {
    if (!ready) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    pickLayer.current.clearLayers();
    if (!pick) return;
    L.circle([pick.lat, pick.lng], {
      radius: 1000,
      color: '#ff4f84',
      fillColor: '#ff4f84',
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(pickLayer.current);
    L.circleMarker([pick.lat, pick.lng], { radius: 5, color: '#fff', fillColor: '#ff4f84', fillOpacity: 1, weight: 2 }).addTo(
      pickLayer.current
    );
    map.setView([pick.lat, pick.lng], Math.max(map.getZoom(), 13));
  }, [ready, pick?.lat, pick?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={elRef} className="map" role="application" aria-label="Xarita" />;
}
