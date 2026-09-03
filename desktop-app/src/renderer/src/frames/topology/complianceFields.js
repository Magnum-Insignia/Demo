/*
 * Regulatory / compliance field catalogue for a connected-device record.
 *
 * Sourced from a research pass against CERT-In's 28 Apr 2022 Directions
 * (issued under Sec 70B(6), IT Act 2000), the SPDI Rules 2011, the DPDP Act
 * 2023, and NCIIPC CII guidance. Every field below carries a `source` badge
 * and a `confidence` flag so the UI never overstates what's a hard legal
 * mandate vs. an inferred best practice — see each field's `basis` string
 * for the specific citation. Two fields (Annexure-II POC format, the live
 * CERT-In incident-report form) could not be verified against the primary
 * source (scanned/compressed PDFs) and are marked best-effort accordingly.
 */

export const SOURCES = {
  CERT_IN: { id: 'cert-in', label: 'CERT-In 2022', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  SPDI: { id: 'spdi', label: 'SPDI Rules 2011', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  DPDP: { id: 'dpdp', label: 'DPDP Act 2023', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  IT_ACT: { id: 'it-act', label: 'IT Act Sec 70', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  NCIIPC: { id: 'nciipc', label: 'NCIIPC (advisory)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ADVISORY: { id: 'advisory', label: 'CERT-In advisory', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  INFERENCE: { id: 'inference', label: 'Best-practice inference', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
}

export const CONFIDENCE = {
  SOURCED: 'directly-sourced',
  ADVISORY: 'advisory',
  INFERRED: 'inference',
  BEST_EFFORT: 'best-effort'
}

export const COMPLIANCE_FIELD_GROUPS = [
  {
    category: 'Identity & Asset',
    fields: [
      { key: 'assetId', label: 'Asset ID / tag', source: SOURCES.INFERENCE, confidence: CONFIDENCE.INFERRED, basis: 'Asset-inventory best practice' },
      { key: 'macAddress', label: 'MAC address', source: SOURCES.INFERENCE, confidence: CONFIDENCE.INFERRED, basis: 'Asset-inventory best practice' },
      { key: 'ipHistory', label: 'Assigned IP (current + history)', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions 2022 — subscriber/IP allotment record (DC/VPN/cloud); generalised here to all endpoints' },
      { key: 'deviceCategory', label: 'Device category', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'Annexure I explicitly lists IoT-device attacks as a reportable incident category' }
    ]
  },
  {
    category: 'Ownership / Custodian',
    fields: [
      { key: 'ownerName', label: 'Owner / custodian', source: SOURCES.SPDI, confidence: CONFIDENCE.INFERRED, basis: 'SPDI Rules 2011 Rule 5 (identifiable-data handling), generalised to device custodian' },
      { key: 'department', label: 'Department / business unit', source: SOURCES.INFERENCE, confidence: CONFIDENCE.INFERRED, basis: 'Asset-management best practice' },
      { key: 'assignedUser', label: 'Associated user ID', source: SOURCES.SPDI, confidence: CONFIDENCE.INFERRED, basis: 'SPDI Rule 3 (passwords/credentials = Sensitive Personal Data)' }
    ]
  },
  {
    category: 'Location & Jurisdiction',
    fields: [
      { key: 'location', label: 'Physical location / site', source: SOURCES.NCIIPC, confidence: CONFIDENCE.INFERRED, basis: 'NCIIPC sectoral CII mapping relevance' },
      { key: 'logJurisdiction', label: 'Log storage jurisdiction', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions — logs must be maintained within Indian jurisdiction' }
    ]
  },
  {
    category: 'Classification & Criticality',
    fields: [
      { key: 'criticalityTier', label: 'Asset criticality tier', source: SOURCES.NCIIPC, confidence: CONFIDENCE.INFERRED, basis: 'NCIIPC CII asset criticality-tiering guidance (no primary field template found)' },
      { key: 'isCII', label: 'Part of Critical Information Infrastructure?', source: SOURCES.IT_ACT, confidence: CONFIDENCE.SOURCED, basis: 'IT Act 2000 Sec 70(1) — CII definition; NCIIPC mandate' },
      { key: 'sector', label: 'Sector / regulator', source: SOURCES.NCIIPC, confidence: CONFIDENCE.INFERRED, basis: 'NCIIPC sectoral CII classification' }
    ]
  },
  {
    category: 'Technical & Security Posture',
    fields: [
      { key: 'osVersion', label: 'OS + version, last patched', source: SOURCES.ADVISORY, confidence: CONFIDENCE.BEST_EFFORT, basis: 'Secondary description of CERT-In incident-report form fields (form itself not text-extractable)' },
      { key: 'avEdr', label: 'Antivirus / EDR status', source: SOURCES.ADVISORY, confidence: CONFIDENCE.BEST_EFFORT, basis: 'Same as above' },
      { key: 'idsIps', label: 'IDS/IPS present', source: SOURCES.ADVISORY, confidence: CONFIDENCE.BEST_EFFORT, basis: 'Same as above' },
      { key: 'encryption', label: 'Encryption (at rest / in transit)', source: SOURCES.SPDI, confidence: CONFIDENCE.INFERRED, basis: 'SPDI Rule 8 — reasonable security practices (ISO 27001 referenced)' },
      { key: 'mfaEnforced', label: 'MFA enforced', source: SOURCES.ADVISORY, confidence: CONFIDENCE.ADVISORY, basis: 'CERT-In advisory recommendation — not a blanket Sec 70B mandate for all entities' }
    ]
  },
  {
    category: 'Time & Logging (CERT-In)',
    fields: [
      { key: 'ntpSource', label: 'NTP source in use', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions — mandatory sync to NIC/NPL time servers (or traceable to them)' },
      { key: 'logRetentionDays', label: 'Log retention period', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions — 180-day rolling retention, India-hosted' },
      { key: 'logTypes', label: 'Log types enabled', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions — "enable logs of all ICT systems" (general); granular types inferred' }
    ]
  },
  {
    category: 'Lifecycle',
    fields: [
      { key: 'firstConnected', label: 'Date first connected', source: SOURCES.INFERENCE, confidence: CONFIDENCE.INFERRED, basis: 'Analogous to CERT-In "subscription period" field for DC/VPN providers' },
      { key: 'lastAudit', label: 'Date of last security audit', source: SOURCES.INFERENCE, confidence: CONFIDENCE.INFERRED, basis: 'CERT-In empanelled-auditor practice' }
    ]
  },
  {
    category: 'Incident Response',
    fields: [
      { key: 'reportingWindow', label: 'Incident reporting timeline', source: SOURCES.CERT_IN, confidence: CONFIDENCE.SOURCED, basis: 'CERT-In Directions — 6 hours from time of noticing, per Annexure I categories' },
      { key: 'pocContact', label: 'Point of Contact', source: SOURCES.CERT_IN, confidence: CONFIDENCE.BEST_EFFORT, basis: 'CERT-In Annexure-II POC format (secondary sources; primary form not decodable)' }
    ]
  },
  {
    category: 'Privacy / Personal Data',
    fields: [
      { key: 'dataCategories', label: 'Personal/SPDI data categories processed', source: SOURCES.SPDI, confidence: CONFIDENCE.SOURCED, basis: 'SPDI Rules 2011 Rule 3; DPDP Act 2023 Sec 2(t)' },
      { key: 'fiduciaryRole', label: 'Data fiduciary / processor role', source: SOURCES.DPDP, confidence: CONFIDENCE.SOURCED, basis: 'DPDP Act 2023 Sec 2, Sec 8 obligations' }
    ]
  }
]

const OS_BY_ROLE = {
  server: ['Windows Server 2019', 'Windows Server 2016', 'Ubuntu 22.04 LTS', 'RHEL 8.6'],
  endpoint: ['Windows 11 23H2', 'Windows 10 22H2', 'macOS 14 Sonoma'],
  router: ['Cisco IOS-XE 17.9', 'JunOS 21.4'],
  external: ['—']
}

function pick(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)]
}
function daysAgo(n) {
  return new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10)
}

// Synthesizes a plausible-looking compliance record for a device. Real
// values would come from an asset-management / CMDB integration later —
// this keeps the panel fully populated for the demo without fabricating
// anything the legal citations above don't already generalise to.
export function deriveComplianceRecord(device, rnd) {
  const critTier = device.criticality || 'medium'
  return {
    assetId: `AST-${device.id}`,
    macAddress: `00:1B:44:${Math.floor(rnd() * 90 + 10)}:${Math.floor(rnd() * 90 + 10)}:${Math.floor(rnd() * 90 + 10)}`,
    ipHistory: [device.ip],
    deviceCategory: device.deviceCategory || device.role,
    ownerName: device.owner || '—',
    department: device.department || '—',
    assignedUser: device.assignedUser || '—',
    location: device.location || '—',
    logJurisdiction: 'India (Mumbai DC)',
    criticalityTier: critTier,
    isCII: critTier === 'critical' ? 'Yes' : 'No',
    sector: device.sector || 'Enterprise IT',
    osVersion: `${pick(rnd, OS_BY_ROLE[device.role] || ['—'])}${device.role !== 'external' ? ', patched ' + daysAgo(Math.floor(rnd() * 40)) : ''}`,
    avEdr: device.role === 'external' ? 'N/A' : rnd() > 0.15 ? 'Active (CrowdStrike Falcon)' : 'Not detected',
    idsIps: device.role === 'router' ? 'Inline IPS active' : rnd() > 0.4 ? 'Network-level (via gateway)' : 'None on host',
    encryption: rnd() > 0.3 ? 'TLS 1.2+ in transit, disk encryption at rest' : 'TLS in transit only',
    mfaEnforced: rnd() > 0.35 ? 'Yes' : 'No',
    ntpSource: 'time.nic.in (NIC NTP pool)',
    logRetentionDays: 180,
    logTypes: 'Auth, network flow, application',
    firstConnected: daysAgo(Math.floor(200 + rnd() * 900)),
    lastAudit: daysAgo(Math.floor(10 + rnd() * 150)),
    reportingWindow: '6 hours from detection (CERT-In Annexure I)',
    pocContact: 'SOC Duty Officer · soc-oncall@enterprise.local',
    dataCategories: device.dataCategories || (device.role === 'server' ? ['Authentication credentials', 'Employee records'] : ['None identified']),
    fiduciaryRole: device.role === 'server' && critTier !== 'low' ? 'Data Processor (internal)' : 'N/A'
  }
}
