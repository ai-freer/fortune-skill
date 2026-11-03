# Pinned timezone data

81 TZif files cover every timezone in CITY_DB plus Australia/Lord_Howe (transition regression). Snapshot copied from the already installed macOS `/usr/share/zoneinfo`; distribution 2026f.1.0, version 2026f, source rules 2026f-rearguard (posix_only). This identifies the installed distribution, not independent authentication of an upstream release.

`manifest.json` records every zone SHA-256 and the accompanying `tzdata.zi` source-rules SHA-256. The Python resolver verifies the selected TZif before parsing it with standard-library ZoneInfo.from_file. Missing zones, modified data, and absent Python fail closed, never fall back to OS or ICU data. No new package was installed.

IANA tz data is public domain; copied files are data only, not the differently licensed date.c, newstrftime.3 or strftime.c. Source/license: https://data.iana.org/time-zones/tzdb/LICENSE . Original source comments are retained in tzdata.zi. Rules can change politically: update only by replacing the audited snapshot and manifest together, then run all transition regressions.

IANA aims at representative regions agreeing after 1970. Earlier records cannot establish every locality's historical civil clock. Historical second offsets and conditional chart calculation remain available before 1970, with an explicit historicalTimezoneAssumption flag and warning requiring verification of the actual local clock convention. The output must not be presented as a uniquely established historical chart. Leap seconds are not represented by this POSIX snapshot.
