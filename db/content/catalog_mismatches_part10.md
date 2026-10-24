# Catalog mismatches found while writing overviews, part 10

These slugs were skipped by `game_overviews_part10.sql`: the IGDB row matched to
the slug describes a different product than the shops' listings actually sell.
Fix the IGDB match (or the listing → game mapping) before writing copy for them.

| Slug | IGDB row | What the shops sell |
|---|---|---|
| `civil-war-ii` | Civil War II (Ageod, 2014) — PC turn-based grand strategy | Digikala: a "Civil War" disc for PlayStation 2 |
| `killzone-2` | Killzone 2 (Guerrilla, 2009) — PS3 shooter | Digikala (2 rows): the original *Killzone* for PlayStation 2 |
| `lion-king-ii` | Lion King II (Gamtec, 1995) — unlicensed Sega Mega Drive platformer | Digikala: a "Lion King" disc for PlayStation 2 |
| `jumanji` | Jumanji (Parker Brothers, 1996) — no summary/genres, pre-PS era | Nakhlmarket `jumanji-ps5`: a modern Jumanji game for PS5 |
| `driver-san-francisco` | Driver: San Francisco (Ubisoft, 2011) — PS3/X360/PC only | Digikala "عصر بازی" edition — an Iranian-published PC DVD; the game has no PS4/PS5 release |
| `resident-evil-operation-raccoon-city` | RE: Operation Raccoon City (Capcom, 2012) — PS3/X360/PC only | Digikala "عصر بازی" edition — an Iranian-published PC DVD; the game has no PS4/PS5 release |
| `the-last-of-us-complete-collector` | The Last of Us (Naughty Dog, 2013) — PS3 original incl. Factions multiplayer | Nakhlmarket: a PS5 "Last of Us Complete" collector's disc (PS5-era release, not the PS3 game) |
