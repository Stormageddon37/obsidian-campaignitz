export interface CanonEvent {
    name: string;
    act: number;
    plotlines: string[];
    completed: boolean;
    order: number;
    filePath: string | null;
}

export interface Session {
    number: number;
    act: number;
    playedOn: Date | null;
    gameDate: string | null;
    level: number | null;
    characters: string[];
    canonEvents: string[];
    filePath: string;
}

export interface PlotlineConfig {
    id: string;
    name: string;
    color: string;
}

export const DEFAULT_PLOTLINE_COLORS: string[] = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
];
