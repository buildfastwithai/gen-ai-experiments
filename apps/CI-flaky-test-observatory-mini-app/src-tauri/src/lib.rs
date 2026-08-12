use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct RunsResponse {
    workflow_runs: Vec<WorkflowRun>,
}

#[derive(Debug, Deserialize)]
struct WorkflowRun {
    id: u64,
    branch: Option<String>,
    conclusion: Option<String>,
    run_started_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JobsResponse {
    jobs: Vec<Job>,
}

#[derive(Debug, Deserialize)]
struct Job {
    name: String,
    conclusion: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
    runner_name: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
struct JobStat {
    name: String,
    runs: u32,
    failures: u32,
    failure_rate: f64,
    avg_seconds: u64,
    branches: Vec<String>,
    runners: Vec<String>,
    status: String,
}

#[derive(Debug, Serialize)]
struct ObservatoryReport {
    repository: String,
    runs_analyzed: u32,
    jobs_analyzed: u32,
    failed_runs: u32,
    success_rate: f64,
    avg_run_seconds: u64,
    flaky_jobs: Vec<JobStat>,
    slowest_jobs: Vec<JobStat>,
    branch_failures: Vec<Breakdown>,
    runner_failures: Vec<Breakdown>,
    generated_at: String,
}

#[derive(Debug, Serialize)]
struct Breakdown {
    label: String,
    runs: u32,
    failures: u32,
    failure_rate: f64,
}

fn parse_repo(input: &str) -> Result<(String, String), String> {
    let clean = input.trim().trim_end_matches('/').trim_end_matches(".git");
    let parts: Vec<&str> = clean.split('/').filter(|part| !part.is_empty()).collect();
    if parts.len() < 2 {
        return Err("Enter a repository like https://github.com/owner/repository".into());
    }
    let repo = parts.last().unwrap().to_string();
    let owner = parts[parts.len() - 2].to_string();
    if clean.contains("github.com") {
        Ok((owner, repo))
    } else {
        Err("Only github.com repositories are supported".into())
    }
}

fn headers(token: &str) -> Result<HeaderMap, String> {
    let mut map = HeaderMap::new();
    map.insert(USER_AGENT, HeaderValue::from_static("CI-Flaky-Observatory"));
    map.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    let auth = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| "Invalid GitHub token".to_string())?;
    map.insert(AUTHORIZATION, auth);
    Ok(map)
}

fn seconds_between(start: Option<&String>, end: Option<&String>) -> u64 {
    match (start, end) {
        (Some(a), Some(b)) => {
            let parse = |value: &str| value.parse::<chrono::DateTime<chrono::FixedOffset>>().ok();
            match (parse(a), parse(b)) {
                (Some(left), Some(right)) => {
                    right.signed_duration_since(left).num_seconds().max(0) as u64
                }
                _ => 0,
            }
        }
        _ => 0,
    }
}

fn make_breakdown(values: HashMap<String, (u32, u32)>) -> Vec<Breakdown> {
    let mut result: Vec<Breakdown> = values
        .into_iter()
        .map(|(label, (runs, failures))| Breakdown {
            label,
            runs,
            failures,
            failure_rate: if runs == 0 {
                0.0
            } else {
                failures as f64 / runs as f64
            },
        })
        .collect();
    result.sort_by(|a, b| {
        b.failure_rate
            .partial_cmp(&a.failure_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    result
}

#[tauri::command]
async fn analyze_repository(
    repository: String,
    token: String,
    days: u32,
) -> Result<ObservatoryReport, String> {
    let (owner, repo) = parse_repo(&repository)?;
    if token.trim().len() < 10 {
        return Err("Enter a GitHub token with Actions read access".into());
    }
    let client = reqwest::Client::builder()
        .default_headers(headers(&token)?)
        .build()
        .map_err(|e| e.to_string())?;
    let runs_url = format!("https://api.github.com/repos/{owner}/{repo}/actions/runs?per_page=100");
    let response = client
        .get(runs_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => "GitHub rejected the token or the token lacks Actions read access".into(),
            404 => "Repository not found or token cannot access it".into(),
            _ => format!("GitHub returned {}", response.status()),
        });
    }
    let runs = response
        .json::<RunsResponse>()
        .await
        .map_err(|e| e.to_string())?
        .workflow_runs;
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days.max(1) as i64);
    let recent: Vec<WorkflowRun> = runs
        .into_iter()
        .filter(|run| {
            run.updated_at
                .as_ref()
                .and_then(|value| value.parse::<chrono::DateTime<chrono::FixedOffset>>().ok())
                .map(|date| date.with_timezone(&chrono::Utc) >= cutoff)
                .unwrap_or(true)
        })
        .take(60)
        .collect();
    if recent.is_empty() {
        return Err("No GitHub Actions runs found in the selected period".into());
    }

    let mut job_map: HashMap<String, JobStat> = HashMap::new();
    let mut branch_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut failed_runs = 0;
    let mut total_run_seconds = 0;

    for run in &recent {
        let branch = run.branch.clone().unwrap_or_else(|| "unknown".into());
        let branch_entry = branch_map.entry(branch.clone()).or_insert((0, 0));
        branch_entry.0 += 1;
        if run.conclusion.as_deref() == Some("failure") {
            failed_runs += 1;
            branch_entry.1 += 1;
        }
        total_run_seconds += seconds_between(run.run_started_at.as_ref(), run.updated_at.as_ref());
        let jobs_url = format!(
            "https://api.github.com/repos/{owner}/{repo}/actions/runs/{}/jobs?per_page=100",
            run.id
        );
        let jobs_response = client
            .get(jobs_url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !jobs_response.status().is_success() {
            continue;
        }
        let jobs = jobs_response
            .json::<JobsResponse>()
            .await
            .map_err(|e| e.to_string())?
            .jobs;
        for job in jobs {
            let entry = job_map.entry(job.name.clone()).or_insert(JobStat {
                name: job.name.clone(),
                runs: 0,
                failures: 0,
                failure_rate: 0.0,
                avg_seconds: 0,
                branches: vec![],
                runners: vec![],
                status: "stable".into(),
            });
            entry.runs += 1;
            if job.conclusion.as_deref() == Some("failure") {
                entry.failures += 1;
            }
            entry.avg_seconds +=
                seconds_between(job.started_at.as_ref(), job.completed_at.as_ref());
            if !entry.branches.contains(&branch) {
                entry.branches.push(branch.clone());
            }
            if let Some(runner) = job.runner_name {
                if !entry.runners.contains(&runner) {
                    entry.runners.push(runner);
                }
            }
        }
    }

    let mut jobs: Vec<JobStat> = job_map
        .into_values()
        .map(|mut job| {
            job.failure_rate = if job.runs == 0 {
                0.0
            } else {
                job.failures as f64 / job.runs as f64
            };
            job.avg_seconds = if job.runs == 0 {
                0
            } else {
                job.avg_seconds / job.runs as u64
            };
            job.status = if job.failure_rate >= 0.10 && job.failure_rate < 0.75 {
                "flaky".into()
            } else if job.failure_rate >= 0.75 {
                "failing".into()
            } else {
                "stable".into()
            };
            job
        })
        .collect();
    let mut flaky = jobs
        .iter()
        .filter(|job| job.status == "flaky" || job.status == "failing")
        .cloned()
        .collect::<Vec<_>>();
    flaky.sort_by(|a, b| {
        b.failure_rate
            .partial_cmp(&a.failure_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    jobs.sort_by(|a, b| b.avg_seconds.cmp(&a.avg_seconds));

    Ok(ObservatoryReport {
        repository: format!("{owner}/{repo}"),
        runs_analyzed: recent.len() as u32,
        jobs_analyzed: jobs.len() as u32,
        failed_runs,
        success_rate: 1.0 - (failed_runs as f64 / recent.len() as f64),
        avg_run_seconds: total_run_seconds / recent.len() as u64,
        flaky_jobs: flaky.into_iter().take(10).collect(),
        slowest_jobs: jobs.into_iter().take(10).collect(),
        branch_failures: make_breakdown(branch_map),
        runner_failures: vec![],
        generated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![analyze_repository])
        .run(tauri::generate_context!())
        .expect("error while running CI Flaky Observatory");
}
