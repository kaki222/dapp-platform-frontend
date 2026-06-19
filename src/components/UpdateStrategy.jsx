import { useState } from 'react'

export default function UpdateStrategy({ trading, account, currentHash }) {
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleUpdate = async () => {
    if (!trading || !account) {
      setMsg('Wallet not connected.')
      return
    }
    if (!hash.trim()) {
      setMsg('Paste an IPFS hash first.')
      return
    }

    try {
      setLoading(true)
      setMsg('Sending transaction...')
      const tx = await trading.updateStrategy(hash.trim())
      await tx.wait()
      setMsg('✅ Strategy updated on-chain.')
      setHash('')
      setLoading(false)
    } catch (err) {
      setMsg('Error: ' + (err.shortMessage || err.message))
      setLoading(false)
    }
  }

  return (
    <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
      <h2 className="subtitle has-text-white">📝 Update Strategy Document</h2>
      {currentHash && (
        <p className="has-text-grey-light is-size-7 mb-2">
          Current hash: <span className="has-text-white">{currentHash}</span>
        </p>
      )}
      <div className="field">
        <input
          className="input"
          style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
          placeholder="New IPFS hash (ipfs://Qm... or bafybei...)"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
        />
      </div>
      <button
        className={`button is-primary ${loading ? 'is-loading' : ''}`}
        onClick={handleUpdate}
        disabled={!hash.trim() || loading}
      >
        Update Strategy
      </button>
      {msg && <p className="has-text-grey-light is-size-7 mt-2">{msg}</p>}
    </div>
  )
}