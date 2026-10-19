import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJobsJson, type Job } from './jobModel';
import { pristineFilter } from './jobsLogic';
import { jobIdFromSearch, jobRoute, jobShare, jobsListShare } from './jobShare';

const jobs = parseJobsJson(
  JSON.parse(
    // jsdom environment (appLink reads window.location): read the real data by path.
    readFileSync(resolve(process.cwd(), 'public/catalog/jobs.json'), 'utf-8'),
  ) as unknown,
);
const byId = (id: number): Job => jobs.find((j) => j.id === id)!;

describe('job links', () => {
  it('round-trips the job id', () => {
    expect(jobRoute(35511202)).toBe('/tools/jobs?job=35511202');
    expect(jobIdFromSearch('?job=35511202')).toBe(35511202);
    expect(jobIdFromSearch('?q=x&job=46605903')).toBe(46605903);
    expect(jobIdFromSearch('?job=abc')).toBeNull();
    expect(jobIdFromSearch('')).toBeNull();
  });
});

describe('jobShare', () => {
  it('writes a job briefing with route, reward, faction and requirements', () => {
    const share = jobShare(byId(35511202));
    const text = share.discordText;
    expect(text.startsWith('### 💼 ESSI · Job briefing\n-# Job Allocation Desk · Job #35511202')).toBe(true);
    expect(text).toContain('a beginner job for **Professor Q (PRQ)**');
    expect(text).toContain('> PRQ BEGINNER STR \\[gain STRENGTH\\]: Break rocks'); // markdown stripped, brackets escaped
    expect(text).toContain('- **Pickup:** Ratropia · Northshire (355 · z35)');
    expect(text).toContain("- **Drop-off:** Ratropia · Queen's Quarry (355 · z112)");
    expect(text).toContain('- **Reward:** Rocks · amount unknown');
    expect(text).toContain('🆔 In-game job ID: **35511202**');
    expect(text).toContain(`[Open this job in ESSI](<${share.link}>)`);
    expect(text.endsWith('Job Allocation Desk, East Shire Space Industries (ESSI)')).toBe(true);
    expect(share.link).toContain('#/tools/jobs?job=35511202');
    expect(share.caption).toContain('💼 ESSI job briefing · #35511202 (Beginner, Professor Q)');
  });

  it('flags a job that costs another faction reputation', () => {
    const harmful = jobs.find((j) => j.harmedFaction !== null)!;
    expect(jobShare(harmful).discordText).toMatch(/- \*\*Loses rep:\*\* ⚠️ /);
  });

  it('lists the requirements, or says there are none', () => {
    const needs = jobs.find((j) => j.skillRequirement !== null)!;
    expect(jobShare(needs).discordText).toMatch(/- \*\*Requirements:\*\* .*≥/);
    const free = jobs.find(
      (j) => j.requiredTag === null && j.requiredSkill === null && j.requiredRep <= 0 && j.requiredAsset === null,
    );
    if (free !== undefined) expect(jobShare(free).discordText).toContain('- **Requirements:** none');
  });

  it('keeps every job under the Discord limit and draws the description', () => {
    for (const job of jobs) {
      const share = jobShare(job);
      expect(share.discordText.length, `#${job.id}`).toBeLessThanOrEqual(1900);
      if (job.description.trim().length > 0) {
        expect(share.card.blocks.some((b) => b.kind === 'paragraph')).toBe(true);
      }
    }
  });
});

describe('trained skills and costs', () => {
  it('shows what a Beginner job trains instead of a requirement', () => {
    const text = jobShare(byId(35511202)).discordText;
    expect(text).toContain('- **Requirements:** tag North Squire\n');
    expect(text).toContain('- **Trains:** Strength (+0.001)');
  });

  it('shows a resource as a cost', () => {
    expect(jobShare(byId(30100701)).discordText).toContain('- **Requirements:** costs 100 oil');
    expect(jobShare(byId(50605501)).discordText).toContain('costs 50 coin');
  });
});

describe('jobsListShare', () => {
  it('fits a long board under the Discord limit with the rest counted', () => {
    const share = jobsListShare(jobs, pristineFilter(), []);
    expect(share.discordText.length).toBeLessThanOrEqual(1900);
    expect(share.discordText).toContain(`lists **${jobs.length} jobs** on the board`);
    expect(share.discordText).toMatch(/- …and \d+ more in ESSI/);
    expect(share.card.blocks.filter((b) => b.kind === 'listRow')).toHaveLength(25);
  });

  it('names the filters and links to them', () => {
    const filter = { ...pristineFilter(), categories: new Set(['beginner']), query: 'rocks' };
    const share = jobsListShare(jobs.slice(0, 3), filter, ['Beginner']);
    expect(share.discordText).toContain('lists **3 jobs** matching Beginner · “rocks”.');
    expect(share.link).toContain('#/tools/jobs?cat=beginner&q=rocks');
  });

  it('says when nothing matches', () => {
    expect(jobsListShare([], pristineFilter(), ['Done']).discordText).toContain('No job matches these filters');
  });
});
