const path = require("path");
const fs = require("fs");
const core = require('@actions/core');
const github = require('@actions/github');
const { Document, Parsers, Spectral, isOpenApiv3 } = require("@stoplight/spectral")

async function runSpectral(specFile) {
    const spectral = new Spectral();
    spectral.registerFormat("oas3", isOpenApiv3);

    let ruleset = core.getInput("ruleset");
    if (ruleset) {
        ruleset = path.resolve(ruleset);
    } else {
        ruleset = "spectral:oas";
    }
    core.info(`Loading ruleset: ${ruleset}`);
    await spectral.loadRuleset(ruleset);

    let input = fs.readFileSync(specFile).toString();

    specFile = path.resolve(specFile);
    core.info(`Running Spectral on spec: ${specFile}`);
    return spectral.run(new Document(input, Parsers.Yaml, specFile));
}

function createCheckObject(spectralReport) {
    let annotations = [];
    let maxSeverity = 0;
    let itemsPerSeverity = [0, 0, 0, 0];

    for (let i in spectralReport) {
        let item = spectralReport[i];

        let annotation = {
            path: path.relative(process.cwd(), item.source).split(path.sep).join('/'),
            start_line: item.range.start.line,
            end_line: item.range.end.line,
            annotation_level: (() => {
                switch (item.severity) {
                    case 0:
                        return "failure";
                    case 1:
                        return "warning";
                    default:
                        return "notice";
                }
            })(),
            title: item.code,
            message: item.message
        };

        if (item.range.start.line === item.range.end.line) {
            annotation.start_column = item.range.start.character;
            annotation.end_column = item.range.end.character;
        }

        annotations.push(annotation);
        maxSeverity = Math.max(maxSeverity, item.severity);
        itemsPerSeverity[item.severity]++;
    }

    let titleItems = [];
    if (itemsPerSeverity[0]) titleItems.push(itemsPerSeverity[0] + " errors");
    if (itemsPerSeverity[1]) titleItems.push(itemsPerSeverity[1] + " warnings");
    if (itemsPerSeverity[2]) titleItems.push(itemsPerSeverity[2] + " notices");
    if (itemsPerSeverity[3]) titleItems.push(itemsPerSeverity[3] + " hints");

    return {
        title: titleItems.length ? titleItems.join(", ") : "No issues",
        summary: "",
        conclusion: itemsPerSeverity[0] > 0 ? "failure" : "success",
        annotations: annotations
    };
}

async function postCheckToGithub(check) {
    const githubToken = core.getInput("token");
    const octokit = github.getOctokit(githubToken);

    let sha = github.context.payload.pull_request.head.sha;
    if (!sha) {
        sha = github.context.sha;
    }

    let response = await octokit.checks.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        name: "Spectral linting report",
        head_sha: sha,
        conclusion: check.conclusion,
        output: {
            title: check.title,
            summary: check.summary
        }
    });

    // Github only allows 50 annotations per call, so we need to use batching.
    let annotations = check.annotations;
    while (annotations.length) {
        let annotationsBatch = annotations.slice(0, 50);
        annotations = annotations.slice(50);

        await octokit.checks.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            check_run_id: response.data.id,
            output: {
                title: check.title,
                summary: check.summary,
                annotations: annotationsBatch
            }
        });
    }
}

(async () => {
    try {
        let specFile = core.getInput("spec");
        if (!specFile) {
            throw new Error("Required parameter 'spec' is missing.");
        }

        // Run Spectral to generate a report.
        let spectralReport = await runSpectral(specFile);

        // Create a check object from the Spectral report and add it to the GitHub PR.
        core.info("Creating check with annotations from Spectral.");
        let check = createCheckObject(spectralReport);
        await postCheckToGithub(check);
    } catch (error) {
        core.setFailed(error.message);
    }
})();
