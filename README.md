# Arcade Bank Workshop

Public website: https://starcraft-bank.github.io/2026-bank-editor/

Public browser-local edition of our Arcade Bank Editor. Seven registry profiles
are included: Unity 0.928, Liberty 0.233, Mineralz 2.62, Reign of Chaos 0.291,
Fallen World 0.84, MineralZ Evolution [Updated] 2.58 and Probes vs Zealot 2 Updated 2.118. No game assets were copied from the
reference restorer website. These are audited source versions, not a claim
that every currently published map accepts edited banks.

## Run and verify

Run `python tools/serve.py`, then visit `http://127.0.0.1:8766/`.
Run `python -m unittest discover -s tests -v` and
`node --test tests/*.test.mjs`.
No npm install or build step is needed. The exact Python engine shipped in
`dist/engine.zip` is used by both the bridge tests and browser worker.
Run `python tools/verify_bundle.py` to verify its reviewed hashes and the public
data boundary. Its source is contained in the ZIP; extract it to inspect it.

## Public-data boundary

There is no bank-upload endpoint, login or network request containing bank data.
A separate Abacus request counts approximate unique public-site browsers; it carries
only a fixed site counter key. Cookies, referrer, bank/account details and editor
state are not included. The provider receives ordinary request network metadata. All decoding, validation and signing run in a dedicated local worker
using the bundled Pyodide runtime. Synthetic examples use fictional handles.
Only the seven small map-identification thumbnails are included as artwork;
see `dist/assets/maps/NOTICE.txt`. Full maps, game data, personal saves and
personal account lists are absent.
The static web host still receives ordinary asset requests and visitor network
metadata. Closing the page discards unsaved sessions.

The visitor must choose a StarCraft II folder before discovery can read it.
Relative folder paths distinguish accounts, authors, main banks and backups.
Discovery lists only registered main filenames directly in
`Accounts/<account>/<player>/Banks/<author>/`. Nested backup/export copies and
rotating backup filenames are excluded in both folder-picker implementations.
Multiple canonical candidates remain separate and show their relative paths;
timestamps never decide which account, author or mode to use.
Manual file opening remains available. Switching maps/accounts preserves edits
in memory; separate main filenames and authors have separate sessions.
New visitors first see a folder-selection welcome dialog. A successful scan
closes it and lists the current-bank counts on the map dashboard. Selecting a
map shows its already-discovered banks; scanning never auto-opens or writes them.
A remembered folder with granted read permission is rescanned on return, skipping
the welcome step. If permission expired, a user gesture can reconnect it.
Cancellation keeps the welcome step open; manual-file users can skip it.
The initial map dashboard uses the same profile registry as the editor selector.
All maps returns to that dashboard without discarding sessions or folder access;
cards show when a profile has edits in progress. Refresh starts at the dashboard.

Replacement uses the shared browser save guard for all profiles: validated
output, per-save main-menu confirmation, original-file hash checks, a verified
IndexedDB backup, a staged File System Access write and read-back verification.
Browser APIs cannot use the desktop OS saving backend or prove game menu state.
Direct replacement requires a browser exposing writable file handles (normally
desktop Chrome/Edge). Other browsers export copies. Recovery backups belong to
this browser/origin and are lost if its storage is cleared; download independent
copies from Recovery vault. No game process is manipulated.

## Limitations

Profile checks do not prove live acceptance or establish the map publication
that wrote a bank. Fallen World's 0.85 account restrictions are enforced by the
map and cannot be removed by bank editing. Extras purchases are session-only.
Original unknown fields are handled by the existing codecs; unsupported data is
preserved or rejected rather than guessed. The website does not change ownership.

The existing desktop codec suite passed 1,415 tests during this port. Browser
integration and save-guard tests are additional checks, not published-match tests.
Third-party runtime licenses and source URLs are in `dist/THIRD-PARTY.txt`.

Fallen World's funded-skills action takes the visitor's existing FWLSBank2,
preserves other slots/settings, and exports a reviewed ZIP containing both banks.
It does not replace half of a two-file dependency. Install both together outside
a match after retaining independent originals. It reports the affordable Special
ranks and the session-only Extras purchases explicitly.

## October 2026 profile expansion

MineralZ Evolution 2.58 exposes 72 logical fields (66 editable), plus named
unlock and prestige-perk availability rows. Prestige and Impossible progression
use the verified native arithmetic model; their dependent checks are calculated
automatically. Difficulty-completion flags are distinct from highest-night records.
See `docs/mineralz-evolution-258.md` for evidence and scope.

Probes vs Zealot 2.118 supports ProbesvZealot2, PvsZ2GameplayOptions and
PvZ2Options2 as separate files under one map. Reward flags synchronize their XP
requirements; wins/losses synchronize game counts and points synchronize rank.
Encrypted PvZ2MMR and unverified cosmetic selections are not editable.
Source coverage is included in the packaged pvz_editor/coverage.json.

Mineralz Survival 2 adds prerequisite-checked Probe skins, named achievements
and a read-only calculated talent-point total. Protection arithmetic is unchanged.

The folder button is **Select your Starcraft folder**. One scan supplies every
map profile. Chrome/Edge can remember the selected directory handle in IndexedDB;
permission may need renewing with **Refresh banks** on a later visit. Folder
fallback uploads stay local and remain selected for the current tab only.
Neither folder selection nor refresh changes pending edits or writes banks.
Input changes are captured immediately, including before a profile switch.

