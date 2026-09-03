// Canned/templated NL responder — swap for a real LLM-over-explainability
// pipeline later. Keyword-matches the question against a small set of
// templates and cites made-up-but-plausible SHAP/attention figures, in the
// same spirit as the compliance panel: clearly a placeholder, not real
// model output.

const TEMPLATES = [
  {
    test: /hwa|donald/i,
    answer:
      'Server-HWA is flagged mainly because of the HWA -> DONALD flow: SHAP attributes 64% of the infiltration score to that edge, driven by an abnormal SYN/ACK ratio and a 0.84 TTL variance consistent with lateral movement (MITRE TA0008).'
  },
  {
    test: /why.*(risk|flag|suspicious)/i,
    answer:
      'The current risk score is driven by three signals in order of contribution: port-entropy anomaly on the edge subnet, a rising SYN/ACK asymmetry ratio, and inter-arrival-time variance exceeding the trained baseline by 2.1x.'
  },
  {
    test: /mitre|stage|attack/i,
    answer:
      'The world model maps the current trajectory to Lateral Movement (TA0008), converging toward Command & Control if the trend continues for another ~4 forecast steps.'
  },
  {
    test: /summar|overview/i,
    answer:
      'Summary: elevated risk on 2 hosts (Server-HWA, IPCam-Lobby-1), one flagged lateral-movement flow with 6 consecutive flagged windows, and one flagged IoT beacon to an external ASN. Recommend prioritizing HWA -> DONALD for investigation.'
  }
]

const FALLBACK =
  "I don't have a specific answer for that yet — try asking about a host by name (e.g. \"why is HWA flagged?\"), the current MITRE stage, or a general risk summary."

export function respond(question) {
  const hit = TEMPLATES.find((t) => t.test.test(question))
  return hit ? hit.answer : FALLBACK
}

export const SUGGESTED_PROMPTS = [
  'Why is Server-HWA flagged?',
  'What MITRE stage are we in?',
  'Summarize current threats'
]
