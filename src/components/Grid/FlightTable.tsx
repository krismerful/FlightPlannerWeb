import { useState, useEffect, useRef, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    RowData,
    Row,
} from '@tanstack/react-table';
import { Trash2, Copy, Plus, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useFlightStore } from '../../store/useFlightStore';
import { Waypoint } from '../../types';
import { formatCoordinate, parseCoordinate } from '../../utils/geo';

// --- Module Augmentation ---
declare module '@tanstack/react-table' {
    interface TableMeta<TData extends RowData> {
        updateData: (id: string, columnId: string, value: any) => void;
        removeRow: (id: string) => void;
        duplicateRow: (id: string) => void;
        updateTime: (id: string, minutes: number) => void;
        // Selection State for "Fill"
        selectedRows: Set<string>;
        toggleSelection: (id: string, isMulti: boolean, isRange: boolean) => void;
        isRowSelected: (id: string) => boolean;
        // Batch Update
        batchUpdate: (columnId: string, value: any) => void;
        updateStartFuel: (fuel: number) => void;
        updateReserveFuel: (id: string, bingo: number) => void;
        duplicateToEnd: (reverse?: boolean) => void;
    }
}

// --- Helper: Time Formatter ---
const formatTime = (minutes: number | undefined) => {
    if (minutes === undefined) return '-';
    const min = Math.floor(minutes);
    const sec = Math.round((minutes - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

const parseTime = (str: string) => {
    // Supports "MM:SS" or "MM" or "MM.mm"
    if (str.includes(':')) {
        const [m, s] = str.split(':').map(Number);
        return (m || 0) + (s || 0) / 60;
    }
    return parseFloat(str);
};

// --- Components ---

const SelectableCell = ({
    getValue,
    row,
    column,
    table,
    isTime = false,
    isCoordinate = false,
    coordinateType = 'lat', // 'lat' | 'lng'
}: {
    getValue: () => any;
    row: any;
    column: any;
    table: any;
    isTime?: boolean;
    isCoordinate?: boolean;
    coordinateType?: 'lat' | 'lng';
}) => {
    const initialValue = getValue();
    const formatValue = (val: any) => {
        if (isTime) return formatTime(val);
        if (isCoordinate && val !== undefined) return formatCoordinate(val, coordinateType === 'lat');
        return val;
    };

    const [value, setValue] = useState(formatValue(initialValue));
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(formatValue(initialValue));
    }, [initialValue, isTime, isCoordinate, coordinateType]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const onBlur = () => {
        setIsEditing(false);

        let finalValue = value;
        if (isTime) {
            finalValue = parseTime(value.toString());
            if (!isNaN(finalValue)) {
                table.options.meta?.updateTime(row.original.id, finalValue);
            } else {
                setValue(formatValue(initialValue)); // Reset if invalid
            }
            return;
        }

        if (isCoordinate) {
            const parsed = parseCoordinate(value.toString());
            if (parsed !== null) {
                finalValue = parsed;
                // Coordinates are updated via standard updateData
                table.options.meta?.updateData(row.original.id, column.id, finalValue);
            } else {
                setValue(formatValue(initialValue)); // Reset if invalid
            }
            return;
        }

        // Standard Update
        // Check if we are part of a selection (Drag-to-fill logic simul)
        // If this row is selected, and there are multiple selected rows, we update all of them
        if (table.options.meta?.isRowSelected(row.original.id) && table.options.meta?.selectedRows.size > 1) {
            table.options.meta?.batchUpdate(column.id, finalValue);
        } else {
            table.options.meta?.updateData(row.original.id, column.id, finalValue);
        }
    };

    const isSelected = table.options.meta?.isRowSelected(row.original.id);

    // If not editing, click to select/deselect
    // Double click to edit

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onBlur();
                }}
                className="w-full bg-white p-1 focus:outline-none ring-2 ring-blue-500 rounded text-black"
            />
        );
    }

    return (
        <div
            className={`w-full h-full p-1 cursor-pointer select-none ${isSelected ? 'bg-blue-100 ring-1 ring-blue-300' : ''}`}
            onClick={(e) => {
                const isMulti = e.ctrlKey || e.metaKey;
                const isRange = e.shiftKey;
                // If already selected and not using modifier, keep selection (allow double click to edit group)
                if (isSelected && !isMulti && !isRange) return;

                table.options.meta?.toggleSelection(row.original.id, isMulti, isRange);
            }}
            onDoubleClick={() => setIsEditing(true)}
        >
            {formatValue(initialValue)}
        </div>
    );
};

