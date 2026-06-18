// src/IpfsUpload.jsx
// Pinata IPFS upload component — used in Admin tab
// Uploads any file, returns ipfs://CID for use as strategyIpfsHash

import { useState } from 'react'

const PINATA_API_KEY    = import.meta.env.VITE_PINATA_API_KEY
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY
const PINATA_URL        = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

export default function IpfsUpload({ onCid }) {
  const [uploading, setUploading] = useState(false)
  const [cid, setCid]             = useState(null)
  const [error, setError]         = useState(null)
  const [fileName, setFileName]   = useState(null)

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    setUploading(true)
    setError(null)
    setCid(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pinataMetadata', JSON.stringify({
        name: file.name,
        keyvalues: { platform: 'ADPoly DApp', type: 'strategy' }
      }))
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

      const res = await fetch(PINATA_URL, {
        method: 'POST',
        headers: {
          pinata_api_key:        PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.details || 'Pinata upload failed')
      }

      const data = await res.json()
      const ipfsUri = `ipfs://${data.IpfsHash}`
      setCid(ipfsUri)
      onCid && onCid(ipfsUri)
      setUploading(false)
    } catch (err) {
      setError(err.message)
      setUploading(false)
    }
  }

  return (
    <div className="box mt-4" style={{ background: '#0f3460' }}>
      <h3 className="has-text-white has-text-weight-bold mb-3">📎 Upload to IPFS (Pinata)</h3>
      <p className="has-text-grey-light is-size-7 mb-3">
        Upload your strategy document (PDF, MD, or any file). Returns an IPFS CID to use as your strategy hash on-chain.
      </p>

      <div className="file is-primary mb-3">
        <label className="file-label">
          <input className="file-input" type="file" onChange={handleUpload} accept=".pdf,.md,.txt,.json" />
          <span className="file-cta" style={{ background: '#00d1b2', border: 'none' }}>
            <span className="file-icon">📎</span>
            <span className="file-label has-text-dark">{uploading ? 'Uploading...' : 'Choose file'}</span>
          </span>
          {fileName && <span className="file-name" style={{ background: '#1a1a2e', color: 'white', border: '1px solid #333' }}>{fileName}</span>}
        </label>
      </div>

      {uploading && (
        <div className="is-flex is-align-items-center">
          <span className="has-text-grey-light is-size-7">Pinning to IPFS...</span>
        </div>
      )}

      {cid && (
        <div className="mt-3">
          <p className="has-text-success has-text-weight-bold is-size-7 mb-1">✅ Pinned successfully!</p>
          <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
            <code style={{ background: '#1a1a2e', color: '#00d1b2', padding: '0.5rem', borderRadius: 4, fontSize: '0.75rem', wordBreak: 'break-all', flex: 1 }}>
              {cid}
            </code>
            <button className="button is-small is-primary"
              onClick={() => { navigator.clipboard.writeText(cid) }}>
              Copy
            </button>
          </div>
          <p className="has-text-grey-light is-size-7 mt-2">
            View on IPFS: <a href={`https://gateway.pinata.cloud/ipfs/${cid.replace('ipfs://', '')}`} target="_blank" rel="noreferrer" style={{ color: '#00d1b2' }}>gateway link</a>
          </p>
          <p className="has-text-warning is-size-7 mt-1">
            → Copy this CID and use it in Trading → Become Provider → Strategy IPFS Hash
          </p>
        </div>
      )}

      {error && (
        <p className="has-text-danger is-size-7 mt-2">❌ {error}</p>
      )}
    </div>
  )
}
