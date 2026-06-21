import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ResolutionForm from './ResolutionManager';
import './AdminPanel.css';
import { API_URL } from '../config';
import {
  LayoutDashboard, Radio, FileText, Users, UserPlus,
  Settings, Menu, LogOut, Wifi, WifiOff, Trash2,
  Edit2, Plus, AlertTriangle, Download
} from 'lucide-react';

const socket = io(API_URL);

function SortArrow({ col, sort }) {
  if (sort.key !== col) return <span className="ap-sort-icon ap-sort-idle">⇅</span>;
  return <span className="ap-sort-icon ap-sort-active">{sort.dir === 'asc' ? '↑' : '↓'}</span>;
}

const NAV = [
  { key: 'dashboard',   label: 'Dashboard',        Icon: LayoutDashboard },
  { key: 'control',     label: 'Voting Control',    Icon: Radio },
  { key: 'resolutions', label: 'Resolutions',       Icon: FileText },
  { key: 'audit',       label: 'Audit Committee',   Icon: Users },
  { key: 'voters',      label: 'Voters',            Icon: UserPlus },
  { key: 'settings',    label: 'Settings',          Icon: Settings },
];

export default function AdminPanel({ adminUser, onAdminLogout }) {
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [resolutions, setResolutions]           = useState([]);
  const [activeResolution, setActiveResolution] = useState(null);
  const [votingState, setVotingState]           = useState({ isOpen: false, type: null });
  const [auditMembers, setAuditMembers]         = useState([]);
  const [activeAuditMember, setActiveAuditMember] = useState(null);
  const [voters, setVoters]                     = useState([]);
  const [stats, setStats]                       = useState({ totalVoters: 0, resolutionVotes: 0, auditVotes: 0 });
  const [globalProxy, setGlobalProxy]           = useState({ proxyVotes: 0, proxyHoldings: 0 });
  const [globalProxyEdit, setGlobalProxyEdit]   = useState(null);
  const [globalProxySaving, setGlobalProxySaving] = useState(false);
  const [votingDuration, setVotingDuration]     = useState(60);
  const [votingDurationEdit, setVotingDurationEdit] = useState(null);
  const [votingDurationSaving, setVotingDurationSaving] = useState(false);

  // UI
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [editingResolution, setEditingResolution]   = useState(null);
  const [showAuditForm, setShowAuditForm]           = useState(false);
  const [editingAuditMember, setEditingAuditMember] = useState(null);
  const [showVoterForm, setShowVoterForm]           = useState(false);
  const [confirmModal, setConfirmModal]             = useState(null);
  const [voterForm, setVoterForm]                   = useState({ name: '', acno: '', holdings: '', chn: '', email: '', phone_number: '' });
  const [voterSearch, setVoterSearch]               = useState('');
  const [voterSaving, setVoterSaving]               = useState(false);
  const [voterError, setVoterError]                 = useState('');
  const [voterSort, setVoterSort]                   = useState({ key: 'holdings', dir: 'desc' });
  const [voterPage, setVoterPage]                   = useState(1);
  const [controlTab, setControlTab]                 = useState('resolutions');

  const VOTERS_PER_PAGE = 25;

  useEffect(() => {
    fetchAll();
    socket.on('voting-state', setVotingState);
    socket.on('resolution-update', setActiveResolution);
    socket.on('audit-member-updated', setActiveAuditMember);
    socket.on('votes-cleared', () => { fetchResolutions(); fetchAuditCommittee(); fetchStats(); });
    socket.on('proxy-settings-updated', ({ proxyVotes: pv, proxyHoldings: ph }) => {
      setGlobalProxy({ proxyVotes: pv, proxyHoldings: ph });
    });
    return () => {
      socket.off('voting-state');
      socket.off('resolution-update');
      socket.off('audit-member-updated');
      socket.off('votes-cleared');
      socket.off('proxy-settings-updated');
    };
  }, []);

  const fetchAll = () => {
    fetchResolutions(); fetchVotingState(); fetchAuditCommittee();
    fetchStats(); fetchGlobalProxy(); fetchVoters(); fetchVotingDuration();
  };

  const fetchResolutions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/resolutions`, { credentials: 'include' });
      const data = await res.json();
      setResolutions(data);
      setActiveResolution(data.find(r => r.isActive) || null);
    } catch (e) { console.error(e); }
  };

  const fetchAuditCommittee = async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit-committee`, { credentials: 'include' });
      const data = await res.json();
      setAuditMembers(data);
      setActiveAuditMember(data.find(m => m.isActive) || null);
    } catch (e) { console.error(e); }
  };

  const fetchVotingState = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/voting/state`, { credentials: 'include' });
      setVotingState(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { credentials: 'include' });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchGlobalProxy = async () => {
    try {
      const res = await fetch(`${API_URL}/api/proxy-settings`, { credentials: 'include' });
      if (res.ok) setGlobalProxy(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchVotingDuration = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/voting-duration`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setVotingDuration(d.duration); }
    } catch (e) { console.error(e); }
  };

  const saveVotingDuration = async () => {
    if (votingDurationEdit === null) return;
    setVotingDurationSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/voting-duration`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ duration: Number(votingDurationEdit) })
      });
      if (res.ok) { const d = await res.json(); setVotingDuration(d.duration); setVotingDurationEdit(null); }
    } catch (e) { console.error(e); } finally { setVotingDurationSaving(false); }
  };

  const fetchVoters = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/voters`, { credentials: 'include' });
      if (res.ok) setVoters(await res.json());
    } catch (e) { console.error(e); }
  };

  // Voting control
  const activateResolution = async (id) => {
    await fetch(`${API_URL}/api/admin/audit-committee/deactivate-all`, { method: 'POST', credentials: 'include' });
    const res = await fetch(`${API_URL}/api/admin/resolutions/${id}/activate`, { method: 'PUT', credentials: 'include' });
    if (res.ok) {
      const updated = await res.json();
      setActiveResolution(updated);
      setActiveAuditMember(null);
      socket.emit('resolution-activated', updated);
    }
  };

  const activateAuditMember = async (id) => {
    await fetch(`${API_URL}/api/admin/resolutions/close`, { method: 'POST', credentials: 'include' });
    const res = await fetch(`${API_URL}/api/admin/audit-committee/${id}/activate`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
    });
    if (res.ok) {
      const updated = await res.json();
      setActiveAuditMember(updated);
      setActiveResolution(null);
      socket.emit('audit-member-activated', updated);
    }
  };

  const closeCurrent = async () => {
    if (activeResolution) {
      await fetch(`${API_URL}/api/admin/resolutions/close`, { method: 'POST', credentials: 'include' });
      setActiveResolution(null);
    } else if (activeAuditMember) {
      await fetch(`${API_URL}/api/admin/audit-committee/${activeAuditMember.id}/deactivate`, { method: 'PUT', credentials: 'include' });
      setActiveAuditMember(null);
    }
  };

  const toggleVoting = async () => {
    const activeId = controlTab === 'audit' ? activeAuditMember?.id : activeResolution?.id;
    if (!activeId) return;
    const type = controlTab === 'audit' ? 'audit' : 'resolution';
    const res = await fetch(`${API_URL}/api/admin/voting/toggle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type, activeId })
    });
    if (res.ok) setVotingState(await res.json());
  };

  const endAGM = () => setConfirmModal({
    message: 'End the AGM and send a thank-you message to all voters?',
    onConfirm: async () => {
      await fetch(`${API_URL}/api/admin/agm/end`, { method: 'POST', credentials: 'include' });
      setConfirmModal(null);
    }
  });

  // Resolution CRUD
  const deleteResolution = (id) => setConfirmModal({
    message: 'Delete this resolution? This cannot be undone.',
    onConfirm: async () => { await fetch(`${API_URL}/api/resolutions/${id}`, { method: 'DELETE', credentials: 'include' }); fetchResolutions(); setConfirmModal(null); }
  });

  // Audit CRUD
  const deleteAuditMember = (id) => setConfirmModal({
    message: 'Delete this committee member? This cannot be undone.',
    onConfirm: async () => { await fetch(`${API_URL}/api/audit-committee/${id}`, { method: 'DELETE', credentials: 'include' }); fetchAuditCommittee(); setConfirmModal(null); }
  });

  const handleAuditFormSubmit = async (formData) => {
    const url = editingAuditMember ? `${API_URL}/api/audit-committee/${editingAuditMember.id}` : `${API_URL}/api/audit-committee`;
    const res = await fetch(url, { method: editingAuditMember ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(formData) });
    if (!res.ok) throw new Error('Failed to save');
    setShowAuditForm(false);
    fetchAuditCommittee();
  };

  // Voter CRUD
  const handleAddVoter = async (e) => {
    e.preventDefault();
    setVoterError('');
    setVoterSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/registered-users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...voterForm, holdings: Number(voterForm.holdings) || 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add voter');
      setVoterForm({ name: '', acno: '', holdings: '', chn: '', email: '', phone_number: '' });
      setShowVoterForm(false);
      fetchVoters(); fetchStats();
    } catch (err) { setVoterError(err.message); }
    finally { setVoterSaving(false); }
  };

  const deleteVoter = (id, name) => setConfirmModal({
    message: `Delete voter "${name}"? This cannot be undone.`,
    onConfirm: async () => {
      await fetch(`${API_URL}/api/admin/voters/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchVoters(); fetchStats(); setConfirmModal(null);
    }
  });

  const exportVotersCSV = () => {
    const headers = ['#', 'Name', 'Account No.', 'Holdings', 'Resolution Votes', 'Audit Votes', 'Phone', 'Email', 'CHN'];
    const rows = sortedVoters.map((v, i) => [
      i + 1,
      v.name || '',
      v.acno || '',
      v.holdings || 0,
      v.resolutionVoteCount || 0,
      v.auditVoteCount || 0,
      v.phone_number || '',
      v.email || '',
      v.chn || ''
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Proxy settings
  const saveGlobalProxy = async () => {
    const vals = globalProxyEdit ?? globalProxy;
    setGlobalProxySaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/proxy-settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ proxyVotes: Number(vals.proxyVotes), proxyHoldings: Number(vals.proxyHoldings) })
      });
      if (res.ok) { const d = await res.json(); setGlobalProxy({ proxyVotes: d.proxyVotes, proxyHoldings: d.proxyHoldings }); setGlobalProxyEdit(null); }
    } catch (e) { console.error(e); } finally { setGlobalProxySaving(false); }
  };

  const clearVotes = (type) => {
    const labels = { resolutions: 'all resolution votes', audit: 'all audit committee votes', all: 'ALL votes' };
    setConfirmModal({
      message: `Clear ${labels[type]}? This cannot be undone.`,
      onConfirm: async () => {
        await fetch(`${API_URL}/api/admin/votes/${type}`, { method: 'DELETE', credentials: 'include' });
        fetchResolutions(); fetchAuditCommittee(); fetchStats(); setConfirmModal(null);
      }
    });
  };

  const handleAdminLogout = async () => {
    await fetch(`${API_URL}/api/admin/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    onAdminLogout();
  };

  const navigate = (v) => { setView(v); setSidebarOpen(false); };

  const activeControlItem = controlTab === 'audit' ? activeAuditMember : activeResolution;

  const filteredVoters = voters.filter(v =>
    (v.name || '').toLowerCase().includes(voterSearch.toLowerCase()) ||
    (v.acno || '').toLowerCase().includes(voterSearch.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(voterSearch.toLowerCase())
  );

  const sortedVoters = [...filteredVoters].sort((a, b) => {
    const { key, dir } = voterSort;
    let va, vb;
    if (key === 'holdings')   { va = Number(a.holdings || 0);           vb = Number(b.holdings || 0); }
    else if (key === 'resVotes')  { va = Number(a.resolutionVoteCount || 0); vb = Number(b.resolutionVoteCount || 0); }
    else if (key === 'auditVotes') { va = Number(a.auditVoteCount || 0);    vb = Number(b.auditVoteCount || 0); }
    else { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  const voterTotalPages = Math.max(1, Math.ceil(sortedVoters.length / VOTERS_PER_PAGE));
  const pagedVoters = sortedVoters.slice((voterPage - 1) * VOTERS_PER_PAGE, voterPage * VOTERS_PER_PAGE);

  const toggleVoterSort = (key) => {
    setVoterSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    setVoterPage(1);
  };

  return (
    <div className="ap-layout">
      {sidebarOpen && <div className="ap-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`ap-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ap-sidebar-logo">
          <img src="/logo.png" alt="APEL" />
        </div>
        <nav className="ap-sidebar-nav">
          {NAV.map(({ key, label, Icon }) => (
            <button key={key} className={`ap-nav-item ${view === key ? 'active' : ''}`} onClick={() => navigate(key)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="ap-sidebar-footer">
          <button onClick={handleAdminLogout} className="ap-nav-item ap-logout-nav">
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="ap-content-wrapper">
        <header className="ap-topbar">
          <button className="ap-hamburger" onClick={() => setSidebarOpen(s => !s)}>
            <Menu size={20} />
          </button>
          <h1 className="ap-page-title">{NAV.find(n => n.key === view)?.label}</h1>
          <div className="ap-topbar-right">
            <span className={`ap-vote-status ${votingState.isOpen ? 'open' : 'closed'}`}>
              {votingState.isOpen ? <><Wifi size={12} /> Live</> : <><WifiOff size={12} /> Closed</>}
            </span>
            <span className="ap-admin-chip">{adminUser}</span>
          </div>
        </header>

        <main className="ap-main">

          {/* ── DASHBOARD ── */}
          {view === 'dashboard' && (
            <div className="ap-section">
              <div className="ap-stats-grid">
                <div className="ap-stat-card">
                  <p className="ap-stat-label">Registered Voters</p>
                  <p className="ap-stat-value">{stats.totalVoters?.toLocaleString()}</p>
                </div>
                <div className="ap-stat-card">
                  <p className="ap-stat-label">Resolution Votes</p>
                  <p className="ap-stat-value">{stats.resolutionVotes?.toLocaleString()}</p>
                </div>
                <div className="ap-stat-card">
                  <p className="ap-stat-label">Audit Votes</p>
                  <p className="ap-stat-value">{stats.auditVotes?.toLocaleString()}</p>
                </div>
                <div className={`ap-stat-card ${votingState.isOpen ? 'ap-stat-live' : ''}`}>
                  <p className="ap-stat-label">Voting Status</p>
                  <p className="ap-stat-value">{votingState.isOpen ? 'OPEN' : 'CLOSED'}</p>
                  {votingState.isOpen && <p className="ap-stat-sub">{votingState.type}</p>}
                </div>
              </div>

              <div className="ap-dash-block">
                <h3 className="ap-block-title">Active Item</h3>
                {(activeResolution || activeAuditMember) ? (
                  <div className="ap-active-pill">
                    <span className="ap-active-dot" />
                    <span>{activeResolution?.title || activeAuditMember?.name}</span>
                    <span className="ap-active-type">{activeResolution ? 'Resolution' : 'Audit Election'}</span>
                  </div>
                ) : <p className="ap-muted">No active item. Go to Voting Control to activate one.</p>}
              </div>

              <div className="ap-dash-block">
                <h3 className="ap-block-title">Quick Actions</h3>
                <div className="ap-quick-actions">
                  <button className="ap-quick-btn" onClick={() => navigate('control')}>Voting Control</button>
                  <button className="ap-quick-btn" onClick={() => navigate('voters')}>Add Voter</button>
                  <button className="ap-quick-btn" onClick={() => navigate('resolutions')}>Manage Resolutions</button>
                </div>
              </div>
            </div>
          )}

          {/* ── VOTING CONTROL ── */}
          {view === 'control' && (
            <div className="ap-section">
              <div className="ap-ctrl-tabs">
                <button className={`ap-tab ${controlTab === 'resolutions' ? 'active' : ''}`} onClick={() => setControlTab('resolutions')}>Resolutions</button>
                <button className={`ap-tab ${controlTab === 'audit' ? 'active' : ''}`} onClick={() => setControlTab('audit')}>Audit Committee</button>
              </div>

              {activeControlItem && (
                <div className="ap-active-bar">
                  <div className="ap-active-info">
                    <span className="ap-active-dot" />
                    <span>Active: <strong>{activeControlItem.title || activeControlItem.name}</strong></span>
                  </div>
                  <div className="ap-active-actions">
                    <button onClick={closeCurrent} className="ap-btn ap-btn-danger">Close</button>
                    <button onClick={toggleVoting} className={`ap-btn ${votingState.isOpen ? 'ap-btn-warning' : 'ap-btn-success'}`}>
                      {votingState.isOpen ? 'Close Voting' : 'Open Voting'}
                    </button>
                    <button onClick={endAGM} className="ap-btn ap-btn-dark">End AGM</button>
                  </div>
                </div>
              )}

              <div className="ap-list">
                {(controlTab === 'resolutions' ? resolutions : auditMembers).map(item => {
                  const isActive = controlTab === 'resolutions' ? activeResolution?.id === item.id : activeAuditMember?.id === item.id;
                  return (
                    <div key={item.id} className={`ap-card ${isActive ? 'ap-card-active' : ''}`}>
                      <div className="ap-card-row">
                        <div className="ap-card-body">
                          {isActive && <span className="ap-badge ap-badge-active">Active</span>}
                          <h4 className="ap-card-title">{item.title || item.name}</h4>
                          <p className="ap-card-desc">{item.description || item.bio}</p>
                          {controlTab === 'audit' && <p className="ap-muted-sm">Votes: <strong>{item.votesFor || 0}</strong></p>}
                        </div>
                        {!isActive && (
                          <button className="ap-btn ap-btn-primary ap-btn-sm" onClick={() => controlTab === 'resolutions' ? activateResolution(item.id) : activateAuditMember(item.id)}>
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(controlTab === 'resolutions' ? resolutions : auditMembers).length === 0 && (
                  <div className="ap-empty">No {controlTab === 'resolutions' ? 'resolutions' : 'committee members'} yet.</div>
                )}
              </div>
            </div>
          )}

          {/* ── RESOLUTIONS ── */}
          {view === 'resolutions' && (
            <div className="ap-section">
              <div className="ap-section-bar">
                <p className="ap-section-count">{resolutions.length} resolution{resolutions.length !== 1 ? 's' : ''}</p>
                <button className="ap-add-btn" onClick={() => { setEditingResolution(null); setShowResolutionForm(true); }}>
                  <Plus size={14} /> Add Resolution
                </button>
              </div>
              <div className="ap-list">
                {resolutions.map(res => (
                  <div key={res.id} className={`ap-card ${activeResolution?.id === res.id ? 'ap-card-active' : ''}`}>
                    <div className="ap-card-row">
                      <div className="ap-card-body">
                        {activeResolution?.id === res.id && <span className="ap-badge ap-badge-active">Active</span>}
                        <h4 className="ap-card-title">{res.title}</h4>
                        <p className="ap-card-desc">{res.description}</p>
                      </div>
                      <div className="ap-row-actions">
                        <button className="ap-icon-btn" onClick={() => { setEditingResolution(res); setShowResolutionForm(true); }} title="Edit"><Edit2 size={14} /></button>
                        <button className="ap-icon-btn ap-icon-danger" onClick={() => deleteResolution(res.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {resolutions.length === 0 && <div className="ap-empty">No resolutions yet.</div>}
              </div>
            </div>
          )}

          {/* ── AUDIT COMMITTEE ── */}
          {view === 'audit' && (
            <div className="ap-section">
              <div className="ap-section-bar">
                <p className="ap-section-count">{auditMembers.length} member{auditMembers.length !== 1 ? 's' : ''}</p>
                <button className="ap-add-btn" onClick={() => { setEditingAuditMember(null); setShowAuditForm(true); }}>
                  <Plus size={14} /> Add Member
                </button>
              </div>
              <div className="ap-list">
                {auditMembers.map(member => (
                  <div key={member.id} className={`ap-card ${activeAuditMember?.id === member.id ? 'ap-card-active' : ''}`}>
                    <div className="ap-card-row">
                      <div className="ap-card-body">
                        {activeAuditMember?.id === member.id && <span className="ap-badge ap-badge-active">Active</span>}
                        <h4 className="ap-card-title">{member.name}</h4>
                        {member.bio && <p className="ap-card-desc">{member.bio}</p>}
                        <p className="ap-muted-sm">Votes: <strong>{member.votesFor || 0}</strong></p>
                      </div>
                      <div className="ap-row-actions">
                        <button className="ap-icon-btn" onClick={() => { setEditingAuditMember(member); setShowAuditForm(true); }} title="Edit"><Edit2 size={14} /></button>
                        <button className="ap-icon-btn ap-icon-danger" onClick={() => deleteAuditMember(member.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {auditMembers.length === 0 && <div className="ap-empty">No committee members yet.</div>}
              </div>
            </div>
          )}

          {/* ── VOTERS ── */}
          {view === 'voters' && (
            <div className="ap-section ap-section-wide">
              <div className="ap-section-bar">
                <p className="ap-section-count">{voters.length} voter{voters.length !== 1 ? 's' : ''}</p>
                <div className="ap-section-bar-actions">
                  <button className="ap-export-btn" onClick={exportVotersCSV} disabled={voters.length === 0} title="Export to CSV">
                    <Download size={14} /> Export CSV
                  </button>
                  <button className="ap-add-btn" onClick={() => { setVoterError(''); setShowVoterForm(true); }}>
                    <Plus size={14} /> Add Voter
                  </button>
                </div>
              </div>
              <input
                type="text"
                className="ap-search-input"
                placeholder="Search by name, account number or email…"
                value={voterSearch}
                onChange={e => { setVoterSearch(e.target.value); setVoterPage(1); }}
              />
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th className="ap-th-sortable" onClick={() => toggleVoterSort('name')}>
                        Name <SortArrow col="name" sort={voterSort} />
                      </th>
                      <th>Account No.</th>
                      <th className="ap-th-sortable" onClick={() => toggleVoterSort('holdings')}>
                        Holdings <SortArrow col="holdings" sort={voterSort} />
                      </th>
                      <th className="ap-th-sortable" onClick={() => toggleVoterSort('resVotes')}>
                        Res. Votes <SortArrow col="resVotes" sort={voterSort} />
                      </th>
                      <th className="ap-th-sortable" onClick={() => toggleVoterSort('auditVotes')}>
                        Audit Vote <SortArrow col="auditVotes" sort={voterSort} />
                      </th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedVoters.length === 0 && (
                      <tr><td colSpan="8" className="ap-table-empty">No voters found.</td></tr>
                    )}
                    {pagedVoters.map((v, idx) => {
                      const rank = (voterPage - 1) * VOTERS_PER_PAGE + idx + 1;
                      const resVotes = Number(v.resolutionVoteCount || 0);
                      const auditVotes = Number(v.auditVoteCount || 0);
                      return (
                        <tr key={v.id}>
                          <td>
                            <div className="ap-voter-name">
                              <span className="ap-voter-rank">#{rank}</span>
                              <strong>{v.name}</strong>
                            </div>
                          </td>
                          <td className="ap-mono">{v.acno}</td>
                          <td className="ap-td-num">{Number(v.holdings || 0).toLocaleString()}</td>
                          <td>
                            {resVotes > 0
                              ? <span className="ap-vote-chip ap-vote-yes">{resVotes}</span>
                              : <span className="ap-vote-chip ap-vote-no">—</span>}
                          </td>
                          <td>
                            {auditVotes > 0
                              ? <span className="ap-vote-chip ap-vote-yes">{auditVotes}</span>
                              : <span className="ap-vote-chip ap-vote-no">—</span>}
                          </td>
                          <td className="ap-td-muted">{v.phone_number || '—'}</td>
                          <td className="ap-td-muted">{v.email || '—'}</td>
                          <td>
                            <button className="ap-icon-btn ap-icon-danger" onClick={() => deleteVoter(v.id, v.name)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {voterTotalPages > 1 && (
                <div className="ap-pagination">
                  <button className="ap-page-btn" onClick={() => setVoterPage(1)} disabled={voterPage === 1}>«</button>
                  <button className="ap-page-btn" onClick={() => setVoterPage(p => Math.max(1, p - 1))} disabled={voterPage === 1}>‹</button>
                  <span className="ap-page-info">Page {voterPage} of {voterTotalPages} &nbsp;·&nbsp; {sortedVoters.length} voters</span>
                  <button className="ap-page-btn" onClick={() => setVoterPage(p => Math.min(voterTotalPages, p + 1))} disabled={voterPage === voterTotalPages}>›</button>
                  <button className="ap-page-btn" onClick={() => setVoterPage(voterTotalPages)} disabled={voterPage === voterTotalPages}>»</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {view === 'settings' && (
            <div className="ap-section">

              <div className="ap-settings-block">
                <h3 className="ap-block-title">Voting Timer Duration</h3>
                <p className="ap-muted" style={{ marginBottom: '1.25rem' }}>Controls the countdown on the voter page and the results screen — both stay in sync</p>
                <div className="ap-proxy-row">
                  <div className="ap-proxy-field">
                    <label>Duration (seconds)</label>
                    <input
                      type="number" min="10" max="3600"
                      value={votingDurationEdit !== null ? votingDurationEdit : votingDuration}
                      onChange={e => setVotingDurationEdit(e.target.value)}
                    />
                  </div>
                  <p className="ap-duration-hint">
                    = {Math.floor((votingDurationEdit !== null ? Number(votingDurationEdit) : votingDuration) / 60)}m {(votingDurationEdit !== null ? Number(votingDurationEdit) : votingDuration) % 60}s
                  </p>
                  <button className="ap-btn ap-btn-primary" onClick={saveVotingDuration} disabled={votingDurationSaving || votingDurationEdit === null}>
                    {votingDurationSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="ap-settings-block">
                <h3 className="ap-block-title">Global Proxy Settings</h3>
                <p className="ap-muted" style={{ marginBottom: '1.25rem' }}>Applied to all resolutions on the results screen</p>
                <div className="ap-proxy-row">
                  <div className="ap-proxy-field">
                    <label>Proxy Votes (FOR)</label>
                    <input type="number" min="0"
                      value={globalProxyEdit !== null ? globalProxyEdit.proxyVotes : globalProxy.proxyVotes}
                      onChange={e => setGlobalProxyEdit(p => ({ ...(p ?? globalProxy), proxyVotes: e.target.value }))}
                    />
                  </div>
                  <div className="ap-proxy-field">
                    <label>Proxy Holdings</label>
                    <input type="number" min="0"
                      value={globalProxyEdit !== null ? globalProxyEdit.proxyHoldings : globalProxy.proxyHoldings}
                      onChange={e => setGlobalProxyEdit(p => ({ ...(p ?? globalProxy), proxyHoldings: e.target.value }))}
                    />
                  </div>
                  <button className="ap-btn ap-btn-primary" onClick={saveGlobalProxy} disabled={globalProxySaving || globalProxyEdit === null}>
                    {globalProxySaving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="ap-btn ap-btn-danger-outline" onClick={() => setConfirmModal({
                    message: 'Reset proxy votes and holdings to zero?',
                    onConfirm: async () => {
                      await fetch(`${API_URL}/api/admin/proxy-settings`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                        body: JSON.stringify({ proxyVotes: 0, proxyHoldings: 0 })
                      });
                      setGlobalProxy({ proxyVotes: 0, proxyHoldings: 0 });
                      setGlobalProxyEdit(null);
                      setConfirmModal(null);
                    }
                  })}>
                    Clear Proxy
                  </button>
                </div>
              </div>

              <div className="ap-settings-block ap-danger-block">
                <h3 className="ap-block-title ap-danger-title">Danger Zone</h3>
                <div className="ap-danger-actions">
                  <button className="ap-btn ap-btn-danger-outline" onClick={() => clearVotes('resolutions')}>Clear Resolution Votes</button>
                  <button className="ap-btn ap-btn-danger-outline" onClick={() => clearVotes('audit')}>Clear Audit Votes</button>
                  <button className="ap-btn ap-btn-danger" onClick={() => clearVotes('all')}>Clear All Votes</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODALS ── */}

      {showResolutionForm && (
        <div className="ap-modal-overlay" onClick={() => setShowResolutionForm(false)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <button className="ap-modal-close" onClick={() => setShowResolutionForm(false)}>×</button>
            <ResolutionForm
              resolution={editingResolution}
              onSuccess={() => { setShowResolutionForm(false); fetchResolutions(); }}
              onCancel={() => setShowResolutionForm(false)}
            />
          </div>
        </div>
      )}

      {showAuditForm && (
        <div className="ap-modal-overlay" onClick={() => setShowAuditForm(false)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <button className="ap-modal-close" onClick={() => setShowAuditForm(false)}>×</button>
            <h2 className="ap-modal-title">{editingAuditMember ? 'Edit Member' : 'Add Member'}</h2>
            <form onSubmit={e => { e.preventDefault(); handleAuditFormSubmit({ name: e.target.name.value, bio: e.target.bio.value }); }} className="ap-form">
              <div className="ap-field">
                <label>Name *</label>
                <input type="text" name="name" defaultValue={editingAuditMember?.name || ''} required minLength="3" />
              </div>
              <div className="ap-field">
                <label>Bio</label>
                <textarea name="bio" defaultValue={editingAuditMember?.bio || ''} rows={4} />
              </div>
              <div className="ap-form-actions">
                <button type="submit" className="ap-btn ap-btn-primary">Save</button>
                <button type="button" className="ap-btn ap-btn-outline" onClick={() => setShowAuditForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVoterForm && (
        <div className="ap-modal-overlay" onClick={() => setShowVoterForm(false)}>
          <div className="ap-modal ap-modal-wide" onClick={e => e.stopPropagation()}>
            <button className="ap-modal-close" onClick={() => setShowVoterForm(false)}>×</button>
            <h2 className="ap-modal-title">Add Voter</h2>
            {voterError && <div className="ap-form-error">{voterError}</div>}
            <form onSubmit={handleAddVoter} className="ap-form">
              <div className="ap-field-grid">
                <div className="ap-field">
                  <label>Full Name *</label>
                  <input type="text" value={voterForm.name} onChange={e => setVoterForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="ap-field">
                  <label>Account No. *</label>
                  <input type="text" value={voterForm.acno} onChange={e => setVoterForm(p => ({ ...p, acno: e.target.value }))} required />
                </div>
                <div className="ap-field">
                  <label>Holdings</label>
                  <input type="number" min="0" value={voterForm.holdings} onChange={e => setVoterForm(p => ({ ...p, holdings: e.target.value }))} />
                </div>
                <div className="ap-field">
                  <label>CHN</label>
                  <input type="text" value={voterForm.chn} onChange={e => setVoterForm(p => ({ ...p, chn: e.target.value }))} />
                </div>
                <div className="ap-field">
                  <label>Email</label>
                  <input type="email" value={voterForm.email} onChange={e => setVoterForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="ap-field">
                  <label>Phone Number</label>
                  <input type="text" value={voterForm.phone_number} onChange={e => setVoterForm(p => ({ ...p, phone_number: e.target.value }))} />
                </div>
              </div>
              <div className="ap-form-actions">
                <button type="submit" className="ap-btn ap-btn-primary" disabled={voterSaving}>{voterSaving ? 'Saving…' : 'Add Voter'}</button>
                <button type="button" className="ap-btn ap-btn-outline" onClick={() => setShowVoterForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="ap-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="ap-modal ap-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-confirm-icon"><AlertTriangle size={36} color="#d97706" /></div>
            <h3 className="ap-confirm-title">Are you sure?</h3>
            <p className="ap-confirm-message">{confirmModal.message}</p>
            <div className="ap-confirm-actions">
              <button className="ap-btn ap-btn-danger" onClick={confirmModal.onConfirm}>Confirm</button>
              <button className="ap-btn ap-btn-outline" onClick={() => setConfirmModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