// --- Sortable Row Component ---
const DraggableRow = ({ row, selectedRows }: { row: Row<Waypoint>; selectedRows: Set<string> }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: row.original.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        position: isDragging ? 'relative' : 'relative',
    } as React.CSSProperties;

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50 border-b ${selectedRows.has(row.original.id) ? 'bg-blue-50' : 'bg-white'} ${isDragging ? 'shadow-lg opacity-80' : ''}`}
        >
            {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'drag') {
                    return (
                        <td key={cell.id} className="border p-1 w-8 text-center cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    );
                }
                return (
                    <td key={cell.id} className="border p-1">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                );
            })}
        </tr>
    );
};

const columnHelper = createColumnHelper<Waypoint>();

export const FlightTable = () => {
    const waypoints = useFlightStore((state) => state.waypoints);
    const addWaypoint = useFlightStore((state) => state.addWaypoint);
    const updateWaypoint = useFlightStore((state) => state.updateWaypoint);
    const removeWaypoint = useFlightStore((state) => state.removeWaypoint);
    const duplicateWaypoint = useFlightStore((state) => state.duplicateWaypoint);
    const updateWaypointTime = useFlightStore((state) => state.updateWaypointTime);
    const updateWaypoints = useFlightStore((state) => state.updateWaypoints);
    const updateStartFuel = useFlightStore((state) => state.updateStartFuel);
    const updateReserveFuelByBingo = useFlightStore((state) => state.updateReserveFuelByBingo);
    const duplicateWaypointsToEnd = useFlightStore((state) => state.duplicateWaypointsToEnd);
    const reorderWaypoints = useFlightStore((state) => state.reorderWaypoints);

    // Selection State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    // Manual Input State
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');

    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const toggleSelection = (id: string, isMulti: boolean, isRange: boolean) => {
        const currentIndex = waypoints.findIndex(w => w.id === id);

        setSelectedRows(prev => {
            let next = new Set<string>();

            if (isRange && lastSelectedId) {
                const lastIndex = waypoints.findIndex(w => w.id === lastSelectedId);
                if (lastIndex !== -1 && currentIndex !== -1) {
                    const start = Math.min(currentIndex, lastIndex);
                    const end = Math.max(currentIndex, lastIndex);

                    // If Multi is also held, keep existing. Else clear.
                    // Standard Windows behavior: Shift always extends from Anchor. 
                    // Typically Shift+Click clears others unless Ctrl is also held.
                    // But here, let's assume Shift+Click extends selection.
                    if (isMulti) {
                        next = new Set(prev);
                    } else {
                        // If just Shift, usually we keep the anchor? 
                        // Simplified: Shift adds range. If you want to clear, click without shift first.
                        // Actually, user compliant was "I can't click one... shift click... and have all... highlighted".
                        // This implies standard range selection.
                        // Standard: Click A (Sel A). Shift Click C (Sel A, B, C).
                        next = new Set(prev); // We'll keep previous selection for simplicity unless user wants strict standard behavior
                        // Actually, strict standard: Clear all, then select range.
                        // Let's stick to "Add Range to Selection" which is safer/easier.
                    }

                    for (let i = start; i <= end; i++) {
                        next.add(waypoints[i].id);
                    }
                } else {
                    // Fallback if index not found
                    next.add(id);
                }
            } else {
                if (isMulti) {
                    next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                } else {
                    next = new Set([id]);
                }
            }
            return next;
        });

        // Update anchor if not a range selection (or maybe update it to current?)
        // Standard: Anchor is set on Click. Shift-Click uses Anchor.
        // If I Click A (Anchor A). Shift-Click C. (Sel A-C). Anchor remains A? Or becomes C?
        // Usually Anchor is the "Start" of the selection.
        // If I Click A. Shift-Click C. Then Shift-Click E. Selection is A-E.
        // so Anchor must remain A.
        // BUT if I Click A. Click B (Anchor B).

        if (!isRange) {
            setLastSelectedId(id);
        }
    };

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'drag',
            header: '',
            size: 30,
            cell: () => <GripVertical size={16} className="text-slate-400 mx-auto" />,
        }),
        columnHelper.accessor((_, i) => i + 1, {
            id: 'index',
            header: '#',
            size: 40,
        }),
        columnHelper.accessor('name', {
            header: 'Name',
            cell: (props) => <SelectableCell {...props} />,
        }),
        columnHelper.accessor('lat', {
            header: 'Lat',
            cell: (props) => <SelectableCell {...props} isCoordinate={true} coordinateType="lat" />,
        }),
        columnHelper.accessor('lng', {
            header: 'Lng',
            cell: (props) => <SelectableCell {...props} isCoordinate={true} coordinateType="lng" />,
        }),
        columnHelper.accessor('heading', {
            header: 'Hdg',
            cell: (info) => info.getValue() ? Math.round(info.getValue()!) : '-',
        }),
        columnHelper.accessor('altitude', {
            header: 'Alt (ft)',
            cell: (props) => <SelectableCell {...props} />,
        }),
        columnHelper.accessor('distance', {
            header: 'Dist',
            cell: (info) => info.getValue() ? info.getValue()!.toFixed(1) : '-',
        }),
        columnHelper.accessor('groundSpeed', {
            header: 'GS (kts)',
            cell: (props) => <SelectableCell {...props} />,
        }),
        columnHelper.accessor('legTime', {
            header: 'Time (mm:ss)',
            // Special Cell for Time Editing
            cell: (props) => <SelectableCell {...props} isTime={true} />,
        }),
        columnHelper.accessor('totalTime', {
            header: 'Total Time',
            cell: (info) => {
                const totalMins = info.getValue();
                if (totalMins === undefined) return '-';
                const hours = Math.floor(totalMins / 60);
                const mins = Math.floor(totalMins % 60);
                const secs = Math.round((totalMins - Math.floor(totalMins)) * 60);
                return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            },
        }),
        columnHelper.accessor('bingo', { // Fuel Required
            header: 'Req Fuel (Bingo)',
            cell: (props) => <SelectableCell {...props} />,
        }),
        columnHelper.accessor('fuelRem', {
            header: 'Fuel Rem',
            cell: ({ getValue, row, table }) => {
                if (row.index === 0) {
                    // Start Fuel - using SelectableCell but we need to wire it to updateStartFuel
                    // We can trick SelectableCell by passing a custom update handler?
                    // Or just render a specific input here.
                    // Let's use a wrapper or handle it in updateData.
                    return <SelectableCell getValue={getValue} row={row} column={{ id: 'startFuel' }} table={table} />;
                }
                const val = getValue();
                return val !== undefined ? Math.round(val) : '-';
            }
        }),
        columnHelper.display({
            id: 'actions',
            header: '',
            cell: ({ row, table }) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => table.options.meta?.duplicateRow(row.original.id)}
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="Duplicate Waypoint"
                    >
                        <Copy size={16} />
                    </button>
                    <button
                        onClick={() => table.options.meta?.removeRow(row.original.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete Waypoint"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        }),
    ], [columnHelper]);

    const table = useReactTable({
        data: waypoints,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (id, columnId, value) => {
                if (columnId === 'altitude' || columnId === 'groundSpeed') {
                    const num = parseFloat(value);
                    if (!isNaN(num)) updateWaypoint(id, { [columnId]: num });
                } else if (columnId === 'startFuel') {
                    const num = parseFloat(value);
                    if (!isNaN(num)) updateStartFuel(num);
                } else if (columnId === 'bingo') {
                    const num = parseFloat(value);
                    if (!isNaN(num)) updateReserveFuelByBingo(id, num);
                } else {
                    updateWaypoint(id, { [columnId]: value });
                }
            },
            removeRow: (id) => removeWaypoint(id),
            duplicateRow: (id) => duplicateWaypoint(id),
            updateTime: (id, minutes) => updateWaypointTime(id, minutes),
            selectedRows,
            toggleSelection,
            isRowSelected: (id) => selectedRows.has(id),
            batchUpdate: (columnId, value) => {
                if (columnId === 'altitude' || columnId === 'groundSpeed') {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        updateWaypoints(Array.from(selectedRows), { [columnId]: num });
                    }
                } else {
                    updateWaypoints(Array.from(selectedRows), { [columnId]: value });
                }
            },
            updateStartFuel: (fuel) => updateStartFuel(fuel),
            updateReserveFuel: (id, bingo) => updateReserveFuelByBingo(id, bingo),
            duplicateToEnd: (reverse) => duplicateWaypointsToEnd(Array.from(selectedRows), reverse),
        }
    });

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = waypoints.findIndex((w) => w.id === active.id);
            const newIndex = waypoints.findIndex((w) => w.id === over?.id);
            reorderWaypoints(oldIndex, newIndex);
        }
    };

    const handleManualAdd = () => {
        console.log("Attempting to add waypoint manually...", { manualLat, manualLng });

        const lat = parseCoordinate(manualLat);
        const lng = parseCoordinate(manualLng);

        // Ensure valid parsed numbers
        if (lat !== null && lng !== null) {
            // Fallback for crypto.randomUUID
            const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
            console.log("Generating ID:", newId);

            addWaypoint({
                id: newId,
                name: `Manual WPT`,
                lat,
                lng,
                altitude: 500,
                groundSpeed: 90,
            });
            setManualLat('');
            setManualLng('');
        } else {
            const msg = "Invalid Format. Supported formats:\n- Decimal Degrees (e.g. 1.35)\n- DDM (e.g. N01 21.126)";
            alert(msg);
            console.error("Invalid Input for Manual Add:", { manualLat, manualLng, lat, lng });
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white text-sm">
            <div className="bg-yellow-50 p-2 text-xs border-b border-yellow-200 text-yellow-800 flex justify-between items-center">
                <span>Tip: Drag handle to reorder. Ctrl/Shift+Click to select. Double-click to edit.</span>
                {selectedRows.size > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => table.options.meta?.duplicateToEnd(false)}
                            className="bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-300 hover:bg-blue-200"
                        >
                            Dup Selection to End
                        </button>
                        <button
                            onClick={() => table.options.meta?.duplicateToEnd(true)}
                            className="bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-300 hover:bg-blue-200"
                        >
                            Dup (Reverse)
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="border p-2 text-left font-semibold">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            <SortableContext
                                items={waypoints.map(w => w.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {table.getRowModel().rows.map((row) => (
                                    <DraggableRow key={row.id} row={row} selectedRows={selectedRows} />
                                ))}
                            </SortableContext>
                        </tbody>
                    </table>
                </DndContext>
            </div>

            {/* Manual Add Form */}
            <div className="p-2 border-t bg-slate-50 flex items-center gap-2">
                <span className="font-semibold text-xs">Add WPT:</span>
                <input
                    placeholder="Lat (N01 21.126)"
                    className="border p-1 rounded w-32 text-xs"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                />
                <input
                    placeholder="Lng (E103 49.188)"
                    className="border p-1 rounded w-32 text-xs"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                />
                <button
                    onClick={handleManualAdd}
                    className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
        </div>
    );
};
