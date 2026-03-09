import { TileLayer } from 'react-leaflet';
import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import localforage from 'localforage';

interface XYZTileLayerProps {
    tileUrl: string; // can be indexeddb://MapName/{z}/{x}/{y} or standard http/file url
}

// Create a custom Leaflet GridLayer for IndexedDB
const IndexedDBTileLayer = L.GridLayer.extend({
    // @ts-ignore
    initialize: function (options: any) {
        // @ts-ignore
        L.GridLayer.prototype.initialize.call(this, options);
        this.store = localforage.createInstance({
            name: 'FlightPlanner_Tiles',
            storeName: options.storeName
        });
        console.log(`[XYZTileLayer] Ready for map: ${options.storeName}`);
    },
    createTile: function (coords: L.Coords, done: (error: any, tile: HTMLImageElement) => void) {
        const tile = document.createElement('img');

        // Handle transparency mapping
        tile.onerror = () => {
            tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        };

        const key = `${coords.z}/${coords.x}/${coords.y}`;
        // Possible fallback if user uploaded TMS (inverted Y) instead of XYZ
        const maxY = Math.pow(2, coords.z) - 1;
        const tmsKey = `${coords.z}/${coords.x}/${maxY - coords.y}`;

        const store = this.store;

        store.getItem(key).then((blob: Blob | null) => {
            if (blob) return blob;
            return store.getItem(tmsKey); // Fallback attempt
        }).then((blob: any) => {
            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                tile.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    done(null, tile);
                };
                tile.src = objectUrl;
            } else {
                console.log(`[XYZTileLayer] Missed tile: ${key}`);
                tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                done(null, tile);
            }
        }).catch((err: any) => {
            console.error("Error loading tile", err);
            tile.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            done(err, tile);
        });

        return tile;
    }
});

const createIndexedDBLayer = (props: { storeName: string }, context: any) => {
    const instance = new (IndexedDBTileLayer as any)({
        storeName: props.storeName,
        minZoom: 1,
        maxZoom: 22,
        opacity: 0.7,
        noWrap: true
    });
    return { instance, context };
};

const updateIndexedDBLayer = (instance: any, props: any, prevProps: any) => {
    if (props.storeName !== prevProps.storeName) {
        instance.options.storeName = props.storeName;
        instance.redraw();
    }
};

const CustomIndexedDBLayer = createLayerComponent<any, any>(
    createIndexedDBLayer,
    updateIndexedDBLayer
);

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
