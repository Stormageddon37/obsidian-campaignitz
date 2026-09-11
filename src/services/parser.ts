import { App, TFile, TFolder } from "obsidian";
import { CanonEvent, Session } from "../models/types";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const PLOTLINE_MULTI_RE = /\(((?:\[\[[^\]]+\]\](?:,\s*)?)+)\)/g;
const WIKILINK_INNER_RE = /\[\[([^\]]+)\]\]/g;
const CHECKBOX_RE = /^(\s*)-\s*\[([ xX])\]\s*/;
const ACT_HEADER_RE = /^##\s*\[?Act\s+(\d+)\]?/i;

export async function parseCanonEvents(
    app: App,
    filePath: string
): Promise<{ events: CanonEvent[]; actLabels: Map<number, string> }> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return { events: [], actLabels: new Map() };

    const content = await app.vault.cachedRead(file);
    const lines = content.split("\n");
    const events: CanonEvent[] = [];
    const actLabels = new Map<number, string>();
    let currentAct = 0;
    let orderInAct = 0;

    for (const line of lines) {
        const actMatch = line.match(ACT_HEADER_RE);
        if (actMatch) {
            currentAct = parseInt(actMatch[1]);
            actLabels.set(currentAct, `Act ${currentAct}`);
            orderInAct = 0;
            continue;
        }

        if (currentAct === 0) continue;

        const cbMatch = line.match(CHECKBOX_RE);
        if (!cbMatch) continue;

        const completed = cbMatch[2].toLowerCase() === "x";
        const rest = line.slice(cbMatch[0].length);

        const plotlines: string[] = [];
        let match: RegExpExecArray | null;
        const multiRe = new RegExp(PLOTLINE_MULTI_RE.source, "g");
        while ((match = multiRe.exec(rest)) !== null) {
            const inner = match[1];
            let innerMatch: RegExpExecArray | null;
            const innerRe = new RegExp(WIKILINK_INNER_RE.source, "g");
            while ((innerMatch = innerRe.exec(inner)) !== null) {
                const pl = innerMatch[1].split("|")[0];
                if (!plotlines.includes(pl)) plotlines.push(pl);
            }
        }

        const nameWithoutPlotlineRefs = rest.replace(PLOTLINE_MULTI_RE, "").trim();
        const nameMatch = nameWithoutPlotlineRefs.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
        const name = nameMatch ? nameMatch[1] : nameWithoutPlotlineRefs.replace(/\[\[|\]\]/g, "").trim();

        if (!name) continue;

        const linkedFile = app.metadataCache.getFirstLinkpathDest(name, filePath);

        events.push({
            name,
            act: currentAct,
            plotlines,
            completed,
            order: orderInAct++,
            filePath: linkedFile?.path ?? null,
        });
    }

    return { events, actLabels };
}

export async function parseSessions(
    app: App,
    folderPath: string,
    canonEventNames: Set<string>
): Promise<Session[]> {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return [];

    const files: TFile[] = [];
    collectMarkdownFiles(folder, files);

    const sessions: Session[] = [];

    for (const file of files) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) continue;

        const fm = cache.frontmatter;
        if (!fm.played_on) continue;

        const numberMatch = file.basename.match(/^(\d+)$/);
        const sessionNumber = numberMatch ? parseInt(numberMatch[1]) : -1;

        const actMatch = file.parent?.name.match(/^(\d+)$/);
        const act = actMatch ? parseInt(actMatch[1]) : 1;

        const playedOn = parseDate(fm.played_on);

        const characters: string[] = [];
        if (Array.isArray(fm.characters)) {
            for (const c of fm.characters) {
                const m = String(c).match(/\[\[([^\]|]+)/);
                characters.push(m ? m[1] : String(c));
            }
        }

        const content = await app.vault.cachedRead(file);
        const linkedCanonEvents: string[] = [];
        let wlMatch: RegExpExecArray | null;
        const wlRe = new RegExp(WIKILINK_RE.source, "g");
        while ((wlMatch = wlRe.exec(content)) !== null) {
            const linkTarget = wlMatch[1].split("|")[0];
            if (canonEventNames.has(linkTarget)) {
                linkedCanonEvents.push(linkTarget);
            }
        }

        sessions.push({
            number: sessionNumber,
            act,
            playedOn,
            gameDate: fm.game_date ? String(fm.game_date) : null,
            level: fm.level != null ? Number(fm.level) : null,
            characters,
            canonEvents: [...new Set(linkedCanonEvents)],
            filePath: file.path,
        });
    }

    sessions.sort((a, b) => {
        if (a.playedOn && b.playedOn) return a.playedOn.getTime() - b.playedOn.getTime();
        if (a.playedOn) return -1;
        if (b.playedOn) return 1;
        return a.number - b.number;
    });

    return sessions;
}

function collectMarkdownFiles(folder: TFolder, out: TFile[]): void {
    for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
            out.push(child);
        } else if (child instanceof TFolder) {
            collectMarkdownFiles(child, out);
        }
    }
}

function parseDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}
