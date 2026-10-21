import { siteConfig } from '../config';
import { findingsCopy } from './copy';
import type { FindingsData } from './data';
import { downloadPath, findingsPath, findingsUrl, rightsPath } from './registry';

export function findingsJsonLd(data: FindingsData, surface: 'issue' | 'rights' | 'index' = 'issue') {
  const { issue, summary } = data;
  const copy = findingsCopy(data);
  const path = surface === 'index' ? '/pro/findings' : surface === 'rights' ? rightsPath(issue) : findingsPath(issue);
  const url = siteConfig.origin + path;
  const issueUrl = findingsUrl(issue);
  const name = surface === 'index' ? copy.T44 : surface === 'rights' ? copy.rightsSections[0]!.heading : copy.T43;
  const crumb = [
    { name: 'Pro', item: `${siteConfig.origin}/pro` },
    { name: copy.T44, item: `${siteConfig.origin}/pro/findings` },
    ...(surface === 'index' ? [] : [{ name: copy.issueLabel, item: issueUrl }]),
    ...(surface === 'rights' ? [{ name: copy.labels.meta[5]!, item: url }] : []),
  ];
  const dates = { ...(issue.first_published_on ? { datePublished: issue.first_published_on } : {}), dateModified: issue.modified_on };
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name, description: copy.T42, inLanguage: 'ja', ...dates,
      isPartOf: { '@id': `${siteConfig.origin}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` },
      ...(surface === 'issue' ? { mainEntity: { '@id': `${issueUrl}#dataset` } } : {}) },
    { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumb.map((row, i) => ({ '@type': 'ListItem', position: i + 1, ...row })) },
    ...(surface !== 'issue' ? [] : [{
      '@type': 'Dataset', '@id': `${issueUrl}#dataset`, identifier: issue.issue_id, name: copy.T43,
      description: `${copy.T42} ${copy.T16}`, url: issueUrl, version: issue.dataset_version, inLanguage: 'ja', ...dates,
      creator: { '@id': `${siteConfig.origin}/#organization` }, publisher: { '@id': `${siteConfig.origin}/#organization` },
      temporalCoverage: `${issue.panels.before.map(run => run.run_date).sort().at(-1)}/${issue.incoming_run_date}`,
      isAccessibleForFree: true, license: siteConfig.origin + rightsPath(issue),
      measurementTechnique: `${siteConfig.origin}/pro/methodology`,
      isBasedOn: [{ '@type': 'CreativeWork', url: `https://github.com/jasonhnd/jobs/blob/${issue.snapshot_commit}/${issue.report.path}` },
        { '@type': 'CreativeWork', url: siteConfig.origin + downloadPath(issue, 'panel') }],
      includedInDataCatalog: { '@type': 'DataCatalog', name: copy.T44, url: `${siteConfig.origin}/pro/findings` },
      variableMeasured: [
        { '@type': 'PropertyValue', name: copy.labels.table[1], propertyID: 'before_raw', minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: copy.labels.table[2], propertyID: 'after_raw', minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: copy.labels.table[3], propertyID: 'delta_display' },
      ],
      additionalProperty: [
        ['mean_before_display', copy.T05, summary.meanBefore], ['mean_after_display', copy.T05, summary.meanAfter],
        ['n_band_changed', copy.T07, summary.bandChanges], ['n_abs_ge_05', copy.T10, summary.absDeltaGe05],
        ['n_abs_ge_10', copy.T10, summary.absDeltaGe10], ['occupation_count', copy.labels.meta[3], summary.occupationCount],
      ].map(([propertyID, name, value]) => ({ '@type': 'PropertyValue', propertyID, name, value })),
      distribution: data.downloads.map(file => ({ '@type': 'DataDownload', name: `${file.file}.csv`, encodingFormat: 'text/csv',
        contentUrl: siteConfig.origin + file.href, contentSize: `${file.bytes} B`, sha256: file.sha256, license: siteConfig.origin + rightsPath(issue) })),
    }]),
  ] };
}
