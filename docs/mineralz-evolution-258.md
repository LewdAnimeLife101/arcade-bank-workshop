# MineralZ Evolution [Updated] 2.58 — bank coverage

Map 1/344126, cached publication 2.58. Verified archive SHA-256:
`fe86e707f0dc45556ce2079dea830b696a75706ceb99a579b8b5e73c9794c57e`.
Evidence is recovered `SCRIPTS.galaxy` plus its descriptive catalog. No published-match
acceptance test is claimed. The latest live publication has not been checked.

The expanded profile has **67 displayed fields, 58 editable and 9 read-only**.
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
| PHR,PR,PHR2 | Displayed read-only. Loader requires inverse count(PR)+PHR2=PHR and rejects PHR2>0 with PHR<42 (2600–2612). Award recurrence uses (PR+39)×1.2 for first42, then incrementsPHR2 (15155–15181). Exact native fixed-point multiplication/division has not been corroborated for this recurrence. Do not emit rank-only edits. |
| im,ims,is,imval | Displayed read-only. Impossible night/completion/skin checks use player-dependent native square roots, modulo and rounding (2547–2555,2672–2696,6282–6285,6400–6403,9913–9915,12555–12562). The rejection block at2693–2696 is commented out, but checks still gate unlocks; absence of rejection is not proof of safe regeneration. |
| kev/ks6 | Imperius donor entitlement flag, read-only. Description3900–3905; other eligibility originates from runtime account data. |
| Sec/skn | Displayed read-only. Saved cosmetic can select prestige, personal, event, challenge or donor families, each with separate runtime eligibility (2148–2247). Supported unlocks can be changed and their appearance selected in-game. Existing value preserved. |
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
