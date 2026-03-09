import { TileLayer } from 'react-leaflet';

interface LocalTileLayerProps {
    folderPath: string; // "file:///path/to/tiles"
    name?: string;
}

const LocalTileLayer = ({ folderPath }: LocalTileLayerProps) => {
    // We assume the user provides a path that ends in a folder containing /{z}/{x}/{y}.png
    // Example path: "file:///C:/Users/Zach/Desktop/MyMapTiles"
    // TileLayer URL format: "{path}/{z}/{x}/{y}.png"

    // Ensure the path doesn't end in a slash, then append the ZXY pattern
    const cleanPath = folderPath.replace(/\/$/, '');
    const url = `${cleanPath}/{z}/{x}/{y}.png`;

    return (
        <TileLayer
            url={url}
            tms={false} // gdal2tiles standard is XYZ (tms=false), but check if your tool outputs TMS.
            // gdal2tiles.py usually outputs XYZ (Google Maps compatible) by default now.
            // If creating TMS tiles (OSGeo standard), set tms={true}.
            opacity={1.0}
            attribution="Local Tiles"
        />
    );
};

export default LocalTileLayer;
