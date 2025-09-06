window.__TEMPLATE_DOCTOR_REPORT__ = {
  "repoUrl": "https://github.com/test-owner/test-repo",
  "ruleSet": "dod",
  "compliance": {
    "issues": [
      {"id":"missing-file-README.md","message":"Missing required file: README.md","severity":"warning"},
      {"id":"missing-workflow-ci","message":"Missing required workflow: ci.yml","severity":"error"}
    ],
    "compliant": [
      {"id":"readme-format","message":"README format valid"},
      {"id":"license-present","message":"License file present"}
    ]
  }
};