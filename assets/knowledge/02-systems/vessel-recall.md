# Vessel Recall

The `!recall` command brings a stranded vessel back to a player's hangar. It is a safety net for genuine emergencies (running out of fuel, wrecking in a hostile zone without the resources to recover). The previous version of the system was light enough to be used as a casual fast-travel, so it now carries hard penalties to discourage that.

> Only the **owner** of a vessel can use `!recall` on it. A passenger, a borrower, or anyone else holding the wallet cannot trigger the recall.

> The information below comes from **Lama** and reflects the current design intent. It may be tuned over time, and some of the details may need correction. Treat it as a working reference rather than a final spec.

---

## Why the system changed

The old `!recall` was too open to exploits. It:

- Bypassed the need to actually own a working vessel.
- Devalued existing vessels.
- Discouraged the Patreon support system (the dev's livelihood).
- Broke the player-designed vessel system and future player profits tied to it.

`!recall` still has to exist alongside `!flee` and the upcoming `!escape` for genuine emergencies. The new costs are designed so that players use it only after careful consideration.

---

## Recall costs

Each use of `!recall` requires and consumes:

- **Leadership skill:** at least 1 to be able to use the command.
- **Leadership loss:** 0.001 per use.
- **Stamina:** a stamina count is required.
- **Stamina loss:** 50 per use.
- **Hangar fee:** the standard hangar charge still applies.
- **Transport cost:** an additional charge in carried coin, scaled with distance (see below).

---

## Transport cost: scaled distance

The transport charge is based on a "scaled distance" between the vessel's APM and the player's APM, capped at 1000 coin:

`scaled_distance = |vessel_APM - player_APM|` (max 1000)

The result is paid out of the player's carried coin.

### Examples

| From | To | Cost |
| :--- | :--- | :--- |
| Imperious Falls (355) | Area 55 North (355) | 1 coin |
| Deimos (402) | Ratropia (355) | 47 coin |
| Mercury (100) | Saturn (600) | 500 coin |
| Ratropia (355) | Kirsch (168 940 424) | 1000 coin (capped) |

For a refresher on what the APM numbers mean and which body each one points to, see the **APMs** article.

---

## Swift Assist (MOOB vessels)

MOOB vessels use a separate "Swift Assist" recall path that bypasses most of the standard penalties above. It is faster and cheaper, but it is not safe in transit: Lycanox bandits can intercept a Swift Assist recall and pirate the player's carried coin along the way.

---

## Coming permissions system

Once the permissions system goes live, a player who picks up a vessel through a quick wallet transfer will not be able to pilot it right away. They will first need to travel to the **Ratropian Town Hall** and **register** the vessel in their name. Registration will carry its own penalties.
