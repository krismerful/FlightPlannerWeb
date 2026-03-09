import { create } from 'zustand';
import { MissionData, Waypoint } from '../types';
import { calculateLegs } from '../utils/geo';

interface FlightStore extends MissionData {
    addWaypoint: (wp: Waypoint) => void;
    updateWaypoint: (id: string, updates: Partial<Waypoint>) => void;
    removeWaypoint: (id: string) => void;
    setGlobalFuelFlow: (flow: number) => void;
    updateStartFuel: (fuel: number) => void;
    duplicateWaypoint: (id: string) => void;
    duplicateWaypointsToEnd: (ids: string[], reverse?: boolean) => void;
    updateWaypointTime: (id: string, minutes: number) => void;
    updateWaypoints: (ids: string[], updates: Partial<Waypoint>) => void;
    insertWaypoint: (index: number, wp: Waypoint) => void;
    loadMission: (mission: MissionData) => void;
    updateReserveFuelByBingo: (waypointId: string, newBingo: number) => void;
    reorderWaypoints: (oldIndex: number, newIndex: number) => void;
    undo: () => void;
    redo: () => void;
    // Internal History
    past: MissionData[];
    future: MissionData[];
}

// Initial Mock Data
const INITIAL_WAYPOINTS: Waypoint[] = [
    { id: '1', name: 'START', lat: 1.3521, lng: 103.8198, altitude: 200, groundSpeed: 90, fuelBurnRate: undefined },
    { id: '2', name: 'WPT A', lat: 1.45, lng: 104.0, altitude: 500, groundSpeed: 90, fuelBurnRate: undefined },
];

import { getReferenceWaypoints } from '../utils/referenceWaypoints';

