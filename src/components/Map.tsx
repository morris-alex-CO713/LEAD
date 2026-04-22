import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Vite
// Using CDNs to avoid local asset pathing issues in the prototype environment
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface OpportunityPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  leadScore: number;
  seoScore: number;
}

interface MapProps {
  onSelect?: (lat: number, lng: number) => void;
  onBoundsChange?: (lat: number, lng: number) => void;
  lat?: number;
  lng?: number;
  radius?: number; // In KM
  opportunities?: OpportunityPoint[];
}

function MapEvents({ onSelect, onBoundsChange }: { onSelect?: (lat: number, lng: number) => void, onBoundsChange?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      if (onSelect) onSelect(e.latlng.lat, e.latlng.lng);
    },
    moveend() {
      if (onBoundsChange) {
        const center = map.getCenter();
        onBoundsChange(center.lat, center.lng);
      }
    }
  });

  // Force map to invalidate size on component mount to ensure it fills container
  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

function LocationMarker({ lat, lng, radius }: { lat?: number, lng?: number, radius?: number }) {
  return (lat !== undefined && lng !== undefined && lat !== 0) ? (
    <>
      <Marker position={[lat, lng]} />
      {radius && (
        <Circle 
          center={[lat, lng]} 
          radius={radius * 1000} 
          pathOptions={{ 
            fillColor: '#2563EB', 
            color: '#2563EB', 
            weight: 1, 
            opacity: 0.5, 
            fillOpacity: 0.1 
          }} 
        />
      )}
    </>
  ) : null;
}

export default function BusinessSelectorMap({ onSelect, onBoundsChange, lat, lng, radius, opportunities }: MapProps) {
  // Try to center on the first opportunity if no lat/lng provided
  const center: [number, number] = (lat && lng && lat !== 0) 
    ? [lat, lng] 
    : opportunities?.length 
      ? [opportunities[0].lat, opportunities[0].lng] 
      : [37.7749, -122.4194];

  return (
    <div className="h-full w-full relative z-10">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onSelect={onSelect} onBoundsChange={onBoundsChange} />
        <LocationMarker lat={lat} lng={lng} radius={radius} />
        
        {opportunities?.map((opt) => (
          <Circle 
            key={opt.id}
            center={[opt.lat, opt.lng]}
            radius={100 + (opt.leadScore * 2)} // Size by lead score
            pathOptions={{
              fillColor: opt.seoScore < 5 ? '#ef4444' : (opt.seoScore < 8 ? '#f59e0b' : '#10b981'),
              color: 'transparent',
              fillOpacity: 0.6
            }}
          >
            {/* Tooltips could be added here if needed */}
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
