import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';

// Fix for default marker icons in Leaflet with Vite
// Using CDNs to avoid local asset pathing issues in the prototype environment
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for opportunities
const createOpportunityIcon = (seoScore: number, isCrm: boolean = false) => {
  const color = isCrm ? '#3b82f6' : (seoScore < 5 ? '#ef4444' : (seoScore < 8 ? '#f59e0b' : '#10b981'));
  const size = isCrm ? '14px' : '12px';
  const border = isCrm ? '3px solid white' : '2px solid white';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: ${size}; height: ${size}; border: ${border}; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

interface OpportunityPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  leadScore: number;
  seoScore: number;
  isCrm?: boolean;
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
            opacity: 0.3, 
            fillOpacity: 0.05 
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
    : (opportunities && opportunities.length > 0) 
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
          <Marker 
            key={opt.id}
            position={[opt.lat, opt.lng]}
            icon={createOpportunityIcon(opt.seoScore, opt.isCrm)}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -5]}>
              <div className="p-1 min-w-[120px]">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-[10px] uppercase tracking-tight truncate">{opt.name}</p>
                  {opt.isCrm && <Badge className="h-3 px-1 text-[7px] bg-blue-500 hover:bg-blue-600 border-none">CRM</Badge>}
                </div>
                <div className="flex gap-2">
                  <span className="text-[9px] font-black text-primary">SC: {opt.leadScore}%</span>
                  <span className="text-[9px] font-black text-muted-foreground uppercase">SEO: {opt.seoScore}/10</span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

