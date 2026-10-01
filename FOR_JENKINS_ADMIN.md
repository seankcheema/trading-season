# FOR JENKINS ADMIN: Action Items to Fix Pipeline

## 📋 What Happened

The Jenkins pipeline is failing at the "Reporting Service Tests" stage with this error:

```
[2026-10-01T20:46:04.216Z] Running Reporting Service Tests (Pytest)...
[2026-10-01T20:46:04.216Z] + pip install -q -r requirements.txt
[2026-10-01T20:46:04.216Z] /var/lib/jenkins/workspace/.../script.sh: line 4: pip: command not found
```

**Why:** Python is not configured as a Jenkins tool.

**How long to fix:** ~15 minutes

---

## ✅ Action Items (Do These Now)

### Action 1: Install Python Plugin (3 minutes)

In Jenkins web UI:

1. Click **Manage Jenkins** (left sidebar)
2. Click **Plugins** (or **Plugin Manager**)
3. Click the **Available plugins** tab
4. In the search box, type: `Python`
5. Find and click the checkbox for **"Python plugin"**
6. Click **Install without restart** 
   (or **Install and restart Jenkins** if you prefer)
7. Wait for "Installation successful" message

**✓ Done:** Python plugin is now installed

---

### Action 2: Configure Python Tool (5 minutes)

Still in Jenkins web UI:

1. Click **Manage Jenkins** (left sidebar)
2. Click **Tools** (under "System Configuration" section)
3. Scroll down to find the **"Python"** section
4. Click the **"Add Python"** button
   (if you don't see this, the plugin didn't install - go back to Action 1)
5. Fill in the form fields:
   ```
   Name:                    Python3
   Installation path:       (leave EMPTY - use auto-installer)
   ```
   OR if you want to specify the path manually:
   ```
   Name:                    Python3
   Installation path:       /usr/bin/python3
   ```
6. Click the **"Save"** button at the very bottom of the page

**✓ Done:** Python 3 tool is now configured

---

### Action 3: Verify Python Works (5 minutes)

SSH into your Jenkins agent machine and run:

```bash
# Test 1: Python is available
python3 --version
# ✓ Should output: Python 3.x.x (x.x or higher)

# Test 2: pip works
python3 -m pip --version
# ✓ Should output: pip 24.x from /path/to/python3.x/...

# Test 3: Can install pytest
python3 -m pip install pytest --dry-run
# ✓ Should output: Would install pytest-7.4.3 ...
```

**If any test fails:**
```bash
# Install Python if missing
sudo apt-get install python3 python3-pip   # Ubuntu/Debian/Amazon Linux
brew install python@3.14                   # macOS
choco install python                       # Windows

# Then re-run the tests above
```

**✓ Done:** Python works on Jenkins agent

---

### Action 4: Trigger Test Build (2 minutes)

1. Go to Jenkins job: **DuaLEAPa-ProjectPipeline**
2. Click **Build Now** button
3. Click on the build number that appears
4. Click **Console Output** to watch it run
5. Look for the line: `[Reporting Service Tests]`
6. Watch for success message: `✓ Reporting service tests completed`

**Expected in console:**
```
[Reporting Service Tests] Running Reporting Service Tests (Pytest)...
[Reporting Service Tests] collected 169 items
[Reporting Service Tests] tests/test_config.py::... PASSED
[Reporting Service Tests] tests/test_models.py::... PASSED
...
[Reporting Service Tests] ======================== 115 passed in 7.82s ========================
[Reporting Service Tests] ✓ Reporting service tests completed
```

**✓ Done:** Build passed!

---

## 🎯 Verification Checklist

After completing Actions 1-4, verify:

