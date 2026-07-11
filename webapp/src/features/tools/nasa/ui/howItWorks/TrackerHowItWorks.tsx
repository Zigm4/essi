import { CodeBlock } from '../../../../../design-system/components/CodeBlock';
import {
  KvRow,
  ParamRow,
  QuirkRow,
  StepRow,
  TierRow,
} from '../../../../../design-system/components/InfoRows';
import { IconLock, IconSearch, IconWarningAmber } from '../../../../../design-system/icons';
import {
  IconAltRoute,
  IconCode,
  IconDescription,
  IconFunctions,
  IconLink,
  IconListAlt,
  IconRefresh,
  IconStar,
} from '../toolIcons';
import { HiwCard, HiwHeader, Lead, P } from './hiw';

/** "How it works" sheet for the Object Tracker (tools-live spec §10.3). */

const SBDB_SINGLE = `{
  "object": {
    "pdes": "1",
    "fullname": "1 Ceres",
    "kind": "an"
  },
  "phys_par": [...],
  "orbit": {...}
}`;

const SBDB_AMBIGUOUS = `{
  "code": 300,
  "list": [
    {"pdes": "1996", "name": "Adams"},
    {"pdes": "(2009 BJ81)", "name": "..."}
  ]
}`;

const HORIZONS_WRAP = `{
  "signature": {"source": "NASA/JPL Horizons API", "version": "1.2"},
  "result": "*****\\n Ephemeris / WWW_USER...\\n$$SOE\\n2461164.500 = A.D. 2026-May-04 ...\\n X = 1.234E+08 Y = 5.678E+08 Z = 9.012E+06 ...\\n$$EOE\\n*****"
}`;

const AU_MATH = `au_per_km = 1 / 149_597_870.7
xAU = x * au_per_km
yAU = y * au_per_km
zAU = z * au_per_km`;

const SECTOR_MATH = `distanceAU = sqrt(xAU*xAU + yAU*yAU)
theta = atan2(y, x)              // radians on raw km, sign-equivalent
if theta < 0: theta += 2π
sector = ((floor(theta * 12 / 2π) + 12) % 12) + 1`;

const SL_MATH = `distance_miles = (distanceAU / au_per_km) * 0.621371
slExact   = distance_miles / 3_000_000      // raw double
slRounded = round(slExact * 1000) / 1000    // 3 decimals, for display
slFloor   = floor(slExact)                  // for in-game navigation`;

const CURL_RESOLVE = `curl -G "https://ssd-api.jpl.nasa.gov/sbdb.api" \\
  --data-urlencode "sstr=Ceres"
# → object.pdes = "1"`;

const CURL_FETCH = `curl "https://ssd.jpl.nasa.gov/api/horizons.api\\
?format=json\\
&COMMAND=%271%3B%27\\
&OBJ_DATA=%27YES%27\\
&MAKE_EPHEM=%27YES%27\\
&EPHEM_TYPE=%27VECTORS%27\\
&CENTER=%27500@10%27\\
&START_TIME=%272026-05-04%27\\
&STOP_TIME=%272026-05-05%27\\
&STEP_SIZE=%271d%27"`;

