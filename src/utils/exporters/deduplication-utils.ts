import { Waypoint } from '../../types';

const COORDINATE_TOLERANCE = 0.0001; // ~10 meters

/**
 * Check if two coordinates are effectively the same within tolerance
 */
function coordinatesMatch(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
    return Math.abs(lat1 - lat2) < COORDINATE_TOLERANCE && Math.abs(lng1 - lng2) < COORDINATE_TOLERANCE;
}

/**
 * Normalize waypoint name for comparison (uppercase, remove spaces, add / prefix if missing)
 */
export function normalizeWaypointName(name: string): string {
    const cleaned = name.toUpperCase().replace(/\s+/g, '');
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export interface CoordinateConflict {
    name: string;
    occurrences: Array<{
        index: number;
        lat: number;
        lng: number;
    }>;
}

export interface DeduplicationResult {
    uniqueWaypoints: Waypoint[];
    indexMapping: Map<number, number>; // Maps original index to deduplicated index
    conflicts: CoordinateConflict[];
}

/**
 * Deduplicate waypoints by name, detecting coordinate conflicts
 * - Same name + same coords: Keep first occurrence
 * - Same name + different coords: Report as conflict
 */
export function deduplicateWaypoints(waypoints: Waypoint[]): DeduplicationResult {
    const uniqueWaypoints: Waypoint[] = [];
    const indexMapping = new Map<number, number>();
    const conflicts: CoordinateConflict[] = [];

    // Track seen names and their coordinates
    const seenNames = new Map<string, { waypointIndex: number; lat: number; lng: number }>();

    waypoints.forEach((wp, originalIndex) => {
        const normalizedName = normalizeWaypointName(wp.name);
        const existing = seenNames.get(normalizedName);

        if (!existing) {
            // First occurrence of this name
            const newIndex = uniqueWaypoints.length;
            uniqueWaypoints.push(wp);
            indexMapping.set(originalIndex, newIndex);
            seenNames.set(normalizedName, {
                waypointIndex: newIndex,
                lat: wp.lat,
                lng: wp.lng
            });
        } else {
            // Duplicate name found
            if (coordinatesMatch(wp.lat, wp.lng, existing.lat, existing.lng)) {
                // Same coordinates - silent deduplication
                indexMapping.set(originalIndex, existing.waypointIndex);
            } else {
                // Different coordinates - conflict!
                indexMapping.set(originalIndex, existing.waypointIndex); // Map to first occurrence for now

                // Check if we already have a conflict entry for this name
                let conflict = conflicts.find(c => c.name === normalizedName);
                if (!conflict) {
                    conflict = {
                        name: normalizedName,
                        occurrences: [
                            {
                                index: waypoints.findIndex(w => normalizeWaypointName(w.name) === normalizedName),
                                lat: existing.lat,
                                lng: existing.lng
                            }
                        ]
                    };
                    conflicts.push(conflict);
                }

                // Add this conflicting occurrence
                conflict.occurrences.push({
                    index: originalIndex,
                    lat: wp.lat,
                    lng: wp.lng
                });
            }
        }
    });

    return {
        uniqueWaypoints,
        indexMapping,
        conflicts
    };
}

/**
 * Format coordinate conflicts into a user-friendly error message
 */
export function formatConflictError(conflicts: CoordinateConflict[]): string {
    let message = 'ERROR: Duplicate waypoint names with different coordinates detected!\n\n';
    message += 'The aircraft system requires unique waypoint names. The following conflicts must be resolved:\n\n';

    conflicts.forEach(conflict => {
        message += `Waypoint "${conflict.name}":\n`;
        conflict.occurrences.forEach(occ => {
            message += `  - Position ${occ.index + 1}: ${occ.lat.toFixed(6)}, ${occ.lng.toFixed(6)}\n`;
        });
        message += '\n';
    });

    message += 'Please rename waypoints or ensure identical names have identical coordinates before exporting.';
    return message;
}
