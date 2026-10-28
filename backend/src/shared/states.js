import { conflict } from './errors.js'

/** Canonical state machines. Every status change goes through assertTransition(). */
export const MACHINES = {
  scan: {
    queued: ['running', 'cancelled', 'failed'],
    running: ['completed', 'partial', 'failed', 'timed_out', 'cancelled'],
    completed: [], partial: [], failed: [], timed_out: [], cancelled: [], rejected: [],
  },
  intent: {
    draft: ['evaluated', 'cancelled', 'expired'],
    evaluated: ['pending_approval', 'approved', 'denied', 'draft'],
    pending_approval: ['approved', 'denied', 'expired', 'cancelled', 'draft'],
    approved: ['ready_to_sign', 'expired', 'cancelled', 'draft'],
    ready_to_sign: ['submitted', 'expired', 'cancelled', 'draft'],
    submitted: ['confirmed', 'failed', 'reverted', 'reconciliation_mismatch'],
    confirmed: [], denied: [], expired: [], cancelled: [], failed: [], reverted: [], reconciliation_mismatch: [],
  },
  revocation: {
    detected: ['revoke_prepared'],
    revoke_prepared: ['revoke_prepared', 'submitted', 'expired'],
    submitted: ['confirmed', 'reverted', 'verification_pending', 'submitted'],
    verification_pending: ['confirmed', 'reverted', 'verification_pending'],
    confirmed: ['allowance_verified', 'verification_failed'],
    verification_failed: ['revoke_prepared'],
    allowance_verified: ['detected'], // a new approval can re-open the same pair
    reverted: ['revoke_prepared'], expired: ['revoke_prepared'],
  },
  incident: {
    open: ['acknowledged', 'investigating', 'escalated', 'resolved'],
    acknowledged: ['investigating', 'escalated', 'resolved'],
    investigating: ['escalated', 'resolved'],
    escalated: ['investigating', 'resolved'],
    resolved: ['investigating'],
  },
  report: {
    submitted: ['under_review', 'duplicate', 'rejected'],
    under_review: ['needs_info', 'resolved', 'rejected', 'duplicate'],
    needs_info: ['under_review', 'resolved', 'rejected'],
    resolved: [], rejected: [], duplicate: [],
  },
}

export const INTENT_EDITABLE = ['draft', 'evaluated', 'pending_approval', 'approved', 'ready_to_sign']
export const INTENT_TERMINAL = ['confirmed', 'denied', 'expired', 'cancelled', 'failed', 'reverted', 'reconciliation_mismatch']

export function canTransition(machine, from, to) {
  return (MACHINES[machine]?.[from] || []).includes(to)
}
export function assertTransition(machine, from, to) {
  if (!canTransition(machine, from, to)) throw conflict(`Invalid ${machine} transition: ${from} → ${to}`, 'INVALID_STATE_TRANSITION')
}