export function TrackerHowItWorks() {
  return (
    <>
      <HiwHeader />

      <HiwCard icon={<IconSearch size={18} />} title="Overview">
        <P>
          {
            'Tracker takes one celestial body (Ceres, Halley, 2020 AB1, …) and returns its current heliocentric position: an X/Y/Z vector in AU, a sector from 1 to 12, and a distance in SL with three precision flavors (exact, rounded, floored).'
          }
        </P>
        <P>
          {
            'Each Track tap fires up to five GET requests across two NASA endpoints. No background work, no caching: every Track is a fresh round-trip.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconAltRoute size={18} />} title="Two-step pipeline">
        <P>
          {
            'Tracking is split into a resolve step and a fetch step. They use different endpoints and have completely different response shapes.'
          }
        </P>
        <StepRow
          number="1"
          title="Resolve"
          body="Turn the user's input ('Halley', 'Ceres', '2020 AB1', '433') into a canonical MPC designation. Up to one GET, often zero."
        />
        <StepRow
          number="2"
          title="Fetch"
          body="Ask JPL Horizons for the body's heliocentric vector today. Up to three GETs (today → yesterday → tomorrow) until one returns data."
        />
      </HiwCard>

      <HiwCard icon={<IconLink size={18} />} title="Endpoints">
        <KvRow label="SBDB single-body" value="https://ssd-api.jpl.nasa.gov/sbdb.api" labelWidth={120} />
        <KvRow label="Horizons" value="https://ssd.jpl.nasa.gov/api/horizons.api" labelWidth={120} />
        <KvRow label="Method" value="GET on both" labelWidth={120} />
        <KvRow label="Auth" value="None on either. Public, no API key, no token." labelWidth={120} />
        <KvRow label="Timeout" value="30 s per call" labelWidth={120} />
        <P>
          {
            'SBDB is JPL’s per-object metadata browser (different from the bulk sbdb_query.api used by Discoveries). Horizons is the ephemeris service shared with System Scan.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconSearch size={18} />} title="Step 1: resolve a canonical ID">
        <P>
          {
            'The user types a name. Horizons wants a clean designation. Tracker tries four strategies, in order, and stops at the first hit. The first three avoid network entirely.'
          }
        </P>
        <TierRow
          tier="0"
          title="Prefilled MPC ID"
          body="When you arrive from Discoveries, the canonical pdes is already known. Skip resolve entirely."
        />
        <TierRow
          tier="1"
          title="Curated catalog"
          body="15 well-known bodies (Ceres, Vesta, Halley-class comets, recent ATLAS comets) are bundled in the app. Match by case-insensitive name. Zero network."
        />
        <TierRow
          tier="2"
          title="Numbered asteroid shortcut"
          body="Input is digits-only and kind is asteroid? It is already a pdes. Use as-is."
        />
        <TierRow
          tier="3"
          title="SBDB sstr lookup"
          body="GET sbdb.api?sstr=<input>. Returns a single match (object.pdes) or an ambiguous list (list[].pdes, take the first). HTTP errors are silently treated as 'not found' so the next tier kicks in."
        />
        <TierRow
          tier="4"
          title="Designation passthrough"
          body="Last resort. If the input has both letters and digits ('2024 G3', 'C/2024 G3 (ATLAS)'), Horizons can resolve it directly. We send it as-is."
        />
      </HiwCard>

      <HiwCard icon={<IconDescription size={18} />} title="SBDB response shapes">
        <P>{'sbdb.api returns one of two JSON shapes depending on whether the query was unambiguous.'}</P>
        <P>{'Single match (e.g. sstr=Ceres):'}</P>
        <CodeBlock text={SBDB_SINGLE} />
        <P>{'Ambiguous match (e.g. sstr=Adams):'}</P>
        <CodeBlock text={SBDB_AMBIGUOUS} />
        <P>
          {
            'Tracker reads only the pdes string from either shape and discards everything else. The fullname and orbital data are interesting but not needed to fetch a position.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconListAlt size={18} />} title="Step 2: Horizons VECTORS request">
        <P>
          {
            'Once an MPC ID is resolved, Tracker asks Horizons for one day’s worth of position vector. Same endpoint as System Scan but with format=json this time.'
          }
        </P>
        <ParamRow
          name="format"
          value="json"
          note="Wraps the Horizons text response inside a JSON envelope. Easier to parse status and error fields than the raw text."
        />
        <ParamRow
          name="COMMAND"
          value="'<pdes>;'"
          note="The canonical designation. The trailing semicolon matters for numbered asteroids: see the next card."
        />
        <ParamRow
          name="OBJ_DATA"
          value="'YES'"
          note="Include the object header. Future versions of Tracker may surface mass, magnitude, etc."
        />
        <ParamRow name="MAKE_EPHEM" value="'YES'" note="Generate the ephemeris (else only the metadata header)." />
        <ParamRow
          name="EPHEM_TYPE"
          value="'VECTORS'"
          note="Cartesian X, Y, Z position vectors instead of RA/Dec angles."
        />
        <ParamRow
          name="CENTER"
          value="'500@10'"
          note="Heliocentric origin. 500 is geocentric; @10 redirects to the Sun's barycenter."
        />
        <ParamRow
          name="START_TIME"
          value="'YYYY-MM-DD'"
          note="UTC. The retry candidate (today, then yesterday, then tomorrow)."
        />
        <ParamRow name="STOP_TIME" value="start + 1 day" note="A 1-day window with a 1-day step yields exactly one row." />
        <ParamRow name="STEP_SIZE" value="'1d'" note="One sample, no waste." />
      </HiwCard>

      <HiwCard icon={<IconWarningAmber size={18} />} title="Three undocumented quirks">
        <P>
          {
            "Reproducing Tracker without these will hit silent 400s and 'No matches found' errors. None of them are in the obvious places of the JPL docs."
          }
        </P>
        <QuirkRow
          title="Numbered asteroids need a trailing ;"
          detail="COMMAND='1' resolves to Mercury Barycenter (NAIF major body code). COMMAND='1;' resolves to Ceres (small body 1). Without the semicolon, every query for a numbered asteroid returns the wrong object."
        />
        <QuirkRow
          title="; must be percent-encoded as %3B"
          detail="Horizons (and many web frameworks) treat an unescaped ; as equivalent to & in the query string, which truncates COMMAND. CharacterSet.urlQueryAllowed includes ; by default, so ESSI adds an explicit removal."
        />
        <QuirkRow
          title="Comet names need stripping"
          detail="'C/2024 G3 (ATLAS)' is the human-readable form. Horizons rejects it with 'No matches found'. We strip the leading C/ or P/ and the trailing parenthetical to get '2024 G3', which Horizons resolves."
        />
      </HiwCard>

      <HiwCard icon={<IconDescription size={18} />} title="Horizons response (JSON wrap)">
        <P>
          {
            "With format=json, Horizons returns a thin JSON envelope whose 'result' field contains the same plain-text ephemeris System Scan parses."
          }
        </P>
        <CodeBlock text={HORIZONS_WRAP} />
        <P>
          {
            "The 'result' string follows the same conventions as the text mode: an $$SOE/$$EOE-bracketed ephemeris block, dates flagged with 'A.D.' and 'TDB', vectors on lines starting with 'X ='. The same parser System Scan uses works here unchanged."
          }
        </P>
        <P>
          {
            "If the body has no ephemeris for the requested date, 'result' is an empty string or contains 'No ephemeris available'. Both cases land Tracker in the day-retry loop."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconRefresh size={18} />} title="Today / yesterday / tomorrow retry">
        <P>
          {
            'Some bodies (recently observed comets, freshly discovered asteroids) have ephemeris coverage that does not extend to the current UTC day. Rather than fail, Tracker tries the surrounding days.'
          }
        </P>
        <KvRow label="Attempt 1" value="today (UTC start of day)" labelWidth={120} />
        <KvRow label="Attempt 2" value="today minus 1 day" labelWidth={120} />
        <KvRow label="Attempt 3" value="today plus 1 day" labelWidth={120} />
        <P>
          {
            "First attempt that returns a parseable position wins. If all three are empty, the result is .noEphemerisData and the user gets 'No ephemeris data available for that object right now'."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconFunctions size={18} />} title="Math">
        <P>
          {
            'The position vector arrives in kilometres. Three conversions turn it into the units the UI shows. Z is preserved here (Tracker shows it) but ignored when computing sector and distance.'
          }
        </P>
        <Lead>Position in AU</Lead>
        <CodeBlock text={AU_MATH} />
        <P>{'149,597,870.7 km is the IAU 2012 value of one astronomical unit, exact.'}</P>
        <Lead>Sector (1 to 12), distance in AU</Lead>
        <CodeBlock text={SECTOR_MATH} />
        <Lead>SL distance, three flavors</Lead>
        <CodeBlock text={SL_MATH} />
        <P>
          {
            "In-game coordinates are integers, so navigation uses the floor. The display shows the rounded value. When floor < rounded the UI flags it: 'navigate to <floor>, not <rounded>', so the player does not overshoot."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconLock size={18} />} title="Privacy">
        <KvRow
          label="Sent"
          value="The object name or designation you typed (or the prefilled pdes from Discoveries), plus a fixed query string. No identifier of yours is added."
          labelWidth={120}
        />
        <KvRow
          label="Visible to NASA"
          value="Your IP address, like for any web request. SBDB and Horizons sit behind ssd.jpl.nasa.gov; both log standard request metadata server-side."
          labelWidth={120}
        />
        <KvRow
          label="Stored remotely"
          value="Nothing on ESSI servers (there are none)."
          labelWidth={120}
        />
        <KvRow
          label="Stored locally"
          value="Each successful track is saved to local history. You can delete entries from the Tracker history sheet."
          labelWidth={120}
        />
        <KvRow label="Opt-in" value="Nothing leaves the device until you tap Track." labelWidth={120} />
      </HiwCard>

      <HiwCard icon={<IconCode size={18} />} title="Try it yourself">
        <P>
          {
            'Two-step example for tracking Ceres. Notice the explicit %3B for the trailing semicolon: -G --data-urlencode would not encode it because it is already in CharacterSet.urlQueryAllowed.'
          }
        </P>
        <Lead>Step 1, resolve the pdes:</Lead>
        <CodeBlock text={CURL_RESOLVE} />
        <Lead>Step 2, fetch the vector for today:</Lead>
        <CodeBlock text={CURL_FETCH} />
        <P>
          {
            "Pipe the second response to jq -r .result to extract the ephemeris text. Look for 'X = ... Y = ... Z = ...' between $$SOE and $$EOE, then apply the math."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconStar size={18} />} title="Credits">
        <P>
          {
            'Catalog metadata: NASA / JPL Solar System Dynamics group, public domain. Curated body list and SL convention: East-Shire Utilities Discord bot.'
          }
        </P>
      </HiwCard>
    </>
  );
}
