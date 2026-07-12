import { CodeBlock } from '../../../../../design-system/components/CodeBlock';
import { KvRow, OpRow, ParamRow, StatusRow } from '../../../../../design-system/components/InfoRows';
import { IconLock, IconSearch } from '../../../../../design-system/icons';
import {
  IconBubbleChart,
  IconCode,
  IconDescription,
  IconEventBusy,
  IconFunctions,
  IconLink,
  IconListAlt,
  IconSchedule,
  IconStar,
  IconTerminal,
} from '../toolIcons';
import { HiwCard, HiwHeader, Cap, P } from './hiw';

/** "How it works" sheet for Celestial Discoveries (tools-live spec §10.2). */

const CDATA_SHAPE = `{
  "AND": [
    "first_obs|RG|2020-01-01|2020-01-31"
  ]
}`;

const SAMPLE_REQUEST = `GET https://ssd-api.jpl.nasa.gov/sbdb_query.api
  ?sb-kind=c
  &fields=full_name,pdes,first_obs,last_obs,pha
  &sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}
  &limit=1000`;

export const SBDB_EXCERPT = `{
  "signature": {"source": "NASA/JPL Small-Body Database Query API", "version": "1.5"},
  "count": 2,
  "fields": ["full_name", "pdes", "first_obs", "last_obs", "pha"],
  "data": [
    ["       1P/Halley",   "1P",       "1835-08-05", "2017-03-22", null],
    ["       (2020 AB1)",  "2020 AB1", "2020-01-15", "2020-04-22", "N"]
  ]
}`;

const CURL = `curl -G "https://ssd-api.jpl.nasa.gov/sbdb_query.api" \\
  --data-urlencode "sb-kind=c" \\
  --data-urlencode "fields=full_name,pdes,first_obs,last_obs,pha" \\
  --data-urlencode 'sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}' \\
  --data-urlencode "limit=1000"`;

