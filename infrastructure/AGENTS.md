# Infrastructure instructions

- Resolve build contexts and mounted file paths relative to the Compose file, not the shell working directory.
- Keep business and auth database credentials, ports, and volumes separate.
- Inspect the actual Jenkins agent configuration; the optional image does not configure the native agent.
- Preserve required test reporting and make missing toolchains visible as failures.
- Document operational changes in the [infrastructure README](README.md). Do not present development examples as production-ready deployment.

## SonarQube

The Jenkins and SonarQube settings the pipeline needs are in the [infrastructure README](README.md#sonarqube). This section covers what an agent needs to reach the server, run a scan, and read the result.

### Connect

- SonarQube (Community Build 26.7) and Jenkins run on the same Linux host. Last known address, 2026-10-07: SonarQube `http://10.14.143.233:9000`, Jenkins `http://10.14.143.233:8080`. Jenkins itself reaches SonarQube as `http://localhost:9000`.
- Confirm the address before anything else: `curl -s -m 10 <url>/api/system/status` must return `"status":"UP"`. The address has been given wrongly before. If nothing answers, ask the user for the current one; do not probe the subnet or install a substitute server unasked.
- Ask the user for the SonarQube login each session. Never write a password or token into the repository, the Jenkinsfile, or documentation.
- For scans, create a project analysis token and revoke it when finished: `POST /api/user_tokens/generate` with `name`, `type=PROJECT_ANALYSIS_TOKEN`, `projectKey=DuaLeapa-Project`, then `POST /api/user_tokens/revoke` with `name`. Leave the existing `jenkins` tokens alone; the Jenkins server entry uses them.
- The Jenkins API rejects anonymous calls. Without a Jenkins login from the user, an agent cannot lint the Jenkinsfile, read Jenkins configuration, or start a build; verify pipeline changes from a console log the user supplies.

### Server state the pipeline expects

- Project key and name are both `DuaLeapa-Project`. The instructor assigned them, so do not rename.
- Quality profiles are the instructor's `texoma-*` set for CSS, Docker, HTML, Java, JavaScript, Python, and TypeScript, from [the course repository](https://github.com/bhickey777/FidelityLeapDailyReviews/tree/main/Extras/SonarQube%20Configuration%20/quality-profilles). Restore one with `POST /api/qualityprofiles/restore` (multipart field `backup`), then assign it with `/api/qualityprofiles/add_project`. Notebooks, JSON, XML, and YAML have no course profile and use Sonar way.
- The gate is `Classroom Quality Gate`. New code: more than 5 issues, hotspots reviewed below 100%, coverage below 80%, or duplication above 20% fails. Overall code: duplication above 30%, more than 5 high or 10 medium severity issues, or more than 5 skipped tests fails. The course guide also lists "Security Issue Severity on Overall Code"; 26.7 has no such metric, so check it by hand with `/api/issues/search?impactSoftwareQualities=SECURITY`.
- A webhook named `Jenkins` posts to `<jenkins-url>/sonarqube-webhook/`. Check `/api/webhooks/deliveries?webhook=<key>` when the gate stage hangs.

### Run a scan from a workstation

Reports must exist first, because the scan imports coverage and needs compiled Java classes. From the repository root:

```sh
mvn -B -f apps/holdings-and-trade-service/pom.xml clean test
mvn -B -f apps/order-and-sell-service/pom.xml clean test
npm --prefix apps/auth-service run test:ci
npm --prefix apps/client-ui test -- --no-watch --coverage --coverage-reporters=lcovonly
(cd apps/reporting-service && python -m pytest tests/ --cov=. --cov-report=xml:coverage/coverage.xml)
node infrastructure/jenkins/jacoco-to-sonar-coverage.mjs apps/holdings-and-trade-service apps/order-and-sell-service
SONAR_HOST_URL=<server-url> SONAR_TOKEN=<token> sonar-scanner \
  -Dproject.settings=infrastructure/jenkins/sonar-project.properties -Dsonar.projectVersion=local-<n>
```

- Use the SonarScanner CLI 8.1 build that bundles its own JRE. The reporting tests need the packages in `apps/reporting-service/requirements.txt`; install them into a virtual environment outside the repository.
- Every scan publishes an analysis to the shared project, and with the default "previous version" setting it becomes the baseline for the next build's new code. Always pass a `local-<n>` version so those analyses are identifiable.
- Run `git status` afterwards and delete any untracked test output. `.scannerwork/` and the coverage reports are ignored; `apps/reporting-service/reports/`, which appears when pytest is given `--junit-xml`, is not.

### Read the result

Wait for `/api/ce/task?id=<id>` (the id is in the scanner output) to report `SUCCESS`, then query with `projectKey` or `components` set to `DuaLeapa-Project`:

| Question | Endpoint |
| --- | --- |
| Did the gate pass, and on which conditions | `/api/qualitygates/project_status` |
| Open issues | `/api/issues/search?issueStatuses=OPEN,CONFIRMED` |
| Security hotspots | `/api/hotspots/search` |
| Coverage, duplication, counts | `/api/measures/component?metricKeys=coverage,new_coverage,duplicated_lines_density,violations` |
| Coverage per app | `/api/measures/component_tree?component=DuaLeapa-Project:apps&strategy=children&metricKeys=line_coverage` |

### Known pitfalls

- A red Quality Gate stage in Jenkins is not proof the gate failed. `Expected URL scheme 'http' or 'https'` means the Server URL field of the Jenkins `SonarQube` entry is blank. Check `/api/qualitygates/project_status` before changing any code.
- Do not point `sonar.coverage.jacoco.xmlReportPaths` at the two JaCoCo reports. Both services use the same Java packages, and the importer credits one service's coverage to the other. After editing the converter, compare its output with the JaCoCo XML per file and per line; matching totals hid a bug once.
- Do not set `sonar.java.libraries` to a glob that can match nothing. The scan stops with `Invalid value for 'sonar.java.libraries'`. The "libraries were not provided" warning is expected.
- The 80% new-code coverage condition is skipped below 20 new lines to cover. Above that, code with no coverage report counts as 0%; a 38-line refactor under `apps/market-data` failed the gate at 2.6% before that directory was measured.
- Market-data coverage comes only from the Jenkins integration stage, which runs each script under coverage.py. A workstation scan without `reports/market-data/coverage.xml` publishes those scripts as uncovered. The generate and validate scripts run without a database (`python -m coverage run` with `--output` and `--dataset` pointed at a scratch directory); initialize and import need PostgreSQL.
- New code is everything since the previous build's analysis, because each build number is a new version. A rerun of a failed build with no code change has no new lines to judge, so it should pass the new-code conditions without anything being fixed. Judge a fix by the per-file measures, not by the next green gate.
- The reporting tests in Jenkins mount the workspace at its own path so the source path recorded in `coverage.xml` exists on the agent. Keep that mount; the earlier `/app` mount recorded a path the scanner cannot find there.
- Jenkins clones at depth 1, so "Shallow clone detected, no blame information" is expected.
- Fix findings instead of suppressing them where a service's own instructions say so; see [reporting service instructions](../apps/reporting-service/AGENTS.md).
