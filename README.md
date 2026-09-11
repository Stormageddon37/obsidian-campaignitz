# Campaignitz

An [Obsidian](https://obsidian.md) plugin for visualizing tabletop RPG campaign plotlines. Track canon events across acts and storylines, overlay your session history, and always know where you are in the story.

## Features

- **Plot grid visualization** — SVG timeline with acts as columns and plotlines as rows
- **Canon event tracking** — parsed from a single markdown file; completed vs. pending events shown as filled/hollow nodes
- **Multi-plotline events** — events spanning multiple plotlines are visually connected with dashed lines
- **Session overlay** — session markers positioned within their act column, spaced by progress
- **"You Are Here" marker** — gold arrow showing your current position based on session dates
- **Click to navigate** — click any event or session node to open the corresponding note
- **Pan and zoom** — drag to pan, Ctrl+scroll to zoom
- **Embeddable** — embed the timeline in any note with a `campaignitz` code block
- **Configurable** — number of acts (1-6), plotline names and colors (1-6), custom file paths

## Setup

1. Install and enable the plugin
2. Configure paths in Settings > Campaignitz:
   - **Canon Events file** — a markdown file listing events by act (default: `Plot/Lines/Canon Events.md`)
   - **Sessions folder** — folder containing session notes with `played_on` frontmatter (default: `Plot/Acts`)
3. Open the timeline via the ribbon icon (map) or command palette: "Open Campaign Timeline"

## Canon Events Format

Structure your canon events file with act headers and checkbox items. Assign plotlines with wikilinks in parentheses:

```markdown
## Act 1
- [x] [[The Raid on Northgate]] ([[A]], [[B]])
- [x] [[The Missing Diplomat]] ([[A]])
- [ ] [[Siege of the Capital]] ([[A]])

## Act 2
- [ ] [[Into the Abyss]] ([[A]])

## Act 3
- [ ] [[The Final Reckoning]] ([[A]])
```

## Session Notes Format

Session notes are markdown files with YAML frontmatter:

```yaml
---
played_on: 2025-05-08
game_date: 0242-10-24T00:00:00
level: 1
characters:
  - "[[Aldric]]"
  - "[[Mira]]"
---
```

The plugin detects which act a session belongs to based on its folder (e.g., `Plot/Acts/1/` = Act 1). Canon event references are detected by scanning session body text for wikilinks matching known events.

## Embedding

Embed the timeline in any note:

````markdown
```campaignitz
height: 600px
```
````

## Manually installing the plugin

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/campaignitz/` folder.
