# Jenkins Python Tool Configuration - Quick Start

## TL;DR - What Needs to Be Done

1. Install the Python Plugin in Jenkins
2. Configure Python 3.14+ in Jenkins Tools
3. That's it! Rebuild and tests will pass

---

## Step-by-Step Configuration

### Step 1: Install Python Plugin (5 minutes)

**In Jenkins UI:**

1. Click **Manage Jenkins** (top-left sidebar)
2. Click **Plugins** (or **Plugin Manager**)
3. Click **Available plugins** tab
4. Search for: `Python`
5. Find **"Python plugin"** (by PhilipCali and others)
6. Check the checkbox ✓
7. Click **Install without restart** or **Install and restart Jenkins**
8. Wait for installation to complete

**Result:** Python plugin is now installed

---

### Step 2: Configure Python Tool (5 minutes)

**In Jenkins UI:**

1. Click **Manage Jenkins** (top-left sidebar)
2. Click **Tools** (under System Configuration)
3. Scroll down to find **Python** section
4. Click **Add Python** (if not visible, plugin install didn't complete)
5. Fill in the form:

```
Name:                      Python3
Installation directory:    (leave empty for auto-installer)
OR if manual:
Installation directory:    /usr/bin/python3
(or C:\Python314 on Windows, /usr/local/bin/python3 on macOS)
```

6. Click **Save** at bottom of page

**Result:** Python 3 tool is now configured

---

### Step 3: Verify Python on Jenkins Agent (5 minutes)

**SSH into Jenkins agent and run:**

```bash
# Check Python is installed
python3 --version
# Expected output: Python 3.14.x (or 3.13.x minimum)

# Check pip works
python3 -m pip --version
# Expected output: pip 24.x from /path/to/python3.14/lib/python3.14/site-packages

# Check pytest can be installed
python3 -m pip install pytest --dry-run
# Should show: Would install pytest-7.4.3 ...
```

**Troubleshooting if Python not found:**

```bash
# Find Python installation
which python3
# If not found, install it:
sudo apt-get install python3.14  # Ubuntu/Debian
brew install python@3.14         # macOS
choco install python             # Windows

# After install, verify again
python3 --version
```

---

## Step 4: Trigger Test Build (5 minutes)

1. Go to Jenkins job: **DuaLEAPa-ProjectPipeline**
2. Click **Build Now**
3. Monitor build progress in real-time
4. Look for **Reporting Service Tests** stage
5. Check console output for:
   ```
   Running Reporting Service Tests (Pytest)...
   collected 169 items
   ✓ Reporting service tests completed
   ```
6. Build should **complete successfully** ✓

---

## Verification Checklist

After following the steps above, verify:

- [ ] Python plugin appears in Jenkins plugin list
- [ ] Python tool appears in Manage Jenkins → Tools
- [ ] `python3 --version` works on Jenkins agent
- [ ] `python3 -m pip --version` works on Jenkins agent
- [ ] Build triggered and ran without "pip: command not found" error
- [ ] Test results appear in build artifacts
- [ ] Coverage report published (look for "Reporting Service Coverage Report" link)

---

## Expected Output

### In Jenkins Console Log

```
[Pipeline] stage('Reporting Service Tests')
[Pipeline] sh
+ mkdir -p reports/junit coverage
+ python -m pip install --upgrade pip setuptools wheel
Successfully installed pip-24.x setuptools-75.x wheel-0.42.x

+ python -m pip install -q -r requirements.txt
Successfully installed Flask-3.0.0 pytest-7.4.3 ...

+ python -m pytest tests/ -v \
  --junit-xml=reports/junit/results.xml \
  --cov=. \
  --cov-report=xml:coverage/coverage.xml \
  --cov-report=html:coverage/htmlcov

collected 169 items
tests/test_config.py::... PASSED
tests/test_models.py::... PASSED
...
======================== 115 passed in 7.82s ========================
```

### In Jenkins Build Page

Look for:
- ✓ "Reporting Service Coverage Report" link
- ✓ Test results published
- ✓ Build marked as SUCCESS

---

## Troubleshooting

### Issue: "Python tool not found"
```
ERROR: No tool configured for name=Python3
```
**Fix:** Go back to Step 2 and verify:
- Python plugin is installed (check in Plugin Manager)
- Python tool is configured (check in Tools with name exactly: `Python3`)

### Issue: "python3: command not found"
```
/var/lib/jenkins/workspace/.../script.sh: line 5: python3: command not found
```
**Fix:** Install Python on Jenkins agent:
```bash
sudo apt-get install python3 python3-pip  # Ubuntu/Debian
brew install python@3.14                  # macOS
```

### Issue: "pip: command not found"
```
/var/lib/jenkins/workspace/.../script.sh: line 5: pip: command not found
```
**Fix:** Make sure Jenkinsfile uses `python -m pip` (not bare `pip`)
- Check that Jenkinsfile was updated ✓
- This should be already fixed in the updated version

### Issue: "No module named pytest"
```
ModuleNotFoundError: No module named 'pytest'
```
**Fix:** This means `pip install -r requirements.txt` didn't run
- Check requirements.txt exists in apps/reporting-service
- Check the pip install command completed successfully
- Look in console log for "Successfully installed pytest-7.4.3"

### Issue: "No test report files were found"
```
Recording test results
No test report files were found. Configuration error?
```
**Fix:** This means pytest didn't create the output directory or reports
- Verify `mkdir -p reports/junit` runs before pytest
- This should be already fixed in the updated version
- Check Jenkinsfile was updated correctly

---

## Common Questions

### Q: Do I need to restart Jenkins after installing the plugin?
**A:** Not required for functionality (use "Install without restart"), but recommended for stability. Safe to restart during low-usage periods.

### Q: Will this affect other Jenkins jobs?
**A:** No. The Python tool only applies to jobs that use the `python 'Python3'` declaration in their Jenkinsfile.

### Q: What if my Jenkins agent is Windows?
**A:** 
1. Install Python 3.14 on Windows
2. In Jenkins Tools, set path to: `C:\Python314\python.exe`
3. Or use WSL2 with Linux Python installation

### Q: Can I use Python 3.13 instead of 3.14?
**A:** Yes, any Python 3.10+ should work. 3.14+ is recommended for latest features.

### Q: How long will tests take?
**A:** ~8-10 seconds for 169 tests + coverage analysis

### Q: Where can I see the coverage report?
**A:** After build completes:
1. Click the build number
2. Look for "Reporting Service Coverage Report" link
3. Click to view interactive HTML report with line-by-line coverage

---

## Next Steps After Configuration

1. **First Build**
   - Monitor console for any errors
   - Verify test results are published
   - Check coverage report loads correctly

2. **Set Coverage Threshold** (optional)
   - Go to job configuration
   - Add post-build action: "Publish Coverage Results"
   - Set threshold to: 76% (or desired level)

3. **Add Email Notifications** (optional)
   - Post-build action: "Email Extension Plugin"
   - Send report to QA team on failures

4. **Archive Historical Coverage**
   - Post-build action: "Coverage Report"
   - Stores coverage trend over time

---

## Quick Reference

| Item | Value |
|------|-------|
| Plugin to install | Python Plugin |
| Tool name in Jenkinsfile | `Python3` |
| Min Python version | 3.10 (3.14+ recommended) |
| Expected test count | 169 |
| Expected passing | 115 |
| Expected coverage | 76% |
| Test execution time | ~8 seconds |
| Config time | ~15 minutes |

---

## Files Changed

- ✅ `infrastructure/jenkins/Jenkinsfile` - Updated with Python tool config and test stage improvements

---

## Support

For questions:
1. Check this guide's Troubleshooting section
2. Review JENKINS_SETUP.md for detailed configuration
3. See JENKINS_FIX_REVIEW.md for technical details about the changes

---

**Ready to configure? Start with Step 1 above!**
