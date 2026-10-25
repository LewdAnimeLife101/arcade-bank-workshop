# MineralZ Evolution [Updated] 2.58 — bank coverage

Map 1/344126, cached publication 2.58. Verified archive SHA-256:
`fe86e707f0dc45556ce2079dea830b696a75706ceb99a579b8b5e73c9794c57e`.
Evidence is recovered `SCRIPTS.galaxy` plus its descriptive catalog. No published-match
acceptance test is claimed. The latest live publication has not been checked.

The profile exposes saved progression and logical completion controls, plus 14 derived prestige-perk availability descriptions. Check values are calculated automatically; the account-dependent Imperius donor flag remains preserved.
All bank get/set/key-existence/load call sites were inventoried, including dynamic
role, achievement, challenge-skin and building-skin families. Original unknown
sections and keys stay unchanged. No original bank is bundled in the editor.

## Editable storage and dependencies

| Family | Coverage and source evidence |
|---|---|
| Probe | `NIVO`, `EXPP`, `WINS`; loader 2634–2664, unit restore 7579–7580, save 9329–9334, win rewards 12513–12529. `NIVEXP` regenerated as NIVO×1224 when level changes. The game restores XP then explicitly sets level; editing level does not invent an XP curve. |
| Normal/Elite | `NIGHTMNHD`, `NIGHTELITE`; KILLED=NIGHTMNHD×4788; Elite completion sets HEAL=21634 at night≥35. Loader 2627–2637, 2666–2669; writers 9898–9903,12531–12539. Normal writable≤36, Elite≤51 follow explicit reset guards. |
| Nightmare/Hell | `NIGHTNMAR`, `HL`; XPNB=NIGHTNMAR×1655; HAL=HL×1631; completion markers XPNQ=59120/HLO=25265 at≥35. 2638–2656,9905–9911,12544–12551,16345–16356. Writable caps316/321 are arithmetic-safe limits, **not normal-play wave caps**. Victory commonly writes35. Lowering a record retains earned completion markers, matching existing behavior. |
| Easy | Boolean `easy_complete` stores EASY35/0. Completion writer12535; first-five-skin unlock check6380–6387. |
| Legacy special skin | Boolean `special_normal` stores ZUHIB121186/0. Writer2668 and16393; skin12 additionally needs level≥101 and Nightmare marker XPNQ59120 (6397). This field does not change those separate prerequisites. |
| Role wins | Six decoded counters `role_a/e/i/f/o/mc`: bank Sec/a,e,i,f,o,mc multipliers4,7,9,5,13,6. Definitions3751–3828; get/compare1632–1653; saving12523; masteries6295–6335. Thresholds0,3,8,15,25,40; dual masteries require both roles. 100-win cosmetics use role checks. Mercenary wins cannot grant its WIP account eligibility (6308–6315). |
| Achievements | All23 `ach0`…`ach22`, hashed section/key/value string encoding. Constant total30; definitions5019–5146; hash1106–1194; read1558–1583; award1508–1527. Python signed-int32 recurrence is cross-checked with an independent JavaScript Math.imul port and fixed vectors. Existing original banks had no achievement entries to corroborate. This is **source + offline-vector evidence**, not native runtime proof. |
| Challenge skins | kev/ks0–5,7–8 boolean flags; names3857–3919; key mapping3921–3925; award1530–1537; read1585–1586. Enabling Godlisk additionally sets reset/cs1=true to prevent the one-time skin rework reset (2698–2705). Disabling removes the key because saved cosmetic restore uses existence (2220). |
| Building cosmetics | All11 saved selectors in skk: wall,photon,robo,heal,gen,base,aa,core,refinery,tesla,toweraura (2790–2880). Supported selections include default, unlocked-by-default generator Forge, role and achievement choices. Excludes exclusive/donor/TBA choices; preserves original choices unchanged. Selection and prerequisite edits are checked together; unmet prerequisites reject output with a field-specific message. Source restore1710–1726; selectors2890–3173. |
| Camera | Sec/zvl int2…99. Command saves1…100 (16174) but loader applies only strictly1<value<100 (16201); editor offers only effective values. Missing value displays0 and stays absent unless changed. |

Building achievement dependencies follow the **actual wrapper bodies**, even where
names are inconsistent: Mineral→ach0, Vespene→ach1, Plasma→ach2, RedCrystal→ach3
(1600–1614). Thus Tal'Darim photon/robo uses ach2, healer ach1, generator ach3.
Purifier choices use wrappers ach5…ach9 as assigned. Existing unknown selected
options can be preserved but cannot be newly assigned through this editor.

## Preserved or derived data

