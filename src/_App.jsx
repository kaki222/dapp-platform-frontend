import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import 'bulma/css/bulma.min.css'

// ═══════════════════════════════════
// CONTRACT ADDRESSES
// ═══════════════════════════════════
const REGISTRY_ADDRESS = ethers.getAddress("0x9347b84753f475960c00365ec7f1c7fd3a7989f2")

const RESEARCH_ADDRESS = ethers.getAddress("0xc09c11331ad411c445cd2ba6679032cc99487bb4")


const REGISTRY_ABI = [
  "function getOwner() view returns (address)",
  "function roles(address) view returns (bytes32)",
  "function grantRole(address user, bytes32 role)",
  "function ROLE_ADMIN() view returns (bytes32)",
  "function ROLE_RESEARCHER() view returns (bytes32)",
]

const RESEARCH_ABI = [
  "function createProject(string title, string ipfsHash, uint256 fundingGoalEth, uint256 durationDays) returns (uint256)",
  "function fundProject(uint256 projectId) payable",
  "function joinProject(uint256 projectId)",
  "function projectCount() view returns (uint256)",
  "function getProject(uint256 id) view returns (tuple(uint256 id, string title, string ipfsHash, address lead, uint256 fundingGoal, uint256 fundingRaised, uint256 deadline, uint8 status, uint256 collaboratorCount))",
]

const ROLES = {
  ADMIN:      ethers.keccak256(ethers.toUtf8Bytes("ADMIN")),
  RESEARCHER: ethers.keccak256(ethers.toUtf8Bytes("RESEARCHER")),
  CONSULTANT: ethers.keccak256(ethers.toUtf8Bytes("CONSULTANT")),
  TRADER:     ethers.keccak256(ethers.toUtf8Bytes("TRADER")),
  CLIENT:     ethers.keccak256(ethers.toUtf8Bytes("CLIENT")),
}

const STATUS = ["Open", "In Progress", "Under Review", "Completed", "Cancelled"]

function getRoleName(roleHash) {
  for (const [name, hash] of Object.entries(ROLES)) {
    if (hash === roleHash) return name
  }
  return "NO ROLE"
}

