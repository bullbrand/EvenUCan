# Parts Inventory & Cookbook — Design Notes (v1.9.43)

## What it does

### 1. Parts Inventory
Users can mark parts they already own directly in the Parts Library browser.
- A ★ star button on each part row (and in the preview pane) toggles "I own this"
- Owned parts sort to the top of every search result
- A "My parts" filter in the kind drop-down shows only owned parts
- The inventory is saved in localStorage (key: `evenucan-inventory`), keyed by part title
- Owned parts are shown with a ✓ in the parts list in the Enclosure Wizard

### 2. AI-Aware Design
When the user clicks "Start a project" or "Fill in automatically", the AI prompt
now includes: "Parts the user already owns: [list]". The AI instruction says to
strongly prefer owned parts and to explain if it must suggest a new one.

### 3. Parts Cookbook
A new button "What can I make with my parts?" appears in:
- The Parts Library panel (bottom of the My Parts filter view)
- The Enclosure Wizard welcome step

Clicking it sends the owned parts list to the AI with a prompt:
"The user owns these parts: [list]. Suggest 3–5 practical projects, ordered by
how many of these parts each one needs. For each project: a one-line name, a
one-sentence description, and a list of which owned parts it uses. Output JSON."

The response is shown as cards. Each card has a "Start this project" button that
pre-fills the wizard with the suggested parts.

## Code changes

### New globals (after existing globals section ~line 9710)
- `loadInventory()` / `saveInventory(inv)` — Set<string> in localStorage
- `ownedInv` — the live Set, loaded once at startup

### Modified: `pickFritzing()` (~line 9794)
- Each `.fzRow` gets a star `<button class="fzStar">★</button>` on the right
- Preview pane's button row adds `<button data-f="own">★ I have this</button>`
- `show()` sorts owned parts first (stable — owned at top, rest unchanged)
- Select adds `<option value="owned">My parts</option>`
- Clicking ★ toggles owned, re-renders without closing dialog

### Modified: AI prompt builder (wherever the parts-AI call is built)
- Add owned parts list to system context

### New: `cookbookPanel()` function
- Calls AI with cookbook prompt
- Renders result as project cards with "Start this project" buttons
