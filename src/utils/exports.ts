import PptxGenJS from 'pptxgenjs';
import { MissionData } from '../types';
import { formatCoordinate } from './geo';
import { exportToAFP, exportToWPT } from './exporters/sd-exporter';
import { generateFlightPlansXML, generateSymbolsXML } from './exporters/f-exporter';

// Let's stick to simple downloads for now, or check if jszip is available.

export const downloadFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToKML = (mission: MissionData) => {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${mission.title}</name>
    <StyleMap id="waypointStyleMap">
      <Pair>
        <key>normal</key>
        <styleUrl>#waypointStyleNormal</styleUrl>
      </Pair>
      <Pair>
        <key>highlight</key>
        <styleUrl>#waypointStyleHighlight</styleUrl>
      </Pair>
    </StyleMap>
    <Style id="waypointStyleNormal">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ff00ff00</color>
      </LabelStyle>
    </Style>
    <Style id="waypointStyleHighlight">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.4</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ff00ff00</color>
      </LabelStyle>
    </Style>
    <Style id="routeStyle">
      <LineStyle>
        <color>ff00ff00</color>
        <width>4</width>
      </LineStyle>
    </Style>`;

  const kmlFooter = `
  </Document>
</kml>`;

  let placemarks = '';
  const coords: string[] = [];

  mission.waypoints.forEach((wp) => {
    coords.push(`${wp.lng},${wp.lat},${wp.altitude * 0.3048}`); // KML uses meters

    placemarks += `
    <Placemark>
      <name>${wp.name}</name>
      <description>Alt: ${wp.altitude} ft</description>
      <styleUrl>#waypointStyleMap</styleUrl>
      <Point>
        <coordinates>${wp.lng},${wp.lat},${wp.altitude * 0.3048}</coordinates>
      </Point>
    </Placemark>`;
  });

  const route = `
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
          ${coords.join('\n          ')}
        </coordinates>
      </LineString>
    </Placemark>`;

  const kmlContent = kmlHeader + placemarks + route + kmlFooter;
  downloadFile(`${mission.title.replace(/\s+/g, '_')}.kml`, kmlContent, 'application/vnd.google-earth.kml+xml');
};

export const exportToPPTX = async (mission: MissionData) => {
  const pres = new PptxGenJS();

  // Define A4 Portrait layout (8.27 x 11.69 inches)
  pres.defineLayout({ name: 'A4', width: 8.27, height: 11.69 });
  pres.layout = 'A4';

  const waypoints = mission.waypoints;
  const WAYPOINTS_PER_TABLE = 5;
  const TABLES_PER_PAGE = 3;
  const WAYPOINTS_PER_PAGE = WAYPOINTS_PER_TABLE * TABLES_PER_PAGE;

  // Helper to format time as HH:MM:SS
  const formatTime = (minutes: number | undefined): string => {
    if (!minutes) return '-';
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  let slide: PptxGenJS.Slide | undefined;

  // Process waypoints in chunks of "WAYPOINTS_PER_TABLE" (5), but managing slides every 3 chunks
  for (let i = 0; i < waypoints.length; i += WAYPOINTS_PER_TABLE) {
    // Create a new slide every 15 waypoints (every 3 tables)
    if (i % WAYPOINTS_PER_PAGE === 0) {
      slide = pres.addSlide();
    }

    if (!slide) {
      // Should catch the first iteration, but safety check
      slide = pres.addSlide();
    }

    const waypointsInTable = waypoints.slice(i, i + WAYPOINTS_PER_TABLE);

    // Build table data
    const tableData: any[][] = [];

    // Header row styles
    const headerStyle = { bold: true, align: 'center' as const, fill: { color: 'D0D0D0' }, border: { pt: 1, color: '000000' }, fontSize: 11 };
    const labelStyle = { bold: true, align: 'left' as const, fill: { color: 'E0E0E0' }, border: { pt: 1, color: '000000' }, fontSize: 11 };
    const valueStyle = { align: 'center' as const, border: { pt: 1, color: '000000' }, fontSize: 11 };

    // Header row: WPT | 1 | 2 | 3 | 4 | 5
    const headerRow = [{ text: 'WPT', options: headerStyle }];
    for (let j = 0; j < WAYPOINTS_PER_TABLE; j++) {
      if (j < waypointsInTable.length) {
        headerRow.push({ text: (i + j + 1).toString(), options: headerStyle });
      } else {
        headerRow.push({ text: '', options: headerStyle });
      }
    }
    tableData.push(headerRow);

    // Row: FROM/TO
    const fromToRow: Array<{ text: string; options: any }> = [{ text: 'FROM/TO', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      fromToRow.push({ text: wp.name, options: valueStyle });
    });
    while (fromToRow.length < WAYPOINTS_PER_TABLE + 1) {
      fromToRow.push({ text: '', options: valueStyle });
    }
    tableData.push(fromToRow);

    // Row: LAT/LONG
    const latLongRow: Array<{ text: string; options: any }> = [{ text: 'LAT/LONG', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      latLongRow.push({
        text: `${formatCoordinate(wp.lat, true)}\n${formatCoordinate(wp.lng, false)}`,
        options: valueStyle
      });
    });
    while (latLongRow.length < WAYPOINTS_PER_TABLE + 1) {
      latLongRow.push({ text: '', options: valueStyle });
    }
    tableData.push(latLongRow);

    // Row: HDG
    const hdgRow: Array<{ text: string; options: any }> = [{ text: 'HDG', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      hdgRow.push({ text: wp.heading ? Math.round(wp.heading).toString() : '-', options: valueStyle });
    });
    while (hdgRow.length < WAYPOINTS_PER_TABLE + 1) {
      hdgRow.push({ text: '', options: valueStyle });
    }
    tableData.push(hdgRow);

    // Row: ALT
    const altRow: Array<{ text: string; options: any }> = [{ text: 'ALT', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      altRow.push({ text: wp.altitude.toString(), options: valueStyle });
    });
    while (altRow.length < WAYPOINTS_PER_TABLE + 1) {
      altRow.push({ text: '', options: valueStyle });
    }
    tableData.push(altRow);

    // Row: DIST
    const distRow: Array<{ text: string; options: any }> = [{ text: 'DIST', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      distRow.push({ text: wp.distance ? wp.distance.toFixed(1) : '0', options: valueStyle });
    });
    while (distRow.length < WAYPOINTS_PER_TABLE + 1) {
      distRow.push({ text: '', options: valueStyle });
    }
    tableData.push(distRow);

    // Row: TIME
    const timeRow: Array<{ text: string; options: any }> = [{ text: 'TIME', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      timeRow.push({ text: formatTime(wp.legTime), options: valueStyle });
    });
    while (timeRow.length < WAYPOINTS_PER_TABLE + 1) {
      timeRow.push({ text: '', options: valueStyle });
    }
    tableData.push(timeRow);

    // Row: REL ETA
    const relEtaRow: Array<{ text: string; options: any }> = [{ text: 'REL ETA', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      relEtaRow.push({ text: formatTime(wp.totalTime), options: valueStyle });
    });
    while (relEtaRow.length < WAYPOINTS_PER_TABLE + 1) {
      relEtaRow.push({ text: '', options: valueStyle });
    }
    tableData.push(relEtaRow);

    // Row: FUEL REM'G
    const fuelRemRow: Array<{ text: string; options: any }> = [{ text: "FUEL REM'G", options: labelStyle }];
    waypointsInTable.forEach(wp => {
      fuelRemRow.push({ text: wp.fuelRem ? Math.round(wp.fuelRem).toLocaleString() : '-', options: valueStyle });
    });
    while (fuelRemRow.length < WAYPOINTS_PER_TABLE + 1) {
      fuelRemRow.push({ text: '', options: valueStyle });
    }
    tableData.push(fuelRemRow);

    // Row: FUEL REQ'D
    const fuelReqRow: Array<{ text: string; options: any }> = [{ text: "FUEL REQ'D", options: labelStyle }];
    waypointsInTable.forEach(wp => {
      fuelReqRow.push({ text: wp.bingo ? Math.round(wp.bingo).toLocaleString() : '-', options: valueStyle });
    });
    while (fuelReqRow.length < WAYPOINTS_PER_TABLE + 1) {
      fuelReqRow.push({ text: '', options: valueStyle });
    }
    tableData.push(fuelReqRow);

    // Row: FUEL BURN (calculated from fuel remaining difference)
    const fuelBurnRow: Array<{ text: string; options: any }> = [{ text: 'FUEL BURN', options: labelStyle }];
    waypointsInTable.forEach((wp, idx) => {
      let burn = '-';
      const absIndex = i + idx;
      if (absIndex === 0) {
        burn = '0'; // First waypoint has no burn
      } else {
        const prevWp = waypoints[absIndex - 1];
        if (prevWp && wp.fuelRem !== undefined && prevWp.fuelRem !== undefined) {
          // Burn is diff between prev fuel rem and current fuel rem
          // Wait, Fuel REM at prev waypoint includes burn TO GET THERE? 
          // Usually Fuel Rem decreases. Burn for this leg = Prev.FuelRem - Curr.FuelRem
          burn = Math.round(prevWp.fuelRem - wp.fuelRem).toString();
        }
      }
      fuelBurnRow.push({ text: burn, options: valueStyle });
    });
    while (fuelBurnRow.length < WAYPOINTS_PER_TABLE + 1) {
      fuelBurnRow.push({ text: '', options: valueStyle });
    }
    tableData.push(fuelBurnRow);

    // Row: G/S
    const gsRow: Array<{ text: string; options: any }> = [{ text: 'G/S', options: labelStyle }];
    waypointsInTable.forEach(wp => {
      gsRow.push({ text: Math.round(wp.groundSpeed).toString(), options: valueStyle });
    });
    while (gsRow.length < WAYPOINTS_PER_TABLE + 1) {
      gsRow.push({ text: '', options: valueStyle });
    }
    tableData.push(gsRow);

    // Calculate position
    // i % WAYPOINTS_PER_PAGE gives offset within the page (0, 5, 10...)
    // Divided by WAYPOINTS_PER_TABLE (5) gives the table Index (0, 1, 2)
    const tableIndexOnSlide = (i % WAYPOINTS_PER_PAGE) / WAYPOINTS_PER_TABLE;
    const yPos = 0.5 + (tableIndexOnSlide * 3.7);

    // Add table to slide
    slide.addTable(tableData, {
      x: 0.3,
      y: yPos,
      w: 7.67, // Full width minus margins
      colW: [1.2, 1.29, 1.29, 1.29, 1.29, 1.29], // Label column wider, then equal columns
      fontSize: 9,
      fontFace: 'Arial'
    });
  }

  const blob = await pres.write({ outputType: 'blob' });
  if (blob instanceof Blob) {
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mission.title.replace(/\s+/g, '_')}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    console.error("Failed to generate PPTX blob");
  }
};

export const exportToSD = (mission: MissionData) => {
  try {
    const afpContent = exportToAFP(mission);
    const wptContent = exportToWPT(mission);

    downloadFile(`${mission.title.replace(/\s+/g, '_')}.afp`, afpContent, 'application/xml');
    downloadFile(`${mission.title.replace(/\s+/g, '_')}.wpt`, wptContent, 'application/xml');
  } catch (error: any) {
    alert(error.message || 'An error occurred during SD export.');
    console.error(error);
  }
};

export const exportToF = async (mission: MissionData, existingSymbolsXML?: string) => {
  try {
    const flightPlans = await generateFlightPlansXML(mission);
    downloadFile('FlightPlans.xml', flightPlans.xml, 'application/xml');
    downloadFile('FlightPlans.sha', flightPlans.hash, 'text/plain');

    const symbols = await generateSymbolsXML(mission, flightPlans.waypointUIDs, existingSymbolsXML);
    downloadFile('Symbols.xml', symbols.xml, 'application/xml');
    downloadFile('Symbols.sha', symbols.hash, 'text/plain');
  } catch (error: any) {
    alert(error.message || 'An error occurred during F format export.');
    console.error(error);
  }
};

