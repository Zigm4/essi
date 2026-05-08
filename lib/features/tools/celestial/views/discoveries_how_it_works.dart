import 'package:flutter/material.dart';

import '../../../../design_system/components/info_card.dart';
import '../../../../design_system/components/section_header.dart';
import '../../../../design_system/components/transmission_header.dart';
import '../../../../design_system/spacing.dart';
import '../../../../design_system/typography.dart';

class DiscoveriesHowItWorksView extends StatelessWidget {
  const DiscoveriesHowItWorksView({super.key});

  @override
  Widget build(BuildContext context) {
    return HowItWorksSheet(
      cards: const [
        TransmissionHeader(label: 'ESSI · how this tool works'),
        _Overview(),
        _Endpoint(),
        _Request(),
        _Constraint(),
        _SampleRequest(),
        _Response(),
        _Parsing(),
        _Status(),
        _Historical(),
        _Timeouts(),
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
            "Discoveries searches NASA's Small-Body Database (SBDB) for comets or asteroids whose first observation date falls within a window you choose. SBDB indexes every minor body the world's observatories have ever reported: about 1.4 million asteroids and 4,000 comets at the time of writing.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Each result gets a status icon computed locally on the device, mirroring the East-Shire Utilities bot's classification rules.",
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
            value: 'https://ssd-api.jpl.nasa.gov/sbdb_query.api',
            labelWidth: 120,
          ),
          const KvRow(label: 'Method', value: 'GET', labelWidth: 120),
          const KvRow(
            label: 'Auth',
            value: 'None. Public, no API key, no token.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Rate limit',
            value:
                'No documented hard limit. Underdeck issues one request per Search tap.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Docs',
            value: 'ssd-api.jpl.nasa.gov/doc/sbdb_query.html',
            labelWidth: 120,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "This is JPL's bulk-query interface to the small-body catalog. The same backend powers the SBDB browser at ssd.jpl.nasa.gov/tools/sbdb_lookup.html and the per-object SBDB API used by the Tracker tool.",
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
            'All four parameters go in the query string of a single GET. No body, no headers required.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const ParamRow(
            name: 'sb-kind',
            value: 'c | a',
            note:
                "'c' for comets, 'a' for asteroids. Required: SBDB will not return both kinds in the same response.",
          ),
          const ParamRow(
            name: 'fields',
            value: 'comma-separated',
            note:
                'Which columns you want back. Underdeck asks for full_name, name, kind, pdes, first_obs, last_obs, pha, plus diameter and albedo for asteroids. Smaller field lists return faster.',
          ),
          const ParamRow(
            name: 'sb-cdata',
            value: 'JSON object',
            note:
                "The filter. JSON-encoded constraint object using SBDB's mini-language (next section). Skipped entirely for pre-1900 queries.",
          ),
          const ParamRow(
            name: 'limit',
            value: '1000 or 50000',
            note:
                '1000 is plenty for any 30-day window. 50000 is used as a safety upper bound when fetching the full pre-1900 catalog without a date filter.',
          ),
        ],
      ),
    );
  }
}

