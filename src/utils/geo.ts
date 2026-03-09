import { Waypoint } from '../types';

const R_NM = 3440.1; // Earth Radius in Nautical Miles (Spherical)

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const getDistanceNM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R_NM * c;
};

export const getHeading = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    const dLon = toRad(lon2 - lon1);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
        Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
};

// Helper: Parse Coordinate String (supports DD and DDM)
// Supported formats:
// - Decimal Degrees: "1.35", "-103.8"
// - DDM: "N01 21.126", "E103 49.188", "S01 20.5", "W100 00"
export const parseCoordinate = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Try DDM Regex: ([NSEW])(\d+)\s+([\d.]+)
    // Matches: N01 21.126, E103 49.188
    const ddmRegex = /^([NSEW])\s*(\d+)\s+([\d.]+)$/i;
    const match = trimmed.match(ddmRegex);

    if (match) {
        const [, dir, degStr, minStr] = match;
        const deg = parseInt(degStr, 10);
        const min = parseFloat(minStr);
        let decimal = deg + min / 60;

        // Handle negation for South and West
        if (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W') {
            decimal = -decimal;
        }
        return decimal;
    }

    // 2. Fallback: Parse as standard float (Decimal Degrees)
    const floatVal = parseFloat(trimmed);
    return isNaN(floatVal) ? null : floatVal;
};

// Helper: Convert DD to DDM string (e.g. N01 20.961)
export const formatCoordinate = (val: number, isLat: boolean): string => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const min = (absVal - deg) * 60;

    // Match VBA format: "N00 00.000" or "E000 00.000"
    const degStr = deg.toString().padStart(isLat ? 2 : 3, '0');
    const minStr = min.toFixed(3).padStart(6, '0');

    return `${dir}${degStr} ${minStr}`;
};

export const calculateLegs = (waypoints: Waypoint[], globalFuelFlow: number, reserveFuel: number, startFuel: number = 0): Waypoint[] => {
    if (waypoints.length === 0) return [];

    const computed = [...waypoints];
    let totalMinutes = 0;

    // Remaining Fuel Calculation (Forward Pass)
    let currentFuel = startFuel;

    // Forward Pass: Distance, Heading, Time, Burn, Fuel Rem
    for (let i = 0; i < computed.length; i++) {
        const wp = computed[i];

        // 1. Geography & Time
        if (i === 0) {
            wp.distance = 0;
            wp.heading = 0;
            wp.legTime = 0;
            wp.totalTime = 0;
        } else {
            const prev = computed[i - 1];
            wp.distance = getDistanceNM(prev.lat, prev.lng, wp.lat, wp.lng);
            wp.heading = getHeading(prev.lat, prev.lng, wp.lat, wp.lng);

            // Time Calculation
            if (wp.distance < 0.05 && wp.holdTime) {
                // Holding Pattern use Manual Time
                wp.legTime = wp.holdTime;
                // wp.groundSpeed should theoretically be 0 or irrelevant
            } else {
                // Normal Leg: Time = Dist / GS (Hours) * 60 = Minutes
                // Guard against GS=0
                const speed = wp.groundSpeed || 1;
                const exactTime = (wp.distance / speed) * 60;
                // Round to nearest second (1/60th of a minute) for "Paper Math" consistency
                wp.legTime = Math.round(exactTime * 60) / 60;
            }

            totalMinutes += wp.legTime;
            wp.totalTime = totalMinutes;
        }

        // 2. Fuel Remaining (Forward)
        // Fuel Remaining at a waypoint is the fuel arriving at that waypoint? 
        // Or fuel departing? Usually "Fuel Remaining" is at that point.
        // WP0 (Start) = Start Fuel. 
        // WP1 = Start Fuel - Burn(Leg 1).

        if (i === 0) {
            wp.fuelRem = currentFuel;
        } else {
            // Burn for this leg (arriving at i)
            // Use burn rate of current waypoint (destination of leg) or global
            const burnRate = wp.fuelBurnRate || globalFuelFlow;
            const legBurn = (wp.legTime || 0) * burnRate;
            // Round leg burn to nearest integer for consistency with "Fuel Rem" display
            const roundedBurn = Math.round(legBurn);
            currentFuel -= roundedBurn;
            wp.fuelRem = currentFuel;
        }
    }

    // Reverse Pass: Bingo (Fuel Required) & Fuel Remaining
    // Logic: Last WP Bingo = Reserve.
    // Prev WP Bingo = Bingo(Next) + Burn(Next Leg)

    // 1. Calculate Bingo values backwards
    // The user said: "Count UP from the second last waypoint".
    // Which effectively means Recalculate Backwards from Destination.

    // Set Destination Bingo
    computed[computed.length - 1].bingo = Math.round(reserveFuel);

    for (let i = computed.length - 2; i >= 0; i--) {
        // Burn for the leg FROM i TO i+1
        // Leg time is stored in i+1
        const nextWp = computed[i + 1];
        const legBurnRate = nextWp.fuelBurnRate || globalFuelFlow;
        const legBurn = (nextWp.legTime || 0) * legBurnRate;
        const roundedBurn = Math.round(legBurn);

        const nextBingo = nextWp.bingo || reserveFuel;
        computed[i].bingo = Math.round(nextBingo + roundedBurn);
    }

    return computed;
};
