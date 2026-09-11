import { App } from "obsidian";
import { CanonEvent, Session, PlotlineConfig } from "../models/types";

export interface TimelineData {
    events: CanonEvent[];
    sessions: Session[];
    actLabels: Map<number, string>;
    plotlines: PlotlineConfig[];
    actCount: number;
}

interface NodePosition {
    x: number;
    y: number;
    event: CanonEvent;
    plotline: PlotlineConfig;
}

const PADDING = { top: 140, right: 40, bottom: 120, left: 100 };
const ACT_LABEL_Y = 30;
const ROW_HEIGHT = 80;
const NODE_RADIUS = 12;
const SESSION_TRACK_Y_OFFSET = 40;
const SESSION_MARKER_RADIUS = 6;
const MIN_COL_WIDTH = 300;

export function buildTimelineSVG(
    container: HTMLElement,
    data: TimelineData,
    app: App
): void {
    container.empty();

    const { events, sessions, actLabels, plotlines, actCount } = data;
    const acts = Array.from({ length: actCount }, (_, i) => i + 1);
    const hasUnassigned = events.some((e) => e.plotlines.length === 0);
    const totalRows = plotlines.length + (hasUnassigned ? 1 : 0);

    const contentWidth = Math.max(acts.length * MIN_COL_WIDTH, container.clientWidth - PADDING.left - PADDING.right);
    const colWidth = contentWidth / acts.length;
    const contentHeight = totalRows * ROW_HEIGHT;
    const totalWidth = PADDING.left + contentWidth + PADDING.right;
    const totalHeight = PADDING.top + contentHeight + SESSION_TRACK_Y_OFFSET + PADDING.bottom;

    const wrapper = container.createDiv({ cls: "campaignitz-svg-wrapper" });

    const svg = createSVGElement("svg", {
        width: String(totalWidth),
        height: String(totalHeight),
        viewBox: `0 0 ${totalWidth} ${totalHeight}`,
        class: "campaignitz-svg",
    });
    wrapper.appendChild(svg);

    const defs = createSVGElement("defs");
    const marker = createSVGElement("marker", {
        id: "arrow-here",
        markerWidth: "10",
        markerHeight: "7",
        refX: "5",
        refY: "3.5",
        orient: "auto",
    });
    marker.appendChild(createSVGElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#f1c40f" }));
    defs.appendChild(marker);

    const filter = createSVGElement("filter", { id: "node-shadow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    filter.appendChild(createSVGElement("feDropShadow", { dx: "0", dy: "1", stdDeviation: "2", "flood-opacity": "0.3" }));
    defs.appendChild(filter);
    svg.appendChild(defs);

    drawGrid(svg, acts, plotlines, actLabels, colWidth, contentWidth, contentHeight, hasUnassigned);

    const nodePositions = computeNodePositions(events, plotlines, acts, colWidth, hasUnassigned);
    drawPlotlineConnections(svg, nodePositions, plotlines);
    drawCrossPlotlineLinks(svg, nodePositions);
    drawNodes(svg, nodePositions, app);
    drawSessionTrack(svg, sessions, acts, colWidth, contentHeight, contentWidth, app, nodePositions);

    setupPanZoom(wrapper, svg);
}

function drawGrid(
    svg: SVGElement,
    acts: number[],
    plotlines: PlotlineConfig[],
    actLabels: Map<number, string>,
    colWidth: number,
    contentWidth: number,
    contentHeight: number,
    hasUnassigned: boolean
): void {
    const gridGroup = createSVGElement("g", { class: "campaignitz-grid" });

    for (let i = 0; i < acts.length; i++) {
        const x = PADDING.left + i * colWidth;
        const label = actLabels.get(acts[i]) || `Act ${acts[i]}`;

        const text = createSVGElement("text", {
            x: String(x + colWidth / 2),
            y: String(ACT_LABEL_Y),
            "text-anchor": "middle",
            class: "campaignitz-act-label",
        });
        text.textContent = label;
        gridGroup.appendChild(text);

        if (i > 0) {
            gridGroup.appendChild(
                createSVGElement("line", {
                    x1: String(x),
                    y1: String(ACT_LABEL_Y + 10),
                    x2: String(x),
                    y2: String(PADDING.top + contentHeight + SESSION_TRACK_Y_OFFSET + 20),
                    class: "campaignitz-grid-line",
                })
            );
        }
    }

    for (let i = 0; i < plotlines.length; i++) {
        const y = PADDING.top + i * ROW_HEIGHT + ROW_HEIGHT / 2;

        const text = createSVGElement("text", {
            x: String(PADDING.left - 15),
            y: String(y + 5),
            "text-anchor": "end",
            class: "campaignitz-plotline-label",
            fill: plotlines[i].color,
        });
        text.textContent = plotlines[i].name;
        gridGroup.appendChild(text);

        gridGroup.appendChild(
            createSVGElement("line", {
                x1: String(PADDING.left),
                y1: String(y),
                x2: String(PADDING.left + contentWidth),
                y2: String(y),
                class: "campaignitz-plotline-track",
                stroke: plotlines[i].color,
            })
        );
    }

    if (hasUnassigned) {
        const y = PADDING.top + plotlines.length * ROW_HEIGHT + ROW_HEIGHT / 2;
        const label = createSVGElement("text", {
            x: String(PADDING.left - 15),
            y: String(y + 5),
            "text-anchor": "end",
            class: "campaignitz-plotline-label",
            fill: "var(--text-faint)",
        });
        label.textContent = "Other";
        gridGroup.appendChild(label);

        gridGroup.appendChild(
            createSVGElement("line", {
                x1: String(PADDING.left),
                y1: String(y),
                x2: String(PADDING.left + contentWidth),
                y2: String(y),
                class: "campaignitz-plotline-track",
                stroke: "var(--text-faint)",
            })
        );
    }

    svg.appendChild(gridGroup);
}

const UNASSIGNED_PLOTLINE: PlotlineConfig = { id: "__unassigned__", name: "Other", color: "var(--text-faint)" };

function computeNodePositions(
    events: CanonEvent[],
    plotlines: PlotlineConfig[],
    acts: number[],
    colWidth: number,
    hasUnassigned: boolean
): NodePosition[] {
    const positions: NodePosition[] = [];
    const plotlineMap = new Map(plotlines.map((p) => [p.id, p]));
    const eventsPerActPlotline = new Map<string, number>();
    const eventCountPerActPlotline = new Map<string, number>();

    for (const event of events) {
        if (event.plotlines.length === 0) {
            const key = `${event.act}-__unassigned__`;
            eventCountPerActPlotline.set(key, (eventCountPerActPlotline.get(key) || 0) + 1);
        } else {
            for (const plId of event.plotlines) {
                const key = `${event.act}-${plId}`;
                eventCountPerActPlotline.set(key, (eventCountPerActPlotline.get(key) || 0) + 1);
            }
        }
    }

    for (const event of events) {
        const actIndex = acts.indexOf(event.act);
        if (actIndex === -1) continue;

        if (event.plotlines.length === 0 && hasUnassigned) {
            const key = `${event.act}-__unassigned__`;
            const idx = eventsPerActPlotline.get(key) || 0;
            const total = eventCountPerActPlotline.get(key) || 1;
            eventsPerActPlotline.set(key, idx + 1);

            const x = PADDING.left + actIndex * colWidth + (colWidth / (total + 1)) * (idx + 1);
            const y = PADDING.top + plotlines.length * ROW_HEIGHT + ROW_HEIGHT / 2;

            positions.push({ x, y, event, plotline: UNASSIGNED_PLOTLINE });
            continue;
        }

        let primaryX: number = -1;
        for (const plId of event.plotlines) {
            const pl = plotlineMap.get(plId);
            if (!pl) continue;

            const plIndex = plotlines.findIndex((p) => p.id === plId);
            if (plIndex === -1) continue;

            const key = `${event.act}-${plId}`;
            const idx = eventsPerActPlotline.get(key) || 0;
            const total = eventCountPerActPlotline.get(key) || 1;
            eventsPerActPlotline.set(key, idx + 1);

            const x: number = primaryX >= 0 ? primaryX : (PADDING.left + actIndex * colWidth + (colWidth / (total + 1)) * (idx + 1));
            if (primaryX < 0) primaryX = x;
            const y = PADDING.top + plIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

            positions.push({ x, y, event, plotline: pl });
        }
    }

    return positions;
}

function drawPlotlineConnections(
    svg: SVGElement,
    positions: NodePosition[],
    plotlines: PlotlineConfig[]
): void {
    const group = createSVGElement("g", { class: "campaignitz-connections" });

    for (const pl of plotlines) {
        const plNodes = positions
            .filter((p) => p.plotline.id === pl.id)
            .sort((a, b) => a.x - b.x);

        for (let i = 1; i < plNodes.length; i++) {
            group.appendChild(
                createSVGElement("line", {
                    x1: String(plNodes[i - 1].x),
                    y1: String(plNodes[i - 1].y),
                    x2: String(plNodes[i].x),
                    y2: String(plNodes[i].y),
                    stroke: pl.color,
                    "stroke-width": "2",
                    "stroke-opacity": "0.4",
                })
            );
        }
    }

    svg.appendChild(group);
}

function drawCrossPlotlineLinks(
    svg: SVGElement,
    positions: NodePosition[]
): void {
    const group = createSVGElement("g", { class: "campaignitz-cross-links" });

    const byEvent = new Map<string, NodePosition[]>();
    for (const pos of positions) {
        const key = `${pos.event.act}-${pos.event.name}`;
        const arr = byEvent.get(key) || [];
        arr.push(pos);
        byEvent.set(key, arr);
    }

    for (const nodes of byEvent.values()) {
        if (nodes.length < 2) continue;
        nodes.sort((a, b) => a.y - b.y);
        for (let i = 1; i < nodes.length; i++) {
            group.appendChild(
                createSVGElement("line", {
                    x1: String(nodes[i - 1].x),
                    y1: String(nodes[i - 1].y),
                    x2: String(nodes[i].x),
                    y2: String(nodes[i].y),
                    class: "campaignitz-cross-link",
                })
            );
        }
    }

    svg.appendChild(group);
}

function drawNodes(
    svg: SVGElement,
    positions: NodePosition[],
    app: App
): void {
    const group = createSVGElement("g", { class: "campaignitz-nodes" });

    for (const pos of positions) {
        const nodeGroup = createSVGElement("g", {
            class: pos.event.filePath
                ? "campaignitz-node campaignitz-clickable"
                : "campaignitz-node",
            "data-filepath": pos.event.filePath || "",
        });

        nodeGroup.appendChild(
            createSVGElement("circle", {
                cx: String(pos.x),
                cy: String(pos.y),
                r: String(NODE_RADIUS),
                fill: pos.event.completed ? pos.plotline.color : "var(--background-primary)",
                stroke: pos.plotline.color,
                "stroke-width": "2.5",
                filter: "url(#node-shadow)",
            })
        );

        if (pos.event.completed) {
            const checkPath = createSVGElement("path", {
                d: `M${pos.x - 4},${pos.y} L${pos.x - 1},${pos.y + 3} L${pos.x + 5},${pos.y - 4}`,
                stroke: "white",
                "stroke-width": "2",
                fill: "none",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                class: "campaignitz-check",
            });
            nodeGroup.appendChild(checkPath);
        }

        const isFirstPlotline = pos.event.plotlines.length === 0 ||
            pos.event.plotlines[0] === pos.plotline.id;

        if (isFirstPlotline) {
            const label = createSVGElement("text", {
                x: String(pos.x),
                y: String(pos.y - NODE_RADIUS - 6),
                "text-anchor": "start",
                class: "campaignitz-node-label",
                transform: `rotate(-30, ${pos.x}, ${pos.y - NODE_RADIUS - 6})`,
            });
            label.textContent = pos.event.name;
            nodeGroup.appendChild(label);
        }

        if (pos.event.filePath) {
            nodeGroup.addEventListener("click", () => {
                void app.workspace.openLinkText(pos.event.filePath!, "", false);
            });
        }

        group.appendChild(nodeGroup);
    }

    svg.appendChild(group);
}

function computeSessionBounds(
    acts: number[],
    colWidth: number,
    nodePositions: NodePosition[]
): Map<number, { left: number; right: number }> {
    const bounds = new Map<number, { left: number; right: number }>();

    for (const act of acts) {
        const actIndex = acts.indexOf(act);
        const colStart = PADDING.left + actIndex * colWidth;
        const colEnd = colStart + colWidth;

        const actNodes = nodePositions.filter((p) => p.event.act === act);
        const completedXs = actNodes.filter((p) => p.event.completed).map((p) => p.x);
        const pendingXs = actNodes.filter((p) => !p.event.completed).map((p) => p.x);

        const lastCompletedX = completedXs.length ? Math.max(...completedXs) : null;
        const firstPendingX = pendingXs.length ? Math.min(...pendingXs) : null;

        let right: number;
        if (lastCompletedX !== null && firstPendingX !== null) {
            right = (lastCompletedX + firstPendingX) / 2;
        } else if (lastCompletedX !== null) {
            right = Math.min(lastCompletedX + colWidth * 0.1, colEnd);
        } else {
            right = colStart + colWidth * 0.15;
        }

        bounds.set(act, { left: colStart + 10, right });
    }

    return bounds;
}

function sessionX(
    session: Session,
    sessionsPerAct: Map<number, Session[]>,
    sessionBounds: Map<number, { left: number; right: number }>
): number {
    const bound = sessionBounds.get(session.act);
    if (!bound) return 0;
    const actSessions = sessionsPerAct.get(session.act) || [session];
    const idx = actSessions.indexOf(session);
    const total = actSessions.length;
    const range = bound.right - bound.left;
    return bound.left + (range / (total + 1)) * (idx + 1);
}

function drawSessionTrack(
    svg: SVGElement,
    sessions: Session[],
    acts: number[],
    colWidth: number,
    contentHeight: number,
    contentWidth: number,
    app: App,
    nodePositions: NodePosition[]
): void {
    const group = createSVGElement("g", { class: "campaignitz-session-track" });
    const trackY = PADDING.top + contentHeight + SESSION_TRACK_Y_OFFSET;

    group.appendChild(
        createSVGElement("line", {
            x1: String(PADDING.left),
            y1: String(trackY),
            x2: String(PADDING.left + contentWidth),
            y2: String(trackY),
            class: "campaignitz-session-line",
        })
    );

    const trackLabel = createSVGElement("text", {
        x: String(PADDING.left - 15),
        y: String(trackY + 5),
        "text-anchor": "end",
        class: "campaignitz-plotline-label campaignitz-session-track-label",
    });
    trackLabel.textContent = "Sessions";
    group.appendChild(trackLabel);

    const datedSessions = sessions.filter((s) => s.playedOn);
    if (datedSessions.length === 0) {
        svg.appendChild(group);
        return;
    }

    const sessionsPerAct = new Map<number, Session[]>();
    for (const s of datedSessions) {
        const arr = sessionsPerAct.get(s.act) || [];
        arr.push(s);
        sessionsPerAct.set(s.act, arr);
    }

    const sessionBounds = computeSessionBounds(acts, colWidth, nodePositions);
    const now = new Date();
    let youAreHereIndex = -1;

    for (let i = 0; i < datedSessions.length; i++) {
        const session = datedSessions[i];
        const x = sessionX(session, sessionsPerAct, sessionBounds);

        if (session.playedOn! <= now) {
            youAreHereIndex = i;
        }

        const marker = createSVGElement("circle", {
            cx: String(x),
            cy: String(trackY),
            r: String(SESSION_MARKER_RADIUS),
            class: "campaignitz-session-marker",
        });

        const tooltipGroup = createSVGElement("g", {
            class: "campaignitz-session-tooltip-trigger campaignitz-clickable",
            "data-filepath": session.filePath,
        });
        tooltipGroup.appendChild(marker);

        const labelInterval = datedSessions.length <= 10 ? 1 : datedSessions.length <= 20 ? 5 : 10;
        const showLabel = session.number >= 0 &&
            (session.number % labelInterval === 0 || i === datedSessions.length - 1);

        if (showLabel) {
            const sessionLabel = createSVGElement("text", {
                x: String(x),
                y: String(trackY + 20),
                "text-anchor": "middle",
                class: "campaignitz-session-number",
            });
            sessionLabel.textContent = `#${session.number}`;
            tooltipGroup.appendChild(sessionLabel);
        }

        tooltipGroup.addEventListener("click", () => {
            void app.workspace.openLinkText(session.filePath, "", false);
        });

        const tooltipData = buildTooltipText(session);
        tooltipGroup.addEventListener("mouseenter", (e: Event) => {
            const parent = svg.parentElement;
            if (parent) showTooltip(parent, e as MouseEvent, tooltipData);
        });
        tooltipGroup.addEventListener("mouseleave", () => {
            const parent = svg.parentElement;
            if (parent) hideTooltip(parent);
        });

        group.appendChild(tooltipGroup);
    }

    if (youAreHereIndex >= 0) {
        const session = datedSessions[youAreHereIndex];
        const x = sessionX(session, sessionsPerAct, sessionBounds);

        const arrowY = trackY - 25;
        const arrow = createSVGElement("g", { class: "campaignitz-you-are-here" });

        arrow.appendChild(
            createSVGElement("polygon", {
                points: `${x - 8},${arrowY - 16} ${x + 8},${arrowY - 16} ${x},${arrowY}`,
                class: "campaignitz-here-arrow",
            })
        );

        const hereLabel = createSVGElement("text", {
            x: String(x),
            y: String(arrowY - 22),
            "text-anchor": "middle",
            class: "campaignitz-here-label",
        });
        hereLabel.textContent = "YOU ARE HERE";
        arrow.appendChild(hereLabel);

        group.appendChild(arrow);
    }

    svg.appendChild(group);
}

function buildTooltipText(session: Session): string {
    const lines: string[] = [];
    if (session.number >= 0) lines.push(`Session ${session.number}`);
    if (session.playedOn) lines.push(`Played: ${session.playedOn.toLocaleDateString()}`);
    if (session.gameDate) lines.push(`In-game: ${session.gameDate}`);
    if (session.level != null) lines.push(`Level: ${session.level}`);
    if (session.characters.length) lines.push(`Party: ${session.characters.join(", ")}`);
    if (session.canonEvents.length) lines.push(`Events: ${session.canonEvents.join(", ")}`);
    return lines.join("\n");
}

function showTooltip(container: HTMLElement, e: MouseEvent, text: string): void {
    hideTooltip(container);
    const tip = container.createDiv({ cls: "campaignitz-tooltip" });
    tip.textContent = text;
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    tip.setCssStyles({ left: `${offsetX + 12}px`, top: `${offsetY - 10}px` });
}

function hideTooltip(container: HTMLElement): void {
    const existing = container.querySelector(".campaignitz-tooltip");
    if (existing) existing.remove();
}

function setupPanZoom(wrapper: HTMLElement, svg: SVGElement): void {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    wrapper.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const target = e.target as Element;
        if (target.closest(".campaignitz-node") || target.closest(".campaignitz-session-tooltip-trigger")) return;
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = wrapper.scrollLeft;
        scrollTop = wrapper.scrollTop;
        wrapper.addClass("campaignitz-panning");
        e.preventDefault();
    });

    const onMouseMove = (e: MouseEvent): void => {
        if (!isPanning) return;
        wrapper.scrollLeft = scrollLeft - (e.clientX - startX);
        wrapper.scrollTop = scrollTop - (e.clientY - startY);
    };

    const onMouseUp = (): void => {
        isPanning = false;
        wrapper.removeClass("campaignitz-panning");
    };

    wrapper.ownerDocument.addEventListener("mousemove", onMouseMove);
    wrapper.ownerDocument.addEventListener("mouseup", onMouseUp);

    const cleanup = (): void => {
        wrapper.ownerDocument.removeEventListener("mousemove", onMouseMove);
        wrapper.ownerDocument.removeEventListener("mouseup", onMouseUp);
    };

    const observer = new MutationObserver(() => {
        if (!wrapper.isConnected) {
            cleanup();
            observer.disconnect();
        }
    });
    observer.observe(wrapper.parentElement || wrapper.ownerDocument.body, { childList: true, subtree: true });

    let scale = 1;
    wrapper.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(3, Math.max(0.3, scale * delta));
        svg.setCssStyles({ transform: `scale(${scale})`, transformOrigin: "0 0" });
    }, { passive: false });
}

function createSVGElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string>): SVGElementTagNameMap[K] {
    const el = createSvg(tag, attrs ? { attr: attrs } : undefined);
    return el;
}
