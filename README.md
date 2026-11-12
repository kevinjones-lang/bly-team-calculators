## Rebuild the standalone page

Run `python3 tools/rebuild-standalone.py` after editing `business-plan/app-v2.jsx`, `plan.js`, or `engine.js`.
It gzip-compresses those three files and writes the base64 back into `business-plan-standalone.html`.
Every other asset in the bundle is left byte-identical.
