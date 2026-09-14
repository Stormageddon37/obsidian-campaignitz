import { Plugin } from "obsidian";
import { CampaignitzSettings, CampaignitzSettingTab, DEFAULT_SETTINGS } from "./settings";
import { CampaignTimelineView, VIEW_TYPE_CAMPAIGN_TIMELINE } from "./views/CampaignTimelineView";
import { parseCanonEvents, parseSessions } from "./services/parser";
import { buildTimelineSVG, TimelineData } from "./components/TimelineSVG";

export default class CampaignitzPlugin extends Plugin {
    settings: CampaignitzSettings = DEFAULT_SETTINGS;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerView(VIEW_TYPE_CAMPAIGN_TIMELINE, (leaf) => new CampaignTimelineView(leaf, this));

        this.addRibbonIcon("map", "Open Campaign Timeline", () => {
            void this.activateView();
        });

        this.addCommand({
            id: "open-campaign-timeline",
            name: "Open Campaign Timeline",
            callback: () => {
                void this.activateView();
            },
        });

        this.addSettingTab(new CampaignitzSettingTab(this.app, this));

        this.registerMarkdownCodeBlockProcessor("campaignitz", async (source, el) => {
            const lines = source.trim().split("\n").reduce<Record<string, string>>((acc, line) => {
                const [key, ...rest] = line.split(":");
                if (key && rest.length) acc[key.trim()] = rest.join(":").trim();
                return acc;
            }, {});

            const height = lines["height"] || "500px";
            el.addClass("campaignitz-embed");
            el.setCssStyles({ height, overflow: "hidden", position: "relative" });

            const settings = this.settings;
            const { events, actLabels } = await parseCanonEvents(this.app, settings.canonEventsPath);
            const canonEventNames = new Set(events.map((e) => e.name));
            const sessions = await parseSessions(this.app, settings.sessionsFolder, canonEventNames);

            const data: TimelineData = {
                events,
                sessions,
                actLabels,
                plotlines: settings.plotlines,
                actCount: settings.actCount,
            };

            buildTimelineSVG(el, data, this.app);

            let resizeTimer: number | null = null;
            let lastWidth = el.clientWidth;
            const observer = new ResizeObserver(() => {
                const w = el.clientWidth;
                if (w === lastWidth || w === 0 || lastWidth === 0) {
                    lastWidth = w;
                    return;
                }
                lastWidth = w;
                if (resizeTimer) window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(() => {
                    buildTimelineSVG(el, data, this.app);
                }, 150);
            });
            observer.observe(el);
            this.register(() => observer.disconnect());
        });
    }

    async loadSettings(): Promise<void> {
        const loaded = ((await this.loadData()) ?? {}) as Partial<CampaignitzSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    async activateView(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CAMPAIGN_TIMELINE);
        if (existing.length) {
            await this.app.workspace.revealLeaf(existing[0]);
            return;
        }

        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({
            type: VIEW_TYPE_CAMPAIGN_TIMELINE,
            active: true,
        });
        await this.app.workspace.revealLeaf(leaf);
    }
}
