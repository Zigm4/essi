import { CodeBlock } from '../../../../../design-system/components/CodeBlock';
import { KvRow, ParamRow, WindowRow } from '../../../../../design-system/components/InfoRows';
import { IconLock, IconSearch } from '../../../../../design-system/icons';
import {
  IconCode,
  IconDescription,
  IconFunctions,
  IconLink,
  IconListAlt,
  IconSpeed,
  IconStar,
  IconTerminal,
  IconTimer,
} from '../toolIcons';
import { HiwCard, HiwHeader, Cap, Lead, P } from './hiw';

const SAMPLE_REQUEST = `GET https://ssd.jpl.nasa.gov/api/horizons.api
  ?format=text
  &COMMAND='199'
  &OBJ_DATA='NO'
  &MAKE_EPHEM='YES'
  &EPHEM_TYPE='VECTORS'
  &CENTER='500@10'
  &START_TIME='2026-05-04 12:00'
  &STOP_TIME='2026-05-04 13:00'
  &STEP_SIZE='1h'
  &QUANTITIES='1'`;

export const HORIZONS_EXCERPT = `$$SOE
2461164.500000000 = A.D. 2026-May-04 00:00:00.0000 TDB
 X =-3.012345678901234E+07 Y = 4.567890123456789E+07 Z = 1.234567890123456E+06
 VX=-5.123456789012345E+01 VY=-2.345678901234567E+01 VZ= 3.456789012345678E+00
 LT= 1.234567890123456E+02 RG= 5.678901234567890E+07 RR= 1.234567890123456E+01
$$EOE`;

const DISTANCE_MATH = `distance_km    = sqrt(x*x + y*y)
distance_miles = distance_km * 0.621371
distance_SL    = floor(distance_miles / 3_000_000)`;

const SECTOR_MATH = `theta = atan2(y, x)              // radians, range [-π, π]
if theta < 0: theta += 2π        // wrap to [0, 2π)
raw    = floor(theta * 12 / 2π)  // 0…11
sector = ((raw + 12) % 12) + 1   // 1…12`;

const CURL = `curl "https://ssd.jpl.nasa.gov/api/horizons.api\\
?format=text\\
&COMMAND=%27499%27\\
&OBJ_DATA=%27NO%27\\
&MAKE_EPHEM=%27YES%27\\
&EPHEM_TYPE=%27VECTORS%27\\
&CENTER=%27500@10%27\\
&START_TIME=%272026-05-04%2012:00%27\\
&STOP_TIME=%272026-05-04%2013:00%27\\
&STEP_SIZE=%271h%27\\
&QUANTITIES=%271%27"`;