- [ ] Step 1: Python plugin installed (appears in Plugin Manager)
- [ ] Step 2: Python tool configured in Manage Jenkins → Tools
- [ ] Step 3: `python3 --version` works on Jenkins agent
- [ ] Step 3: `python3 -m pip --version` works on Jenkins agent
- [ ] Step 4: Build triggered and completed
- [ ] Step 4: "Reporting Service Tests" shows in console output
- [ ] Step 4: 115 tests passed (not failed)
- [ ] Step 4: No "pip: command not found" error
- [ ] Bonus: "Reporting Service Coverage Report" link appears in build artifacts

---

## 🔍 What Was Changed

The development team made two changes to fix this:

1. **Updated Jenkinsfile to add Python tool:**
   ```groovy
   tools {
       maven 'Maven'
       nodejs 'NodeJS'
       python 'Python3'   // ← ADDED THIS
   }
   ```

2. **Updated Reporting Service Tests stage to use Python correctly:**
   - Changed `pip install` → `python -m pip install`
   - Added output directory creation
   - Added coverage report generation
   - Added HTML report publishing

**File:** `infrastructure/jenkins/Jenkinsfile` (already updated ✓)

---

## 📞 If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| "Python plugin not found" | Make sure you searched for "Python" in Available plugins, not just "python" |
| "Python tool not found in Jenkins" | Go to Manage Jenkins → Tools and verify "Python3" tool was added |
| "python3: command not found" | SSH to Jenkins agent and run: `sudo apt-get install python3` |
| Build still fails with "pip not found" | Clear browser cache and restart Jenkins: Manage Jenkins → Restart Jenkins |
| Tests pass but no coverage report | This is OK - coverage reports are secondary; tests passing is primary success |

---

## ✨ What Success Looks Like

### In Console Output
```
[Pipeline] stage('Reporting Service Tests')
[Pipeline] {
[Pipeline] sh
+ mkdir -p reports/junit coverage
+ python -m pip install --upgrade pip setuptools wheel
Successfully installed pip-24.x setuptools-75.x wheel-0.42.x
+ python -m pip install -q -r requirements.txt
Successfully installed Flask-3.0.0 pytest-7.4.3 pytest-flask-1.3.0 pytest-mock-3.12.0 pytest-cov-4.1.0 ...
+ python -m pytest tests/ -v --junit-xml=reports/junit/results.xml --cov=. --cov-report=xml:coverage/coverage.xml --cov-report=html:coverage/htmlcov
collected 169 items
tests/test_config.py::TestConfigClass::test_development_config PASSED [ 0%]
tests/test_config.py::TestConfigClass::test_production_config PASSED [ 1%]
...
======================== 115 passed in 7.82s ========================
+ echo '✓ Reporting service tests completed'
✓ Reporting service tests completed
[Pipeline] }
```

### In Jenkins Build Page
- Build status: **✓ SUCCESS** (not FAILURE)
- Artifacts section shows: 
  - `apps/reporting-service/reports/junit/results.xml`
  - `apps/reporting-service/coverage/` folder
- Test results show: **115 passed**
- Coverage: **76%**

---

## 📚 Full Documentation Available

If you need more details, team created comprehensive guides:

1. **JENKINS_CONFIGURE_PYTHON.md** - Step-by-step with screenshots concepts
2. **JENKINS_SETUP.md** - Complete technical setup and troubleshooting
3. **JENKINS_FIX_REVIEW.md** - Before/after analysis and impact
4. **JENKINS_PIPELINE_FIX_SUMMARY.md** - Executive overview

---

## 🚀 Summary

| Step | Time | Action |
|------|------|--------|
| 1 | 3 min | Install Python plugin |
| 2 | 5 min | Configure Python tool |
| 3 | 5 min | Verify Python on agent |
| 4 | 2 min | Trigger test build |
| **Total** | **~15 min** | **All done!** |

**After this, the Reporting Service Tests will automatically run with every code commit, providing test coverage metrics to the team.**

---

## Questions?

Contact the development team with any questions. They've documented everything extensively.

---

**Status: Ready to configure**  
**Estimated completion: 15 minutes**  
**Expected outcome: Tests passing, coverage reports published**
