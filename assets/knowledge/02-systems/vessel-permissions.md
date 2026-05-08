# Vessel Permissions

The `!permit` command lets a vessel owner reserve **seats** on their ship for other players. Once a seat has been granted, the targeted player can board the vessel, occupy that seat, and travel along without ever owning the ship.

> The information below comes from **Lama** and reflects the current design intent on the live server test. It may be tuned later and some of the details may still need correction. Treat it as a working reference rather than a final spec.

![Permit command in use](images/vessel-permit.png)

---

## A warning before you hand out seats

The **pilot** seat is the highest-trust slot on any vessel. Whoever holds it can:

- Fly the ship anywhere they like.
- Wreck it on purpose.
- Park it somewhere remote where you may never recover it.

Only grant pilot to players you actually trust. The other crew roles are far lower risk because they are tied to specific stations on board, not to flight control.

---

## Granting and clearing seats

The base form of the command is:

`!permit <vessel> <role> <target>`

The target can be a `@mention`, a raw Discord ID, or `0` to **clear** the seat.

### Examples

| Goal | Command |
| :--- | :--- |
| Assign a pilot by Discord ID | `!permit OORT-01 pilot 409593970994446336` |
| Assign a prospector by mention | `!permit OORT-01 prospector @dioramalama` |
| Clear the gunner seat | `!permit OORT-01 gunner 0` |

You can run `!permit` from anywhere; standing next to the vessel is not required (this may tighten up later).

---

## Shorthand

Both the role name and the command itself accept shorter forms.

**Role names** are matched by prefix. Any of these resolves to *technician*:

`t`, `te`, `tec`, `tech`, `technician`

**The command** has a short alias `.p`. So:

`!permit OORT-01 technician 0`

and

`.p oort-01 t 0`

do the same thing (clearing the technician seat). Casing is ignored: uppercase, lowercase, camelCase all parse the same way.

---

## Boarding and leaving

Once a seat has been assigned to a player, they use:

- `!enter` to be placed in that seat.
- `!exit` to leave the vessel.

A seat is a single slot per role per vessel, so two players cannot occupy the same role at the same time.

> The role-specific abilities (gunner gunnery, technician repairs, prospector scanning, and so on) are **not wired up yet**. For now `!permit` reserves the seat and nothing more. The behaviours tied to each role are planned for a later update.

---

## How passenger location is tracked

Passengers do not get their position rewritten every time the vessel jumps. Doing that would mean a write per passenger per movement, which adds up fast. Instead:

- While seated, the game considers you to be aboard the vessel rather than at a fixed APM.
- The instant you `!exit`, your character snaps to wherever the ship is at that moment.

So if you board on Earth, the vessel travels three jumps while you stay seated, and you `!exit` at Kirsch, you arrive at Kirsch the moment you stand up.
