# APMs

APMs are the location codes used throughout the game. Every quest objective, ship docking position, and travel reference points to one of these numbers, so knowing which APM matches which place makes the rest of the game much easier to navigate.

This list is **not exhaustive**. New APMs surface in quests and travel logs all the time. The article will be updated as more are discovered or confirmed.

A pattern is emerging in the numbering, though it is not strict:

- `x00` is the main body of a planet (100 Mercury, 200 Venus, and so on).
- `x06` is the orbital station of that planet (106 Mercury Station, 506 Jupiter Station).
- `x66` also follows the standard space station layout (parent body still to confirm).
- `x01`, `x02`, `x05` are moons of the parent planet (401 Phobos, 402 Deimos, 505 Io).
- The 300s also include Earth-side surface locations (Ratropia and the rooms reached from it).

Inside any APM, the **ZONE** number identifies the specific room or area. Most APMs are subdivided into many zones (for example Ratropia has dozens of room zones, Mars has districts and orbital points).

---

## Space (000)

- **0:** Space (the default APM when not docked or planetside)

---

## Space Stations (shared layout)

All orbital and station-class APMs share the same internal layout. Whether you dock at Mercury Station, Venus Station, or Mars Station, the zones inside refer to the same modules.

![Space Station map](images/space-station-map.png)

Map by MakerJay

| Zone | Module |
|---|---|
| 51 | Command Nexus |
| 52 | Habitation Hub |
| 53 | Research Ring |
| 54 | Engineering Bay |
| 55 | Docking Port |
| 56 | Observation Deck |
| 57 | Medical Module |
| 58 | Storage Sector |
| 59 | Life Support System |

Known stations using this layout:

- **106:** Mercury Station
- **206:** Venus Station
- **306:** Earth Station
- **406:** Mars Station
- **466:** Unknown station (layout confirmed, parent body to identify)
- **506:** Jupiter Station
- **806:** Neptune Station

---

## Rustwind Generators (shared layout)

Rustwind Generators are industrial facilities found on Mars. Multiple Rustwind Generator sites exist, but they all share the same internal layout, so once you know the zone layout you can navigate any of them.

![Rustwind Generator map](images/rustwinds.png)

Map by MakerJay

| Zone | Area |
|---|---|
| 49 | Chimney Tower |
| 50 | Detention Block |
| 51 | Grinder Alley |
| 52 | Smelter Pit |
| 53 | Chimney Tower |
| 54 | Cyclone Chamber |
| 55 | Loading Dock |
| 56 | Radioactive Furnace |
| 57 | Chimney Tower |
| 58 | Conveyor Corridor |
| 59 | Gearhead Gate |
| 60 | Command Center |
| 61 | Chimney Tower |

Zones 49, 53, 57, and 61 are all named "Chimney Tower" (each generator has 4 of them of them).

---

## Mercury (100s)

- **100:** Mercury
- **106:** Mercury Station (see Space Stations section)

---

## Venus (200s)

- **200:** Venus
- **206:** Venus Station (see Space Stations section)

---

## Earth (300s)

- **300:** Earth Orbit
- **301:** Luna (also referred to as the Luna System)
  - Zone 5: Copperclaw Canyon (Aristoteles)
  - Zone 7: Luna Mesa Mart, Moonhowl Mesa (Endymion)
  - Zone 28: Mechmoon Mesa (Galilaei)
  - Zone 35: Armstrong's Vault (Arago)
  - Zone 55: Artifactors' Arena (Arzachel)
  - Zone 73: Moonclaw Mountains (Moretus)
- **302:** Nerva Beacon
- **306:** Earth Station (see Space Stations section)
- **350 to 354:** Labs above Up-shire
- **355:** Ratropia
  - Zone 46: Royal Road North
  - Zone 54: Imperious Falls
  - Zone 55: Area55 North
  - Zone 62: Vault of Webs
  - Zone 68: Town Hall
  - Zone 80: Tavern
  - Zone 112: Queens Quarry
- **356:** Rankle River
  - Zone 42: Kraken's Lair
  - Zone 55: Eastshire Jetty
- **360:** Under Down-shire
- **366:** Barrows End

---

## Mars (400s)

- **400:** Mars
  - Zone 55: Ratropian Submersible Anchorage
  - Zone 211: Helmswatch
  - Zone 258: Blackshores District
  - Zone 472: Promethea 472
  - Zone 565: Icelantis Observatory
- **401:** Phobos
  - Zone 54: Polyastral Haven (Todd)
- **402:** Deimos
- **406:** Mars Station (see Space Stations section)
- **466:** Station with standard layout, parent body still to confirm (see Space Stations section)

Mars also hosts multiple **Rustwind Generators**. They all share the same internal layout (see Rustwind Generators section).

---

## Jupiter (500s)

- **500:** Jupiter
- **505:** Io
- **506:** Jupiter Station (see Space Stations section)

---

## Saturn (600s)

- **600:** Saturn
- **601 to 699:** Saturn's moons (up to 99 of them)

---

## Uranus (700s)

- **700:** Uranus

---

## Neptune (800s)

- **800:** Neptune
- **806:** Neptune Station (see Space Stations section)

---

## Far system

- **100 000 000 and above:** Oort cloud asteroids

Some known asteroids in this range:

- **168 940 424:** Lalothen's holding asteroid
  - Zone 55: Kirsch Hanger
- **199 990 000:** Oortian Capital
  - Zone 58: Engineering Core