// ═══════════════════════════════════
// MAIN APP
// ═══════════════════════════════════
function App() {
  const [account, setAccount]       = useState(null)
  const [registry, setRegistry]     = useState(null)
  const [research, setResearch]     = useState(null)
  const [owner, setOwner]           = useState(null)
  const [userRole, setUserRole]     = useState(null)
  const [status, setStatus]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [activeTab, setActiveTab]   = useState('dashboard')

  // Admin state
  const [grantAddr, setGrantAddr]   = useState('')
  const [grantRole, setGrantRole]   = useState('RESEARCHER')

  // Research state
  const [projects, setProjects]     = useState([])
  const [newProject, setNewProject] = useState({
    title: '', ipfsHash: '', fundingGoal: 1, duration: 30
  })
  const [fundAmount, setFundAmount] = useState('0.01')
  const [fundingId, setFundingId]   = useState(0)

  // ── Connect Wallet ──
  const connectWallet = async () => {
    if (!window.ethereum) { alert("Install MetaMask!"); return }
    try {
      setLoading(true)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        })
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia',
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

      const reg = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)
      const res = new ethers.Contract(RESEARCH_ADDRESS, RESEARCH_ABI, signer)

      const ownerAddr = await reg.getOwner()
      const role      = await reg.roles(accounts[0])

      setAccount(accounts[0])
      setRegistry(reg)
      setResearch(res)
      setOwner(ownerAddr)
      setUserRole(getRoleName(role))
      setStatus('Connected to Sepolia!')
      setLoading(false)

    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  // ── Load Projects ──
  const loadProjects = useCallback(async () => {
    if (!research) return
    try {
      const count = await research.projectCount()
      const loaded = []
      for (let i = 0; i < Number(count); i++) {
        const p = await research.getProject(i)
        loaded.push({
          id:           Number(p.id),
          title:        p.title,
          ipfsHash:     p.ipfsHash,
          lead:         p.lead,
          fundingGoal:  ethers.formatEther(p.fundingGoal),
          fundingRaised: ethers.formatEther(p.fundingRaised),
          deadline:     new Date(Number(p.deadline) * 1000).toLocaleDateString(),
          status:       STATUS[p.status],
          collaborators: Number(p.collaboratorCount)
        })
      }
      setProjects(loaded)
    } catch (err) {
      console.error("Load projects error:", err)
    }
  }, [research])

  useEffect(() => {
    if (research) loadProjects()
  }, [research, loadProjects])

  // ── Grant Role ──
  const handleGrantRole = async () => {
    if (!registry) return
    try {
      setLoading(true)
      setStatus('Granting role...')
      const tx = await registry.grantRole(
        grantAddr, ROLES[grantRole]
      )
      await tx.wait()
      setStatus(`✅ Role ${grantRole} granted to ${grantAddr}`)
      setGrantAddr('')
      setLoading(false)
    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  // ── Create Project ──
  const handleCreateProject = async () => {
    if (!research) return
    try {
      setLoading(true)
      setStatus('Creating project...')
      const tx = await research.createProject(
        newProject.title,
        newProject.ipfsHash || "ipfs://placeholder",
        newProject.fundingGoal,
        newProject.duration
      )
      await tx.wait()
      setStatus('✅ Project created!')
      setNewProject({ title: '', ipfsHash: '', fundingGoal: 1, duration: 30 })
      await loadProjects()
      setLoading(false)
    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  // ── Fund Project ──
  const handleFundProject = async (projectId) => {
    if (!research) return
    try {
      setLoading(true)
      setStatus('Funding project...')
      const tx = await research.fundProject(projectId, {
        value: ethers.parseEther(fundAmount)
      })
      await tx.wait()
      setStatus(`✅ Funded project #${projectId} with ${fundAmount} ETH!`)
      await loadProjects()
      setLoading(false)
    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  // ── Join Project ──
  const handleJoinProject = async (projectId) => {
    if (!research) return
    try {
      setLoading(true)
      setStatus('Joining project...')
      const tx = await research.joinProject(projectId)
      await tx.wait()
      setStatus(`✅ Joined project #${projectId}!`)
      await loadProjects()
      setLoading(false)
    } catch (err) {
      setStatus('Error: ' + err.message)
      setLoading(false)
    }
  }

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #16213e, #0f3460)',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <div className="container">
          <h1 className="title has-text-white is-2">
            🔬 Research & Trading Platform
          </h1>
          <p className="subtitle has-text-grey-light">
            Decentralized Research Collaboration on Ethereum Sepolia
          </p>
          <p className="is-size-7 has-text-grey">
            Registry: {REGISTRY_ADDRESS}
          </p>
        </div>
      </div>

      <div className="container pb-6">

        {/* Not Connected */}
        {!account ? (
          <div className="box has-text-centered" style={{
            background: '#16213e', border: '1px solid #0f3460'
          }}>
            <p className="has-text-white mb-4 is-size-5">
              Connect your wallet to access the platform
            </p>
            <button
              className={`button is-primary is-large ${loading ? 'is-loading' : ''}`}
              onClick={connectWallet}>
              🦊 Connect MetaMask
            </button>
          </div>
        ) : (

          <div>
            {/* Wallet Bar */}
            <div className="box mb-4" style={{
              background: '#16213e', border: '1px solid #0f3460'
            }}>
              <div className="columns is-vcentered">
                <div className="column">
                  <p className="has-text-grey-light is-size-7">
                    Connected
                  </p>
                  <p className="has-text-white is-size-7">
                    {account}
                  </p>
                </div>
                <div className="column is-narrow">
                  <span className={`tag is-medium ${
                    userRole === 'ADMIN' ? 'is-danger' :
                    userRole === 'RESEARCHER' ? 'is-info' :
                    userRole === 'TRADER' ? 'is-success' :
                    userRole === 'CONSULTANT' ? 'is-warning' :
                    'is-dark'}`}>
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs is-boxed mb-4">
              <ul>
                {['dashboard', 'research', 'admin'].map(tab => (
                  <li key={tab}
                    className={activeTab === tab ? 'is-active' : ''}>
                    <a onClick={() => setActiveTab(tab)}
                      style={{ color: activeTab === tab ? '#00d1b2' : '#aaa' }}>
                      {tab === 'dashboard' && '📊 Dashboard'}
                      {tab === 'research'  && '🔬 Research'}
                      {tab === 'admin'     && '⚙️ Admin'}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── DASHBOARD TAB ── */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="columns">
                  {[
                    { label: 'Total Projects', value: projects.length, color: 'is-info' },
                    { label: 'Active Projects', value: projects.filter(p => p.status === 'Open' || p.status === 'In Progress').length, color: 'is-success' },
                    { label: 'Your Role', value: userRole, color: 'is-warning' },
                    { label: 'Network', value: 'Sepolia', color: 'is-primary' },
                  ].map(stat => (
                    <div key={stat.label} className="column">
                      <div className="box has-text-centered" style={{
                        background: '#16213e',
                        border: '1px solid #0f3460'
                      }}>
                        <p className="heading has-text-grey-light">
                          {stat.label}
                        </p>
                        <p className={`title ${stat.color.replace('is-', 'has-text-')}`}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Services */}
                <div className="box" style={{
                  background: '#16213e', border: '1px solid #0f3460'
                }}>
                  <h2 className="subtitle has-text-white">
                    📋 Platform Services
                  </h2>
                  <div className="columns">
                    {[
                      { name: 'Research', icon: '🔬', status: 'Live', color: 'is-success', tab: 'research' },
                      { name: 'Consultancy', icon: '💼', status: 'Coming Soon', color: 'is-warning', tab: null },
                      { name: 'Trading', icon: '📈', status: 'Coming Soon', color: 'is-warning', tab: null },
                    ].map(s => (
                      <div key={s.name} className="column">
                        <div className="box" style={{ background: '#0f3460' }}>
                          <p className="is-size-2">{s.icon}</p>
                          <p className="has-text-white has-text-weight-bold">
                            {s.name}
                          </p>
                          <span className={`tag ${s.color} mt-2`}>
                            {s.status}
                          </span>
                          {s.tab && (
                            <br />
                          )}
                          {s.tab && (
                            <button
                              className="button is-small is-primary mt-2"
                              onClick={() => setActiveTab(s.tab)}>
                              Open →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── RESEARCH TAB ── */}
            {activeTab === 'research' && (
              <div>
                {/* Create Project */}
                {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && (
                  <div className="box mb-4" style={{
                    background: '#16213e', border: '1px solid #0f3460'
                  }}>
                    <h2 className="subtitle has-text-white">
                      ➕ Create Research Project
                    </h2>
                    <div className="field">
                      <label className="label has-text-grey-light">
                        Project Title
                      </label>
                      <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                        placeholder="e.g. MNP Detection in GCC Petroleum"
                        value={newProject.title}
                        onChange={e => setNewProject({
                          ...newProject, title: e.target.value
                        })}
                      />
                    </div>
                    <div className="field">
                      <label className="label has-text-grey-light">
                        IPFS Hash (optional)
                      </label>
                      <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                        placeholder="ipfs://Qm..."
                        value={newProject.ipfsHash}
                        onChange={e => setNewProject({
                          ...newProject, ipfsHash: e.target.value
                        })}
                      />
                    </div>
                    <div className="columns">
                      <div className="column">
                        <label className="label has-text-grey-light">
                          Funding Goal (ETH)
                        </label>
                        <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                          type="number" min="1"
                          value={newProject.fundingGoal}
                          onChange={e => setNewProject({
                            ...newProject, fundingGoal: e.target.value
                          })}
                        />
                      </div>
                      <div className="column">
                        <label className="label has-text-grey-light">
                          Duration (days)
                        </label>
                        <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                          type="number" min="1"
                          value={newProject.duration}
                          onChange={e => setNewProject({
                            ...newProject, duration: e.target.value
                          })}
                        />
                      </div>
                    </div>
                    <button
                      className={`button is-primary ${loading ? 'is-loading' : ''}`}
                      onClick={handleCreateProject}
                      disabled={!newProject.title || loading}>
                      Create Project
                    </button>
                  </div>
                )}

                {/* Fund Amount */}
                <div className="box mb-4" style={{
                  background: '#16213e', border: '1px solid #0f3460'
                }}>
                  <label className="label has-text-grey-light">
                    Fund Amount (ETH)
                  </label>
                  <div className="field has-addons">
                    <div className="control">
                      <input className="input" style={{ background: '#0f3460', color: 'white' }}
                        type="number" step="0.01" min="0.01"
                        value={fundAmount}
                        onChange={e => setFundAmount(e.target.value)}
                      />
                    </div>
                    <div className="control">
                      <button className="button is-static has-text-white"
                        style={{ background: '#0f3460' }}>
                        ETH
                      </button>
                    </div>
                  </div>
                </div>

                {/* Projects List */}
                <div className="box" style={{
                  background: '#16213e', border: '1px solid #0f3460'
                }}>
                  <div className="is-flex is-justify-content-space-between mb-4">
                    <h2 className="subtitle has-text-white mb-0">
                      🔬 Research Projects ({projects.length})
                    </h2>
                    <button
                      className="button is-small is-info"
                      onClick={loadProjects}>
                      Refresh
                    </button>
                  </div>

                  {projects.length === 0 ? (
                    <div className="has-text-centered py-6">
                      <p className="has-text-grey">
                        No projects yet.
                      </p>
                      {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && (
                        <p className="has-text-grey-light mt-2">
                          Create the first research project above!
                        </p>
                      )}
                    </div>
                  ) : (
                    projects.map(p => (
                      <div key={p.id} className="box mb-3"
                        style={{ background: '#0f3460' }}>
                        <div className="columns is-vcentered">
                          <div className="column">
                            <p className="has-text-white has-text-weight-bold">
                              #{p.id} — {p.title}
                            </p>
                            <p className="has-text-grey-light is-size-7">
                              Lead: {p.lead.slice(0,6)}...{p.lead.slice(-4)}
                            </p>
                            <p className="has-text-grey-light is-size-7">
                              Deadline: {p.deadline} | 
                              Collaborators: {p.collaborators}
                            </p>
                          </div>
                          <div className="column is-narrow has-text-right">
                            <span className={`tag mb-2 ${
                              p.status === 'Open' ? 'is-success' :
                              p.status === 'In Progress' ? 'is-info' :
                              p.status === 'Completed' ? 'is-primary' :
                              'is-dark'}`}>
                              {p.status}
                            </span>
                            <p className="has-text-white is-size-7">
                              {p.fundingRaised} / {p.fundingGoal} ETH
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <progress
                          className="progress is-primary mb-2"
                          value={parseFloat(p.fundingRaised)}
                          max={parseFloat(p.fundingGoal)}>
                        </progress>

                        {/* Action Buttons */}
                        {(p.status === 'Open' || p.status === 'In Progress') && (
                          <div className="buttons">
                            <button
                              className={`button is-small is-success ${loading ? 'is-loading' : ''}`}
                              onClick={() => handleFundProject(p.id)}
                              disabled={loading}>
                              💰 Fund {fundAmount} ETH
                            </button>
                            {(userRole === 'RESEARCHER' || userRole === 'ADMIN') &&
                              p.lead.toLowerCase() !== account.toLowerCase() && (
                              <button
                                className={`button is-small is-info ${loading ? 'is-loading' : ''}`}
                                onClick={() => handleJoinProject(p.id)}
                                disabled={loading}>
                                🤝 Join as Collaborator
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── ADMIN TAB ── */}
            {activeTab === 'admin' && (
              <div className="box" style={{
                background: '#16213e', border: '1px solid #0f3460'
              }}>
                {userRole !== 'ADMIN' ? (
                  <p className="has-text-danger">
                    Access denied — ADMIN role required
                  </p>
                ) : (
                  <div>
                    <h2 className="subtitle has-text-white">
                      ⚙️ Admin Panel
                    </h2>
                    <div className="field">
                      <label className="label has-text-grey-light">
                        Wallet Address
                      </label>
                      <input className="input"
                        style={{ background: '#0f3460', color: 'white' }}
                        placeholder="0x..."
                        value={grantAddr}
                        onChange={e => setGrantAddr(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="label has-text-grey-light">
                        Role to Grant
                      </label>
                      <div className="select">
                        <select
                          value={grantRole}
                          onChange={e => setGrantRole(e.target.value)}
                          style={{ background: '#0f3460', color: 'white' }}>
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
                    <div className="mt-4 p-4"
                      style={{ background: '#0f3460', borderRadius: 8 }}>
                      <p className="has-text-grey-light is-size-7">
                        <strong className="has-text-white">
                          Platform Owner:
                        </strong> {owner}
                      </p>
                      <p className="has-text-grey-light is-size-7 mt-2">
                        <strong className="has-text-white">
                          Registry:
                        </strong> {REGISTRY_ADDRESS}
                      </p>
                      <p className="has-text-grey-light is-size-7 mt-2">
                        <strong className="has-text-white">
                          Research Contract:
                        </strong> {RESEARCH_ADDRESS}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status Bar */}
        {status && (
          <div className={`notification mt-4 ${
            status.includes('✅') ? 'is-success' :
            status.includes('Error') ? 'is-danger' :
            'is-info'} is-light`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default App