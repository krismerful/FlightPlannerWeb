---
description: How to convert GeoTIFF files to XYZ tiles
---

# Converting GeoTIFF to XYZ Tiles

This workflow explains how to convert GeoTIFF map files into XYZ tile directories for use in the Flight Planner application.

## Prerequisites

- GDAL tools installed on your system
- GeoTIFF file(s) to convert

### Installing GDAL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install gdal-bin
```

**macOS:**
```bash
brew install gdal
```

**Windows:**
Download from https://gdal.org/download.html or use OSGeo4W installer

## Converting GeoTIFF to Tiles

### Basic Conversion

```bash
gdal2tiles.py -z 10-18 input.tif output_tiles/
```

**Parameters:**
- `-z 10-18`: Generate tiles for zoom levels 10 through 18
- `input.tif`: Your source GeoTIFF file
- `output_tiles/`: Output directory name

### Recommended Zoom Levels

Choose zoom levels based on your map coverage area:

- **Large regions** (country-level): `-z 5-12`
- **Medium areas** (city-level): `-z 10-15`
- **Small areas** (neighborhood): `-z 13-18`
- **Detailed charts**: `-z 15-20`

**Tip**: Higher zoom levels = more tiles = larger file size. Start conservative and add more zoom levels if needed.

### Advanced Options

**Specify projection (Web Mercator):**
```bash
gdal2tiles.py -z 10-18 -p mercator input.tif output_tiles/
```

**Set tile format (PNG or JPEG):**
```bash
# PNG (default, supports transparency)
gdal2tiles.py -z 10-18 input.tif output_tiles/

# JPEG (smaller file size, no transparency)
gdal2tiles.py -z 10-18 --tiledriver=JPEG input.tif output_tiles/
```

**Add resampling method:**
```bash
# For aerial imagery
gdal2tiles.py -z 10-18 -r average input.tif output_tiles/

# For charts/maps with sharp lines
gdal2tiles.py -z 10-18 -r near input.tif output_tiles/
```

## Importing into Flight Planner

1. **Launch Flight Planner**
2. **Click "Manage Maps"** button on the map
3. **Click "Import Tiles"**
4. **Select the tile directory** (e.g., `output_tiles/`)
5. **Click "Load"** to display on the map

The tiles will be copied to your application's data directory and available for future use.

## Directory Structure

After conversion, your tile directory will look like:

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

## Tips

### File Size Optimization

- **Limit zoom levels**: Only generate the zoom levels you actually need
- **Use JPEG for photos**: Aerial imagery compresses better as JPEG
- **Use PNG for charts**: Line art and text need PNG's lossless compression

### Performance

- **Conversion time**: Large GeoTIFFs can take 10-30 minutes to process
- **Disk space**: A 400MB GeoTIFF might produce 100-300MB of tiles depending on zoom range
- **Memory**: GDAL may use several GB of RAM for large files

### Troubleshooting

**"ERROR: Input file has no georeferencing"**
- Your GeoTIFF needs coordinate system information
- Use `gdalinfo input.tif` to check if it has projection data

**Tiles appear in wrong location**
- Verify the GeoTIFF uses WGS84 or Web Mercator projection
- Reproject if needed: `gdalwarp -t_srs EPSG:3857 input.tif reprojected.tif`

**Conversion is very slow**
- Reduce the zoom level range
- Use `-r near` for faster (but lower quality) resampling
- Process smaller regions at a time

## Example: Singapore Aviation Chart

```bash
# Convert a Singapore aviation chart with appropriate zoom levels
gdal2tiles.py -z 13-17 -p mercator -r average singapore_chart.tif singapore_tiles/
```

This creates tiles suitable for viewing Singapore at city and neighborhood scales.
