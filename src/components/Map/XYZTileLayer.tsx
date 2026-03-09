import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import localforage from 'localforage';

interface XYZTileLayerProps {
    tileUrl: string; // can be indexeddb://MapName/{z}/{x}/{y} or standard http/file url
}

// Create a custom Leaflet GridLayer for IndexedDB
const IndexedDBTileLayer = L.GridLayer.extend({
    createTile: function (coords: L.Coords, done: (error: any, tile: HTMLImageElement) => void) {
        const tile = document.createElement('img');

        // Handle transparency mapping
        tile.onerror = () => {
            tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        };

        const storeName = this.options.storeName;
        // Invert Y if needed, assuming tms=false for standard XYZ
        const key = `${coords.z}/${coords.x}/${coords.y}`;

        const store = localforage.createInstance({
            name: 'FlightPlanner_Tiles',
            storeName: storeName
        });

        store.getItem<Blob>(key).then((blob: Blob | null) => {
            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                tile.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    done(null, tile);
                };
                tile.src = objectUrl;
            } else {
                tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                done(null, tile);
            }
        }).catch((err) => {
            console.error("Error loading tile", err);
            tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            done(err, tile);
        });

        return tile;
    }
});

const CustomIndexedDBLayer = ({ storeName }: { storeName: string }) => {
    const map = useMap();

    useEffect(() => {
        // @ts-ignore - Custom options defined in extend not recognized by Leaflet's base GridLayer types
        const layer = new IndexedDBTileLayer({
            storeName,
            minZoom: 10,
            maxZoom: 15,
            opacity: 0.7,
            noWrap: true
        });

        layer.addTo(map);

        return () => {
            layer.remove();
        };
    }, [map, storeName]);

    return null;
};

const XYZTileLayer = ({ tileUrl }: XYZTileLayerProps) => {
    // Check if it's our custom indexeddb protocol
    if (tileUrl.startsWith('indexeddb://')) {
        // Extract the store name (which is the map name)
        // Format: indexeddb://MapName/{z}/{x}/{y}
        const storeName = tileUrl.replace('indexeddb://', '').split('/')[0];

        return <CustomIndexedDBLayer storeName={storeName} />;
    }

    // Fallback to standard TileLayer for web URLs or backwards compatibility
    return (
        <TileLayer
            url={tileUrl}
            opacity={0.7}
            attribution="Map Data"
            minZoom={10}
            maxZoom={15}
            noWrap={true}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />
    );
};

export default XYZTileLayer;