export function DiscoveriesHowItWorks() {
  return (
    <>
      <HiwHeader />

      <HiwCard icon={<IconSearch size={18} />} title="Overview">
        <P>
          {
            "Discoveries searches NASA's Small-Body Database (SBDB) for comets or asteroids whose first observation date falls within a window you choose. SBDB indexes every minor body the world's observatories have ever reported: about 1.4 million asteroids and 4,000 comets at the time of writing."
          }
        </P>
        <P>
          {
            "Each result gets a status icon computed locally on the device, mirroring the East-Shire Utilities bot's classification rules."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconLink size={18} />} title="Endpoint">
        <KvRow label="Base URL" value="https://ssd-api.jpl.nasa.gov/sbdb_query.api" labelWidth={120} />
        <KvRow label="Method" value="GET" labelWidth={120} />
        <KvRow label="Auth" value="None. Public, no API key, no token." labelWidth={120} />
        <KvRow
          label="Rate limit"
          value="No documented hard limit. ESSI issues one request per Search tap."
          labelWidth={120}
        />
        <KvRow label="Docs" value="ssd-api.jpl.nasa.gov/doc/sbdb_query.html" labelWidth={120} />
        <P>
          {
            'This is JPL’s bulk-query interface to the small-body catalog. The same backend powers the SBDB browser at ssd.jpl.nasa.gov/tools/sbdb_lookup.html and the per-object SBDB API used by the Tracker tool.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconListAlt size={18} />} title="Request parameters">
        <P>{'All four parameters go in the query string of a single GET. No body, no headers required.'}</P>
        <ParamRow
          name="sb-kind"
          value="c | a"
          note="'c' for comets, 'a' for asteroids. Required: SBDB will not return both kinds in the same response."
        />
        <ParamRow
          name="fields"
          value="comma-separated"
          note="Which columns you want back. ESSI asks for full_name, name, kind, pdes, first_obs, last_obs, pha, plus diameter and albedo for asteroids. Smaller field lists return faster."
        />
        <ParamRow
          name="sb-cdata"
          value="JSON object"
          note="The filter. JSON-encoded constraint object using SBDB's mini-language (next section). Skipped entirely for pre-1900 queries."
        />
        <ParamRow
          name="limit"
          value="1000 or 50000"
          note="1000 is plenty for any 30-day window. 50000 is used as a safety upper bound when fetching the full pre-1900 catalog without a date filter."
        />
      </HiwCard>

      <HiwCard icon={<IconFunctions size={18} />} title="Constraint mini-language">
        <P>
          {
            'sb-cdata is the unusual part. SBDB expects a JSON object whose values are NOT JSON: each clause is a single string with pipe-separated tokens.'
          }
        </P>
        <P>Shape:</P>
        <CodeBlock text={CDATA_SHAPE} />
        <P>{'Tokens, in order: field name, operator, then 1 to 2 values depending on the operator.'}</P>
        <P>Operators ESSI might use:</P>
        <OpRow op="RG" desc="Range, inclusive on both ends. Two values: lower, upper." />
        <OpRow op="EQ / NE" desc="Equals / not equals. One value." />
        <OpRow op="LT / LE / GT / GE" desc="Less / less-equal / greater / greater-equal. One value." />
        <OpRow op="LK" desc="SQL-style LIKE pattern, % wildcard. One value." />
        <OpRow op="NL / NN" desc="Is null / is not null. No value." />
        <P>
          {
            'The full operator set is in the SBDB docs. The whole sb-cdata value is then URL-encoded as the query parameter.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconTerminal size={18} />} title="Sample request">
        <Cap>Comets first observed in January 2020:</Cap>
        <CodeBlock text={SAMPLE_REQUEST} />
        <P>
          {
            'Shown unencoded for readability. The sb-cdata value must be percent-encoded in the actual request: braces become %7B / %7D, brackets %5B / %5D, pipes %7C, double-quotes %22.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconDescription size={18} />} title="Response shape">
        <P>
          {
            "JSON document. The top-level keys are 'signature' (versioning), 'count' (row count), 'fields' (column names in order), and 'data' (an array of arrays, one per body)."
          }
        </P>
        <P>
          {
            'Each row is positional: row[i] is the value for fields[i]. Cells are heterogeneous: a single column can return strings, numbers, or null in different rows.'
          }
        </P>
        <P>Excerpt:</P>
        <CodeBlock text={SBDB_EXCERPT} />
        <P>
          {
            "full_name comes back with leading whitespace and unnumbered designations wrapped in parens. The UI strips both for display. Dates are ISO YYYY-MM-DD strings. The pha field is 'Y', 'N', or null (potentially hazardous asteroid flag)."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconSearch size={18} />} title="Parsing">
        <P>{'Three small rules turn the wire format into typed objects:'}</P>
        <KvRow
          label="1. Column map"
          value="Build name→index from the 'fields' array first. Never assume column order: SBDB has reordered fields in the past."
          labelWidth={120}
        />
        <KvRow
          label="2. Tolerant cells"
          value="Each cell decoder accepts string OR number OR null. SBDB returns dates as strings but diameter as a number, sometimes the same column shifts type across rows."
          labelWidth={120}
        />
        <KvRow
          label="3. Sort"
          value="Order results by first_obs ascending so the earliest discovery is at the top, matching the bot."
          labelWidth={120}
        />
        <P>
          {
            'Rows where pdes (the canonical designation) is missing are dropped: those are SBDB internal placeholders.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconBubbleChart size={18} />} title="Status icon (computed locally)">
        <P>
          {
            "After parsing, each object gets one of four icons. The rules are evaluated top-down, first match wins. They mirror the East-Shire Utilities bot's calculate_status function."
          }
        </P>
        <StatusRow
          icon="🔴"
          title="Potentially hazardous"
          rule="pha == 'Y'. SBDB has flagged this asteroid as a Potentially Hazardous Asteroid (close approach within 0.05 AU and absolute magnitude H ≤ 22)."
        />
        <StatusRow
          icon="🟡"
          title="Caution: large asteroid"
          rule="kind = asteroid AND diameter > 140 m. Large enough to matter on impact, even if not currently flagged hazardous."
        />
        <StatusRow
          icon="🟡"
          title="Caution: short tracking"
          rule="tracking_days < 3, where tracking_days = last_obs − first_obs. The orbit is poorly constrained; future positions are uncertain."
        />
        <StatusRow icon="🟢" title="Within normal parameters" rule="Default. None of the above triggers." />
        <StatusRow
          icon="❓"
          title="Unclassified"
          rule="Either first_obs or last_obs is missing or unparseable. Status cannot be computed."
        />
        <P>
          {
            'This computation is 100 percent local. SBDB does not return a status field; the 4 buckets are an ESSI/bot convention to give a quick visual read.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconEventBusy size={18} />} title="Pre-1900 quirk">
        <P>
          {
            'SBDB’s first_obs filter behaves erratically when the lower bound is before 1900. Some legitimate rows (Halley, the first numbered minor planets, etc.) get skipped server-side for reasons that are not documented.'
          }
        </P>
        <P>{'When the start date you pick is in 1899 or earlier, ESSI switches strategy:'}</P>
        <KvRow label="Server" value="Drop the sb-cdata constraint entirely. Set limit=50000." labelWidth={120} />
        <KvRow
          label="Client"
          value="Filter the response locally by parsing each row's first_obs and keeping only those inside [start, end]."
          labelWidth={120}
        />
        <P>
          {'Cost: bigger response (a few MB instead of a few KB), longer wait. Benefit: no rows quietly missing.'}
        </P>
      </HiwCard>

      <HiwCard icon={<IconSchedule size={18} />} title="Timeouts and limits">
        <KvRow label="Comet timeout" value="30 s. The comet table is small (~4,000 rows total)." labelWidth={130} />
        <KvRow
          label="Asteroid timeout"
          value="90 s. SBDB scans 1.4 M asteroid rows; even an indexed query takes time."
          labelWidth={130}
        />
        <KvRow label="Result cap" value="1,000 rows for normal queries, 50,000 for pre-1900." labelWidth={130} />
        <P>
          {
            'If you hit the timeout, narrow the date range. Asteroid windows of 10+ days are flagged in the UI for that reason.'
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconLock size={18} />} title="Privacy">
        <KvRow
          label="Sent"
          value="Object kind, date range (or none for pre-1900), field list, fixed limit. No identifier of yours is added."
          labelWidth={120}
        />
        <KvRow label="Relayed via" value="A Cloudflare Worker proxy (browsers can't call JPL directly - no CORS)." labelWidth={120} />
        <KvRow label="Your IP" value="Seen by the Cloudflare proxy, not by NASA." labelWidth={120} />
        <KvRow
          label="Stored remotely"
          value="Nothing on ESSI servers (there are none). NASA's standard request logs apply on their side."
          labelWidth={120}
        />
        <KvRow
          label="Stored locally"
          value="Search results live in memory until you leave the screen or run another search. Each search is logged to local history."
          labelWidth={120}
        />
        <KvRow label="Opt-in" value="Nothing leaves the device until you tap Search." labelWidth={120} />
      </HiwCard>

      <HiwCard icon={<IconCode size={18} />} title="Try it yourself">
        <P>
          {
            'Run this in a terminal. The --data-urlencode -G form lets curl handle the percent-encoding of the JSON value for you.'
          }
        </P>
        <CodeBlock text={CURL} />
        <P>
          {
            "Pipe to jq for readable output: append | jq '.data[0:3]' to see the first three rows. Replace 'c' with 'a' for asteroids, but expect a much larger response."
          }
        </P>
      </HiwCard>

      <HiwCard icon={<IconStar size={18} />} title="Credits">
        <P>
          {
            'Catalog data: NASA / JPL Solar System Dynamics group, public domain. Status classification: East-Shire Utilities Discord bot.'
          }
        </P>
      </HiwCard>
    </>
  );
}