| Data | Reason |
|---|---|
| PHR,PR,PHR2 | Prestige rank editable 0–100; PR and PHR2 regenerated together. 100 is the highest identified unlock milestone, not a claimed game hard cap. Loader requires inverse count(PR)+PHR2=PHR and rejects PHR2>0 with PHR<42 (2600–2612). Award recurrence uses (PR+39)×1.2 for first42, then incrementsPHR2 (15155–15181). All 146 isolated native prestige checks passed. Editing rank does not replay the in-game purchase reset of level/wins. Source-valid noncanonical original PR remains untouched. |
| im,ims,is,imval | Impossible highest night and victory/DNA completion are editable logical controls. Account-specific im/is/imval values are regenerated automatically using native-verified Q12 math (2547–2555,2672–2696,6282–6285,6400–6403,9913–9915,12555–12562). 30 complete synthetic cases and 21 rounding cases passed; six deliberate zero-divisor cases are unsupported. Highest-night ceiling52427 is an arithmetic storage boundary, not a normal-play wave limit. Normal victory is35; the selection summary only displays completed when ims==35. Final skin also requires level200 and both exact tokens. The old loader rejection block at2693–2696 is commented out; a mismatching original record is reported rather than treated as proof of corruption. Zero-divisor accounts keep other edits available. |
| kev/ks6 | Imperius donor entitlement flag, read-only. Description3900–3905; other eligibility originates from runtime account data. |
| Sec/skn | Editable dropdown for eligible default, prestige and challenge skins. Options refresh after previewing prerequisite edits. Selection and prerequisites are checked together, including lowering rank or removing a selected challenge flag. Existing unknown/personal/event/direct-donor selections are preserved, not newly granted (2148–2247). |
| reset/cs1 | Migration marker; generated only when enabling Godlisk, otherwise preserved. |
| VERSION,VERS | Reset/startup metadata, never a publication discriminator. VERSION only reset/admin writers; no loader read. Preserved. |
| CODID | Map-side rejection marker. If17, editing is blocked; not cleared or fabricated. |
| NIVEXP,KILLED,HEAL,XPNB,XPNQ,HAL,HLO | Derived/check/earned completion fields, updated only for the associated changed record, otherwise preserved. |
| Staff/donor/personal/event identity | Runtime allowlists and donor arrays; not freely editable bank stats. No ownership conversion or account-gate bypass. |
| Primary/secondary skills, colours, specialities, probe skin tier, mastery unlocks | Derived in-game from level, difficulty markers and role counters (6286–6453), not independent persisted switches. The current match choice is not a bank item loadout. |
| Achievements points | Recomputed from achieved flags and catalog point weights; no separate bank field found. |

## Verification

`python -m unittest test_expanded -v`: seven focused tests covering native signature
context, exact no-op bytes, unknown preservation, all role encodings, dependency
rejection, all23 achievement values, challenge migration, donor/read-only enforcement,
safe numeric boundaries, Nightmare/Hell marker updates and retained completion.
Hash vectors were also independently evaluated with JavaScript signed-int32 math.
These checks do not establish published-game acceptance.

## Prestige perk choices

Rank 12 unlocks all 14 choices. The map stores prestige rank, not a bank-side
selected-perk field. `gv_prestigeChoose` is a match-local selection, so the editor
shows availability and descriptions and provides **Unlock prestige perk choices**
(rank at least12) and **Set prestige rank to 100** (rank at least100).
Neither button activates every perk at once or changes separately saved achievement flags. Passive role bonuses cap at40;
prestige cosmetics unlock at10/20/30/40/50; the final identified achievement and
secret-worker milestone are100. Existing progression is not reduced by presets.

There is one shared weighted WINS counter and per-role counters, not a separate
win count for every difficulty. Easy has a completion marker but no saved highest
night. The editor exposes the real storage instead of creating unsupported fields.

## Native verification, 25 October 2026

The isolated diagnostic ABEMZEProbe20261025 used a Survival2 archive as a map
container, replacing its gameplay script and bank list with Evolution2.58
formula tests. This explains its inherited loading-screen name; it did not run
Survival's bank logic. It wrote only a dedicated scratch bank. All76 original
Arcade-bank hashes remained unchanged. This verifies native arithmetic, **not**
loading an edited bank in the published Evolution map.

Prestige:146/146 checks. Impossible:30 complete synthetic account/night cases,
six expected zero-divisor exclusions, all nine constants and intermediate values,
and21 signed rounding cases. Native Round ties toward positive infinity. The
final constant intentionally skips its immediate predecessor; both details are
covered by regression tests. Sanitized synthetic native vectors are in
`tests/fixtures/mze_native_impossible.json`; no real player bank is published.
