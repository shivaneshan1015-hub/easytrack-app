import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function RouteMap({ shops = [] }) {
  const validShops = shops.filter(s => s && s.latitude && s.longitude);
  
  const defaultCenter = validShops.length > 0 
    ? [parseFloat(validShops[0].latitude), parseFloat(validShops[0].longitude)] 
    : [9.9252, 78.1198]; // Madurai HQ fallback

  // Extract coordinate arrays sequentially to construct the distribution polyline vector
  const polylinePositions = validShops.map(shop => [
    parseFloat(shop.latitude), 
    parseFloat(shop.longitude)
  ]);

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={defaultCenter} />
        
        {/* Visual Route Path Line */}
        {polylinePositions.length > 1 && (
          <Polyline 
            positions={polylinePositions} 
            pathOptions={{ 
              color: '#2563eb', 
              weight: 4, 
              opacity: 0.7, 
              dashArray: '10, 10',
              lineJoin: 'round'
            }} 
          />
        )}

        {validShops.map((shop, index) => (
          <Marker key={shop.id} position={[parseFloat(shop.latitude), parseFloat(shop.longitude)]}>
            <Popup>
              <div style={{ fontFamily: 'sans-serif', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                    {index + 1}
                  </span>
                  <strong style={{ color: '#1e293b', fontSize: '14px' }}>{shop.name}</strong>
                </div>
                {shop.phone_number && <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>📞 {shop.phone_number}</p>}
                <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Stop #{index + 1} in Supply Sequence
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}