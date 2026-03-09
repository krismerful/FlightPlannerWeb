import { MissionData } from '../../types';
import { deduplicateWaypoints, formatConflictError } from './deduplication-utils';
import { getReferenceWaypoints } from '../referenceWaypoints';

// Helper to convert string to SHA-256 hex string with hyphens
async function sha256(message: string): Promise<string> {
    // In a browser environment, use crypto.subtle
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Format: 8-8-8-8-8-8-8-8 Uppercase
    // The reference SHA seems to be grouped by 8 chars and joined by hyphens.
    // Length of SHA256 hex is 64 chars.
    // 64 / 8 = 8 groups.

    const groups = hashHex.match(/.{1,8}/g);
    if (!groups) return hashHex.toUpperCase();
    return groups.join('-').toUpperCase();
}


// Helper to generate a UUID v4
function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (
            +c ^ // cast string to number
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
        ).toString(16)
    );
}

const flightPlansHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns21:FlightPlans xmlns:ns2="ExpandingSquaresData" xmlns:ns3="SDRChannelDescriptorData" xmlns:ns4="ThreatCharacteristicsData" xmlns:ns5="TacticalPresetsData" xmlns:ns6="TacticalApproachesData" xmlns:ns7="PLSQDEncryptionsData" xmlns:ns8="TacticalHoversData" xmlns:ns9="ArrivalsData" xmlns:ns10="ImpromptusData" xmlns:ns11="NavPresetsData" xmlns:ns12="DeparturesData" xmlns:ns13="SymbolsData" xmlns:ns14="EnroutesData" xmlns:ns15="CommonTypes" xmlns:ns16="http://titanium.dstc.edu.au/xml/xs3p" xmlns:ns17="LaddersData" xmlns:ns18="PLSRadiosData" xmlns:ns19="SectorsData" xmlns:ns20="CirclesData" xmlns:ns21="FlightPlansData" xmlns:ns22="CivilPresetsData" xmlns:ns23="PLSDFHomingsData" xmlns:ns24="PLSSurvivorsData" xmlns:ns25="HoldPatternsData">`;

const flightPlansFooter = `
</ns21:FlightPlans>`;

const symbolsHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns13:Symbols xmlns:ns2="ExpandingSquaresData" xmlns:ns3="SDRChannelDescriptorData" xmlns:ns4="ThreatCharacteristicsData" xmlns:ns5="TacticalPresetsData" xmlns:ns6="TacticalApproachesData" xmlns:ns7="PLSQDEncryptionsData" xmlns:ns8="TacticalHoversData" xmlns:ns9="ArrivalsData" xmlns:ns10="ImpromptusData" xmlns:ns11="NavPresetsData" xmlns:ns12="DeparturesData" xmlns:ns13="SymbolsData" xmlns:ns14="EnroutesData" xmlns:ns15="CommonTypes" xmlns:ns16="http://titanium.dstc.edu.au/xml/xs3p" xmlns:ns17="LaddersData" xmlns:ns18="PLSRadiosData" xmlns:ns19="SectorsData" xmlns:ns20="CirclesData" xmlns:ns21="FlightPlansData" xmlns:ns22="CivilPresetsData" xmlns:ns23="PLSDFHomingsData" xmlns:ns24="PLSSurvivorsData" xmlns:ns25="HoldPatternsData">`;

const symbolsFooter = `
</ns13:Symbols>`;


