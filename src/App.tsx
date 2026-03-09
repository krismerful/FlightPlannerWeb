import { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { FlightMap } from './components/Map/FlightMap';
import { FlightTable } from './components/Grid/FlightTable';

import { FileDown, Map, FileJson, Plane } from 'lucide-react';

import { useFlightStore } from './store/useFlightStore';
import { exportToPPTX, exportToKML, exportToSD, exportToF } from './utils/exports';


function App() {
    const mission = useFlightStore((state) => state);
    const undo = useFlightStore((state) => state.undo);
    const redo = useFlightStore((state) => state.redo);

    const [leftWidth, setLeftWidth] = useState(60);
    const isDragging = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'col-resize';
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        document.body.style.cursor = 'default';
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) { // Keep between 20% and 80%
            setLeftWidth(newWidth);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [handleMouseMove, handleMouseUp]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        redo();
                    } else {
                        e.preventDefault();
                        undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return (
        <div className="flex h-screen w-screen flex-row">
            <div className="h-full relative" style={{ width: `${leftWidth}%` }}>
                <FlightMap />

                {/* Export Toolbar */}
                <div className="absolute top-4 right-4 z-[1000] flex gap-2 flex-wrap max-w-[500px] justify-end">
                    <button
                        onClick={undo}
                        className="bg-white/80 p-2 rounded hover:bg-white text-slate-700 shadow font-bold"
                        title="Undo (Ctrl+Z)"
                    >
                        ↩
                    </button>
                    <button
                        onClick={redo}
                        className="bg-white/80 p-2 rounded hover:bg-white text-slate-700 shadow font-bold"
                        title="Redo (Ctrl+Y)"
                    >
                        ↪
                    </button>

                    <button
                        onClick={() => {
                            const dataStr = JSON.stringify(mission, null, 2);
                            const blob = new Blob([dataStr], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `mission-${new Date().toISOString().split('T')[0]}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded shadow-md hover:bg-blue-700 text-sm font-semibold"
                    >
                        <FileDown size={16} />
                        Save Plan
                    </button>
                    <label className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded shadow-md hover:bg-green-700 text-sm font-semibold cursor-pointer">
                        <FileJson size={16} />
                        Open Plan
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    try {
                                        const json = JSON.parse(event.target?.result as string);
                                        useFlightStore.getState().loadMission(json);
                                    } catch (err) {
                                        alert("Failed to load mission file.");
                                        console.error(err);
                                    }
                                };
                                reader.readAsText(file);
                                // Reset value so same file can be selected again
                                e.target.value = '';
                            }}
                        />
                    </label>

                    <div className="w-full h-0 basis-full"></div> {/* Break row */}

                    <button
                        onClick={() => exportToPPTX(mission)}
                        className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-md hover:bg-slate-100 text-sm font-semibold text-slate-700"
                    >
                        <FileDown size={16} />
                        Export PPTX
                    </button>
                    <button
                        onClick={() => exportToKML(mission)}
                        className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-md hover:bg-slate-100 text-sm font-semibold text-slate-700"
                    >
                        <Map size={16} />
                        Export KML
                    </button>
                    <button
                        onClick={() => exportToSD(mission)}
                        className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-md hover:bg-slate-100 text-sm font-semibold text-slate-700"
                    >
                        <FileJson size={16} />
                        Export SD
                    </button>
                    <button
                        onClick={() => exportToF(mission)}
                        className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-md hover:bg-slate-100 text-sm font-semibold text-slate-700"
                    >
                        <Plane size={16} />
                        Export F
                    </button>

                </div>
            </div>

            {/* Draggable Divider */}
            <div
                className="w-1 cursor-col-resize hover:bg-blue-500 bg-slate-300 active:bg-blue-600 transition-colors z-[2000] flex-shrink-0"
                onMouseDown={handleMouseDown}
            />

            <div className="h-full flex flex-col" style={{ width: `calc(${100 - leftWidth}% - 4px)` }}>
                <div className="bg-slate-800 text-white p-2 font-bold text-center">
                    Flight Plan Data
                </div>
                <div className="flex-1 overflow-auto">
                    <FlightTable />
                </div>
            </div>
        </div>
    );
}

export default App;