export const useFlightStore = create<FlightStore>((set, get) => ({
    title: 'New Mission',
    globalFuelFlow: 42.5, // lbs/min default
    reserveFuel: 2600, // lbs default
    startFuel: 0,
    waypoints: calculateLegs(INITIAL_WAYPOINTS, 42.5, 2600, 0),
    past: [],
    future: [],

    undo: () => {
        const { past, future, title, globalFuelFlow, reserveFuel, startFuel, waypoints } = get();
        if (past.length === 0) return;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        set({
            past: newPast,
            future: [{ title, globalFuelFlow, reserveFuel, startFuel, waypoints }, ...future],
            title: previous.title,
            globalFuelFlow: previous.globalFuelFlow,
            reserveFuel: previous.reserveFuel,
            startFuel: previous.startFuel,
            waypoints: previous.waypoints
        });
    },

    redo: () => {
        const { past, future, title, globalFuelFlow, reserveFuel, startFuel, waypoints } = get();
        if (future.length === 0) return;

        const next = future[0];
        const newFuture = future.slice(1);

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: newFuture,
            title: next.title,
            globalFuelFlow: next.globalFuelFlow,
            reserveFuel: next.reserveFuel,
            startFuel: next.startFuel,
            waypoints: next.waypoints
        });
    },

    // Helper to save history before mutation
    // We can't expose a helper easily in the object literal without 'this' issues or just repeating code.
    // Repeating code for now is safer/simpler than middleware refactor.

    addWaypoint: (wp) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [], // Clear future on new action
            waypoints: calculateLegs([...waypoints, wp], globalFuelFlow, reserveFuel, startFuel)
        });
    },

    updateWaypoint: (id, updates) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(waypoints.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)), globalFuelFlow, reserveFuel, startFuel)
        });
    },

    removeWaypoint: (id) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(waypoints.filter((w) => w.id !== id), globalFuelFlow, reserveFuel, startFuel)
        });
    },

    setGlobalFuelFlow: (flow) => {
        const { waypoints, reserveFuel, startFuel, past, title, globalFuelFlow } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            globalFuelFlow: flow,
            waypoints: calculateLegs(waypoints, flow, reserveFuel, startFuel)
        });
    },

    updateStartFuel: (fuel) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            startFuel: fuel,
            waypoints: calculateLegs(waypoints, globalFuelFlow, reserveFuel, fuel)
        });
    },

    insertWaypoint: (index: number, wp: Waypoint) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        const newWaypoints = [...waypoints];
        newWaypoints.splice(index, 0, wp);

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(newWaypoints, globalFuelFlow, reserveFuel, startFuel)
        });
    },

    loadMission: (mission: MissionData) => {
        const { past, title, globalFuelFlow, reserveFuel, startFuel, waypoints } = get();

        // Deduplicate / Sanitize Logic
        const { flaWaypoints, standardWaypoints } = getReferenceWaypoints();
        // Create Map: Label -> Fixed Waypoint
        const fixedMap = new Map<string, { lat: number, lon: number }>();
        [...flaWaypoints, ...standardWaypoints].forEach(w => fixedMap.set(w.label, w));

        const sanitizedWaypoints = mission.waypoints.map(wp => {
            const fixed = fixedMap.get(wp.name);
            if (fixed) {
                // Return copy with fixed coordinates to ensure exact match
                // We keep the ID from the mission file (or should we regenerate it?)
                // If the mission file has duplicates, they might have same ID?
                // Usually mission.json is a list, so objects are distinct.
                return {
                    ...wp,
                    lat: fixed.lat,
                    lng: fixed.lon
                };
            }
            return wp;
        });

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            ...mission,
            waypoints: calculateLegs(sanitizedWaypoints, mission.globalFuelFlow, mission.reserveFuel, mission.startFuel || 0)
        });
    },

    duplicateWaypoint: (id) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        const index = waypoints.findIndex((wp) => wp.id === id);
        if (index === -1) return;

        const wpToCopy = waypoints[index];
        const newWp: Waypoint = {
            ...wpToCopy,
            id: crypto.randomUUID(),
            name: `${wpToCopy.name} (Copy)`,
        };

        const newWaypoints = [...waypoints];
        newWaypoints.splice(index + 1, 0, newWp);

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(newWaypoints, globalFuelFlow, reserveFuel, startFuel)
        });
    },

    duplicateWaypointsToEnd: (ids, reverse = false) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        const selected = waypoints.filter(w => ids.includes(w.id));
        if (selected.length === 0) return;

        let toAdd = selected.map(w => ({
            ...w,
            id: crypto.randomUUID(),
            name: w.name
        }));

        if (reverse) {
            toAdd.reverse();
        }

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs([...waypoints, ...toAdd], globalFuelFlow, reserveFuel, startFuel)
        });
    },

    updateWaypointTime: (id, minutes) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();

        // Logic copy from original
        const wp = waypoints.find((w) => w.id === id);
        if (!wp) return;
        if (minutes <= 0) return;

        let newWaypoints;
        if (!wp.distance || wp.distance < 0.05) {
            newWaypoints = waypoints.map((w) => (w.id === id ? { ...w, holdTime: minutes, groundSpeed: 0 } : w));
        } else {
            const rawGS = (wp.distance / minutes) * 60;
            const newGS = Math.round(rawGS);
            newWaypoints = waypoints.map((w) => (w.id === id ? { ...w, groundSpeed: newGS, holdTime: undefined } : w));
        }

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(newWaypoints, globalFuelFlow, reserveFuel, startFuel)
        });
    },

    updateReserveFuelByBingo: (waypointId: string, newBingo: number) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        const wp = waypoints.find(w => w.id === waypointId);
        if (!wp || wp.bingo === undefined) return;

        const diff = newBingo - wp.bingo;
        const newReserve = reserveFuel + diff;

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            reserveFuel: newReserve,
            waypoints: calculateLegs(waypoints, globalFuelFlow, newReserve, startFuel)
        });
    },

    updateWaypoints: (ids, updates) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(waypoints.map((wp) => (ids.includes(wp.id) ? { ...wp, ...updates } : wp)), globalFuelFlow, reserveFuel, startFuel)
        });
    },

    reorderWaypoints: (oldIndex: number, newIndex: number) => {
        const { waypoints, globalFuelFlow, reserveFuel, startFuel, past, title } = get();
        const newWaypoints = [...waypoints];
        const [removed] = newWaypoints.splice(oldIndex, 1);
        newWaypoints.splice(newIndex, 0, removed);

        set({
            past: [...past, { title, globalFuelFlow, reserveFuel, startFuel, waypoints }],
            future: [],
            waypoints: calculateLegs(newWaypoints, globalFuelFlow, reserveFuel, startFuel)
        });
    }
}));