export const generateFlightPlansXML = async (mission: MissionData) => {
    // First, check for coordinate conflicts
    const deduplicationResult = deduplicateWaypoints(mission.waypoints);

    if (deduplicationResult.conflicts.length > 0) {
        throw new Error(formatConflictError(deduplicationResult.conflicts));
    }

    let xml = flightPlansHeader;

    const uid = uuidv4();

    xml += `
    <ns21:FlightPlan>
        <ns21:UID>${uid}</ns21:UID>
        <ns21:Label>${mission.title}</ns21:Label>
        <ns21:NavType>VFR</ns21:NavType>`;

    // Create Map: Label -> Fixed UID
    const { flaWaypoints, standardWaypoints } = getReferenceWaypoints();
    const fixedMap = new Map<string, string>();
    [...flaWaypoints, ...standardWaypoints].forEach(w => fixedMap.set(w.label, w.uid));

    // Generate UIDs for deduplicated waypoints: Use Fixed UID if available, else new random UUID
    const waypointUIDs = deduplicationResult.uniqueWaypoints.map(wp => {
        const fixedUid = fixedMap.get(wp.name);
        return fixedUid || uuidv4();
    });

    // For each waypoint in the original mission, reference the deduplicated UID
    mission.waypoints.forEach((wp, index) => {
        const deduplicatedIndex = deduplicationResult.indexMapping.get(index)!;
        const hId = waypointUIDs[deduplicatedIndex];

        xml += `
        <ns21:Locations>
            <ns15:Location>
                <ns15:GRAPHICS_UID>
                    <ns15:UID>${hId}</ns15:UID>
                </ns15:GRAPHICS_UID>
            </ns15:Location>
            <ns15:LegData>
                <ns15:MSL>${(wp.altitude * 0.3048).toFixed(2)}</ns15:MSL>
                <ns15:LegType>TF_TRACK_TO_FIX</ns15:LegType>`;

        if (wp.legTime && wp.legTime > 0) {
            // legTime is in minutes, convert to seconds for ETE
            xml += `
                <ns15:ETE>${Math.round(wp.legTime * 60)}</ns15:ETE>`;
        } else {
            xml += `
                <ns15:Speed>${(wp.groundSpeed || 100).toFixed(1)}</ns15:Speed>
                <ns15:GroundSpeed>false</ns15:GroundSpeed>`;
        }

        xml += `
                <ns15:RouteMaintain>none</ns15:RouteMaintain>
            </ns15:LegData>
        </ns21:Locations>`;
    });

    xml += `
    </ns21:FlightPlan>`;
    xml += flightPlansFooter;

    const hash = await sha256(xml);
    return { xml, hash, waypointUIDs };
};

export const generateSymbolsXML = async (mission: MissionData, waypointUIDs: string[], existingXML?: string) => {
    // Deduplicate waypoints (should already be validated by generateFlightPlansXML, but check again)
    const deduplicationResult = deduplicateWaypoints(mission.waypoints);

    if (deduplicationResult.conflicts.length > 0) {
        throw new Error(formatConflictError(deduplicationResult.conflicts));
    }

    let content = '';

    // Import reference waypoints
    const { flaWaypoints, standardWaypoints } = getReferenceWaypoints();
    const allReferenceWaypoints = [...standardWaypoints, ...flaWaypoints];

    const now = new Date().toISOString();

    const createSymbolXML = (uid: string, label: string, type: string, lat: number, lon: number) => {
        return `
    <ns13:Symbol>
        <ns13:UID>${uid}</ns13:UID>
        <ns13:Label>${label}</ns13:Label>
        <ns13:AopPointType>${type}</ns13:AopPointType>
        <ns13:MinAltitude>0.0</ns13:MinAltitude>
        <ns13:MaxAltitude>0.0</ns13:MaxAltitude>
        <ns13:DateTime1>${now}</ns13:DateTime1>
        <ns13:DateTime2>${now}</ns13:DateTime2>
        <ns13:Echelon>NONE</ns13:Echelon>
        <ns13:Airspace>0</ns13:Airspace>
        <ns13:Locations>
            <ns15:Lat>${lat}</ns15:Lat>
            <ns15:Lon>${lon}</ns15:Lon>
            <ns15:Ground>0.0</ns15:Ground>
        </ns13:Locations>
    </ns13:Symbol>`;
    };

    // Add reference symbols first
    allReferenceWaypoints.forEach(wp => {
        content += createSymbolXML(wp.uid, wp.label, wp.type, wp.lat, wp.lon);
    });

    // Only create symbols for unique waypoints
    deduplicationResult.uniqueWaypoints.forEach((wp, index) => {
        const uid = waypointUIDs[index]; // MUST match the FlightPlan
        // If it's a fixed waypoint (matches name in reference list), do NOT create a new symbol definition
        // primarily because the F-Model database already has it, and defining it again causes conflict.
        // We assume name uniqueness is the key here.
        const isFixed = [...flaWaypoints, ...standardWaypoints].some(fw => fw.label === wp.name);
        if (isFixed) return;

        content += createSymbolXML(uid, wp.name, 'PointType.ACPUser', wp.lat, wp.lng);
    });

    let finalXml = '';
    if (existingXML) {
        // Find the closing tag
        const closingTag = '</ns13:Symbols>';
        const parts = existingXML.split(closingTag);
        if (parts.length >= 1) {
            finalXml = parts[0] + content + closingTag;
        } else {
            // Fallback
            finalXml = symbolsHeader + content + symbolsFooter;
        }
    } else {
        finalXml = symbolsHeader + content + symbolsFooter;
    }

    const hash = await sha256(finalXml);
    return { xml: finalXml, hash };
};
