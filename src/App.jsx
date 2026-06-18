import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import 'bulma/css/bulma.min.css'

// ═══════════════════════════════════
// CONTRACT ADDRESSES
// ═══════════════════════════════════
const REGISTRY_ADDRESS     = "0x9347B84753f475960C00365EC7F1C7Fd3a7989F2"
const RESEARCH_ADDRESS     = "0xfB72641a3420E061e06cd6A6D0CfF568E859a42e"
const ESCROW_ADDRESS       = "0xFFa916a6730c1221a3846bba88DAB7f2d7291248"
const TRADING_ADDRESS      = "0x955ee365A00234369A6F3c92BE9cD5734c730aBB"
const GAMIFICATION_ADDRESS = "0x1e4Bf31217dBecFB8f0361592BeF9d6F0c0bc33A"

// ═══════════════════════════════════
// ABIs
// ═══════════════════════════════════
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

const ESCROW_ABI = [
  "function createEngagement(address consultant, string scopeHash, string[] milestoneDescs, uint256[] milestonePayments) payable returns (uint256)",
  "function completeMilestone(uint256 engagementId, uint256 milestoneIdx)",
  "function approveMilestone(uint256 engagementId, uint256 milestoneIdx)",
  "function raiseDispute(uint256 engagementId)",
  "function cancelEngagement(uint256 engagementId)",
  "function engagementCount() view returns (uint256)",
  "function getEngagement(uint256 id) view returns (tuple(uint256 id, address client, address consultant, string scopeHash, uint256 totalFee, uint256 released, uint8 status, uint256 milestoneCount, uint256 createdAt))",
  "function getMilestones(uint256 engagementId) view returns (tuple(string description, uint256 payment, bool completed, bool approved, bool paid)[])",
]

const TRADING_ABI = [
  "function registerProvider(string name, string bio, string strategyHash, uint256 monthlyFee)",
  "function verifyProvider(address provider)",
  "function publishSignal(string asset, string direction, uint256 entryPrice, uint256 stopLoss, uint256 takeProfit, string rationale)",
  "function subscribe(address provider) payable",
  "function withdraw()",
  "function isSubscribed(address subscriber, address provider) view returns (bool)",
  "function providerCount() view returns (uint256)",
  "function signalCount() view returns (uint256)",
  "function getProviderList() view returns (address[])",
  "function getProviderSignals(address provider) view returns (uint256[])",
  "function getSignal(uint256 id) view returns (tuple(uint256 id, address provider, string asset, string direction, uint256 entryPrice, uint256 stopLoss, uint256 takeProfit, string rationale, uint256 timestamp, bool resolved, bool hit, int256 pnlBps))",
  //"function providers(address) view returns (string name, string bio, string strategyIpfsHash, uint256 monthlyFee, uint256 subscriberCount, uint256 totalPnLBps, uint256 winRate, uint256 signalCount, bool verified, bool active, uint256 registeredAt, address addr)",
  "function providers(address) view returns (string name, string bio, string strategyIpfsHash, uint256 monthlyFee, uint256 subscriberCount, uint256 totalPnLBps, uint256 winRate, uint256 signalCount, bool verified, bool active, uint256 registeredAt, address addr)",
  "function pendingWithdrawal(address) view returns (uint256)",
  "function platformFeeBps() view returns (uint256)",
]

const GAMIFICATION_ABI = [
  "function getProfile(address user) view returns (tuple(uint256 xp, uint256 level, uint256 badgeBitmap, uint256 actionCount, uint256 joinedAt))",
  "function hasBadge(address user, uint256 badgeId) view returns (bool)",
  "function leaderboardLength() view returns (uint256)",
  "function getTopUsers(uint256 n) view returns (address[], uint256[])",
]

// ═══════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════
const ROLES = {
  ADMIN:      ethers.keccak256(ethers.toUtf8Bytes("ADMIN")),
  RESEARCHER: ethers.keccak256(ethers.toUtf8Bytes("RESEARCHER")),
  CONSULTANT: ethers.keccak256(ethers.toUtf8Bytes("CONSULTANT")),
  TRADER:     ethers.keccak256(ethers.toUtf8Bytes("TRADER")),
  CLIENT:     ethers.keccak256(ethers.toUtf8Bytes("CLIENT")),
}

const STATUS        = ["Open", "In Progress", "Under Review", "Completed", "Cancelled"]
const ENG_STATUS    = ["Active", "Completed", "Disputed", "Cancelled"]
const ENG_STATUS_COLOR = {
  "Active":    "is-success",
  "Completed": "is-primary",
  "Disputed":  "is-danger",
  "Cancelled": "is-dark",
}

const BADGE_NAMES = [
  { id: 0, name: "First Step",       icon: "🥇" },
  { id: 1, name: "Researcher",       icon: "🔬" },
  { id: 2, name: "Signal Caller",    icon: "📡" },
  { id: 3, name: "Consultant",       icon: "💼" },
  { id: 4, name: "Top Contributor",  icon: "⭐" },
  { id: 5, name: "Elite",            icon: "💎" },
  { id: 6, name: "Platform Pioneer", icon: "🚀" },
]

function getRoleName(roleHash) {
  for (const [name, hash] of Object.entries(ROLES)) {
    if (hash === roleHash) return name
  }
  return "NO ROLE"
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : ''
}