class _Constraint extends StatelessWidget {
  const _Constraint();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Constraint mini-language',
            icon: Icons.functions,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'sb-cdata is the unusual part. SBDB expects a JSON object whose values are NOT JSON: each clause is a single string with pipe-separated tokens.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Shape:', style: AppTypography.caption),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''{
  "AND": [
    "first_obs|RG|2020-01-01|2020-01-31"
  ]
}
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Tokens, in order: field name, operator, then 1 to 2 values depending on the operator.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Operators Underdeck might use:',
            style: AppTypography.body,
          ),
          const SizedBox(height: 4),
          const OpRow(
            op: 'RG',
            desc: 'Range, inclusive on both ends. Two values: lower, upper.',
          ),
          const OpRow(
            op: 'EQ / NE',
            desc: 'Equals / not equals. One value.',
          ),
          const OpRow(
            op: 'LT / LE / GT / GE',
            desc: 'Less / less-equal / greater / greater-equal. One value.',
          ),
          const OpRow(
            op: 'LK',
            desc: 'SQL-style LIKE pattern, % wildcard. One value.',
          ),
          const OpRow(
            op: 'NL / NN',
            desc: 'Is null / is not null. No value.',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'The full operator set is in the SBDB docs. The whole sb-cdata value is then URL-encoded as the query parameter.',
            style: AppTypography.caption,
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
            'Comets first observed in January 2020:',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: '''GET https://ssd-api.jpl.nasa.gov/sbdb_query.api
  ?sb-kind=c
  &fields=full_name,pdes,first_obs,last_obs,pha
  &sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}
  &limit=1000
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Shown unencoded for readability. The sb-cdata value must be percent-encoded in the actual request: braces become %7B / %7D, brackets %5B / %5D, pipes %7C, double-quotes %22.',
            style: AppTypography.caption,
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
            "JSON document. The top-level keys are 'signature' (versioning), 'count' (row count), 'fields' (column names in order), and 'data' (an array of arrays, one per body).",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Each row is positional: row[i] is the value for fields[i]. Cells are heterogeneous: a single column can return strings, numbers, or null in different rows.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('Excerpt:', style: AppTypography.caption),
          const SizedBox(height: 4),
          const CodeBlock(
            text: '''{
  "signature": {
    "source": "NASA/JPL Small-Body Database Query API",
    "version": "1.5"
  },
  "count": 2,
  "fields": ["full_name", "pdes", "first_obs", "last_obs", "pha"],
  "data": [
    ["       1P/Halley",   "1P",      "1835-08-05", "2017-03-22", null],
    ["       (2020 AB1)",  "2020 AB1","2020-01-15", "2020-04-22", "N"]
  ]
}
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "full_name comes back with leading whitespace and unnumbered designations wrapped in parens. The UI strips both for display. Dates are ISO YYYY-MM-DD strings. The pha field is 'Y', 'N', or null (potentially hazardous asteroid flag).",
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
            'Three small rules turn the wire format into typed objects:',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: '1. Column map',
            value:
                "Build name→index from the 'fields' array first. Never assume column order: SBDB has reordered fields in the past.",
            labelWidth: 120,
          ),
          const KvRow(
            label: '2. Tolerant cells',
            value:
                'Each cell decoder accepts string OR number OR null. SBDB returns dates as strings but diameter as a number, sometimes the same column shifts type across rows.',
            labelWidth: 120,
          ),
          const KvRow(
            label: '3. Sort',
            value:
                'Order results by first_obs ascending so the earliest discovery is at the top, matching the bot.',
            labelWidth: 120,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Rows where pdes (the canonical designation) is missing are dropped: those are SBDB internal placeholders.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Status icon (computed locally)',
            icon: Icons.bubble_chart,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "After parsing, each object gets one of four icons. The rules are evaluated top-down, first match wins. They mirror the East-Shire Utilities bot's calculate_status function.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const StatusRow(
            icon: '🔴',
            title: 'Potentially hazardous',
            rule:
                "pha == 'Y'. SBDB has flagged this asteroid as a Potentially Hazardous Asteroid (close approach within 0.05 AU and absolute magnitude H ≤ 22).",
          ),
          const StatusRow(
            icon: '🟡',
            title: 'Caution: large asteroid',
            rule:
                'kind = asteroid AND diameter > 140 m. Large enough to matter on impact, even if not currently flagged hazardous.',
          ),
          const StatusRow(
            icon: '🟡',
            title: 'Caution: short tracking',
            rule:
                'tracking_days < 3, where tracking_days = last_obs − first_obs. The orbit is poorly constrained; future positions are uncertain.',
          ),
          const StatusRow(
            icon: '🟢',
            title: 'Within normal parameters',
            rule: 'Default. None of the above triggers.',
          ),
          const StatusRow(
            icon: '❓',
            title: 'Unclassified',
            rule:
                'Either first_obs or last_obs is missing or unparseable. Status cannot be computed.',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This computation is 100 percent local. SBDB does not return a status field; the 4 buckets are an Underdeck/bot convention to give a quick visual read.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Historical extends StatelessWidget {
  const _Historical();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Pre-1900 quirk',
            icon: Icons.event_busy,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "SBDB's first_obs filter behaves erratically when the lower bound is before 1900. Some legitimate rows (Halley, the first numbered minor planets, etc.) get skipped server-side for reasons that are not documented.",
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'When the start date you pick is in 1899 or earlier, Underdeck switches strategy:',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Server',
            value: 'Drop the sb-cdata constraint entirely. Set limit=50000.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Client',
            value:
                "Filter the response locally by parsing each row's first_obs and keeping only those inside [start, end].",
            labelWidth: 120,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Cost: bigger response (a few MB instead of a few KB), longer wait. Benefit: no rows quietly missing.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _Timeouts extends StatelessWidget {
  const _Timeouts();
  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Timeouts and limits',
            icon: Icons.schedule,
          ),
          const SizedBox(height: AppSpacing.sm),
          const KvRow(
            label: 'Comet timeout',
            value: '30 s. The comet table is small (~4,000 rows total).',
            labelWidth: 130,
          ),
          const KvRow(
            label: 'Asteroid timeout',
            value: '90 s. SBDB scans 1.4 M asteroid rows; even an indexed query takes time.',
            labelWidth: 130,
          ),
          const KvRow(
            label: 'Result cap',
            value: '1,000 rows for normal queries, 50,000 for pre-1900.',
            labelWidth: 130,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'If you hit the timeout, narrow the date range. Asteroid windows of 10+ days are flagged in the UI for that reason.',
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
                'Object kind, date range (or none for pre-1900), field list, fixed limit. No identifier of yours is added.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Visible to NASA',
            value: 'Your IP address, like for any web request.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Stored remotely',
            value:
                "Nothing on Underdeck servers (there are none). NASA's standard request logs apply on their side.",
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Stored locally',
            value:
                'Search results live in memory until you leave the screen or run another search. Each search is logged to local history.',
            labelWidth: 120,
          ),
          const KvRow(
            label: 'Opt-in',
            value: 'Nothing leaves the device until you tap Search.',
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
            'Run this in a terminal. The --data-urlencode -G form lets curl handle the percent-encoding of the JSON value for you.',
            style: AppTypography.body,
          ),
          const SizedBox(height: AppSpacing.sm),
          const CodeBlock(
            text: '''curl -G "https://ssd-api.jpl.nasa.gov/sbdb_query.api" \\
  --data-urlencode "sb-kind=c" \\
  --data-urlencode "fields=full_name,pdes,first_obs,last_obs,pha" \\
  --data-urlencode 'sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}' \\
  --data-urlencode "limit=1000"
''',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "Pipe to jq for readable output: append | jq '.data[0:3]' to see the first three rows. Replace 'c' with 'a' for asteroids, but expect a much larger response.",
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
            'Catalog data: NASA / JPL Solar System Dynamics group, public domain. Status classification: East-Shire Utilities Discord bot.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}
