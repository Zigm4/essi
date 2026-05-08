import 'package:flutter/material.dart';

import '../../../../design_system/components/info_card.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';

class TrackerHowItWorksView extends StatelessWidget {
  const TrackerHowItWorksView({super.key});

  @override
  Widget build(BuildContext context) {
    return HowItWorksSheet(
      cards: const [
        TransmissionHeader(label: 'ESSI · how this tool works'),
        _Overview(),
        _Pipeline(),
        _Endpoints(),
        _Resolve(),
        _SbdbResponse(),
        _HorizonsRequest(),
        _Quirks(),
        _HorizonsResponse(),
        _Retry(),
        _Math(),
        _Privacy(),
        _Replicate(),
        _Credits(),
      ],
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Overview',
            icon: Icons.search,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Tracker takes one celestial body (Ceres, Halley, 2020 AB1, …) and returns its current heliocentric position: an X/Y/Z vector in AU, a sector from 1 to 12, and a distance in SL with three precision flavors (exact, rounded, floored).',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Each Track tap fires up to four GET requests across two NASA endpoints. No background work, no caching: every Track is a fresh round-trip.',
            style: AppTypography.body,
          ),
        ],
      ),
    );
  }
}

class _Pipeline extends StatelessWidget {
  const _Pipeline();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Two-step pipeline',
            icon: Icons.alt_route,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Tracking is split into a resolve step and a fetch step. They use different endpoints and have completely different response shapes.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const StepRow(
            number: '1',
            title: 'Resolve',
            body:
                "Turn the user's input ('Halley', 'Ceres', '2020 AB1', '433') into a canonical MPC designation. Up to one GET, often zero.",
          ),
          const StepRow(
            number: '2',
            title: 'Fetch',
            body:
                "Ask JPL Horizons for the body's heliocentric vector today. Up to three GETs (today → yesterday → tomorrow) until one returns data.",
          ),
        ],
      ),
    );
  }
}

class _Endpoints extends StatelessWidget {
  const _Endpoints();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Endpoints', icon: Icons.link),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'SBDB single-body',
            value: 'https://ssd-api.jpl.nasa.gov/sbdb.api',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Horizons',
            value: 'https://ssd.jpl.nasa.gov/api/horizons.api',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Method',
            value: 'GET on both',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Auth',
            value: 'None on either. Public, no API key, no token.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Timeout',
            value: '30 s per call',
            labelWidth: 120,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "SBDB is JPL's per-object metadata browser (different from the bulk sbdb_query.api used by Discoveries). Horizons is the ephemeris service shared with System Scan.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Resolve extends StatelessWidget {
  const _Resolve();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Step 1: resolve a canonical ID',
            icon: Icons.search,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'The user types a name. Horizons wants a clean designation. Tracker tries four strategies, in order, and stops at the first hit. The first three avoid network entirely.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const TierRow(
            tier: '0',
            title: 'Prefilled MPC ID',
            body:
                'When you arrive from Discoveries, the canonical pdes is already known. Skip resolve entirely.',
          ),
          const TierRow(
            tier: '1',
            title: 'Curated catalog',
            body:
                'About 60 well-known bodies (Ceres, Vesta, Halley-class comets, recent ATLAS comets) are bundled in the app. Match by case-insensitive name. Zero network.',
          ),
          const TierRow(
            tier: '2',
            title: 'Numbered asteroid shortcut',
            body:
                'Input is digits-only and kind is asteroid? It is already a pdes. Use as-is.',
          ),
          const TierRow(
            tier: '3',
            title: 'SBDB sstr lookup',
            body:
                "GET sbdb.api?sstr=<input>. Returns a single match (object.pdes) or an ambiguous list (list[].pdes, take the first). HTTP errors are silently treated as 'not found' so the next tier kicks in.",
          ),
          const TierRow(
            tier: '4',
            title: 'Designation passthrough',
            body:
                "Last resort. If the input has both letters and digits ('2024 G3', 'C/2024 G3 (ATLAS)'), Horizons can resolve it directly. We send it as-is.",
          ),
        ],
      ),
    );
  }
}

