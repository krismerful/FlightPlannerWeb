# Flight Planner User Guide

Welcome to the Flight Planner! This guide will help you get started with planning your flights, managing waypoints, and working with custom maps.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating a Flight Plan](#creating-a-flight-plan)
3. [Working with Waypoints](#working-with-waypoints)
4. [Using Custom Maps](#using-custom-maps)
5. [Exporting Your Flight Plan](#exporting-your-flight-plan)
6. [Saving and Loading Plans](#saving-and-loading-plans)

---

## Getting Started

When you launch Flight Planner, you'll see two main sections:

- **Left Panel (60%)**: Interactive map showing your flight route
- **Right Panel (40%)**: Flight plan data table with detailed waypoint information

The application starts with a sample flight plan that you can modify or replace with your own.

---

## Creating a Flight Plan

### Adding Waypoints

There are several ways to add waypoints to your flight plan:

1. **Click on the Map**: Simply click anywhere on the map to add a new waypoint at that location
2. **Manual Entry**: Click the **+ Add Waypoint** button below the flight table to manually enter coordinates
3. **Insert Between Waypoints**: Click on a flight path line segment to insert a waypoint at that position

### Editing Waypoint Details

The flight table on the right shows all your waypoint information. You can edit the following fields by clicking on them:

- **Name**: Custom waypoint identifier
- **Latitude/Longitude**: Coordinates in decimal degrees (e.g., `1.3521` or DMS format `1°21'7.56"N`)
- **Altitude**: Height in feet
- **Ground Speed**: Speed in knots (affects time calculations)
- **Time**: Flight time to reach this waypoint (edits will adjust ground speed automatically)

### Calculated Fields

The following fields are automatically calculated:

- **Distance**: Distance from previous waypoint (nautical miles)
- **Fuel Used**: Fuel consumed on this leg (based on fuel flow rate)
- **Remaining Fuel**: Fuel remaining after this waypoint
- **Bingo Fuel**: Required fuel (reserve + fuel needed to complete mission)
- **Total Time**: Cumulative flight time from start

### Configuring Fuel Settings

At the top of the flight table, you can configure:

- **Global Fuel Flow**: Default fuel consumption rate (lbs/min)
- **Start Fuel**: Total fuel at mission start (lbs)
- **Reserve Fuel**: Minimum fuel reserve (lbs)

> **Tip**: You can also edit the **Bingo** value for any waypoint to adjust the reserve fuel calculation for the entire mission.

---

## Working with Waypoints

### Selecting Waypoints

- **Single Select**: Click the checkbox next to a waypoint
- **Multi-Select**: Hold `Ctrl` (or `Cmd` on Mac) and click multiple checkboxes

### Waypoint Operations

- **Delete**: Click the trash icon (🗑️) next to a waypoint
- **Duplicate**: Click the copy icon to create a duplicate waypoint immediately after the current one
- **Drag and Drop**: Click and drag waypoints on the map to reposition them
- **Batch Edit**: Select multiple waypoints and use the batch edit controls to update altitude or ground speed for all selected waypoints at once

### Advanced: Duplicate to End

Select one or more waypoints and use the **Duplicate to End** feature to:
- Copy selected waypoints to the end of your flight plan
- Optionally reverse the order (useful for creating reciprocal routes)

---

## Using Custom Maps

Flight Planner supports custom map layers in **XYZ tile format**. This allows you to use aviation charts, topographic maps, or any other georeferenced imagery.

### Loading Custom Maps

1. Click the **Manage Maps** button on the map interface
2. Click **Import Tiles** to select a tile directory
3. Select your converted tile folder (must be in XYZ format)
4. Click **Load** to display the map on your flight planner

Your imported maps will be saved and available for future use.

### Converting Maps to XYZ Tile Format

> **IMPORTANT**: Custom maps must be converted to XYZ tile format before importing into Flight Planner.

Flight Planner requires maps in **XYZ tile directory format** (also known as slippy map tiles). If you have a GeoTIFF or other map format, you'll need to convert it first.

#### Conversion Process

The recommended tool for conversion is **GDAL** (Geospatial Data Abstraction Library). Here's a basic conversion command:

```bash
gdal2tiles.py -z 10-18 input.tif output_tiles/
```

**Parameters:**
- `-z 10-18`: Zoom levels to generate (adjust based on your needs)
- `input.tif`: Your source GeoTIFF file
- `output_tiles/`: Output directory name

#### Recommended Zoom Levels

Choose zoom levels based on your coverage area:

- **Large regions** (country-level): `-z 5-12`
- **Medium areas** (city-level): `-z 10-15`
- **Small areas** (neighborhood): `-z 13-18`
- **Detailed charts**: `-z 15-20`

> **Note**: Higher zoom levels create more tiles and larger file sizes. Start conservative and add more zoom levels if needed.

#### Need Help with Conversion?

**If you need assistance converting your maps to XYZ tile format, please contact Snap (@krismerful on Telegram).**

### Expected Tile Directory Structure

After conversion, your tile directory should look like this:

```
output_tiles/
├── 10/
│   └── {x}/
│       └── {y}.png
├── 11/
│   └── {x}/
│       └── {y}.png
...
└── 18/
    └── {x}/
        └── {y}.png
```

---

## Exporting Your Flight Plan

Flight Planner supports multiple export formats to integrate with different systems:

### Export Formats

Click the export buttons in the top-right corner of the map:

- **Export PPTX**: Creates a PowerPoint presentation with navigation log (15 waypoints per slide, in the NEXUS format)
- **Export KML**: Google Earth compatible format for visualization
- **Export SD**: Custom format for SD card systems
- **Export F**: Flight-specific format

Each export includes all waypoint data, route information, and fuel calculations.

---

## Saving and Loading Plans

### Save Your Flight Plan

Click the **Save Plan** button to download your flight plan as a JSON file. This file contains:
- All waypoints with coordinates and settings
- Fuel configuration
- Mission title and metadata

The file will be named `mission-YYYY-MM-DD.json` based on the current date.

### Load a Saved Plan

Click the **Open Plan** button and select a previously saved `.json` file. This will:
- Replace your current flight plan
- Restore all waypoints and settings
- Recalculate all flight data

> **Tip**: Save your flight plans regularly, especially before making major changes!

---

## Tips and Best Practices

### Map Usage

- **Layer your maps**: You can switch between different map layers (e.g., terrain vs. aviation charts) using the Map Manager
- **Zoom appropriately**: Use higher zoom levels for detailed planning, lower for overview
- **Test your maps**: After importing, verify that the map aligns correctly with the base layer

### Performance

- **Limit waypoints**: For best performance, keep flight plans under 100 waypoints
- **Optimize map tiles**: Only import the zoom levels you actually need
- **Save frequently**: Use the Save Plan feature to avoid losing work

---

## Troubleshooting

### Maps Not Displaying

- Verify your tile directory has the correct structure (zoom/x/y.png)
- Check that tiles are in PNG or JPEG format
- Ensure the map has proper georeferencing (WGS84 or Web Mercator)

### Calculations Seem Wrong

- Verify your fuel flow rate is in lbs/min
- Check that ground speeds are in knots
- Ensure altitudes are in feet
- Confirm coordinates are in decimal degrees

### Need More Help?

For map conversion assistance or technical support, contact:

**Snap** - @krismerful on Telegram

---

## Keyboard Shortcuts

- **Ctrl/Cmd + Click**: Multi-select waypoints
- **Delete**: Remove selected waypoint (when row is focused)
- **Enter**: Confirm cell edit
- **Escape**: Cancel cell edit

---

Happy flight planning! ✈️
# FlightPlannerWeb