function formatPrice(scaled) {
  return (Number(scaled) / 100).toFixed(2)
}

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - Number(ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

// ═══════════════════════════════════
// MAIN APP
// ═══════════════════════════════════
function App() {
  const [account, setAccount]       = useState(null)
  const [registry, setRegistry]     = useState(null)
  const [research, setResearch]     = useState(null)
  const [escrow, setEscrow]         = useState(null)
  const [trading, setTrading]       = useState(null)
  const [gamification, setGamification] = useState(null)
  const [owner, setOwner]           = useState(null)
  const [userRole, setUserRole]     = useState(null)
  const [status, setStatus]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [activeTab, setActiveTab]   = useState('dashboard')

  // Admin state
  const [grantAddr, setGrantAddr]   = useState('')
  const [grantRole, setGrantRole]   = useState('RESEARCHER')

  // Research state
  const [projects, setProjects]     = useState([])
  const [newProject, setNewProject] = useState({ title: '', ipfsHash: '', fundingGoal: 1, duration: 30 })
  const [fundAmount, setFundAmount] = useState('0.01')

  // Consultancy state
  const [engagements, setEngagements]     = useState([])
  const [expandedEng, setExpandedEng]     = useState(null)
  const [engMilestones, setEngMilestones] = useState({})
  const [newEng, setNewEng] = useState({
    consultant: '',
    scopeHash:  '',
    milestones: [{ description: '', payment: '' }]
  })

  // Trading state
  const [providers, setProviders]         = useState([])
  const [signals, setSignals]             = useState([])
  const [myProviderData, setMyProviderData] = useState(null)
  const [pendingPayout, setPendingPayout] = useState('0')
  const [tradingSubTab, setTradingSubTab] = useState('feed')
  const [newProvider, setNewProvider]     = useState({ name: '', bio: '', strategyHash: '', monthlyFee: '0.01' })
  const [newSignal, setNewSignal]         = useState({ asset: 'XAU/USD', direction: 'LONG', entryPrice: '', stopLoss: '', takeProfit: '', rationale: '' })

  // Gamification state
  const [myProfile, setMyProfile]     = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [myBadges, setMyBadges]       = useState([])

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

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()

      const reg   = new ethers.Contract(REGISTRY_ADDRESS,     REGISTRY_ABI,     signer)
      const res   = new ethers.Contract(RESEARCH_ADDRESS,     RESEARCH_ABI,     signer)
      const esc   = new ethers.Contract(ESCROW_ADDRESS,       ESCROW_ABI,       signer)
      const trd   = new ethers.Contract(TRADING_ADDRESS,      TRADING_ABI,      signer)
      const gamif = new ethers.Contract(GAMIFICATION_ADDRESS, GAMIFICATION_ABI, signer)

      const ownerAddr = await reg.getOwner()
      const role      = await reg.roles(accounts[0])

      setAccount(accounts[0])
      setRegistry(reg)
      setResearch(res)
      setEscrow(esc)
      setTrading(trd)
      setGamification(gamif)
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
          id:            Number(p.id),
          title:         p.title,
          ipfsHash:      p.ipfsHash,
          lead:          p.lead,
          fundingGoal:   ethers.formatEther(p.fundingGoal),
          fundingRaised: ethers.formatEther(p.fundingRaised),
          deadline:      new Date(Number(p.deadline) * 1000).toLocaleDateString(),
          status:        STATUS[p.status],
          collaborators: Number(p.collaboratorCount)
        })
      }
      setProjects(loaded)
    } catch (err) { console.error("Load projects error:", err) }
  }, [research])

  // ── Load Engagements ──
  const loadEngagements = useCallback(async () => {
    if (!escrow || !account) return
    try {
      const count = await escrow.engagementCount()
      const loaded = []
      for (let i = 0; i < Number(count); i++) {
        const e = await escrow.getEngagement(i)
        const isParty =
          e.client.toLowerCase()     === account.toLowerCase() ||
          e.consultant.toLowerCase() === account.toLowerCase()
        if (!isParty) continue
        loaded.push({
          id:             Number(e.id),
          client:         e.client,
          consultant:     e.consultant,
          scopeHash:      e.scopeHash,
          totalFee:       ethers.formatEther(e.totalFee),
          released:       ethers.formatEther(e.released),
          status:         ENG_STATUS[e.status],
          milestoneCount: Number(e.milestoneCount),
          createdAt:      new Date(Number(e.createdAt) * 1000).toLocaleDateString(),
          isClient:       e.client.toLowerCase() === account.toLowerCase(),
          isConsultant:   e.consultant.toLowerCase() === account.toLowerCase(),
        })
      }
      setEngagements(loaded)
    } catch (err) { console.error("Load engagements error:", err) }
  }, [escrow, account])

  // ── Load Milestones ──
  const loadMilestones = async (engId) => {
    if (!escrow) return
    try {
      const ms = await escrow.getMilestones(engId)
      setEngMilestones(prev => ({
        ...prev,
        [engId]: ms.map((m, idx) => ({
          idx,
          description: m.description,
          payment:     ethers.formatEther(m.payment),
          completed:   m.completed,
          approved:    m.approved,
          paid:        m.paid,
        }))
      }))
    } catch (err) { console.error("Load milestones error:", err) }
  }

  // ── Load Trading Data ──
  const loadTradingData = useCallback(async () => {
    if (!trading || !account) return
    try {
      // Provider list
      const addrs = await trading.getProviderList()
      const loadedProviders = []
      for (const addr of addrs) {
        const p = await trading.providers(addr)
        if (!p.active) continue
        const subbed = await trading.isSubscribed(account, addr)
        loadedProviders.push({
          addr,
          name:            p.name,
          bio:             p.bio,
          monthlyFee:      ethers.formatEther(p.monthlyFee),
          subscriberCount: Number(p.subscriberCount),
          winRate:         Number(p.winRate) / 100,
          signalCount:     Number(p.signalCount),
          verified:        p.verified,
          isSubscribed:    subbed,
        })
      }
      setProviders(loadedProviders)

      // My provider profile
      const me = await trading.providers(account)
      if (me.active) {
        setMyProviderData({
          name:        me.name,
          verified:    me.verified,
          subscribers: Number(me.subscriberCount),
          signals:     Number(me.signalCount),
          winRate:     Number(me.winRate) / 100,
        })
        const payout = await trading.pendingWithdrawal(account)
        setPendingPayout(ethers.formatEther(payout))
      }

      // Recent signals (last 20)
      const sigCount = Number(await trading.signalCount())
      const loadedSignals = []
      const from = Math.max(1, sigCount - 19)
      for (let i = sigCount; i >= from; i--) {
        const s = await trading.getSignal(i)
        loadedSignals.push({
          id:          Number(s.id),
          provider:    s.provider,
          asset:       s.asset,
          direction:   s.direction,
          entryPrice:  formatPrice(s.entryPrice),
          stopLoss:    formatPrice(s.stopLoss),
          takeProfit:  formatPrice(s.takeProfit),
          rationale:   s.rationale,
          timestamp:   s.timestamp,
          resolved:    s.resolved,
          hit:         s.hit,
          pnlBps:      Number(s.pnlBps),
        })
      }
      setSignals(loadedSignals)
    } catch (err) { console.error("Load trading error:", err) }
  }, [trading, account])

  // ── Load Gamification ──
  const loadGamification = useCallback(async () => {
    if (!gamification || !account) return
    try {
      const profile = await gamification.getProfile(account)
      setMyProfile({
        xp:          Number(profile.xp),
        level:       Number(profile.level),
        actionCount: Number(profile.actionCount),
        joinedAt:    Number(profile.joinedAt),
      })

      const badges = []
      for (const b of BADGE_NAMES) {
        const has = await gamification.hasBadge(account, b.id)
        if (has) badges.push(b)
      }
      setMyBadges(badges)

      const [addrs, xps] = await gamification.getTopUsers(10)
      const board = addrs.map((a, i) => ({ addr: a, xp: Number(xps[i]) }))
      setLeaderboard(board)
    } catch (err) { console.error("Load gamification error:", err) }
  }, [gamification, account])

  useEffect(() => { if (research) loadProjects() },                    [research, loadProjects])
  useEffect(() => { if (escrow && account) loadEngagements() },        [escrow, account, loadEngagements])
  useEffect(() => { if (trading && account) loadTradingData() },       [trading, account, loadTradingData])
  useEffect(() => { if (gamification && account) loadGamification() }, [gamification, account, loadGamification])

  // ── Milestone helpers ──
  const addMilestoneRow    = () => setNewEng(prev => ({ ...prev, milestones: [...prev.milestones, { description: '', payment: '' }] }))
  const removeMilestoneRow = (idx) => setNewEng(prev => ({ ...prev, milestones: prev.milestones.filter((_, i) => i !== idx) }))
  const updateMilestone    = (idx, field, value) => setNewEng(prev => ({ ...prev, milestones: prev.milestones.map((m, i) => i === idx ? { ...m, [field]: value } : m) }))
  const totalETH = newEng.milestones.reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0).toFixed(4)

  // ── Handlers: Consultancy ──
  const handleCreateEngagement = async () => {
    if (!escrow) return
    try {
      setLoading(true); setStatus('Creating engagement...')
      const descs    = newEng.milestones.map(m => m.description)
      const payments = newEng.milestones.map(m => ethers.parseEther(m.payment.toString()))
      const total    = payments.reduce((a, b) => a + b, 0n)
      const tx = await escrow.createEngagement(ethers.getAddress(newEng.consultant), newEng.scopeHash || "ipfs://scope-placeholder", descs, payments, { value: total })
      await tx.wait()
      setStatus('✅ Engagement created!')
      setNewEng({ consultant: '', scopeHash: '', milestones: [{ description: '', payment: '' }] })
      await loadEngagements()
      setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleCompleteMilestone = async (engId, mIdx) => {
    const key = `complete-${engId}-${mIdx}`
    try {
      setActionLoading(prev => ({ ...prev, [key]: true })); setStatus('Marking milestone complete...')
      const tx = await escrow.completeMilestone(engId, mIdx); await tx.wait()
      setStatus(`✅ Milestone #${mIdx + 1} marked complete!`)
      await loadMilestones(engId)
      setActionLoading(prev => ({ ...prev, [key]: false }))
    } catch (err) { setStatus('Error: ' + err.message); setActionLoading(prev => ({ ...prev, [key]: false })) }
  }

  const handleApproveMilestone = async (engId, mIdx) => {
    const key = `approve-${engId}-${mIdx}`
    try {
      setActionLoading(prev => ({ ...prev, [key]: true })); setStatus('Approving & releasing payment...')
      const tx = await escrow.approveMilestone(engId, mIdx); await tx.wait()
      setStatus(`✅ Milestone #${mIdx + 1} approved — payment released!`)
      await loadMilestones(engId); await loadEngagements()
      setActionLoading(prev => ({ ...prev, [key]: false }))
    } catch (err) { setStatus('Error: ' + err.message); setActionLoading(prev => ({ ...prev, [key]: false })) }
  }

  const handleRaiseDispute = async (engId) => {
    try {
      setLoading(true); setStatus('Raising dispute...')
      const tx = await escrow.raiseDispute(engId); await tx.wait()
      setStatus(`⚠️ Dispute raised on engagement #${engId}`); await loadEngagements(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleCancelEngagement = async (engId) => {
    try {
      setLoading(true); setStatus('Cancelling engagement...')
      const tx = await escrow.cancelEngagement(engId); await tx.wait()
      setStatus(`✅ Engagement #${engId} cancelled — ETH refunded!`); await loadEngagements(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  // ── Handlers: Admin ──
  const handleGrantRole = async () => {
    if (!registry) return
    try {
      setLoading(true); setStatus('Granting role...')
      const tx = await registry.grantRole(grantAddr, ROLES[grantRole]); await tx.wait()
      setStatus(`✅ Role ${grantRole} granted to ${grantAddr}`); setGrantAddr(''); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  // ── Handlers: Research ──
  const handleCreateProject = async () => {
    if (!research) return
    try {
      setLoading(true); setStatus('Creating project...')
      const tx = await research.createProject(newProject.title, newProject.ipfsHash || "ipfs://placeholder", newProject.fundingGoal, newProject.duration)
      await tx.wait(); setStatus('✅ Project created!')
      setNewProject({ title: '', ipfsHash: '', fundingGoal: 1, duration: 30 }); await loadProjects(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleFundProject = async (projectId) => {
    if (!research) return
    try {
      setLoading(true); setStatus('Funding project...')
      const tx = await research.fundProject(projectId, { value: ethers.parseEther(fundAmount) }); await tx.wait()
      setStatus(`✅ Funded project #${projectId} with ${fundAmount} ETH!`); await loadProjects(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleJoinProject = async (projectId) => {
    if (!research) return
    try {
      setLoading(true); setStatus('Joining project...')
      const tx = await research.joinProject(projectId); await tx.wait()
      setStatus(`✅ Joined project #${projectId}!`); await loadProjects(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  // ── Handlers: Trading ──
  const handleRegisterProvider = async () => {
    if (!trading) return
    try {
      setLoading(true); setStatus('Registering as signal provider...')
      const fee = ethers.parseEther(newProvider.monthlyFee)
      const tx = await trading.registerProvider(newProvider.name, newProvider.bio, newProvider.strategyHash || "ipfs://strategy", fee)
      await tx.wait(); setStatus('✅ Registered as signal provider!')
      setNewProvider({ name: '', bio: '', strategyHash: '', monthlyFee: '0.01' })
      await loadTradingData(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handlePublishSignal = async () => {
    if (!trading) return
    try {
      setLoading(true); setStatus('Publishing signal...')
      const entry = Math.round(parseFloat(newSignal.entryPrice) * 100)
      const sl    = Math.round(parseFloat(newSignal.stopLoss)   * 100)
      const tp    = Math.round(parseFloat(newSignal.takeProfit) * 100)
      const tx = await trading.publishSignal(newSignal.asset, newSignal.direction, entry, sl, tp, newSignal.rationale || "—")
      await tx.wait(); setStatus('✅ Signal published on-chain!')
      setNewSignal({ asset: 'XAU/USD', direction: 'LONG', entryPrice: '', stopLoss: '', takeProfit: '', rationale: '' })
      await loadTradingData(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleSubscribe = async (providerAddr, feeEth) => {
    if (!trading) return
    try {
      setLoading(true); setStatus('Subscribing...')
      const tx = await trading.subscribe(providerAddr, { value: ethers.parseEther(feeEth) })
      await tx.wait(); setStatus('✅ Subscribed!')
      await loadTradingData(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleWithdraw = async () => {
    if (!trading) return
    try {
      setLoading(true); setStatus('Withdrawing earnings...')
      const tx = await trading.withdraw(); await tx.wait()
      setStatus('✅ Withdrawal successful!'); await loadTradingData(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  const handleVerifyProvider = async (addr) => {
    if (!trading) return
    try {
      setLoading(true); setStatus('Verifying provider...')
      const tx = await trading.verifyProvider(addr); await tx.wait()
      setStatus(`✅ Provider ${shortAddr(addr)} verified!`); await loadTradingData(); setLoading(false)
    } catch (err) { setStatus('Error: ' + err.message); setLoading(false) }
  }

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16213e, #0f3460)', padding: '2rem', marginBottom: '2rem' }}>
        <div className="container">
          <h1 className="title has-text-white is-2">🔬 Research & Trading Platform</h1>
          <p className="subtitle has-text-grey-light">Decentralized Research Collaboration on Ethereum Sepolia</p>
          <p className="is-size-7 has-text-grey">Registry: {REGISTRY_ADDRESS}</p>
        </div>
      </div>

      <div className="container pb-6">

        {!account ? (
          <div className="box has-text-centered" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
            <p className="has-text-white mb-4 is-size-5">Connect your wallet to access the platform</p>
            <button className={`button is-primary is-large ${loading ? 'is-loading' : ''}`} onClick={connectWallet}>
              🦊 Connect MetaMask
            </button>
          </div>
        ) : (
          <div>

            {/* Wallet Bar */}
            <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
              <div className="columns is-vcentered">
                <div className="column">
                  <p className="has-text-grey-light is-size-7">Connected</p>
                  <p className="has-text-white is-size-7">{account}</p>
                </div>
                {myProfile && (
                  <div className="column is-narrow has-text-centered">
                    <p className="has-text-grey-light is-size-7">XP</p>
                    <p className="has-text-warning has-text-weight-bold">{myProfile.xp}</p>
                  </div>
                )}
                {myProfile && (
                  <div className="column is-narrow has-text-centered">
                    <p className="has-text-grey-light is-size-7">Level</p>
                    <p className="has-text-success has-text-weight-bold">{myProfile.level}</p>
                  </div>
                )}
                <div className="column is-narrow">
                  <span className={`tag is-medium ${
                    userRole === 'ADMIN'      ? 'is-danger'  :
                    userRole === 'RESEARCHER' ? 'is-info'    :
                    userRole === 'TRADER'     ? 'is-success' :
                    userRole === 'CONSULTANT' ? 'is-warning' : 'is-dark'}`}>
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs is-boxed mb-4">
              <ul>
                {['dashboard', 'research', 'consultancy', 'trading', 'gamification', 'admin'].map(tab => (
                  <li key={tab} className={activeTab === tab ? 'is-active' : ''}>
                    <a onClick={() => setActiveTab(tab)} style={{ color: activeTab === tab ? '#00d1b2' : '#aaa' }}>
                      {tab === 'dashboard'    && '📊 Dashboard'}
                      {tab === 'research'     && '🔬 Research'}
                      {tab === 'consultancy'  && '💼 Consultancy'}
                      {tab === 'trading'      && '📈 Trading'}
                      {tab === 'gamification' && '🏆 XP & Badges'}
                      {tab === 'admin'        && '⚙️ Admin'}
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
                    { label: 'Total Projects',  value: projects.length,    color: 'is-info'    },
                    { label: 'Active Projects', value: projects.filter(p => p.status === 'Open' || p.status === 'In Progress').length, color: 'is-success' },
                    { label: 'Engagements',     value: engagements.length, color: 'is-warning'  },
                    { label: 'Signal Providers',value: providers.length,   color: 'is-primary'  },
                  ].map(stat => (
                    <div key={stat.label} className="column">
                      <div className="box has-text-centered" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                        <p className="heading has-text-grey-light">{stat.label}</p>
                        <p className={`title ${stat.color.replace('is-', 'has-text-')}`}>{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {myProfile && (
                  <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <h2 className="subtitle has-text-white">🏆 My Progress</h2>
                    <div className="columns">
                      <div className="column">
                        <p className="has-text-grey-light is-size-7">XP</p>
                        <p className="has-text-warning is-size-4 has-text-weight-bold">{myProfile.xp}</p>
                      </div>
                      <div className="column">
                        <p className="has-text-grey-light is-size-7">Level</p>
                        <p className="has-text-success is-size-4 has-text-weight-bold">{myProfile.level}</p>
                      </div>
                      <div className="column">
                        <p className="has-text-grey-light is-size-7">Actions</p>
                        <p className="has-text-white is-size-4 has-text-weight-bold">{myProfile.actionCount}</p>
                      </div>
                      <div className="column is-half">
                        <p className="has-text-grey-light is-size-7 mb-2">Badges</p>
                        <div className="tags">
                          {myBadges.length === 0
                            ? <span className="tag is-dark">No badges yet</span>
                            : myBadges.map(b => <span key={b.id} className="tag is-warning">{b.icon} {b.name}</span>)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <h2 className="subtitle has-text-white">📋 Platform Services</h2>
                  <div className="columns">
                    {[
                      { name: 'Research',    icon: '🔬', status: 'Live', color: 'is-success', tab: 'research'     },
                      { name: 'Consultancy', icon: '💼', status: 'Live', color: 'is-success', tab: 'consultancy'  },
                      { name: 'Trading',     icon: '📈', status: 'Live', color: 'is-success', tab: 'trading'      },
                      { name: 'XP & Badges', icon: '🏆', status: 'Live', color: 'is-success', tab: 'gamification' },
                    ].map(s => (
                      <div key={s.name} className="column">
                        <div className="box" style={{ background: '#0f3460' }}>
                          <p className="is-size-2">{s.icon}</p>
                          <p className="has-text-white has-text-weight-bold">{s.name}</p>
                          <span className={`tag ${s.color} mt-2`}>{s.status}</span>
                          <br />
                          <button className="button is-small is-primary mt-2" onClick={() => setActiveTab(s.tab)}>
                            Open →
                          </button>
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
                {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && (
                  <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <h2 className="subtitle has-text-white">➕ Create Research Project</h2>
                    <div className="field">
                      <label className="label has-text-grey-light">Project Title</label>
                      <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                        placeholder="e.g. MNP Detection in GCC Petroleum"
                        value={newProject.title}
                        onChange={e => setNewProject({ ...newProject, title: e.target.value })} />
                    </div>
                    <div className="field">
                      <label className="label has-text-grey-light">IPFS Hash (optional)</label>
                      <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                        placeholder="ipfs://Qm..."
                        value={newProject.ipfsHash}
                        onChange={e => setNewProject({ ...newProject, ipfsHash: e.target.value })} />
                    </div>
                    <div className="columns">
                      <div className="column">
                        <label className="label has-text-grey-light">Funding Goal (ETH)</label>
                        <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                          type="number" min="1" value={newProject.fundingGoal}
                          onChange={e => setNewProject({ ...newProject, fundingGoal: e.target.value })} />
                      </div>
                      <div className="column">
                        <label className="label has-text-grey-light">Duration (days)</label>
                        <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                          type="number" min="1" value={newProject.duration}
                          onChange={e => setNewProject({ ...newProject, duration: e.target.value })} />
                      </div>
                    </div>
                    <button className={`button is-primary ${loading ? 'is-loading' : ''}`}
                      onClick={handleCreateProject} disabled={!newProject.title || loading}>
                      Create Project
                    </button>
                  </div>
                )}

                <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <label className="label has-text-grey-light">Fund Amount (ETH)</label>
                  <div className="field has-addons">
                    <div className="control">
                      <input className="input" style={{ background: '#0f3460', color: 'white' }}
                        type="number" step="0.01" min="0.01" value={fundAmount}
                        onChange={e => setFundAmount(e.target.value)} />
                    </div>
                    <div className="control">
                      <button className="button is-static has-text-white" style={{ background: '#0f3460' }}>ETH</button>
                    </div>
                  </div>
                </div>

                <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <div className="is-flex is-justify-content-space-between mb-4">
                    <h2 className="subtitle has-text-white mb-0">🔬 Research Projects ({projects.length})</h2>
                    <button className="button is-small is-info" onClick={loadProjects}>Refresh</button>
                  </div>
                  {projects.length === 0 ? (
                    <div className="has-text-centered py-6"><p className="has-text-grey">No projects yet.</p></div>
                  ) : (
                    projects.map(p => (
                      <div key={p.id} className="box mb-3" style={{ background: '#0f3460' }}>
                        <div className="columns is-vcentered">
                          <div className="column">
                            <p className="has-text-white has-text-weight-bold">#{p.id} — {p.title}</p>
                            <p className="has-text-grey-light is-size-7">Lead: {shortAddr(p.lead)}</p>
                            <p className="has-text-grey-light is-size-7">Deadline: {p.deadline} | Collaborators: {p.collaborators}</p>
                          </div>
                          <div className="column is-narrow has-text-right">
                            <span className={`tag mb-2 ${p.status === 'Open' ? 'is-success' : p.status === 'In Progress' ? 'is-info' : p.status === 'Completed' ? 'is-primary' : 'is-dark'}`}>{p.status}</span>
                            <p className="has-text-white is-size-7">{p.fundingRaised} / {p.fundingGoal} ETH</p>
                          </div>
                        </div>
                        <progress className="progress is-primary mb-2" value={parseFloat(p.fundingRaised)} max={parseFloat(p.fundingGoal)} />
                        {(p.status === 'Open' || p.status === 'In Progress') && (
                          <div className="buttons">
                            <button className={`button is-small is-success ${loading ? 'is-loading' : ''}`} onClick={() => handleFundProject(p.id)} disabled={loading}>💰 Fund {fundAmount} ETH</button>
                            {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && p.lead.toLowerCase() !== account.toLowerCase() && (
                              <button className={`button is-small is-info ${loading ? 'is-loading' : ''}`} onClick={() => handleJoinProject(p.id)} disabled={loading}>🤝 Join as Collaborator</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── CONSULTANCY TAB ── */}
            {activeTab === 'consultancy' && (
              <div>
                <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <h2 className="subtitle has-text-white">💼 Create Engagement</h2>
                  <p className="has-text-grey-light is-size-7 mb-4">Lock ETH into escrow. Funds release milestone-by-milestone as you approve deliverables.</p>
                  <div className="field">
                    <label className="label has-text-grey-light">Consultant Wallet Address</label>
                    <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                      placeholder="0x..." value={newEng.consultant}
                      onChange={e => setNewEng({ ...newEng, consultant: e.target.value })} />
                  </div>
                  <div className="field">
                    <label className="label has-text-grey-light">Scope of Work (IPFS Hash — optional)</label>
                    <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                      placeholder="ipfs://Qm..." value={newEng.scopeHash}
                      onChange={e => setNewEng({ ...newEng, scopeHash: e.target.value })} />
                  </div>
                  <label className="label has-text-grey-light">Milestones</label>
                  {newEng.milestones.map((m, idx) => (
                    <div key={idx} className="box mb-2" style={{ background: '#0f3460', padding: '0.75rem' }}>
                      <div className="columns is-vcentered mb-0">
                        <div className="column">
                          <input className="input is-small" style={{ background: '#1a1a2e', color: 'white', border: '1px solid #333' }}
                            placeholder={`Milestone ${idx + 1} description`} value={m.description}
                            onChange={e => updateMilestone(idx, 'description', e.target.value)} />
                        </div>
                        <div className="column is-narrow">
                          <div className="field has-addons">
                            <div className="control">
                              <input className="input is-small" style={{ background: '#1a1a2e', color: 'white', border: '1px solid #333', width: '100px' }}
                                type="number" step="0.001" min="0.001" placeholder="ETH" value={m.payment}
                                onChange={e => updateMilestone(idx, 'payment', e.target.value)} />
                            </div>
                            <div className="control"><button className="button is-small is-static has-text-grey" style={{ background: '#1a1a2e' }}>ETH</button></div>
                          </div>
                        </div>
                        {newEng.milestones.length > 1 && (
                          <div className="column is-narrow">
                            <button className="button is-small is-danger is-outlined" onClick={() => removeMilestoneRow(idx)}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="is-flex is-justify-content-space-between is-align-items-center mt-3 mb-4">
                    <button className="button is-small is-outlined" style={{ borderColor: '#00d1b2', color: '#00d1b2' }} onClick={addMilestoneRow}>+ Add Milestone</button>
                    <div className="has-text-right">
                      <p className="has-text-grey-light is-size-7">Total to lock in escrow</p>
                      <p className="has-text-white has-text-weight-bold is-size-5">{totalETH} ETH</p>
                    </div>
                  </div>
                  <button className={`button is-warning is-fullwidth ${loading ? 'is-loading' : ''}`}
                    onClick={handleCreateEngagement}
                    disabled={!newEng.consultant || newEng.milestones.some(m => !m.description || !m.payment) || loading}>
                    💼 Lock ETH & Create Engagement
                  </button>
                </div>

                <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <div className="is-flex is-justify-content-space-between mb-4">
                    <h2 className="subtitle has-text-white mb-0">📋 My Engagements ({engagements.length})</h2>
                    <button className="button is-small is-info" onClick={async () => { setEngagements([]); setEngMilestones({}); setExpandedEng(null); await loadEngagements() }}>Refresh</button>
                  </div>
                  {engagements.length === 0 ? (
                    <div className="has-text-centered py-6">
                      <p className="has-text-grey">No engagements yet.</p>
                      <p className="has-text-grey-light mt-2 is-size-7">Create one above as a client, or get hired as a consultant.</p>
                    </div>
                  ) : (
                    engagements.map(e => (
                      <div key={e.id} className="box mb-3" style={{ background: '#0f3460' }}>
                        <div className="columns is-vcentered mb-2">
                          <div className="column">
                            <p className="has-text-white has-text-weight-bold">#{e.id} — {e.isClient ? '👤 You are Client' : '🔧 You are Consultant'}</p>
                            <p className="has-text-grey-light is-size-7">Client: {shortAddr(e.client)} → Consultant: {shortAddr(e.consultant)}</p>
                            <p className="has-text-grey-light is-size-7">Created: {e.createdAt} | {e.milestoneCount} milestones</p>
                          </div>
                          <div className="column is-narrow has-text-right">
                            <span className={`tag mb-2 ${ENG_STATUS_COLOR[e.status]}`}>{e.status}</span>
                            <p className="has-text-white is-size-7">{e.released} / {e.totalFee} ETH released</p>
                          </div>
                        </div>
                        <progress className="progress is-warning mb-3" value={parseFloat(e.released)} max={parseFloat(e.totalFee)} />
                        <button className="button is-small is-outlined mb-3" style={{ borderColor: '#555', color: '#aaa' }}
                          onClick={async () => { if (expandedEng === e.id) { setExpandedEng(null) } else { setExpandedEng(e.id); await loadMilestones(e.id) } }}>
                          {expandedEng === e.id ? '▲ Hide Milestones' : '▼ View Milestones'}
                        </button>
                        {expandedEng === e.id && engMilestones[e.id] && (
                          <div className="mb-3">
                            {engMilestones[e.id].map(m => (
                              <div key={m.idx} className="box mb-2" style={{ background: '#1a1a2e', padding: '0.75rem' }}>
                                <div className="columns is-vcentered mb-0">
                                  <div className="column">
                                    <p className="has-text-white is-size-7 has-text-weight-bold">Milestone {m.idx + 1}: {m.description}</p>
                                    <p className="has-text-grey-light is-size-7">{m.payment} ETH</p>
                                    <div className="tags mt-1">
                                      <span className={`tag is-small ${m.completed ? 'is-info' : 'is-dark'}`}>{m.completed ? '✓ Completed' : '○ Pending'}</span>
                                      <span className={`tag is-small ${m.approved ? 'is-success' : 'is-dark'}`}>{m.approved ? '✓ Approved' : '○ Awaiting approval'}</span>
                                      <span className={`tag is-small ${m.paid ? 'is-primary' : 'is-dark'}`}>{m.paid ? '💸 Paid' : '🔒 Locked'}</span>
                                    </div>
                                  </div>
                                  <div className="column is-narrow">
                                    {e.isConsultant && !m.completed && !m.paid && e.status === 'Active' && (
                                      <button className={`button is-small is-info ${actionLoading[`complete-${e.id}-${m.idx}`] ? 'is-loading' : ''}`}
                                        onClick={() => handleCompleteMilestone(e.id, m.idx)} disabled={!!actionLoading[`complete-${e.id}-${m.idx}`]}>✓ Mark Done</button>
                                    )}
                                    {e.isClient && m.completed && !m.approved && e.status === 'Active' && (
                                      <button className={`button is-small is-success ${actionLoading[`approve-${e.id}-${m.idx}`] ? 'is-loading' : ''}`}
                                        onClick={() => handleApproveMilestone(e.id, m.idx)} disabled={!!actionLoading[`approve-${e.id}-${m.idx}`]}>💸 Approve & Pay</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {e.status === 'Active' && (
                          <div className="buttons">
                            <button className={`button is-small is-danger is-outlined ${loading ? 'is-loading' : ''}`} onClick={() => handleRaiseDispute(e.id)} disabled={loading}>⚠️ Raise Dispute</button>
                            {e.isClient && parseFloat(e.released) === 0 && (
                              <button className={`button is-small is-dark ${loading ? 'is-loading' : ''}`} onClick={() => handleCancelEngagement(e.id)} disabled={loading}>✕ Cancel & Refund</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── TRADING TAB ── */}
            {activeTab === 'trading' && (
              <div>
                {/* Sub-tabs */}
                <div className="tabs is-toggle is-small mb-4">
                  <ul>
                    {['feed', 'providers', 'publish', 'register'].map(t => (
                      <li key={t} className={tradingSubTab === t ? 'is-active' : ''}>
                        <a onClick={() => setTradingSubTab(t)} style={{ color: tradingSubTab === t ? '#fff' : '#aaa' }}>
                          {t === 'feed'      && '📡 Signal Feed'}
                          {t === 'providers' && '👥 Providers'}
                          {t === 'publish'   && '📤 Publish Signal'}
                          {t === 'register'  && '🎯 Become Provider'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* My Provider Panel */}
                {myProviderData && (
                  <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #00d1b2' }}>
                    <div className="columns is-vcentered">
                      <div className="column">
                        <p className="has-text-white has-text-weight-bold">
                          📡 {myProviderData.name}
                          {myProviderData.verified
                            ? <span className="tag is-success is-small ml-2">✓ Verified</span>
                            : <span className="tag is-warning is-small ml-2">Pending Verification</span>}
                        </p>
                        <p className="has-text-grey-light is-size-7">{myProviderData.subscribers} subscribers · {myProviderData.signals} signals · {myProviderData.winRate.toFixed(1)}% win rate</p>
                      </div>
                      <div className="column is-narrow has-text-right">
                        <p className="has-text-grey-light is-size-7">Pending earnings</p>
                        <p className="has-text-success has-text-weight-bold">{pendingPayout} ETH</p>
                        {parseFloat(pendingPayout) > 0 && (
                          <button className={`button is-small is-success mt-1 ${loading ? 'is-loading' : ''}`} onClick={handleWithdraw} disabled={loading}>Withdraw</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Signal Feed */}
                {tradingSubTab === 'feed' && (
                  <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <div className="is-flex is-justify-content-space-between mb-4">
                      <h2 className="subtitle has-text-white mb-0">📡 Live Signal Feed ({signals.length})</h2>
                      <button className="button is-small is-info" onClick={loadTradingData}>Refresh</button>
                    </div>
                    {signals.length === 0 ? (
                      <div className="has-text-centered py-6"><p className="has-text-grey">No signals published yet.</p></div>
                    ) : (
                      signals.map(s => (
                        <div key={s.id} className="box mb-3" style={{ background: '#0f3460', borderLeft: `4px solid ${s.direction === 'LONG' ? '#48c78e' : '#f14668'}` }}>
                          <div className="columns is-vcentered mb-1">
                            <div className="column">
                              <span className={`tag mr-2 ${s.direction === 'LONG' ? 'is-success' : 'is-danger'}`}>{s.direction}</span>
                              <span className="has-text-white has-text-weight-bold">{s.asset}</span>
                              <span className="has-text-grey-light is-size-7 ml-3">by {shortAddr(s.provider)}</span>
                            </div>
                            <div className="column is-narrow">
                              {s.resolved
                                ? <span className={`tag ${s.hit ? 'is-success' : 'is-danger'}`}>{s.hit ? '✅ TP Hit' : '❌ SL Hit'}</span>
                                : <span className="tag is-warning">⏳ Open</span>}
                            </div>
                          </div>
                          <div className="columns is-mobile is-size-7">
                            <div className="column">
                              <p className="has-text-grey-light">Entry</p>
                              <p className="has-text-white">${s.entryPrice}</p>
                            </div>
                            <div className="column">
                              <p className="has-text-danger">Stop Loss</p>
                              <p className="has-text-white">${s.stopLoss}</p>
                            </div>
                            <div className="column">
                              <p className="has-text-success">Take Profit</p>
                              <p className="has-text-white">${s.takeProfit}</p>
                            </div>
                            <div className="column">
                              <p className="has-text-grey-light">Time</p>
                              <p className="has-text-white">{timeAgo(s.timestamp)}</p>
                            </div>
                          </div>
                          {s.rationale && s.rationale !== '—' && (
                            <p className="has-text-grey-light is-size-7 mt-1">💬 {s.rationale}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Providers */}
                {tradingSubTab === 'providers' && (
                  <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <div className="is-flex is-justify-content-space-between mb-4">
                      <h2 className="subtitle has-text-white mb-0">👥 Signal Providers ({providers.length})</h2>
                      <button className="button is-small is-info" onClick={loadTradingData}>Refresh</button>
                    </div>
                    {providers.length === 0 ? (
                      <div className="has-text-centered py-6"><p className="has-text-grey">No providers registered yet.</p></div>
                    ) : (
                      providers.map(p => (
                        <div key={p.addr} className="box mb-3" style={{ background: '#0f3460' }}>
                          <div className="columns is-vcentered">
                            <div className="column">
                              <p className="has-text-white has-text-weight-bold">
                                {p.name}
                                {p.verified && <span className="tag is-success is-small ml-2">✓ Verified</span>}
                              </p>
                              <p className="has-text-grey-light is-size-7">{p.bio}</p>
                              <p className="has-text-grey-light is-size-7 mt-1">
                                {p.subscriberCount} subscribers · {p.signalCount} signals · {p.winRate.toFixed(1)}% win rate
                              </p>
                            </div>
                            <div className="column is-narrow has-text-right">
                              <p className="has-text-white has-text-weight-bold">{p.monthlyFee} ETH/mo</p>
                              {p.addr.toLowerCase() === account.toLowerCase() ? (
                                <span className="tag is-primary is-small mt-2">Your Profile</span>
                              ) : p.isSubscribed ? (
                                <span className="tag is-success is-small mt-2">✓ Subscribed</span>
                              ) : (
                                <button className={`button is-small is-primary mt-2 ${loading ? 'is-loading' : ''}`}
                                  onClick={() => handleSubscribe(p.addr, p.monthlyFee)} disabled={loading}>
                                  Subscribe
                                </button>
                              )}
                              {userRole === 'ADMIN' && !p.verified && (
                                <button className={`button is-small is-warning mt-2 ml-1 ${loading ? 'is-loading' : ''}`}
                                  onClick={() => handleVerifyProvider(p.addr)} disabled={loading}>
                                  Verify
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Publish Signal */}
                {tradingSubTab === 'publish' && (
                  <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <h2 className="subtitle has-text-white">📤 Publish Signal</h2>
                    {!myProviderData ? (
                      <p className="has-text-warning">Register as a provider first (Become Provider tab).</p>
                    ) : !myProviderData.verified ? (
                      <p className="has-text-warning">⏳ Awaiting admin verification before publishing signals.</p>
                    ) : (
                      <div>
                        <div className="columns">
                          <div className="column">
                            <label className="label has-text-grey-light">Asset</label>
                            <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                              placeholder="XAU/USD" value={newSignal.asset}
                              onChange={e => setNewSignal({ ...newSignal, asset: e.target.value })} />
                          </div>
                          <div className="column">
                            <label className="label has-text-grey-light">Direction</label>
                            <div className="select is-fullwidth">
                              <select value={newSignal.direction} onChange={e => setNewSignal({ ...newSignal, direction: e.target.value })}
                                style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}>
                                <option>LONG</option>
                                <option>SHORT</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="columns">
                          <div className="column">
                            <label className="label has-text-grey-light">Entry Price ($)</label>
                            <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                              type="number" step="0.01" placeholder="3284.40" value={newSignal.entryPrice}
                              onChange={e => setNewSignal({ ...newSignal, entryPrice: e.target.value })} />
                          </div>
                          <div className="column">
                            <label className="label has-text-grey-light">Stop Loss ($)</label>
                            <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                              type="number" step="0.01" placeholder="3240.00" value={newSignal.stopLoss}
                              onChange={e => setNewSignal({ ...newSignal, stopLoss: e.target.value })} />
                          </div>
                          <div className="column">
                            <label className="label has-text-grey-light">Take Profit ($)</label>
                            <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                              type="number" step="0.01" placeholder="3380.00" value={newSignal.takeProfit}
                              onChange={e => setNewSignal({ ...newSignal, takeProfit: e.target.value })} />
                          </div>
                        </div>
                        <div className="field">
                          <label className="label has-text-grey-light">Rationale</label>
                          <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                            placeholder="e.g. Wave 4 LPS + BOS on H1, targeting BSL at 3380" value={newSignal.rationale}
                            onChange={e => setNewSignal({ ...newSignal, rationale: e.target.value })} />
                        </div>
                        <button className={`button is-primary is-fullwidth ${loading ? 'is-loading' : ''}`}
                          onClick={handlePublishSignal}
                          disabled={!newSignal.entryPrice || !newSignal.stopLoss || !newSignal.takeProfit || loading}>
                          📤 Publish Signal On-Chain
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Register as Provider */}
                {tradingSubTab === 'register' && (
                  <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                    <h2 className="subtitle has-text-white">🎯 Register as Signal Provider</h2>
                    {myProviderData ? (
                      <p className="has-text-success">✅ Already registered as {myProviderData.name}</p>
                    ) : (
                      <div>
                        <div className="field">
                          <label className="label has-text-grey-light">Display Name</label>
                          <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                            placeholder="e.g. AmarFX Signals" value={newProvider.name}
                            onChange={e => setNewProvider({ ...newProvider, name: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label has-text-grey-light">Bio</label>
                          <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                            placeholder="Your trading background and methodology" value={newProvider.bio}
                            onChange={e => setNewProvider({ ...newProvider, bio: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label has-text-grey-light">Strategy IPFS Hash (optional)</label>
                          <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                            placeholder="ipfs://Qm..." value={newProvider.strategyHash}
                            onChange={e => setNewProvider({ ...newProvider, strategyHash: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label has-text-grey-light">Monthly Subscription Fee (ETH)</label>
                          <input className="input" style={{ background: '#0f3460', color: 'white', border: '1px solid #333' }}
                            type="number" step="0.001" min="0.001" value={newProvider.monthlyFee}
                            onChange={e => setNewProvider({ ...newProvider, monthlyFee: e.target.value })} />
                        </div>
                        <button className={`button is-primary is-fullwidth ${loading ? 'is-loading' : ''}`}
                          onClick={handleRegisterProvider} disabled={!newProvider.name || !newProvider.bio || loading}>
                          🎯 Register as Provider
                        </button>
                        <p className="has-text-grey-light is-size-7 mt-2">After registration, an admin must verify your profile before you can publish signals.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── GAMIFICATION TAB ── */}
            {activeTab === 'gamification' && (
              <div>
                {/* My Profile */}
                <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <div className="is-flex is-justify-content-space-between mb-3">
                    <h2 className="subtitle has-text-white mb-0">🏆 My XP Profile</h2>
                    <button className="button is-small is-info" onClick={loadGamification}>Refresh</button>
                  </div>
                  {!myProfile || myProfile.joinedAt === 0 ? (
                    <p className="has-text-grey">No profile yet — complete an action on the platform to earn your first XP.</p>
                  ) : (
                    <div>
                      <div className="columns mb-4">
                        {[
                          { label: 'Total XP',  value: myProfile.xp,          color: 'has-text-warning'  },
                          { label: 'Level',     value: myProfile.level,        color: 'has-text-success'  },
                          { label: 'Actions',   value: myProfile.actionCount,  color: 'has-text-info'     },
                          { label: 'Badges',    value: myBadges.length,        color: 'has-text-primary'  },
                        ].map(stat => (
                          <div key={stat.label} className="column">
                            <div className="box has-text-centered" style={{ background: '#0f3460' }}>
                              <p className="heading has-text-grey-light">{stat.label}</p>
                              <p className={`title ${stat.color}`}>{stat.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* XP Progress to next level */}
                      <div className="mb-4">
                        <p className="has-text-grey-light is-size-7 mb-1">Progress to Level {myProfile.level + 1}</p>
                        <progress className="progress is-warning"
                          value={myProfile.xp - (myProfile.level * myProfile.level * 100)}
                          max={(myProfile.level + 1) * (myProfile.level + 1) * 100 - myProfile.level * myProfile.level * 100} />
                        <p className="has-text-grey-light is-size-7">Need {(myProfile.level + 1) * (myProfile.level + 1) * 100 - myProfile.xp} more XP</p>
                      </div>

                      {/* Badges */}
                      <h3 className="has-text-white has-text-weight-bold mb-3">My Badges</h3>
                      <div className="columns is-multiline">
                        {BADGE_NAMES.map(b => {
                          const earned = myBadges.some(mb => mb.id === b.id)
                          return (
                            <div key={b.id} className="column is-one-third">
                              <div className="box has-text-centered" style={{ background: earned ? '#0f3460' : '#111', opacity: earned ? 1 : 0.4 }}>
                                <p className="is-size-2">{b.icon}</p>
                                <p className={`is-size-7 has-text-weight-bold ${earned ? 'has-text-white' : 'has-text-grey'}`}>{b.name}</p>
                                {earned && <span className="tag is-success is-small mt-1">Earned</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* XP Actions Reference */}
                <div className="box mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <h3 className="has-text-white has-text-weight-bold mb-3">⚡ How to Earn XP</h3>
                  <div className="columns is-multiline">
                    {[
                      { action: 'Create research project', xp: '+100 XP' },
                      { action: 'Complete research milestone', xp: '+50 XP' },
                      { action: 'Publish trading signal', xp: '+75 XP' },
                      { action: 'Complete escrow engagement', xp: '+150 XP' },
                      { action: 'Subscribe to provider', xp: '+25 XP' },
                      { action: 'Receive a subscriber', xp: '+25 XP' },
                    ].map(item => (
                      <div key={item.action} className="column is-half">
                        <div className="is-flex is-justify-content-space-between p-3" style={{ background: '#0f3460', borderRadius: 6 }}>
                          <span className="has-text-grey-light is-size-7">{item.action}</span>
                          <span className="has-text-warning has-text-weight-bold is-size-7">{item.xp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leaderboard */}
                <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                  <h3 className="has-text-white has-text-weight-bold mb-3">🥇 XP Leaderboard</h3>
                  {leaderboard.length === 0 ? (
                    <p className="has-text-grey">No leaderboard data yet.</p>
                  ) : (
                    leaderboard.map((u, i) => (
                      <div key={u.addr} className="is-flex is-justify-content-space-between is-align-items-center p-3 mb-2"
                        style={{ background: u.addr.toLowerCase() === account.toLowerCase() ? '#0f3460' : '#111', borderRadius: 6, border: u.addr.toLowerCase() === account.toLowerCase() ? '1px solid #00d1b2' : '1px solid transparent' }}>
                        <div className="is-flex is-align-items-center">
                          <span className={`tag mr-3 ${i === 0 ? 'is-warning' : i === 1 ? 'is-light' : i === 2 ? 'is-danger' : 'is-dark'}`}>#{i + 1}</span>
                          <span className="has-text-white is-size-7">{shortAddr(u.addr)}</span>
                          {u.addr.toLowerCase() === account.toLowerCase() && <span className="tag is-primary is-small ml-2">You</span>}
                        </div>
                        <span className="has-text-warning has-text-weight-bold">{u.xp} XP</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── ADMIN TAB ── */}
            {activeTab === 'admin' && (
              <div className="box" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                {userRole !== 'ADMIN' ? (
                  <p className="has-text-danger">Access denied — ADMIN role required</p>
                ) : (
                  <div>
                    <h2 className="subtitle has-text-white">⚙️ Admin Panel</h2>
                    <div className="field">
                      <label className="label has-text-grey-light">Wallet Address</label>
                      <input className="input" style={{ background: '#0f3460', color: 'white' }}
                        placeholder="0x..." value={grantAddr} onChange={e => setGrantAddr(e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label has-text-grey-light">Role to Grant</label>
                      <div className="select">
                        <select value={grantRole} onChange={e => setGrantRole(e.target.value)} style={{ background: '#0f3460', color: 'white' }}>
                          <option>RESEARCHER</option>
                          <option>CONSULTANT</option>
                          <option>TRADER</option>
                          <option>CLIENT</option>
                        </select>
                      </div>
                    </div>
                    <button className={`button is-primary ${loading ? 'is-loading' : ''}`} onClick={handleGrantRole} disabled={!grantAddr || loading}>Grant Role</button>

                    <div className="mt-5">
                      <h3 className="has-text-white has-text-weight-bold mb-3">📋 Contract Registry</h3>
                      <div className="p-4" style={{ background: '#0f3460', borderRadius: 8 }}>
                        {[
                          { label: 'Platform Owner',    value: owner },
                          { label: 'Registry',          value: REGISTRY_ADDRESS },
                          { label: 'Research',          value: RESEARCH_ADDRESS },
                          { label: 'Escrow',            value: ESCROW_ADDRESS },
                          { label: 'TradingIntelligence', value: TRADING_ADDRESS },
                          { label: 'GamificationModule',  value: GAMIFICATION_ADDRESS },
                        ].map(row => (
                          <p key={row.label} className="has-text-grey-light is-size-7 mb-2">
                            <strong className="has-text-white">{row.label}:</strong> {row.value}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="has-text-white has-text-weight-bold mb-3">🔧 Trading Admin</h3>
                      <p className="has-text-grey-light is-size-7 mb-3">Providers pending verification appear in the Providers sub-tab of Trading. Click Verify next to any unverified provider.</p>
                      <button className="button is-small is-info" onClick={() => { setActiveTab('trading'); setTradingSubTab('providers') }}>
                        Go to Provider List →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Status Bar */}
        {status && (
          <div className={`notification mt-4 ${status.includes('✅') ? 'is-success' : status.includes('⚠️') ? 'is-warning' : status.includes('Error') ? 'is-danger' : 'is-info'} is-light`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