class _SbdbResponse extends StatelessWidget {
  const _SbdbResponse();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'SBDB response shapes',
            icon: Icons.description,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'sbdb.api returns one of two JSON shapes depending on whether the query was unambiguous.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Single match (e.g. sstr=Ceres):', style: AppTypography.caption),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''{
  "object": {
    "pdes": "1",
    "fullname": "1 Ceres",
    "kind": "an"
  },
  "phys_par": [...],
  "orbit": {...}
}
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Ambiguous match (e.g. sstr=Adams):',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''{
  "code": 300,
  "list": [
    {"pdes": "1996", "name": "Adams"},
    {"pdes": "(2009 BJ81)", "name": "..."}
  ]
}
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Tracker reads only the pdes string from either shape and discards everything else. The fullname and orbital data are interesting but not needed to fetch a position.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _HorizonsRequest extends StatelessWidget {
  const _HorizonsRequest();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Step 2: Horizons VECTORS request',
            icon: Icons.list_alt,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Once an MPC ID is resolved, Tracker asks Horizons for one day's worth of position vector. Same endpoint as System Scan but with format=json this time.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const ParamRow(
            name: 'format',
            value: 'json',
            note:
                'Wraps the Horizons text response inside a JSON envelope. Easier to parse status and error fields than the raw text.',
          ),
          const ParamRow(
            name: 'COMMAND',
            value: "'<pdes>;'",
            note:
                'The canonical designation. The trailing semicolon matters for numbered asteroids: see the next card.',
          ),
          const ParamRow(
            name: 'OBJ_DATA',
            value: "'YES'",
            note:
                'Include the object header. Future versions of Tracker may surface mass, magnitude, etc.',
          ),
          const ParamRow(
            name: 'MAKE_EPHEM',
            value: "'YES'",
            note:
                'Generate the ephemeris (else only the metadata header).',
          ),
          const ParamRow(
            name: 'EPHEM_TYPE',
            value: "'VECTORS'",
            note:
                'Cartesian X, Y, Z position vectors instead of RA/Dec angles.',
          ),
          const ParamRow(
            name: 'CENTER',
            value: "'500@10'",
            note:
                "Heliocentric origin. 500 is geocentric; @10 redirects to the Sun's barycenter.",
          ),
          const ParamRow(
            name: 'START_TIME',
            value: "'YYYY-MM-DD'",
            note:
                'UTC. The retry candidate (today, then yesterday, then tomorrow).',
          ),
          const ParamRow(
            name: 'STOP_TIME',
            value: 'start + 1 day',
            note: 'A 1-day window with a 1-day step yields exactly one row.',
          ),
          const ParamRow(
            name: 'STEP_SIZE',
            value: "'1d'",
            note: 'One sample, no waste.',
          ),
        ],
      ),
    );
  }
}

class _Quirks extends StatelessWidget {
  const _Quirks();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Three undocumented quirks',
            icon: Icons.warning_amber_rounded,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Reproducing Tracker without these will hit silent 400s and 'No matches found' errors. None of them are in the obvious places of the JPL docs.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const QuirkRow(
            title: 'Numbered asteroids need a trailing ;',
            detail:
                "COMMAND='1' resolves to Mercury Barycenter (NAIF major body code). COMMAND='1;' resolves to Ceres (small body 1). Without the semicolon, every query for a numbered asteroid returns the wrong object.",
          ),
          const QuirkRow(
            title: '; must be percent-encoded as %3B',
            detail:
                'Horizons (and many web frameworks) treat an unescaped ; as equivalent to & in the query string, which truncates COMMAND. CharacterSet.urlQueryAllowed includes ; by default, so Underdeck adds an explicit removal.',
          ),
          const QuirkRow(
            title: 'Comet names need stripping',
            detail:
                "'C/2024 G3 (ATLAS)' is the human-readable form. Horizons rejects it with 'No matches found'. We strip the leading C/ or P/ and the trailing parenthetical to get '2024 G3', which Horizons resolves.",
          ),
        ],
      ),
    );
  }
}

