import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type CampaignitzPlugin from "../main";
import { parseCanonEvents, parseSessions } from "../services/parser";
import { buildTimelineSVG, TimelineData } from "../components/TimelineSVG";

export const VIEW_TYPE_CAMPAIGN_TIMELINE = "campaignitz-timeline";

export class CampaignTimelineView extends ItemView {
    plugin: CampaignitzPlugin;
    private resizeObserver: ResizeObserver | null = null;
    private lastData: TimelineData | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: CampaignitzPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CAMPAIGN_TIMELINE;
    }

    getDisplayText(): string {
        return "Campaign Timeline";
    }

    getIcon(): string {
        return "map";
    }

    async onOpen(): Promise<void> {
        await this.render();
    }

    async onClose(): Promise<void> {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.contentEl.empty();
    }

    async render(): Promise<void> {
        const container = this.contentEl;
        container.empty();
        container.addClass("campaignitz-view");

        const header = container.createDiv({ cls: "campaignitz-header" });
        const refreshBtn = header.createEl("button", { cls: "campaignitz-refresh-btn", attr: { "aria-label": "Refresh" } });
        setIcon(refreshBtn, "refresh-cw");
        refreshBtn.addEventListener("click", () => { void this.render(); });

        const title = header.createEl("h4", { cls: "campaignitz-title" });
        title.textContent = "Campaign Timeline";

        const timelineContainer = container.createDiv({ cls: "campaignitz-container" });

        const settings = this.plugin.settings;
        const { events, actLabels } = await parseCanonEvents(this.app, settings.canonEventsPath);

        const canonEventNames = new Set(events.map((e) => e.name));
        const sessions = await parseSessions(this.app, settings.sessionsFolder, canonEventNames);

        if (events.length === 0 && sessions.length === 0) {
            timelineContainer.createEl("p", {
                text: "No canon events or sessions found. Check your settings.",
                cls: "campaignitz-empty",
            });
            return;
        }

        const data: TimelineData = {
            events,
            sessions,
            actLabels,
            plotlines: settings.plotlines,
            actCount: settings.actCount,
        };

        this.lastData = data;
        buildTimelineSVG(timelineContainer, data, this.app);

        if (this.resizeObserver) this.resizeObserver.disconnect();
        let resizeTimer: number | null = null;
        let lastWidth = timelineContainer.clientWidth;
        this.resizeObserver = new ResizeObserver(() => {
            const w = timelineContainer.clientWidth;
            if (w === lastWidth || w === 0 || lastWidth === 0) {
                lastWidth = w;
                return;
            }
            lastWidth = w;
            if (resizeTimer) window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                if (this.lastData) {
                    buildTimelineSVG(timelineContainer, this.lastData, this.app);
                }
            }, 150);
        });
        this.resizeObserver.observe(timelineContainer);
    }
}
