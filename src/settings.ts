import { App, PluginSettingTab, Setting, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import type CampaignitzPlugin from "./main";
import { PlotlineConfig, DEFAULT_PLOTLINE_COLORS } from "./models/types";

export interface CampaignitzSettings {
    canonEventsPath: string;
    sessionsFolder: string;
    actCount: number;
    plotlines: PlotlineConfig[];
    sessionDateField: string;
}

export const DEFAULT_SETTINGS: CampaignitzSettings = {
    canonEventsPath: "Plot/Lines/Canon Events.md",
    sessionsFolder: "Plot/Acts",
    actCount: 3,
    plotlines: [
        { id: "A", name: "A", color: DEFAULT_PLOTLINE_COLORS[0] },
        { id: "B", name: "B", color: DEFAULT_PLOTLINE_COLORS[1] },
        { id: "C", name: "C", color: DEFAULT_PLOTLINE_COLORS[2] },
    ],
    sessionDateField: "played_on",
};

export class CampaignitzSettingTab extends PluginSettingTab {
    plugin: CampaignitzPlugin;

    constructor(app: App, plugin: CampaignitzPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getControlValue(key: string): unknown {
        const s = this.plugin.settings;
        switch (key) {
            case "canonEventsPath": return s.canonEventsPath;
            case "sessionsFolder": return s.sessionsFolder;
            case "actCount": return s.actCount;
            case "sessionDateField": return s.sessionDateField;
            default: return undefined;
        }
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        const s = this.plugin.settings;
        switch (key) {
            case "canonEventsPath": s.canonEventsPath = value as string; break;
            case "sessionsFolder": s.sessionsFolder = value as string; break;
            case "actCount": s.actCount = value as number; break;
            case "sessionDateField": s.sessionDateField = value as string; break;
        }
        await this.plugin.saveSettings();
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: "Canon Events file",
                desc: "Path to the markdown file listing canon events by act",
                control: {
                    type: "text" as const,
                    key: "canonEventsPath",
                    placeholder: "Plot/Lines/Canon Events.md",
                },
            },
            {
                name: "Sessions folder",
                desc: "Folder containing session notes (searched recursively)",
                control: {
                    type: "text" as const,
                    key: "sessionsFolder",
                    placeholder: "Plot/Acts",
                },
            },
            {
                name: "Number of acts",
                desc: "How many acts your campaign has (1-6)",
                control: {
                    type: "slider" as const,
                    key: "actCount",
                    min: 1,
                    max: 6,
                    step: 1,
                },
            },
            {
                type: "group" as const,
                heading: "Plotlines",
                items: this.buildPlotlineItems(),
            },
            {
                name: "Session date field",
                desc: "Frontmatter key used for the real-world session date",
                control: {
                    type: "text" as const,
                    key: "sessionDateField",
                    placeholder: "played_on",
                },
            },
        ];
    }

    private buildPlotlineItems(): SettingGroupItem[] {
        const items: SettingGroupItem[] = [];

        for (let i = 0; i < this.plugin.settings.plotlines.length; i++) {
            const idx = i;
            items.push({
                name: `Plotline ${idx + 1}`,
                render: (setting: Setting) => {
                    const pl = this.plugin.settings.plotlines[idx];
                    if (!pl) return;
                    setting
                        .addText((text) =>
                            text
                                .setPlaceholder("ID (e.g. A)")
                                .setValue(pl.id)
                                .onChange(async (value) => {
                                    this.plugin.settings.plotlines[idx].id = value;
                                    this.plugin.settings.plotlines[idx].name = value;
                                    await this.plugin.saveSettings();
                                })
                        )
                        .addColorPicker((cp) =>
                            cp.setValue(pl.color).onChange(async (value) => {
                                this.plugin.settings.plotlines[idx].color = value;
                                await this.plugin.saveSettings();
                            })
                        );

                    if (this.plugin.settings.plotlines.length > 1) {
                        setting.addExtraButton((btn) =>
                            btn
                                .setIcon("trash")
                                .setTooltip("Remove plotline")
                                .onClick(async () => {
                                    this.plugin.settings.plotlines.splice(idx, 1);
                                    await this.plugin.saveSettings();
                                    this.update();
                                })
                        );
                    }
                },
            });
        }

        if (this.plugin.settings.plotlines.length < 6) {
            items.push({
                name: "",
                render: (setting: Setting) => {
                    setting.addButton((btn) =>
                        btn
                            .setButtonText("Add plotline")
                            .setCta()
                            .onClick(async () => {
                                const nextIdx = this.plugin.settings.plotlines.length;
                                this.plugin.settings.plotlines.push({
                                    id: String.fromCharCode(65 + nextIdx),
                                    name: String.fromCharCode(65 + nextIdx),
                                    color: DEFAULT_PLOTLINE_COLORS[nextIdx] || "#888888",
                                });
                                await this.plugin.saveSettings();
                                this.update();
                            })
                    );
                },
            });
        }

        return items;
    }
}