export function ScanHowItWorks() {
  return (
    <>
      <HiwHeader />

      <HiwCard icon={<IconSearch size={18} />} title="Overview">
        <P>
          {
            "System Scan asks NASA's JPL Horizons service for the heliocentric position vector of each of the nine planets, then converts (X, Y) into the in-game grid: a sector from 1 to 12 and a distance in SL."
          }
        </P>
        <P>
          {
            'In Full mode, the tool then samples each orbit forward in time to find the moment the planet crosses into its next sector.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconLink size={18} />} title="Endpoint">
        <KvRow label="Base URL" value="https://ssd.jpl.nasa.gov/api/horizons.api" />
        <KvRow label="Method" value="GET" />
        <KvRow label="Auth" value="None. Public, no API key, no token." />
        <KvRow
          label="Rate limit"
          value="Per source IP. Parallel bursts of 9 requests return HTTP 503 about every other time. Sequential calls with a small gap pass cleanly."
        />
        <KvRow label="Docs" value="ssd.jpl.nasa.gov/horizons/manual.html" />
        <P>
          {
            "JPL Horizons is a free public ephemeris service from NASA's Solar System Dynamics group. Anyone can hit it from any tool: a browser, curl, a Swift app, a Python script."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconListAlt size={18} />} title="Request parameters">
        <P>
          {
            'Every value must be wrapped in single quotes inside the query string. That is a Horizons quirk, not URL encoding. The single quotes are part of the value.'
          }
        </P>
        <ParamRow name="format" value="text" note="Plain text body. Easier to parse than the html or json variants." />
        <ParamRow
          name="COMMAND"
          value="'199' to '999'"
          note="NAIF body code. Mercury 199, Venus 299, Earth 399, Mars 499, Jupiter 599, Saturn 699, Uranus 799, Neptune 899, Pluto 999."
        />
        <ParamRow name="OBJ_DATA" value="'NO'" note="Skip the body's metadata block. We only want the ephemeris." />
        <ParamRow name="MAKE_EPHEM" value="'YES'" note="Generate the ephemeris." />
        <ParamRow
          name="EPHEM_TYPE"
          value="'VECTORS'"
          note="Cartesian X, Y, Z position vectors instead of RA/Dec angles."
        />
        <ParamRow
          name="CENTER"
          value="'500@10'"
          note="Origin of the coordinate system. 500 is the standard geocentric body code; @10 redirects to the Sun's barycenter, giving heliocentric output."
        />
        <ParamRow name="START_TIME" value="'YYYY-MM-DD HH:mm'" note="UTC. Light mode uses now." />
        <ParamRow name="STOP_TIME" value="'YYYY-MM-DD HH:mm'" note="UTC. Light mode uses now + 1h." />
        <ParamRow
          name="STEP_SIZE"
          value="'1h', '1d', '1m'…"
          note="Sampling interval. Smaller = more rows in the response. Pick big enough that the response stays in the low thousands of lines."
        />
        <ParamRow name="QUANTITIES" value="'1'" note="Only ask for the X/Y/Z vector. Cuts response size by about 70 percent." />
      </HiwCard>

      <HiwCard icon={<IconTerminal size={18} />} title="Sample request">
        <Cap>Mercury, position right now:</Cap>
        <CodeBlock text={SAMPLE_REQUEST} />
      </HiwCard>

      <HiwCard icon={<IconDescription size={18} />} title="Response shape">
        <P>
          {
            'Horizons returns one big plain-text document with a header (target metadata, request echo), an ephemeris block bracketed by $$SOE / $$EOE markers, and a footer.'
          }
        </P>
        <P>
          {
            "Each ephemeris row is two lines: a date line containing 'A.D.' and 'TDB', then a vector line starting with 'X ='. ESSI only reads those two line types and ignores everything else."
          }
        </P>
        <P>Excerpt:</P>
        <CodeBlock text={HORIZONS_EXCERPT} />
        <P>
          {
            "X, Y, Z are kilometres relative to the Sun's centre. VX/VY/VZ are velocities (km/s). LT is light-time. RG is range. RR is range rate. ESSI ignores everything except X and Y."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconSearch size={18} />} title="Parsing">
        <P>
          {
            "The parser is naive on purpose. Walk the lines: when one contains 'A.D.' grab the date, when the next starts with 'X =' grab the vector, repeat. No regex, no XML, no JSON."
          }
        </P>
        <P>Date format used to decode the timestamp:</P>
        <CodeBlock text="yyyy-MMM-dd HH:mm:ss.SSSS  (UTC)" />
        <P>{"Locale is forced to en_US_POSIX so 'May' parses regardless of the device language."}</P>
      </HiwCard>

      <HiwCard icon={<IconFunctions size={18} />} title="Math">
        <P>
          {
            "Two conversions turn (X, Y) in kilometres into the game's grid. Z is ignored: the game's map is 2D in the ecliptic plane."
          }
        </P>
        <Lead>Distance in SL</Lead>
        <CodeBlock text={DISTANCE_MATH} />
        <P>
          {
            '1 SL = 3,000,000 miles. The constant comes from the East-Shire Utilities bot the app mirrors: it is a game convention, not a physical unit.'
          }
        </P>
        <Lead>Sector (1 to 12)</Lead>
        <CodeBlock text={SECTOR_MATH} />
        <P>
          {
            'The +12 then mod 12 is defensive: it handles the boundary case where atan2 returns exactly 2π due to floating-point rounding. Sectors are counted counter-clockwise from the +X axis.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconTimer size={18} />} title="Per-planet windows (Full mode)">
        <P>
          {
            'To find the next sector change, ESSI does a coarse sweep then refines around the first transition. The window has to be wide enough to contain at least one transition: Pluto sits in one sector for years.'
          }
        </P>
        <P>
          {
            'Step is sized so each broad response stays in the low thousands of lines. A 30-year window stepped at 1 hour would be 260,000 rows.'
          }
        </P>
        <WindowRow planet="Mercury / Venus / Earth / Mars" broad="60 d, 1h step" refine="±12 h, 1m step" />
        <WindowRow planet="Jupiter" broad="540 d, 12h step" refine="±18 h, 5m step" />
        <WindowRow planet="Saturn" broad="4 y, 1d step" refine="±2 d, 30m step" />
        <WindowRow planet="Uranus" broad="10 y, 2d step" refine="±3 d, 1h step" />
        <WindowRow planet="Neptune" broad="20 y, 7d step" refine="±10 d, 6h step" />
        <WindowRow planet="Pluto" broad="30 y, 14d step" refine="±20 d, 12h step" />
      </HiwCard>

      <HiwCard icon={<IconSpeed size={18} />} title="Rate limiting">
        <P>
          {
            'Calls are issued sequentially with a 200 ms gap between them. A parallel burst of 9 requests returns HTTP 503 about every other time; a gentle drip never has.'
          }
        </P>
        <KvRow label="Light mode" value="9 calls (one per planet)." />
        <KvRow
          label="Full mode"
          value="9 to 18 calls. One coarse per planet, plus one refinement per planet when a transition is found."
        />
        <KvRow label="Timeout" value="30 s per call." />
      </HiwCard>

      <HiwCard icon={<IconLock size={18} />} title="Privacy">
        <KvRow
          label="Sent"
          value="Planet code (199 to 999), UTC timestamp, fixed query string. No identifier of yours is added."
        />
        <KvRow label="Visible to NASA" value="Your IP address, like for any web request." />
        <KvRow
          label="Stored remotely"
          value="Nothing on ESSI servers (there are none). NASA's standard request logs apply on their side."
        />
        <KvRow
          label="Stored locally"
          value="Successful scans go to local history (no cloud sync in this build). You can delete entries from the history sheet."
        />
        <KvRow label="Opt-in" value="Nothing leaves the device until you tap Scan now." />
      </HiwCard>

      <HiwCard icon={<IconCode size={18} />} title="Try it yourself">
        <P>
          {
            "Run this in a terminal to get Mars's current position. The %27 sequences are URL-encoded single quotes; the literal quotes around values are required by Horizons."
          }
        </P>
        <CodeBlock text={CURL} />
        <P>
          {
            'Look for the X = and Y = values between $$SOE and $$EOE, then apply the two formulas in the Math section. That is the entire pipeline.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconStar size={18} />} title="Credits">
        <P>
          {
            'Ephemeris data: NASA / JPL Solar System Dynamics group, public domain. Sector and SL conventions: East-Shire Utilities Discord bot.'
          }
        </P>
      </HiwCard>
    </>
  );
}
