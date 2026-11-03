# Third-Party Notices

This repository is source-available for noncommercial use under the PolyForm
Noncommercial License 1.0.0, except where third-party components or referenced
materials have their own licenses or rights status.

This file is an engineering notice, not legal advice.

## Direct Runtime Dependencies

| Component | Source | License / Rights Status | Use |
|-----------|--------|-------------------------|-----|
| iztro | https://github.com/SylarLong/iztro | MIT | Zi Wei Dou Shu chart engine |
| lunar-javascript | https://github.com/6tail/lunar-javascript | MIT | Lunar calendar, Ba Zi chart data, shensha, dayun/liunian data |
| lunar-python | https://pypi.org/project/lunar-python/ | MIT | Python lunar calendar dependency used by vendored Ba Zi integration |
| colorama | https://pypi.org/project/colorama/ | BSD-style | Python terminal color dependency used by vendored Ba Zi integration |
| bidict | https://pypi.org/project/bidict/ | MPL-2.0 | Python bidirectional map dependency used by vendored Ba Zi integration |

## Vendored Source

| Component | Source | License / Rights Status | Local Path | Notes |
|-----------|--------|-------------------------|------------|-------|
| china-testing/bazi | https://github.com/china-testing/bazi | No license file bundled; redistribution status confirmed by maintainer | `vendor/bazi/` | On 2026-11-03 the maintainer confirmed that upstream redistribution permissions had previously been resolved. This review did not independently inspect permission documents. The code and bundled texts retain their own rights; this repository does not grant additional rights beyond the applicable permissions. |

## Referenced Projects And Materials

| Component | Source | License / Rights Status | Use |
|-----------|--------|-------------------------|-----|
| jinchenma94/bazi-skill | https://github.com/jinchenma94/bazi-skill | MIT | Reference for agent skill structure and classical-methodology organization |

## Publication Notes

- The project-level PolyForm Noncommercial license applies only to this
  repository's original work unless a file says otherwise.
- Third-party packages retain their own license terms.
- `vendor/bazi/` remains included based on the maintainer confirmation recorded
  above, not on an assumption that public availability or noncommercial use
  alone grants redistribution rights. No permission document was independently
  verified in this review.
- Generated reports are local/private outputs and are ignored by git.

## Bundled timezone data

`data/tzdb/` contains public-domain IANA-derived timezone data copied from the already installed macOS 2026f.1.0 distribution (2026f-rearguard). It is not covered by the project's noncommercial restriction. See `data/tzdb/NOTICE.md` and its manifest for provenance, hashes, coverage, limitations, and https://data.iana.org/time-zones/tzdb/LICENSE for the upstream data status. Hashes establish local integrity, not independent authentication of the distributor or upstream release.
