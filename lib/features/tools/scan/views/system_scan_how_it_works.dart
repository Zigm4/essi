import 'package:flutter/material.dart';

import '../../../../design_system/components/info_card.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';

class SystemScanHowItWorksView extends StatelessWidget {
  const SystemScanHowItWorksView({super.key});

  @override
  Widget build(BuildContext context) {
    return HowItWorksSheet(
      cards: const [
        TransmissionHeader(label: 'ESSI · how this tool works'),
        _Overview(),
        _Endpoint(),
        _Request(),
        _SampleRequest(),
        _Response(),
        _Parsing(),
        _Math(),
        _Windows(),
        _RateLimit(),
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
            "System Scan asks NASA's JPL Horizons service for the heliocentric position vector of each of the nine planets, then converts (X, Y) into the in-game grid: a sector from 1 to 12 and a distance in SL.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'In Full mode, the tool then samples each orbit forward in time to find the moment the planet crosses into its next sector.',
            style: AppTypography.body,
          ),
        ],
      ),
    );
  }
}

class _Endpoint extends StatelessWidget {
  const _Endpoint();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Endpoint', icon: Icons.link),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Base URL',
            value: 'https://ssd.jpl.nasa.gov/api/horizons.api',
          ),
          const KvRow(label: 'Method', value: 'GET'),
          const KvRow(label: 'Auth', value: 'None. Public, no API key, no token.'),
          const KvRow(
            label: 'Rate limit',
            value:
                'Per source IP. Parallel bursts of 9 requests return HTTP 503 about every other time. Sequential calls with a small gap pass cleanly.',
          ),
          const KvRow(
            label: 'Docs',
            value: 'ssd.jpl.nasa.gov/horizons/manual.html',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "JPL Horizons is a free public ephemeris service from NASA's Solar System Dynamics group. Anyone can hit it from any tool: a browser, curl, a Swift app, a Python script.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Request extends StatelessWidget {
  const _Request();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Request parameters',
            icon: Icons.list_alt,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Every value must be wrapped in single quotes inside the query string. That is a Horizons quirk, not URL encoding. The single quotes are part of the value.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const ParamRow(
            name: 'format',
            value: 'text',
            note:
                'Plain text body. Easier to parse than the html or json variants.',
          ),
          const ParamRow(
            name: 'COMMAND',
            value: "'199' to '999'",
            note:
                'NAIF body code. Mercury 199, Venus 299, Earth 399, Mars 499, Jupiter 599, Saturn 699, Uranus 799, Neptune 899, Pluto 999.',
          ),
          const ParamRow(
            name: 'OBJ_DATA',
            value: "'NO'",
            note: "Skip the body's metadata block. We only want the ephemeris.",
          ),
          const ParamRow(
            name: 'MAKE_EPHEM',
            value: "'YES'",
            note: 'Generate the ephemeris.',
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
                "Origin of the coordinate system. 500 is the standard geocentric body code; @10 redirects to the Sun's barycenter, giving heliocentric output.",
          ),
          const ParamRow(
            name: 'START_TIME',
            value: "'YYYY-MM-DD HH:mm'",
            note: 'UTC. Light mode uses now.',
          ),
          const ParamRow(
            name: 'STOP_TIME',
            value: "'YYYY-MM-DD HH:mm'",
            note: 'UTC. Light mode uses now + 1h.',
          ),
          const ParamRow(
            name: 'STEP_SIZE',
            value: "'1h', '1d', '1m'…",
            note:
                'Sampling interval. Smaller = more rows in the response. Pick big enough that the response stays in the low thousands of lines.',
          ),
          const ParamRow(
            name: 'QUANTITIES',
            value: "'1'",
            note:
                'Only ask for the X/Y/Z vector. Cuts response size by about 70 percent.',
          ),
        ],
      ),
    );
  }
}

