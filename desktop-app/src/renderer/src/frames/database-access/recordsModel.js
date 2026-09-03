// Synthetic ingested-record generator — swap for a real datastore query later.

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export const SOURCES = [
  { id: 'flow', label: 'Flow Records (NetFlow/IPFIX)' },
  { id: 'packet', label: 'Packet Captures (PCAP-derived)' },
  { id: 'auth', label: 'Authentication Logs' }
]

const PROTOS = ['TCP', 'UDP', 'ICMP']
const FLAGS = ['SYN', 'SYN,ACK', 'PSH,ACK', 'FIN,ACK', 'RST', 'ACK']

function ip(rnd) {
  return `10.6.${1 + Math.floor(rnd() * 9)}.${2 + Math.floor(rnd() * 250)}`
}

export function generateRecords(source) {
  const rnd = mulberry32(source.length * 7919 + 42)
  const rows = []
  for (let i = 0; i < 60; i++) {
    const ts = new Date(Date.now() - i * 45000).toISOString().replace('T', ' ').slice(0, 19)
    if (source === 'flow') {
      rows.push({
        timestamp: ts,
        src_ip: ip(rnd),
        dst_ip: ip(rnd),
        src_port: 1024 + Math.floor(rnd() * 60000),
        dst_port: [22, 80, 443, 445, 3389][Math.floor(rnd() * 5)],
        protocol: PROTOS[Math.floor(rnd() * PROTOS.length)],
        tcp_flags: FLAGS[Math.floor(rnd() * FLAGS.length)],
        bytes: Math.round(200 + rnd() * 8000),
        packets: Math.round(2 + rnd() * 60),
        duration_ms: Math.round(20 + rnd() * 4000),
        label: rnd() > 0.87 ? 'suspicious' : 'benign'
      })
    } else if (source === 'packet') {
      rows.push({
        timestamp: ts,
        src_ip: ip(rnd),
        dst_ip: ip(rnd),
        ttl: 40 + Math.floor(rnd() * 90),
        window_size: [8192, 16384, 65535][Math.floor(rnd() * 3)],
        fragment_flag: rnd() > 0.9 ? 'DF' : '-',
        payload_bytes: Math.round(rnd() * 1460),
        retransmit: rnd() > 0.85 ? 'yes' : 'no'
      })
    } else {
      rows.push({
        timestamp: ts,
        username: ['analyst.01', 'director.01', 'svc-backup', 'admin'][Math.floor(rnd() * 4)],
        source_host: ip(rnd),
        method: ['password', 'certificate', 'sso'][Math.floor(rnd() * 3)],
        result: rnd() > 0.12 ? 'success' : 'failure',
        mfa: rnd() > 0.3 ? 'yes' : 'no'
      })
    }
  }
  return rows
}
