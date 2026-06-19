// Drop-in component: src/components/ResolveSignal.jsx
// Owner-only (matches onlyPlatformOwner in the contract) panel to resolve open signals.
// Auto-calculates pnlBps from the signal's entry/SL/TP prices and direction - no manual entry needed.

import { useState } from 'react'

// entryPrice/stopLoss/takeProfit here are the human-readable decimal strings
// already formatted by App.jsx's formatPrice() (e.g. "4253.00"), matching
// what's stored in your `signals` state array.
function calcPnlBps(direction, entryPrice, slPrice, tpPrice, tpHit) {
  const entry = parseFloat(entryPrice)
  const target = tpHit ? parseFloat(tpPrice) : parseFloat(slPrice)

  let bps
  if (direction === 'LONG') {
    bps = ((target - entry) / entry) * 10000
  } else {
    // SHORT: profit when price falls
    bps = ((entry - target) / entry) * 10000
  }

  return Math.round(bps)
}

export default function ResolveSignal({ trading, account, owner, signals, onResolved }) {
  const [selectedId, setSelectedId] = useState('')
  const [outcome, setOutcome] = useState('tp') // 'tp' | 'sl'
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase()
  if (!isOwner) return null

  const openSignals = signals.filter(s => !s.resolved)
  const selected = openSignals.find(s => s.id === Number(selectedId))

  const previewBps = selected
    ? calcPnlBps(selected.direction, selected.entryPrice, selected.stopLoss, selected.takeProfit, outcome === 'tp')
    : null

  const handleResolve = async () => {
    if (!trading || !selected) {
      setMsg('Pick an open signal first.')
      return
    }
    try {
      setLoading(true)
      setMsg('Sending transaction...')
      const tpHit = outcome === 'tp'
      const pnlBps = calcPnlBps(selected.direction, selected.entryPrice, selected.stopLoss, selected.takeProfit, tpHit)
      const tx = await trading.resolveSignal(selected.id, tpHit, pnlBps)
      await tx.wait()
      setMsg(`✅ Signal #${selected.id} resolved as ${tpHit ? 'TP Hit' : 'SL Hit'} (${pnlBps} bps).`)
      setSelectedId('')
      setLoading(false)
      if (onResolved) await onResolved()
    } catch (err) {
      setMsg('Error: ' + (err.shortMessage || err.message))
      setLoading(false)
    }
  }

  return (
    <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #f14668' }}>
      <h2 className="subtitle has-text-white">🛠️ Resolve Signal (Owner Only)</h2>

      {openSignals.length === 0 ? (
        <p className="has-text-grey-light is-size-7">No open signals to resolve.</p>
      ) : (
        <div>
          <div className="field">
            <label className="label has-text-grey-light">Open Signal</label>
            <div className="select is-fullwidth">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
              >
                <option value="">-- choose a signal --</option>
                {openSignals.map(s => (
                  <option key={s.id} value={s.id}>
                    #{s.id} — {s.direction} {s.asset} @ ${s.entryPrice} (SL ${s.stopLoss} / TP ${s.takeProfit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selected && (
            <div>
              <div className="field">
                <label className="label has-text-grey-light">Outcome</label>
                <div className="buttons">
                  <button
                    className={`button is-small ${outcome === 'tp' ? 'is-success' : ''}`}
                    onClick={() => setOutcome('tp')}
                  >
                    ✅ Take Profit Hit
                  </button>
                  <button
                    className={`button is-small ${outcome === 'sl' ? 'is-danger' : ''}`}
                    onClick={() => setOutcome('sl')}
                  >
                    ❌ Stop Loss Hit
                  </button>
                </div>
              </div>

              <p className="has-text-grey-light is-size-7 mb-3">
                Calculated P&amp;L: <span className={previewBps >= 0 ? 'has-text-success' : 'has-text-danger'}>
                  {previewBps} bps
                </span>{' '}
                ({(previewBps / 100).toFixed(2)}%)
              </p>

              <button
                className={`button is-danger is-fullwidth ${loading ? 'is-loading' : ''}`}
                onClick={handleResolve}
                disabled={loading}
              >
                Resolve Signal #{selected.id}
              </button>
            </div>
          )}
        </div>
      )}

      {msg && <p className="has-text-grey-light is-size-7 mt-3">{msg}</p>}
    </div>
  )
}
