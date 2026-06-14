import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import 'bulma/css/bulma.min.css'

// Your live contract details
const CONTRACT_ADDRESS = "0x9347B84753f475960C00365EC7F1C7Fd3a7989F2"

const CONTRACT_ABI = [
  "function getOwner() view returns (address)",
  "function roles(address) view returns (bytes32)",
  "function grantRole(address user, bytes32 role)",
  "function registerService(string name, address addr)",
  "function getService(string name) view returns (address)",
  "function ROLE_ADMIN() view returns (bytes32)",
  "function ROLE_RESEARCHER() view returns (bytes32)",
  "function ROLE_CONSULTANT() view returns (bytes32)",
  "function ROLE_TRADER() view returns (bytes32)",
  "function ROLE_CLIENT() view returns (bytes32)"
]

const ROLES = {
  ADMIN:      ethers.keccak256(ethers.toUtf8Bytes("ADMIN")),
  RESEARCHER: ethers.keccak256(ethers.toUtf8Bytes("RESEARCHER")),
  CONSULTANT: ethers.keccak256(ethers.toUtf8Bytes("CONSULTANT")),
  TRADER:     ethers.keccak256(ethers.toUtf8Bytes("TRADER")),
  CLIENT:     ethers.keccak256(ethers.toUtf8Bytes("CLIENT")),
}

function getRoleName(roleHash) {
  for (const [name, hash] of Object.entries(ROLES)) {
    if (hash === roleHash) return name
  }
  return "NO ROLE"
}

function App() {
  const [account, setAccount]   = useState(null)
  const [contract, setContract] = useState(null)
  const [owner, setOwner]       = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [status, setStatus]     = useState('')
  const [grantAddr, setGrantAddr] = useState('')
  const [grantRole, setGrantRole] = useState('RESEARCHER')
  const [loading, setLoading]   = useState(false)

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!")
      return
    }
    try {
      setLoading(true)
      // Auto-switch to Sepolia
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      })
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia test network',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          }]
        })
      }
    }
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()

      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const ownerAddr = await c.getOwner()
      const role      = await c.roles(accounts[0])

      setAccount(accounts[0])
      setContract(c)
      setOwner(ownerAddr)
      setUserRole(getRoleName(role))
      setStatus('Connected to Sepolia!')
      setLoading(false)

    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  const handleGrantRole = async () => {
    if (!contract) return
    try {
      setLoading(true)
      setStatus('Sending transaction...')

      const roleHash = ROLES[grantRole]
      const tx = await contract.grantRole(grantAddr, roleHash)

      setStatus('Waiting for confirmation...')
      await tx.wait()

      setStatus(`✅ Role ${grantRole} granted to ${grantAddr}`)
      setLoading(false)
    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="container mt-6">

      {/* Header */}
      <div className="box has-background-dark">
        <h1 className="title has-text-white">
          🔬 Research & Trading Platform
        </h1>
        <p className="subtitle has-text-grey-light">
          Powered by Ethereum Sepolia
        </p>
        <p className="has-text-grey-light is-size-7">
          Contract: {CONTRACT_ADDRESS}
        </p>
      </div>

      {/* Connect Wallet */}
      {!account ? (
        <div className="box has-text-centered">
          <p className="mb-4">Connect your MetaMask wallet to access the platform</p>
          <button
            className={`button is-primary is-large ${loading ? 'is-loading' : ''}`}
            onClick={connectWallet}>
            🦊 Connect MetaMask
          </button>
        </div>
      ) : (

        <div>
          {/* Wallet Info */}
          <div className="box">
            <div className="columns">
              <div className="column">
                <p><strong>Your Address:</strong></p>
                <p className="is-size-7">{account}</p>
              </div>
              <div className="column">
                <p><strong>Your Role:</strong></p>
                <span className={`tag is-large ${
                  userRole === 'ADMIN' ? 'is-danger' :
                  userRole === 'RESEARCHER' ? 'is-info' :
                  userRole === 'TRADER' ? 'is-success' :
                  userRole === 'CONSULTANT' ? 'is-warning' :
                  'is-light'}`}>
                  {userRole}
                </span>
              </div>
              <div className="column">
                <p><strong>Platform Owner:</strong></p>
                <p className="is-size-7">{owner}</p>
              </div>
            </div>
          </div>

          {/* Admin Panel */}
          {userRole === 'ADMIN' && (
            <div className="box">
              <h2 className="subtitle">
                ⚙️ Admin Panel — Grant Roles
              </h2>
              <div className="field">
                <label className="label">Wallet Address</label>
                <input
                  className="input"
                  placeholder="0x..."
                  value={grantAddr}
                  onChange={e => setGrantAddr(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">Role</label>
                <div className="select">
                  <select
                    value={grantRole}
                    onChange={e => setGrantRole(e.target.value)}>
                    <option>RESEARCHER</option>
                    <option>CONSULTANT</option>
                    <option>TRADER</option>
                    <option>CLIENT</option>
                  </select>
                </div>
              </div>
              <button
                className={`button is-primary ${loading ? 'is-loading' : ''}`}
                onClick={handleGrantRole}
                disabled={!grantAddr || loading}>
                Grant Role
              </button>
            </div>
          )}

          {/* Services Panel */}
          <div className="box">
            <h2 className="subtitle">📋 Platform Services</h2>
            <div className="columns">
              {['Research', 'Consultancy', 'Trading'].map(s => (
                <div key={s} className="column">
                  <div className="box has-background-light">
                    <p className="has-text-weight-bold">{s}</p>
                    <p className="is-size-7 has-text-grey">
                      {s === 'Research' && '🔬 Coming Soon'}
                      {s === 'Consultancy' && '💼 Coming Soon'}
                      {s === 'Trading' && '📈 Coming Soon'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      {status && (
        <div className={`notification ${
          status.includes('✅') ? 'is-success' :
          status.includes('Error') ? 'is-danger' :
          'is-info'}`}>
          {status}
        </div>
      )}
    </div>
  )
}

export default App