import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, LayersControl, Tooltip } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { useFlightStore } from '../../store/useFlightStore';
import XYZTileLayer from './XYZTileLayer';
import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapManager } from './MapManager';
import { getReferenceWaypoints } from '../../utils/referenceWaypoints';
import { ReferenceWaypointsLayer } from './ReferenceWaypointsLayer';

// Fix for Leaflet marker icons
// @ts-ignore
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapEvents = () => {
    const addWaypoint = useFlightStore((state) => state.addWaypoint);
    useMapEvents({
        click(e) {
            addWaypoint({
                id: crypto.randomUUID(),
                name: `WPT TEMP`,
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                altitude: 500,
                groundSpeed: 90,
            });
        },
    });
    return null;
};


export const FlightMap = () => {
    // ... (Store hooks)
    const waypoints = useFlightStore((state) => state.waypoints);
    const removeWaypoint = useFlightStore((state) => state.removeWaypoint);
    const updateWaypoint = useFlightStore((state) => state.updateWaypoint);
    const insertWaypoint = useFlightStore((state) => state.insertWaypoint);
    const addWaypoint = useFlightStore((state) => state.addWaypoint);

    const positions: LatLngExpression[] = waypoints.map(wp => [wp.lat, wp.lng]);
    const center: LatLngExpression = waypoints.length > 0 ? [waypoints[0].lat, waypoints[0].lng] : [1.315, 103.84];

    // State for imported layers
    const [tileUrl, setTileUrl] = useState<string | null>(null);
    const [showMapManager, setShowMapManager] = useState(false);

    // Get hardcoded reference waypoints
    const { flaWaypoints, standardWaypoints } = getReferenceWaypoints();

    // ... (Marker/Polyline handlers)
    const handleMarkerDragEnd = (id: string, e: any) => {
        const marker = e.target;
        const position = marker.getLatLng();
        updateWaypoint(id, { lat: position.lat, lng: position.lng });
    };

    const handlePolylineClick = (e: any) => {
        // ... (Same logic as before)
        L.DomEvent.stopPropagation(e);
        const clickLatlng = e.latlng;
        let bestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const w1 = waypoints[i];
            const w2 = waypoints[i + 1];
            const distTotal = L.latLng(w1.lat, w1.lng).distanceTo(L.latLng(w2.lat, w2.lng));
            const distToClick = L.latLng(w1.lat, w1.lng).distanceTo(clickLatlng);
            const distFromClick = clickLatlng.distanceTo(L.latLng(w2.lat, w2.lng));
            const diff = (distToClick + distFromClick) - distTotal;

            if (diff < minDistance) {
                minDistance = diff;
                bestIndex = i;
            }
        }

        if (bestIndex !== -1) {
            insertWaypoint(bestIndex + 1, {
                id: crypto.randomUUID(),
                name: 'TEMP',
                lat: clickLatlng.lat,
                lng: clickLatlng.lng,
                altitude: waypoints[bestIndex].altitude,
                groundSpeed: waypoints[bestIndex].groundSpeed
            });
        }
    };

    const handleFixedWaypointClick = (wp: any) => {
        addWaypoint({
            id: crypto.randomUUID(),
            name: wp.label, // ReferenceWaypoint uses 'label', Waypoint uses 'name'
            lat: wp.lat,
            lng: wp.lon,
            altitude: 500,
            groundSpeed: 90,
        });
    };

    return (
        <div className="h-full w-full bg-slate-800 relative">
            {/* Map Manager Button */}
            <div className="absolute top-4 left-14 z-[1000] bg-white p-2 rounded shadow flex gap-2 items-center">
                <button
                    onClick={() => setShowMapManager(true)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm font-bold"
                >
                    Manage Maps
                </button>
            </div>

            {showMapManager && (
                <MapManager
                    onClose={() => setShowMapManager(false)}
                    onLayerSelect={(url) => setTileUrl(url)}
                />
            )}

            <MapContainer center={center} zoom={11} minZoom={10} maxZoom={15} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="bottomright">
                    <LayersControl.BaseLayer checked name="OpenStreetMap">
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satellite">
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution='Tiles &copy; Esri'
                        />
                    </LayersControl.BaseLayer>
                    {tileUrl && (
                        <LayersControl.Overlay checked name="Imported Chart">
                            <XYZTileLayer tileUrl={tileUrl} />
                        </LayersControl.Overlay>
                    )}
                    <LayersControl.Overlay name="FLA Waypoints">
                        <ReferenceWaypointsLayer
                            waypoints={flaWaypoints}
                            color="#FF6B6B"
                            fillColor="#FF6B6B"
                            onWaypointClick={handleFixedWaypointClick}
                        />
                    </LayersControl.Overlay>
                    <LayersControl.Overlay name="Standard Waypoints">
                        <ReferenceWaypointsLayer
                            waypoints={standardWaypoints}
                            color="#4ECDC4"
                            fillColor="#4ECDC4"
                            onWaypointClick={handleFixedWaypointClick}
                        />
                    </LayersControl.Overlay>
                </LayersControl>
                <MapEvents />

                {waypoints.map((wp) => (
                    <Marker
                        key={wp.id}
                        position={[wp.lat, wp.lng]}
                        draggable={true}
                        eventHandlers={{
                            dragend: (e) => handleMarkerDragEnd(wp.id, e)
                        }}
                    >
                        <Tooltip permanent direction="top" offset={[0, -35]} className="waypoint-label">
                            {wp.name}
                        </Tooltip>
                        <Popup>
                            <div className="text-center">
                                <span className="font-bold">{wp.name}</span>
                                <br />
                                {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                                <br />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeWaypoint(wp.id);
                                    }}
                                    className="mt-2 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                                >
                                    Delete
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <Polyline
                    positions={positions}
                    color="blue"
                    weight={5}
                    eventHandlers={{
                        click: handlePolylineClick
                    }}
                />
            </MapContainer>
        </div>
    );
};

