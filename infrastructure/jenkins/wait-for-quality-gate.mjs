import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

// Resolve this build's task and analysis, never the latest project analysis.
const metadata = Object.fromEntries(readFileSync('.scannerwork/report-task.txt', 'utf8')
  .trim().split(/\r?\n/).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
const base = process.env.SONAR_HOST_URL;
const token = process.env.SONAR_AUTH_TOKEN;
if (!base || !token || !metadata.ceTaskId) throw new Error('Missing SonarQube credentials or task metadata');
async function query(path) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`SonarQube API returned HTTP ${response.status}`);
  return response.json();
}
const deadline = Date.now() + 14 * 60 * 1000;
let previousStatus;
while (Date.now() < deadline) {
  const { task } = await query(`/api/ce/task?id=${encodeURIComponent(metadata.ceTaskId)}`);
  if (task.status !== previousStatus) console.log(`SonarQube task ${metadata.ceTaskId}: ${task.status}`);
  previousStatus = task.status;
  if (task.status === 'SUCCESS') {
    if (!task.analysisId) throw new Error('Completed task has no analysis ID');
    const { projectStatus } = await query(`/api/qualitygates/project_status?analysisId=${encodeURIComponent(task.analysisId)}`);
    console.log(`SonarQube quality gate status: ${projectStatus.status}`);
    for (const condition of projectStatus.conditions ?? []) {
      console.log(`${condition.metricKey}: ${condition.status}, actual=${condition.actualValue ?? '-'}, threshold=${condition.errorThreshold ?? '-'}`);
    }
    if (projectStatus.status !== 'OK') throw new Error('SonarQube quality gate failed');
    process.exit(0);
  }
  if (!['PENDING', 'IN_PROGRESS'].includes(task.status)) throw new Error(`SonarQube task failed: ${task.status}`);
  await sleep(10000);
}
throw new Error('SonarQube analysis did not complete within 14 minutes');
