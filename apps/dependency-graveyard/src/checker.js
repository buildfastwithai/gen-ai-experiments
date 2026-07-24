// checker.js - Checks each package against npm and PyPI APIs and calculates a risk score

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_REGISTRY = 'https://pypi.org/pypi';
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function daysSince(dateStr) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Checks an npm package against the npm registry.
 */
async function checkNpmPackage(name) {
    const result = { name, ecosystem: 'npm', risk: 'SAFE', reasons: [], lastPublished: null, maintainers: null, deprecated: false };
    try {
        const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`);
        if (!res.ok) return { ...result, risk: 'UNKNOWN', reasons: ['Package not found on npm'] };

        const data = await res.json();
        const times = data.time || {};
        const latestVersion = data['dist-tags']?.latest;
        const lastPublishedStr = latestVersion ? times[latestVersion] : times.modified;
        const lastPublished = lastPublishedStr ? new Date(lastPublishedStr) : null;
        const maintainers = data.maintainers?.length ?? 0;
        const deprecated = !!(latestVersion && data.versions?.[latestVersion]?.deprecated);
        const weeklyDownloads = null; // Would need separate API call

        result.lastPublished = lastPublished;
        result.maintainers = maintainers;
        result.deprecated = deprecated;

        if (deprecated) {
            result.risk = 'CRITICAL';
            result.reasons.push(`Officially deprecated on npm`);
        }

        if (lastPublished && Date.now() - lastPublished.getTime() > TWO_YEARS_MS) {
            result.risk = result.risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
            result.reasons.push(`Not updated in ${daysSince(lastPublished)} days (${Math.floor(daysSince(lastPublished) / 365)}+ years)`);
        } else if (lastPublished && Date.now() - lastPublished.getTime() > ONE_YEAR_MS) {
            if (result.risk === 'SAFE') result.risk = 'MEDIUM';
            result.reasons.push(`Not updated in ${daysSince(lastPublished)} days (1+ year)`);
        }

        if (maintainers === 1) {
            if (result.risk === 'SAFE') result.risk = 'MEDIUM';
            result.reasons.push(`Single maintainer — high bus factor risk`);
        }

        if (result.reasons.length === 0) result.reasons.push('No issues found');

    } catch (e) {
        result.risk = 'UNKNOWN';
        result.reasons.push(`Error fetching: ${e.message}`);
    }
    return result;
}

/**
 * Checks a Python package against the PyPI registry.
 */
async function checkPypiPackage(name) {
    const result = { name, ecosystem: 'pypi', risk: 'SAFE', reasons: [], lastPublished: null, maintainers: null, deprecated: false };
    try {
        const res = await fetch(`${PYPI_REGISTRY}/${encodeURIComponent(name)}/json`);
        if (!res.ok) return { ...result, risk: 'UNKNOWN', reasons: ['Package not found on PyPI'] };

        const data = await res.json();
        const info = data.info;
        const releases = data.releases || {};

        // Find the latest release date
        const releaseDates = Object.values(releases)
            .flat()
            .map(r => r.upload_time)
            .filter(Boolean)
            .sort()
            .reverse();

        const lastPublished = releaseDates.length > 0 ? new Date(releaseDates[0]) : null;
        const yanked = info.yanked || false;

        result.lastPublished = lastPublished;
        result.deprecated = yanked;

        if (yanked) {
            result.risk = 'CRITICAL';
            result.reasons.push(`Package has been yanked from PyPI: ${info.yanked_reason || 'No reason given'}`);
        }

        // Check if classifiers indicate deprecation
        const classifiers = info.classifiers || [];
        if (classifiers.some(c => c.toLowerCase().includes('inactive') || c.toLowerCase().includes('abandoned'))) {
            result.risk = result.risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
            result.reasons.push('Marked as Inactive or Abandoned in classifiers');
        }

        if (lastPublished && Date.now() - lastPublished.getTime() > TWO_YEARS_MS) {
            if (result.risk === 'SAFE') result.risk = 'HIGH';
            result.reasons.push(`Not updated in ${daysSince(lastPublished)} days (${Math.floor(daysSince(lastPublished) / 365)}+ years)`);
        } else if (lastPublished && Date.now() - lastPublished.getTime() > ONE_YEAR_MS) {
            if (result.risk === 'SAFE') result.risk = 'MEDIUM';
            result.reasons.push(`Not updated in ${daysSince(lastPublished)} days (1+ year)`);
        }

        if (result.reasons.length === 0) result.reasons.push('No issues found');

    } catch (e) {
        result.risk = 'UNKNOWN';
        result.reasons.push(`Error fetching: ${e.message}`);
    }
    return result;
}

/**
 * Checks all packages concurrently, batching requests to avoid rate limits.
 */
async function checkAll(npmPackages, pypiPackages) {
    const BATCH_SIZE = 10;
    const results = [];

    const allTasks = [
        ...npmPackages.map(name => () => checkNpmPackage(name)),
        ...pypiPackages.map(name => () => checkPypiPackage(name)),
    ];

    for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
        const batch = allTasks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(fn => fn()));
        results.push(...batchResults);
    }

    return results;
}

export { checkAll };