No published-match acceptance test is claimed for these expansions.

Account choices display player names and regions when SC2's local account
shortcuts provide them. The site reads only shortcut target metadata under the
selected StarCraft II folder; it never launches shortcuts or follows their
paths. Account IDs remain the identity used for filtering, sessions and saves.
Duplicate display names are disambiguated; missing names fall back to IDs.
No names or private account mappings are bundled or uploaded.


Every profile now has **Edit bank**, **Unlock All** and **Validation** pages.
Edit bank groups progression, heroes, skills, equipment, achievements, records,
appearance and preserved data; search spans all fields. Reign separates known
perks from unmapped entries and equipped glyphs from each hero's storage.

The two shared unlock presets stage validated drafts only. **Unlock all** uses
supported progression targets and generous public-record floors. **Unlock all
(with legit stats)** uses an explicitly authored, lower public-record template
while retaining functional prerequisites. It is not proof of earned play.
Neither option promises literal all-max support: exclusions are listed before
applying, including Survival 2 protection arithmetic, absent Reign carriers,
Fallen companion allocations and external account entitlements. No natural
maximum is invented for uncapped currencies or lifetime counters.

Map-specific actions include Reign's seven progression categories, powerful
loadouts and statistics reconciliation; Fallen's existing two-bank skills
workflow; MineralZ Evolution menu and prestige plans; and Liberty jewel tools.
Original-file validation, manual opening, retained folder selection, independent
backups, freshness checking and explicit confirmed replacement remain in place.


The footer shows **Unique visitors**, starting 26 October 2026 in a separate
counter. The previous page-load total is preserved, not relabelled as unique.
A fixed localStorage flag remembers a browser; no visitor ID is generated or sent.
Refreshes and return visits read the count without incrementing it. Web Locks
serialize first visits across tabs where available. Different browsers/devices,
private browsing and cleared storage can count again; this is not unique people.
Localhost reads only. Other preview hosts are inactive. Blocked storage reads
only, and the flag is stored before a hit to prevent retries after uncertain
network failures (which can undercount). Ad blockers and public counter
manipulation also affect accuracy. Counter failure never blocks the editor.
No external JavaScript is loaded and no administration secret is bundled.
Counter API documentation: https://v2.jasoncameron.dev/abacus

The GitHub repository is `Starcraft-Bank/2026-bank-editor`. The counter key
remains unchanged to retain its total. Browser permissions and storage belong to
the origin: visitors must select their folder again on the new hostname, and
local recovery backups are not transferred between hostnames.

## Reign of Chaos workshop (0.291)

Reign uses visible category and hero buttons. Equipment has 121 named catalogue
entries, nine source rarities, tooltip stats, and explicit active-equipment,
hero-storage and shared-stash destinations. Adding, moving and removing items
stages a validated preview; active changes synchronize the saved form's first
equipment loadout. Existing unsupported units, unknown items and native locks
are preserved. Hardcore's shared stash is unavailable.

Glyphs have separate hero storage and equipped views, three named rarities,
84 item-derived powers, and 27 stat types with tier ceilings. Creating a glyph
does not equip it. Required Glyph Crafting Power adjustments are explicit.
Named evolution controls synchronize the saved form, unlock record and minimum
XP; missing saved heroes are not synthesized. Ascendancy exposes named abilities
and passive nodes. Charm ownership and five normal per-hero charm loadouts are
separate controls. Reserved encodings stay out of ordinary gameplay categories.

Source identity remains map 1/326447, cached publication 0.291, archive SHA-256
`1abc89826cc502f391ec7359d89d78f58f795f01c209eac904a77d3d3abc20cf`.
The audit used the existing extracted Galaxy scripts and localized item text;
REA inventoried the derived extraction ZIP, not the unsupported original MPQ.
Signed synthetic output is tested through the exact bundled browser engine.
Earlier isolated native tests cover item serialization and slot restoration;
this rebuild has not been tested in a published Arcade match. Dynamic tooltip
values remain marked as dynamic rather than presented as computed final stats.

Both Reign Unlock All variants include standalone playtime and shop-clear
records for all 11 named heroes, even if a hero has no saved inventory yet.
Full distributes a 1,290-hour floor across them in 20-second ticks and gives
each at least 100 clears of shops 1–9; larger existing counters remain.
The lower-record template distributes 129 hours and assigns two clears of
each supported shop per hero. These are authored values, not natural caps or
verified play history. Global time and clear totals cover all hero counters,
including preserved reserved-hero history. Hero 6 and shop 10 are untouched.
Missing hero units are still not synthesized, and solo dungeon records/times
remain separate from shop-clear counts. Named manual choices (charm loadouts,
mutually exclusive ascendancy abilities and equipment preferences) are not
all selected at once by Unlock All.

All seven profiles now use overview cards and visible category/group buttons.
The map button returns to the illustrated map dashboard. Account, difficulty,
tier, effect and loadout choices use searchable, paginated button cards in a
dialog; no native select menus or datalists remain in the owned interface.
Long collections such as Liberty's 100 jewel slots use group search and pages.
Selection values, bank validation, staged edits, discovery and save checks are
unchanged. Reign's nested glyph form uses the same choice component.
