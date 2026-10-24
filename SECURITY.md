# Security

dsh-threads runs inside DeepSeek Harness with the host's own rights: it opens sessions, gives
them the main conversation's permission mode, and runs git in project folders. Problems that let
a thread do more than its main conversation allows, run commands the user did not approve, or
reach another user's sessions are security issues.

## Reporting

Please do not open a public issue. Report it privately through GitHub: **Security → Report a
vulnerability** on this repository. If that button is not there, open an issue that only asks
for a private contact, without details.

Please include the dsh-threads and DeepSeek Harness versions, the steps, and what happened.
You will get an answer within a week.

Only the latest release is supported.

---

中文：请不要公开提 issue。在本仓库的 **Security → Report a vulnerability** 私下报告；没有这个按钮时，开一个只请求私下联系方式、不写细节的 issue。请写明 dsh-threads 和 DeepSeek Harness 的版本、复现步骤和结果。一周内会回复。只维护最新版本。