class _SampleRequest extends StatelessWidget {
  const _SampleRequest();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Sample request',
            icon: Icons.terminal,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Mercury, position right now:',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: '''GET https://ssd.jpl.nasa.gov/api/horizons.api
  ?format=text
  &COMMAND='199'
  &OBJ_DATA='NO'
  &MAKE_EPHEM='YES'
  &EPHEM_TYPE='VECTORS'
  &CENTER='500@10'
  &START_TIME='2026-05-04 12:00'
  &STOP_TIME='2026-05-04 13:00'
  &STEP_SIZE='1h'
  &QUANTITIES='1'
''',
          ),
        ],
      ),
    );
  }
}

class _Response extends StatelessWidget {
  const _Response();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Response shape',
            icon: Icons.description,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            r'Horizons returns one big plain-text document with a header (target metadata, request echo), an ephemeris block bracketed by $$SOE / $$EOE markers, and a footer.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Each ephemeris row is two lines: a date line containing 'A.D.' and 'TDB', then a vector line starting with 'X ='. Underdeck only reads those two line types and ignores everything else.",
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Excerpt:', style: AppTypography.caption),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: r'''$$SOE
2461164.500000000 = A.D. 2026-May-04 00:00:00.0000 TDB
 X =-3.012345678901234E+07 Y = 4.567890123456789E+07 Z = 1.234567890123456E+06
 VX=-5.123456789012345E+01 VY=-2.345678901234567E+01 VZ= 3.456789012345678E+00
 LT= 1.234567890123456E+02 RG= 5.678901234567890E+07 RR= 1.234567890123456E+01
$$EOE
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "X, Y, Z are kilometres relative to the Sun's centre. VX/VY/VZ are velocities (km/s). LT is light-time. RG is range. RR is range rate. Underdeck ignores everything except X and Y.",
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Parsing extends StatelessWidget {
  const _Parsing();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Parsing',
            icon: Icons.search,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "The parser is naive on purpose. Walk the lines: when one contains 'A.D.' grab the date, when the next starts with 'X =' grab the vector, repeat. No regex, no XML, no JSON.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Date format used to decode the timestamp:',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(text: 'yyyy-MMM-dd HH:mm:ss.SSSS  (UTC)'),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Locale is forced to en_US_POSIX so 'May' parses regardless of the device language.",
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
            "Two conversions turn (X, Y) in kilometres into the game's grid. Z is ignored: the game's map is 2D in the ecliptic plane.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Distance in SL', style: AppTypography.body),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''distance_km    = sqrt(x*x + y*y)
distance_miles = distance_km * 0.621371
distance_SL    = floor(distance_miles / 3_000_000)
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '1 SL = 3,000,000 miles. The constant comes from the East-Shire Utilities bot the app mirrors: it is a game convention, not a physical unit.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.md),
          Text('Sector (1 to 12)', style: AppTypography.body),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''theta = atan2(y, x)              // radians, range [-π, π]
if theta < 0: theta += 2π        // wrap to [0, 2π)
raw    = floor(theta * 12 / 2π)  // 0…11
sector = ((raw + 12) % 12) + 1   // 1…12
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'The +12 then mod 12 is defensive: it handles the boundary case where atan2 returns exactly 2π due to floating-point rounding. Sectors are counted counter-clockwise from the +X axis.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Windows extends StatelessWidget {
  const _Windows();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Per-planet windows (Full mode)',
            icon: Icons.timer,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'To find the next sector change, Underdeck does a coarse sweep then refines around the first transition. The window has to be wide enough to contain at least one transition: Pluto sits in one sector for years.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Step is sized so each broad response stays in the low thousands of lines. A 30-year window stepped at 1 hour would be 260,000 rows.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const WindowRow(
            planet: 'Mercury / Venus / Earth / Mars',
            broad: '60 d, 1h step',
            refine: '±12 h, 1m step',
          ),
          const WindowRow(
            planet: 'Jupiter',
            broad: '540 d, 12h step',
            refine: '±18 h, 5m step',
          ),
          const WindowRow(
            planet: 'Saturn',
            broad: '4 y, 1d step',
            refine: '±2 d, 30m step',
          ),
          const WindowRow(
            planet: 'Uranus',
            broad: '10 y, 2d step',
            refine: '±3 d, 1h step',
          ),
          const WindowRow(
            planet: 'Neptune',
            broad: '20 y, 7d step',
            refine: '±10 d, 6h step',
          ),
          const WindowRow(
            planet: 'Pluto',
            broad: '30 y, 14d step',
            refine: '±20 d, 12h step',
          ),
        ],
      ),
    );
  }
}

class _RateLimit extends StatelessWidget {
  const _RateLimit();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Rate limiting',
            icon: Icons.speed,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Calls are issued sequentially with a 200 ms gap between them. A parallel burst of 9 requests returns HTTP 503 about every other time; a gentle drip never has.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Light mode',
            value: '9 calls (one per planet).',
          ),
          const KvRow(
            label: 'Full mode',
            value:
                '9 to 18 calls. One coarse per planet, plus one refinement per planet when a transition is found.',
          ),
          const KvRow(label: 'Timeout', value: '30 s per call.'),
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
                'Planet code (199 to 999), UTC timestamp, fixed query string. No identifier of yours is added.',
          ),
          const KvRow(
            label: 'Visible to NASA',
            value: 'Your IP address, like for any web request.',
          ),
          const KvRow(
            label: 'Stored remotely',
            value:
                "Nothing on Underdeck servers (there are none). NASA's standard request logs apply on their side.",
          ),
          const KvRow(
            label: 'Stored locally',
            value:
                'Successful scans go to local history (no cloud sync in this build). You can delete entries from the history sheet.',
          ),
          const KvRow(
            label: 'Opt-in',
            value: 'Nothing leaves the device until you tap Scan now.',
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
            "Run this in a terminal to get Mars's current position. The %27 sequences are URL-encoded single quotes; the literal quotes around values are required by Horizons.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: '''curl "https://ssd.jpl.nasa.gov/api/horizons.api\\
?format=text\\
&COMMAND=%27499%27\\
&OBJ_DATA=%27NO%27\\
&MAKE_EPHEM=%27YES%27\\
&EPHEM_TYPE=%27VECTORS%27\\
&CENTER=%27500@10%27\\
&START_TIME=%272026-05-04%2012:00%27\\
&STOP_TIME=%272026-05-04%2013:00%27\\
&STEP_SIZE=%271h%27\\
&QUANTITIES=%271%27"
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            r'Look for the X = and Y = values between $$SOE and $$EOE, then apply the two formulas in the Math section. That is the entire pipeline.',
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
            'Ephemeris data: NASA / JPL Solar System Dynamics group, public domain. Sector and SL conventions: East-Shire Utilities Discord bot.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}
