// parsers.js - Extracts dependency names from package.json and requirements.txt

/**
 * Parses package.json and returns a list of npm package names.
 */
function parsePackageJson(content) {
    try {
        const pkg = JSON.parse(content);
        const deps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
        };
        return Object.keys(deps);
    } catch (e) {
        throw new Error('Failed to parse package.json: ' + e.message);
    }
}

/**
 * Parses requirements.txt and returns a list of Python package names.
 * Strips version specifiers like ==, >=, <=, ~=, !=
 * Ignores comments and blank lines.
 */
function parseRequirementsTxt(content) {
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
        .map(line => line.split(/[=<>!~;@\[]/)[0].trim())
        .filter(Boolean);
}

export { parsePackageJson, parseRequirementsTxt };
