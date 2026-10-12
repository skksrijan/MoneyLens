import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  Link as ChainIcon,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  FileCode,
  X,
  Hash,
  Clock,
  Layers
} from 'lucide-react';

const BlockchainPage = () => {
  const [blocks, setBlocks] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [difficulty, setDifficulty] = useState(2);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);

  const fetchBlockchain = async () => {
    try {
      setLoading(true);
      const res = await api.get('/blockchain');
      if (res.data.success) {
        setBlocks(res.data.blocks);
        setVerifyResult(res.data.verifyResult);
        setDifficulty(res.data.difficulty);
      }
    } catch (err) {
      console.error('Failed to load blockchain:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockchain();
  }, []);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      const res = await api.get('/blockchain/verify');
      setVerifyResult(res.data);
    } catch (err) {
      alert('Verification request failed');
    } finally {
      setVerifying(false);
    }
  };

  const getEventBadgeClass = (eventType) => {
    switch (eventType) {
      case 'genesis': return 'badge-blockchain';
      case 'transaction': return 'badge-income';
      case 'amendment': return 'badge-warning';
      case 'deletion': return 'badge-expense';
      default: return 'badge-blockchain';
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Blockchain Explorer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Immutable SHA-256 Proof-of-Work cryptographic ledger auditing every financial event.
          </p>
        </div>
        <button onClick={handleVerify} disabled={verifying} className="btn btn-primary">
          <RotateCcw size={16} className={verifying ? 'animate-spin' : ''} />
          <span>{verifying ? 'Recalculating Hashes...' : 'Verify Chain Integrity'}</span>
        </button>
      </div>

      {/* Verification Status Card */}
      {verifyResult && (
        <div
          className="content-card"
          style={{
            borderColor: verifyResult.valid ? 'var(--success)' : 'var(--danger)',
            background: verifyResult.valid ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: verifyResult.valid ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: verifyResult.valid ? 'var(--success)' : 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {verifyResult.valid ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                  {verifyResult.valid ? 'Cryptographic Ledger 100% Intact' : 'TAMPER DETECTED ON LEDGER!'}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {verifyResult.valid
                    ? `All ${verifyResult.blockCount} blocks successfully verified with unbroken previousHash linkage.`
                    : `Chain failure detected at Block #${verifyResult.invalidAt}: ${verifyResult.reason}`}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                  PoW Target
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {"0".repeat(difficulty)} Prefix
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                  Total Height
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  {blocks.length} Blocks
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocks Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading blockchain blocks...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {blocks.map((block) => (
            <div key={block._id} className="content-card" style={{ marginBottom: 0, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: 'var(--info)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '14px'
                    }}
                  >
                    Block #{block.index}
                  </div>
                  <span className={`badge ${getEventBadgeClass(block.eventType)}`} style={{ textTransform: 'uppercase' }}>
                    {block.eventType}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {block.timestamp}
                  </span>
                  <button
                    onClick={() => setSelectedBlock(block)}
                    className="btn btn-outline btn-sm"
                    style={{ gap: '4px' }}
                  >
                    <FileCode size={13} />
                    <span>Payload</span>
                  </button>
                </div>
              </div>

              {/* Hash and Previous Hash grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', background: 'rgba(15, 23, 42, 0.5)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                    Current Block Hash (SHA-256)
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary)', wordBreak: 'break-all', marginTop: '2px' }}>
                    {block.hash}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                    Previous Block Hash
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '2px' }}>
                    {block.previousHash}
                  </div>
                </div>
              </div>

              {/* Nonce and Difficulty footer */}
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '12px', color: 'var(--text-faint)' }}>
                <span>Nonce: <strong>{block.nonce}</strong></span>
                <span>Difficulty: <strong>{block.difficulty}</strong></span>
                {block.amendedBlockHash && (
                  <span>Supersedes: <code style={{ color: 'var(--warning)' }}>{block.amendedBlockHash.substring(0, 12)}...</code></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot JSON Modal */}
      {selectedBlock && (
        <div className="modal-overlay" onClick={() => setSelectedBlock(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Block #{selectedBlock.index} Snapshot Data</h2>
              <button onClick={() => setSelectedBlock(null)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <pre
              style={{
                backgroundColor: '#0a0f1d',
                padding: '16px',
                borderRadius: '8px',
                overflowX: 'auto',
                fontSize: '13px',
                color: '#38bdf8',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {JSON.stringify(selectedBlock.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockchainPage;
