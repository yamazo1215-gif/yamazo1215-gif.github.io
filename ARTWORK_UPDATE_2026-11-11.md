# Works artwork update · 2026-11-11

Reviewed release pages and actual cover images individually. The page now has artwork for 100 of 102 Works: 24 previously empty entries filled, three generic/site-wide images replaced, and one no-image placeholder removed.

`manual-artwork-sources.json` records the exact source page, original asset URL, release/edition, and local file for every added or replaced image. Original aspect ratios are preserved. The Lefty Hand Cream entry uses its official performance-video thumbnail, not a fabricated CD jacket. Bonus-disc songs use their enclosing package and state the release in Works details. A-channel entries remain tied to the existing 2017 BOX edition.

Corrected clear title spelling (ETERNAL GOD, MIX SEASONS, HEAVENS DOOR, MASTER ARTIST, Underworld, ゆうがた), the Lefty Hand Cream title/artist order, the folclore Remix qualifier, and the original package date for オレンジ (2011-02-23).

Remaining without artwork:
- ないものねだらせたもん勝ち / Emoria: source restrictions and access refusal; no replacement adopted.
- SAO Alicization War of Underworld #2: the existing `noimg.jpg` was removed; the researched official replacement was not adopted because that site explicitly prohibits unauthorized use.

Validation: all Node tests pass; the static build succeeds; source data retains all 102 work IDs; all added local files are verified image files. Browser screenshot validation was unavailable in the execution environment. No UI/CSS/JavaScript rendering behavior was changed.
