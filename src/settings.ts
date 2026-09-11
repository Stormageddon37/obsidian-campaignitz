import { App, PluginSettingTab, Setting } from "obsidian";
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

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Canon Events file")
            .setDesc("Path to the markdown file listing canon events by act")
            .addText((text) =>
                text
                    .setPlaceholder("Plot/Lines/Canon Events.md")
                    .setValue(this.plugin.settings.canonEventsPath)
                    .onChange(async (value) => {
                        this.plugin.settings.canonEventsPath = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Sessions folder")
            .setDesc("Folder containing session notes (searched recursively)")
            .addText((text) =>
                text
                    .setPlaceholder("Plot/Acts")
                    .setValue(this.plugin.settings.sessionsFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.sessionsFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Number of acts")
            .setDesc("How many acts your campaign has (1-6)")
            .addSlider((slider) =>
                slider
                    .setLimits(1, 6, 1)
                    .setValue(this.plugin.settings.actCount)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.actCount = value;
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl("h3", { text: "Plotlines" });

        for (let i = 0; i < this.plugin.settings.plotlines.length; i++) {
            const pl = this.plugin.settings.plotlines[i];
            const s = new Setting(containerEl)
                .setName(`Plotline ${i + 1}`)
                .addText((text) =>
                    text
                        .setPlaceholder("ID (e.g. A)")
                        .setValue(pl.id)
                        .onChange(async (value) => {
                            this.plugin.settings.plotlines[i].id = value;
                            this.plugin.settings.plotlines[i].name = value;
                            await this.plugin.saveSettings();
                        })
                )
                .addColorPicker((cp) =>
                    cp.setValue(pl.color).onChange(async (value) => {
                        this.plugin.settings.plotlines[i].color = value;
                        await this.plugin.saveSettings();
                    })
                );

            if (this.plugin.settings.plotlines.length > 1) {
                s.addExtraButton((btn) =>
                    btn
                        .setIcon("trash")
                        .setTooltip("Remove plotline")
                        .onClick(async () => {
                            this.plugin.settings.plotlines.splice(i, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        })
                );
            }
        }

        if (this.plugin.settings.plotlines.length < 6) {
            new Setting(containerEl).addButton((btn) =>
                btn
                    .setButtonText("Add plotline")
                    .setCta()
                    .onClick(async () => {
                        const idx = this.plugin.settings.plotlines.length;
                        this.plugin.settings.plotlines.push({
                            id: String.fromCharCode(65 + idx),
                            name: String.fromCharCode(65 + idx),
                            color: DEFAULT_PLOTLINE_COLORS[idx] || "#888888",
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );
        }

        new Setting(containerEl)
            .setName("Session date field")
            .setDesc("Frontmatter key used for the real-world session date")
            .addText((text) =>
                text
                    .setPlaceholder("played_on")
                    .setValue(this.plugin.settings.sessionDateField)
                    .onChange(async (value) => {
                        this.plugin.settings.sessionDateField = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
