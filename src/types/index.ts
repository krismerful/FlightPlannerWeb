export interface Waypoint {
    id: string;
    name: string;
    lat: number;
    lng: number;
    altitude: number; // feet
    groundSpeed: number; // knots
    fuelBurnRate?: number; // lbs/min override, optional

    // Computed values
    distance?: number; // NM from previous
    heading?: number; // True heading from previous
    legTime?: number; // Minutes
    totalTime?: number; // Minutes
    fuelRem?: number; // lbs
    bingo?: number; // lbs required
    holdTime?: number; // Minutes, for holding patterns (zero distance)
}

export interface MissionData {
    title: string;
    globalFuelFlow: number; // lbs/minute
    reserveFuel: number; // lbs (Landing Reserve)
    startFuel: number; // lbs (Initial Fuel on Board)
    waypoints: Waypoint[];
}

export type LatLng = { lat: number; lng: number };

export interface MapInfo {
    name: string;
    path: string;
}

