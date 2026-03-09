import React, { useState, useEffect, useRef } from 'react';
import { MapInfo } from '../../types';
import localforage from 'localforage';

interface MapManagerProps {
    onClose: () => void;
    onLayerSelect: (tileUrl: string) => void;
}

// We'll store a list of maps in a central "maps_list" key.
// Each map's blobs will be stored in a separate localforage instance.
const mapListStore = localforage.createInstance({
    name: 'FlightPlanner',
    storeName: 'maps_list'
});

export const MapManager: React.FC<MapManagerProps> = ({ onClose, onLayerSelect }) => {
    const [maps, setMaps] = useState<MapInfo[]>([]);
    const [importMsg, setImportMsg] = useState<string>('');
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadMaps();
    }, []);

    const loadMaps = async () => {
        try {
            const storedMaps: MapInfo[] | null = await mapListStore.getItem('library');
            if (storedMaps) {
                setMaps(storedMaps);
            } else {
                setMaps([]);
            }
        } catch (e) {
            console.error("Failed to load maps", e);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsImporting(true);
        try {
            // The directory name is usually in webkitRelativePath (e.g., "MyMap/0/0/0.png")
            // We'll extract the "MyMap" part as the map name.
            const firstPath = files[0].webkitRelativePath;
            const mapName = firstPath.split('/')[0] || `ImportedMap_${Date.now()}`;

            setImportMsg(`Importing ${mapName}... (0 / ${files.length})`);

            // Create a dedicated store for this map's tiles
            const tileStore = localforage.createInstance({
                name: 'FlightPlanner_Tiles',
                storeName: mapName
            });

            // Iterate over files and save the PNG/JPGs
            let savedCount = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Only process typical image tiles
                if (!file.name.match(/\.(png|jpg|jpeg|webp)$/i)) continue;

                // Path format: MapName/z/x/y.ext
                const parts = file.webkitRelativePath.split('/');
                if (parts.length >= 4) {
                    // Extract z, x, y from the end of the path
                    const yExt = parts.pop()!;
                    const x = parts.pop()!;
                    const z = parts.pop()!;

                    const y = yExt.split('.')[0];

                    const tileKey = `${z}/${x}/${y}`;

                    // We can just store the Blob directly
                    await tileStore.setItem(tileKey, file);
                    savedCount++;

                    if (savedCount % 100 === 0) {
                        setImportMsg(`Importing ${mapName}... (${savedCount} / ${files.length})`);
                        // Yield to event loop to allow UI updates
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }

            // Update MapLibrary list
            const newMap: MapInfo = {
                name: mapName,
                path: mapName // We use the mapName as the identifier/path now
            };

            const updatedMaps = [...maps.filter(m => m.name !== mapName), newMap];
            await mapListStore.setItem('library', updatedMaps);

            setImportMsg('');
            loadMaps(); // Refresh UI library

        } catch (err: any) {
            console.error(err);
            setImportMsg(`Error: ${err.message}`);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset input
            }
        }
    };

    const handleLoadMap = async (map: MapInfo) => {
        try {
            // Pass the map ID (which is the storeName) back as a special URI
            // We'll use a custom protocol identifier so our Map component knows to handle it.
            const tileUrl = `indexeddb://${map.path}/{z}/{x}/{y}`;
            onLayerSelect(tileUrl);
            onClose();
        } catch (err: any) {
            console.error('Failed to load map:', err);
            setImportMsg(`Error loading map: ${err.message}`);
        }
    };

    const handleDeleteMap = async (mapName: string) => {
        try {
            // Remove from list
            const updatedMaps = maps.filter(m => m.name !== mapName);
            await mapListStore.setItem('library', updatedMaps);

            // Drop the actual tile store (requires a bit of a workaround in localforage, or just clear it)
            const tileStore = localforage.createInstance({
                name: 'FlightPlanner_Tiles',
                storeName: mapName
            });
            await tileStore.clear();

            loadMaps();
        } catch (err) {
            console.error('Failed to delete map', err);
        }
    }

    return (
        <div className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-10">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">My Maps</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✖</button>
                </div>

                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Import a tile directory (XYZ format) from your computer. Files are stored securely in your browser.</span>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        // @ts-ignore - Specific to allowing directory uploads
                        webkitdirectory=""
                        directory=""
                    />

                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-bold shadow-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isImporting ? 'Importing...' : 'Import Tiles'}
                    </button>
                </div>
                {importMsg && <div className="p-2 bg-blue-50 text-blue-700 text-xs text-center border-b font-mono">{importMsg}</div>}

                <div className="flex-1 overflow-auto p-4">
                    <div className="space-y-3">
                        {maps.length === 0 ? (
                            <div className="text-center text-gray-400 mt-10">
                                <p>No maps found.</p>
                                <p className="text-sm">Import a tile directory to get started.</p>
                            </div>
                        ) : (
                            maps.map((map, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 bg-white shadow-sm">
                                    <div>
                                        <div className="font-bold text-gray-800">{map.name}</div>
                                        <div className="text-xs text-gray-400 break-all">Browser Cached</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDeleteMap(map.name)}
                                            className="text-red-500 px-3 py-1.5 rounded hover:bg-red-50 text-sm font-semibold border border-red-200"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => handleLoadMap(map)}
                                            className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 text-sm font-semibold"
                                        >
                                            Load
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

