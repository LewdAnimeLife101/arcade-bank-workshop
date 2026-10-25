# Arcade Bank Workshop

Public browser-local edition of our Arcade Bank Editor. Seven registry profiles
are included: Unity 0.928, Liberty 0.233, Mineralz 2.62, Reign of Chaos 0.291,
Fallen World 0.84, MineralZ Evolution [Updated] 2.58 and Probes vs Zealot 2 Updated 2.118. No game assets were copied from the
reference restorer website. These are audited source versions, not a claim
that every currently published map accepts edited banks.

## Run and verify

Run `python tools/serve.py`, then visit `http://127.0.0.1:8766/`.
Run `python -m unittest discover -s tests -v` and
`node --test tests/browser_helpers.test.mjs`.
No npm install or build step is needed. The exact Python engine shipped in
`dist/engine.zip` is used by both the bridge tests and browser worker.
Run `python tools/verify_bundle.py` to verify its reviewed hashes and the public
data boundary. Its source is contained in the ZIP; extract it to inspect it.

## Public-data boundary

There is no bank-upload endpoint, analytics, login or network request containing
bank data. All decoding, validation and signing run in a dedicated local worker
using the bundled Pyodide runtime. Synthetic examples use fictional handles.
Original game assets, maps, personal saves and personal account lists are absent.
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

MineralZ Evolution 2.58 now exposes 67 fields (58 editable), covering role wins,
achievements, challenge skins, building cosmetics and further difficulty records.
Prestige and Impossible checks remain read-only and are not fully validated.
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
