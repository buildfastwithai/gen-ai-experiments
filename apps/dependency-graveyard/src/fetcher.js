// fetcher.js - Downloads package.json / requirements.txt from GitHub or reads locally
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Converts a GitHub URL to raw content URLs and fetches the files.
 * Supports both main and master branches.
 */
async function fetchFromGitHub(repoUrl) {
    // Normalize URL: remove trailing slash and .git
    const base = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
    const match = base.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const repo = match[1];
    const files = {};

    for (const branch of ['main', 'master']) {
        const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}`;
        for (const filename of ['package.json', 'requirements.txt']) {
            if (files[filename]) continue; // already found
            try {
                const res = await fetch(`${rawBase}/${filename}`);
                if (res.ok) {
                    files[filename] = await res.text();
                }
            } catch (_) { /* skip */ }
        }
        if (Object.keys(files).length > 0) break;
    }

    if (Object.keys(files).length === 0) {
        throw new Error(`No package.json or requirements.txt found in ${repoUrl}`);
    }

    return files;
}

/**
 * Reads package.json / requirements.txt from the local directory.
 */
function fetchFromLocal(dir = process.cwd()) {
    const files = {};
    for (const filename of ['package.json', 'requirements.txt']) {
        const fullPath = join(dir, filename);
        if (existsSync(fullPath)) {
            files[filename] = readFileSync(fullPath, 'utf-8');
        }
    }
    if (Object.keys(files).length === 0) {
        throw new Error(`No package.json or requirements.txt found in ${dir}`);
    }
    return files;
}

export { fetchFromGitHub, fetchFromLocal };
