import { CircleMarker, Popup, Tooltip, LayerGroup } from 'react-leaflet';
import { ReferenceWaypoint } from '../../utils/referenceWaypoints';

interface ReferenceWaypointsLayerProps {
    waypoints: ReferenceWaypoint[];
    color: string;
    fillColor: string;
    onWaypointClick?: (wp: ReferenceWaypoint) => void;
}

export const ReferenceWaypointsLayer = ({ waypoints, color, fillColor, onWaypointClick }: ReferenceWaypointsLayerProps) => {
    return (
        <LayerGroup>
            {waypoints.map((wp) => (
                <CircleMarker
                    key={wp.uid}
                    center={[wp.lat, wp.lon]}
                    radius={6}
                    pathOptions={{
                        color: color,
                        fillColor: fillColor,
                        fillOpacity: 0.6,
                        weight: 2
                    }}
                    eventHandlers={{
                        click: () => {
                            // Stop propagation so we don't trigger map click
                            // L.DomEvent.stopPropagation(e); 
                            // Actually React Leaflet event handlers might need specific handling?
                            // e.originalEvent.stopPropagation();
                            if (onWaypointClick) onWaypointClick(wp);
                        }
                    }}
                >
                    <Tooltip permanent direction="top" offset={[0, -10]} className="waypoint-label">
                        {wp.label}
                    </Tooltip>
                    <Popup>
                        <div className="text-center">
                            <span className="font-bold">{wp.label}</span>
                            <br />
                            {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
                            <br />
                            <span className="text-xs text-gray-600">{wp.type}</span>
                        </div>
                    </Popup>
                </CircleMarker>
            ))}
        </LayerGroup>
    );
};
