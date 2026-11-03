#!/usr/bin/env python3
"""Independent advisory check: 0 clear, 1 vulnerable, 2 incomplete."""
import json
from pathlib import Path
import sys
import urllib.request


def audit(records, fetch):
    findings, unavailable = [], []
    for record in records:
        name, version = record['name'], record['version']
        try:
            data = fetch(f'https://pypi.org/pypi/{name}/{version}/json')
            advisories = data['vulnerabilities']
            if not isinstance(advisories, list):
                raise ValueError('invalid advisory response')
            for advisory in advisories:
                if not isinstance(advisory, dict) or not advisory.get('id'):
                    raise ValueError('invalid advisory entry')
                if not advisory.get('withdrawn'):
                    findings.append({'package': name, 'version': version, 'id': advisory['id'],
                                     'fixedIn': advisory.get('fixed_in', [])})
        except Exception as error:
            unavailable.append({'package': name, 'reason': type(error).__name__})
    return {'status': 'vulnerable' if findings else 'incomplete' if unavailable else 'no_known_advisories',
            'source': 'PyPI release vulnerability records (OSV-derived)',
            'scope': 'three pinned runtime packages; excludes pip/build tools and vendored code',
            'findings': findings, 'unavailable': unavailable}


def fetch(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.load(response)


if __name__ == '__main__':
    records = json.loads((Path(__file__).resolve().parent.parent / 'references/python-artifacts.json').read_text())
    result = audit(records, fetch)
    print(json.dumps(result, indent=2))
    if result['unavailable']:
        print('::warning::Python advisory coverage is incomplete; retry the audit. This is not a clean security result.', file=sys.stderr)
    sys.exit(1 if result['findings'] else 2 if result['unavailable'] else 0)