class _HorizonsResponse extends StatelessWidget {
  const _HorizonsResponse();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Horizons response (JSON wrap)',
            icon: Icons.description,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "With format=json, Horizons returns a thin JSON envelope whose 'result' field contains the same plain-text ephemeris System Scan parses.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: r'''{
  "signature": {"source": "NASA/JPL Horizons API", "version": "1.2"},
  "result": "*****\n Ephemeris / WWW_USER...\n$$SOE\n2461164.500 = A.D. 2026-May-04 ...\n X = 1.234E+08 Y = 5.678E+08 Z = 9.012E+06 ...\n$$EOE\n*****"
}
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            r"The 'result' string follows the same conventions as the text mode: an $$SOE/$$EOE-bracketed ephemeris block, dates flagged with 'A.D.' and 'TDB', vectors on lines starting with 'X ='. The same parser System Scan uses works here unchanged.",
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "If the body has no ephemeris for the requested date, 'result' is an empty string or contains 'No ephemeris available'. Both cases land Tracker in the day-retry loop.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Today / yesterday / tomorrow retry',
            icon: Icons.refresh,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Some bodies (recently observed comets, freshly discovered asteroids) have ephemeris coverage that does not extend to the current UTC day. Rather than fail, Tracker tries the surrounding days.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Attempt 1',
            value: 'today (UTC start of day)',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Attempt 2',
            value: 'today minus 1 day',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Attempt 3',
            value: 'today plus 1 day',
            labelWidth: 120,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "First attempt that returns a parseable position wins. If all three are empty, the result is .noEphemerisData and the user gets 'No ephemeris data available for that object right now'.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Math extends StatelessWidget {
  const _Math();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Math', icon: Icons.functions),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'The position vector arrives in kilometres. Three conversions turn it into the units the UI shows. Z is preserved here (Tracker shows it) but ignored when computing sector and distance.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Position in AU', style: AppTypography.body),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''au_per_km = 1 / 149_597_870.7
xAU = x * au_per_km
yAU = y * au_per_km
zAU = z * au_per_km
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '149,597,870.7 km is the IAU 2012 value of one astronomical unit, exact.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.md),
          Text('Sector (1 to 12), distance in AU', style: AppTypography.body),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''distanceAU = sqrt(xAU*xAU + yAU*yAU)
theta = atan2(y, x)              // radians on raw km, sign-equivalent
if theta < 0: theta += 2π
sector = ((floor(theta * 12 / 2π) + 12) % 12) + 1
''',
          ),
          const SizedBox(height: AppSpacing.md),
          Text('SL distance, three flavors', style: AppTypography.body),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''distance_miles = (distanceAU / au_per_km) * 0.621371
slExact   = distance_miles / 3_000_000      // raw double
slRounded = round(slExact * 1000) / 1000    // 3 decimals, for display
slFloor   = floor(slExact)                  // for in-game navigation
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "In-game coordinates are integers, so navigation uses the floor. The display shows the rounded value. When floor < rounded the UI flags it: 'navigate to <floor>, not <rounded>', so the player does not overshoot.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Privacy extends StatelessWidget {
  const _Privacy();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Privacy', icon: Icons.lock),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Sent',
            value:
                'The object name or designation you typed (or the prefilled pdes from Discoveries), plus a fixed query string. No identifier of yours is added.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Visible to NASA',
            value:
                'Your IP address, like for any web request. SBDB and Horizons sit behind ssd.jpl.nasa.gov; both log standard request metadata server-side.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Stored remotely',
            value: 'Nothing on Underdeck servers (there are none).',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Stored locally',
            value:
                'Each successful track is saved to local history. You can delete entries from the Tracker history sheet.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Opt-in',
            value: 'Nothing leaves the device until you tap Track.',
            labelWidth: 120,
          ),
        ],
      ),
    );
  }
}

class _Replicate extends StatelessWidget {
  const _Replicate();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Try it yourself',
            icon: Icons.code,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Two-step example for tracking Ceres. Notice the explicit %3B for the trailing semicolon: -G --data-urlencode would not encode it because it is already in CharacterSet.urlQueryAllowed.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Step 1, resolve the pdes:', style: AppTypography.caption),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''curl -G "https://ssd-api.jpl.nasa.gov/sbdb.api" \\
  --data-urlencode "sstr=Ceres"
# → object.pdes = "1"
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Step 2, fetch the vector for today:',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''curl "https://ssd.jpl.nasa.gov/api/horizons.api\\
?format=json\\
&COMMAND=%271%3B%27\\
&OBJ_DATA=%27YES%27\\
&MAKE_EPHEM=%27YES%27\\
&EPHEM_TYPE=%27VECTORS%27\\
&CENTER=%27500@10%27\\
&START_TIME=%272026-05-04%27\\
&STOP_TIME=%272026-05-05%27\\
&STEP_SIZE=%271d%27"
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            r"Pipe the second response to jq -r .result to extract the ephemeris text. Look for 'X = ... Y = ... Z = ...' between $$SOE and $$EOE, then apply the math.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Credits extends StatelessWidget {
  const _Credits();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Credits', icon: Icons.star),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Catalog metadata: NASA / JPL Solar System Dynamics group, public domain. Curated body list and SL convention: East-Shire Utilities Discord bot.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}
