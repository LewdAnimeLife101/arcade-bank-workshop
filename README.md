# Arcade Bank Workshop

Public browser-local edition of our Arcade Bank Editor. Six registry profiles
are included: Unity 0.928, Liberty 0.233, Mineralz 2.62, Reign of Chaos 0.291,
Fallen World 0.84 and MineralZ Evolution [Updated] 2.58. No game assets were copied from the
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

Replacement uses the shared browser save guard for all six profiles: validated
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
