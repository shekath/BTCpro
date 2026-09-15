import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = (n, d=0) => n != null ? Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}) : '---';
const fmtUSD = (n)      => n != null ? `$${fmt(n)}` : '---';
const fmtPct = (n)      => n != null ? `${Number(n)>0?'+':''}${Number(n).toFixed(2)}%` : '---';

// ─── Sound alert ─────────────────────────────────────────────────────────────
function playBeep(freq=880, dur=0.25, vol=0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch {}
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function CountdownTimer({ lastUpdate }) {
  const [secs, setSecs] = useState(900);
  useEffect(() => { setSecs(900); }, [lastUpdate]);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s > 0 ? s-1 : 900), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(secs/60), s = secs%60;
  const pct = (secs/900)*100;
  const col = secs < 120 ? 'var(--sell)' : secs < 300 ? 'var(--warning)' : 'var(--buy)';
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:9,color:'var(--muted)',letterSpacing:1,marginBottom:6}}>NEXT 15M SCAN IN</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:col}}>
        {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </div>
      <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,marginTop:8,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:col,borderRadius:2,transition:'width 1s linear'}}/>
      </div>
    </div>
  );
}

// ─── Signal Card ─────────────────────────────────────────────────────────────
function SignalCard({ signal, executing, tradeResult, onExecute }) {
  if (!signal) return (
    <div className="signal-hero neutral">
      <div className="signal-badge neutral">◆ SCANNING</div>
      <div className="signal-reason">Analyzing 15m market data…</div>
    </div>
  );
  const dir = (signal.signal||'neutral').toLowerCase();
  const isTradeable = signal.signal !== 'NEUTRAL';
  const rsiPct = Math.min(Math.max(signal.rsi||50,0),100);
  const rsiColor = rsiPct<32?'var(--buy)':rsiPct>68?'var(--sell)':'var(--warning)';

  return (
    <div className={`signal-hero ${dir}`}>
      <div className={`signal-badge ${dir}`}>
        {dir==='buy'?'▲':dir==='sell'?'▼':'◆'} {signal.signal}
      </div>
      <div className="signal-reason">{signal.reason||'Awaiting conditions…'}</div>
      {isTradeable && (
        <div className="signal-levels">
          <div className="level-item"><div className="level-label">ENTRY</div><div className="level-value">{fmtUSD(signal.entry)}</div></div>
          <div className="level-item"><div className="level-label" style={{color:'var(--buy)'}}>TARGET</div><div className="level-value c-buy">{fmtUSD(signal.target)}</div></div>
          <div className="level-item"><div className="level-label" style={{color:'var(--sell)'}}>STOP</div><div className="level-value c-sell">{fmtUSD(signal.stop_loss)}</div></div>
        </div>
      )}
      <div style={{marginTop:8,marginBottom:isTradeable?14:0}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span className="level-label">RSI (14)</span>
          <span className="level-value" style={{fontSize:13,color:rsiColor}}>{signal.rsi?.toFixed(1)??'--'}</span>
        </div>
        <div className="rsi-bar-wrap">
          <div className="rsi-bar" style={{width:`${rsiPct}%`,background:`linear-gradient(90deg,${rsiColor},${rsiColor}88)`}}/>
        </div>
        <div className="rsi-zones"><span>Oversold &lt;32</span><span>50</span><span>&gt;68 Overbought</span></div>
      </div>
      {isTradeable && (
        <>
          <button className={`exec-btn ${dir}`} onClick={onExecute} disabled={executing}>
            {executing ? '⏳ Executing…' : `✓ Approve & Execute ${signal.signal}`}
          </button>
          {tradeResult && (
            <div style={{marginTop:8,fontSize:12,textAlign:'center',color:tradeResult.type==='success'?'var(--buy)':'var(--sell)'}}>
              {tradeResult.msg}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Key Levels ───────────────────────────────────────────────────────────────
function KeyLevels({ levels, price, maxPain }) {
  if (!levels || !Object.keys(levels).length) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>Calculating key levels…</div>;
  const rows = [
    { label:'R2',       value:levels.r2,    type:'resistance' },
    { label:'R1',       value:levels.r1,    type:'resistance' },
    { label:'MAX PAIN', value:maxPain,       type:'maxpain' },
    { label:'EMA50',    value:levels.ema50,  type:'ema' },
    { label:'▶ NOW',   value:price,          type:'current' },
    { label:'PIVOT',    value:levels.pivot,  type:'pivot' },
    { label:'EMA20',    value:levels.ema20,  type:'ema' },
    { label:'S1',       value:levels.s1,     type:'support' },
    { label:'S2',       value:levels.s2,     type:'support' },
  ].filter(r=>r.value).sort((a,b)=>b.value-a.value);

  const colorMap={resistance:'c-sell',support:'c-buy',pivot:'c-accent',ema:'c-info',current:'',maxpain:'c-warn'};
  return (
    <div className="levels-list">
      {rows.map(r=>(
        <div key={r.label} className={`level-row ${r.type}`}>
          <span className="level-name">{r.label}</span>
          <span className={`level-price ${colorMap[r.type]||''}`}>{fmtUSD(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Options OI Chart ─────────────────────────────────────────────────────────
function OIChart({ calls, puts }) {
  if (!calls?.length && !puts?.length) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>Loading Options OI…</div>;
  const all=[...calls.slice(0,4),...puts.slice(0,4)];
  const maxOI=Math.max(...all.map(i=>i.oi_usd),1);
  return (
    <div>
      {calls.length>0&&<>
        <div style={{fontSize:10,color:'var(--buy)',fontWeight:700,letterSpacing:1,marginBottom:6}}>CALLS (Resistance Wall)</div>
        <div className="oi-chart" style={{marginBottom:12}}>
          {calls.slice(0,4).map(c=>(
            <div key={c.symbol} className="oi-row">
              <span className="oi-label">${fmt(c.strike)}</span>
              <div className="oi-bar-wrap">
                <div className="oi-bar call" style={{width:`${(c.oi_usd/maxOI)*100}%`}}>
                  {c.oi_usd>maxOI*0.2&&`$${(c.oi_usd/1000).toFixed(0)}K`}
                </div>
              </div>
              <span className="oi-usd">${(c.oi_usd/1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </>}
      {puts.length>0&&<>
        <div style={{fontSize:10,color:'var(--sell)',fontWeight:700,letterSpacing:1,marginBottom:6}}>PUTS (Support Wall)</div>
        <div className="oi-chart">
          {puts.slice(0,4).map(p=>(
            <div key={p.symbol} className="oi-row">
              <span className="oi-label">${fmt(p.strike)}</span>
              <div className="oi-bar-wrap">
                <div className="oi-bar put" style={{width:`${(p.oi_usd/maxOI)*100}%`}}>
                  {p.oi_usd>maxOI*0.2&&`$${(p.oi_usd/1000).toFixed(0)}K`}
                </div>
              </div>
              <span className="oi-usd">${(p.oi_usd/1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ─── Multi-TF Signal Table ────────────────────────────────────────────────────
function MultiTFTable({ signal15m, signal1h }) {
  const renderCell = (sig, tf) => {
    if (!sig) return <td key={tf} colSpan={4} style={{color:'var(--muted)',textAlign:'center',fontSize:12}}>Loading…</td>;
    const c = sig.signal==='BUY'?'c-buy':sig.signal==='SELL'?'c-sell':'c-neutral';
    return (
      <>
        <td><span className={c} style={{fontWeight:700}}>{sig.signal}</span></td>
        <td className="c-neutral" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{fmtUSD(sig.entry)}</td>
        <td className="c-buy"   style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{sig.target?fmtUSD(sig.target):'—'}</td>
        <td className="c-sell"  style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{sig.stop_loss?fmtUSD(sig.stop_loss):'—'}</td>
      </>
    );
  };
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{color:'var(--muted)',textTransform:'uppercase',fontSize:10,letterSpacing:0.8}}>
            <th style={{textAlign:'left',padding:'6px 8px'}}>TF</th>
            <th style={{textAlign:'left',padding:'6px 8px'}}>Signal</th>
            <th style={{textAlign:'left',padding:'6px 8px'}}>Entry</th>
            <th style={{textAlign:'left',padding:'6px 8px'}}>Target</th>
            <th style={{textAlign:'left',padding:'6px 8px'}}>Stop</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{borderTop:'1px solid var(--border)'}}>
            <td style={{padding:'8px 8px',fontWeight:700,color:'var(--accent)'}}>15m</td>
            {renderCell(signal15m,'15m')}
          </tr>
          <tr style={{borderTop:'1px solid var(--border)'}}>
            <td style={{padding:'8px 8px',fontWeight:700,color:'var(--info)'}}>1H</td>
            {renderCell(signal1h,'1h')}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── P&L Tracker ─────────────────────────────────────────────────────────────
function PnLTracker({ trades, currentPrice, onSimulateTrade, onCloseTrade }) {
  const totalPnL = trades.reduce((acc, t) => {
    const pnl = t.side === 'BUY'
      ? (currentPrice - t.entry) * t.size
      : (t.entry - currentPrice) * t.size;
    return acc + pnl;
  }, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 0.5 }}>UNREALIZED P&amp;L</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: totalPnL >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
            {totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onSimulateTrade('BUY')}
            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--buy-dim)', color: 'var(--buy)', cursor: 'pointer' }}
            title="Simulate Long Paper Trade"
          >
            + Long
          </button>
          <button
            onClick={() => onSimulateTrade('SELL')}
            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--sell-dim)', color: 'var(--sell)', cursor: 'pointer' }}
            title="Simulate Short Paper Trade"
          >
            + Short
          </button>
        </div>
      </div>

      {!trades?.length ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '10px 0' }}>
          No active positions.<br />Click <strong>+ Long</strong> or <strong>+ Short</strong> to test real-time P&amp;L tracking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {trades.map((t) => {
            const pnl = t.side === 'BUY'
              ? (currentPrice - t.entry) * t.size
              : (t.entry - currentPrice) * t.size;
            const pnlPct = ((pnl / (t.entry * t.size)) * 100).toFixed(2);
            const isProfit = pnl >= 0;
            return (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${isProfit ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: t.side === 'BUY' ? 'var(--buy)' : 'var(--sell)', fontSize: 12 }}>
                    {t.side} @ {fmtUSD(t.entry)}
                  </span>
                  <button
                    onClick={() => onCloseTrade(t.id)}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Live: {fmtUSD(currentPrice)}</span>
                  <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: isProfit ? 'var(--buy)' : 'var(--sell)' }}>
                    {isProfit ? '+' : ''}{fmtUSD(pnl)} ({isProfit ? '+' : ''}{pnlPct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Options Strategy Card ───────────────────────────────────────────────────
function OptionsStrategyCard({ strategy }) {
  if (!strategy) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>Formulating options strategy…</div>;
  const biasCol = strategy.bias === 'BULLISH' ? 'var(--buy)' : strategy.bias === 'BEARISH' ? 'var(--sell)' : 'var(--warning)';
  const pcrCol = strategy.pcr > 1.2 ? 'var(--buy)' : strategy.pcr < 0.8 ? 'var(--sell)' : 'var(--muted)';
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontWeight:800,fontSize:14,color:biasCol}}>{strategy.strategy}</span>
        <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'rgba(255,255,255,0.06)',fontFamily:"'JetBrains Mono',monospace",color:pcrCol}}>
          PCR: {strategy.pcr}
        </span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',borderRadius:6,background:'rgba(255,255,255,0.03)'}}>
          <span style={{color:'var(--muted)',fontSize:11}}>LEG 1</span>
          <span style={{fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{strategy.leg1}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',borderRadius:6,background:'rgba(255,255,255,0.03)'}}>
          <span style={{color:'var(--muted)',fontSize:11}}>LEG 2</span>
          <span style={{fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{strategy.leg2}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',borderRadius:6,background:'rgba(255,255,255,0.03)'}}>
          <span style={{color:'var(--muted)',fontSize:11}}>WIN PROB</span>
          <span style={{fontWeight:700,color:'var(--buy)'}}>{strategy.probability}</span>
        </div>
      </div>
      <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.4,fontStyle:'italic',borderLeft:'2px solid var(--border)',paddingLeft:8}}>
        {strategy.rationale}
      </div>
    </div>
  );
}

// ─── Overall Bitcoin Sentiment Meter ──────────────────────────────────────────
function OverallSentimentMeter({ sentiment }) {
  if (!sentiment) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>Calibrating sentiment meter…</div>;
  const score = Math.max(0, Math.min(100, sentiment.score || 50));
  // Needle: 0 score = -90deg, 50 score = 0deg, 100 score = +90deg
  const needleDeg = (score / 100) * 180 - 90;
  const category = sentiment.category || 'NEUTRAL';
  const color = sentiment.color || '#fcd535';

  return (
    <div>
      <div className="sentiment-meter-wrap">
        <div className="gauge-dial">
          <div className="gauge-needle" style={{ transform: `translateX(-50%) rotate(${needleDeg}deg)` }} />
          <div className="gauge-needle-dot" />
          <div className="gauge-inner-mask">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color }}>
              {score.toFixed(0)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color, textTransform: 'uppercase' }}>
              {category}
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdowns */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 2 }}>
            <span>Technical Momentum (40%)</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>
              {sentiment.components?.technical ?? 50}/100
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sentiment.components?.technical ?? 50}%`, background: '#60a5fa' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 2 }}>
            <span>Crowd Funding Rate (30%)</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>
              {sentiment.components?.funding ?? 50}/100
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sentiment.components?.funding ?? 50}%`, background: '#f59e0b' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 2 }}>
            <span>Crypto News Sentiment (30%)</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>
              {sentiment.components?.news ?? 50}/100
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sentiment.components?.news ?? 50}%`, background: '#0ecb81' }} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${color}` }}>
        💡 <strong>Pro Advice:</strong> {sentiment.advice}
      </div>
    </div>
  );
}

// ─── Alerts Feed ─────────────────────────────────────────────────────────────
function AlertsFeed({ alerts }) {
  if (!alerts?.length) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>No alerts yet…</div>;
  return (
    <div className="alerts-list">
      {alerts.map((a,i)=>(
        <div key={i} className={`alert-item ${a.type}`}>
          <span>{a.msg}</span>
          <span className="alert-time">{a.time}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sentiment Widget ─────────────────────────────────────────────────────────
function SentimentWidget({ sentiment }) {
  if (!sentiment) return <div className="c-neutral" style={{fontSize:12,textAlign:'center',padding:'10px 0'}}>Fetching news…</div>;
  const score=sentiment.score||0;
  const pct=Math.min(Math.max((score+1)/2*100,0),100);
  const barColor=pct>55?'var(--buy)':pct<45?'var(--sell)':'var(--warning)';
  const textClass=sentiment.overall==='BULLISH'?'c-buy':sentiment.overall==='BEARISH'?'c-sell':'c-neutral';
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <span className={textClass} style={{fontSize:16,fontWeight:700}}>{sentiment.overall}</span>
        <span style={{fontSize:11,color:'var(--muted)',fontFamily:"'JetBrains Mono',monospace"}}>Score: {score.toFixed(2)}</span>
      </div>
      <div className="sentiment-bar-wrap">
        <div className="sentiment-bar" style={{width:`${pct}%`,background:barColor}}/>
        <div className="sentiment-marker" style={{left:`${pct}%`,background:barColor}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--muted)',marginBottom:12}}>
        <span>BEARISH</span><span>NEUTRAL</span><span>BULLISH</span>
      </div>
      <div className="news-list">
        {sentiment.news?.slice(0,4).map((n,i)=>(
          <div key={i} className={`news-item ${n.sentiment}`}>
            <span className={`news-sentiment ${n.sentiment}`}>{n.sentiment}</span>
            <div>{n.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Volume Spike Alert Banner ────────────────────────────────────────────────
function VolumeBanner({ spike }) {
  if (!spike) return null;
  return (
    <div style={{
      position:'fixed',top:60,left:'50%',transform:'translateX(-50%)',
      zIndex:999,background:spike.side==='BUY'?'var(--buy)':'var(--sell)',
      color:'#000',padding:'10px 28px',borderRadius:20,fontWeight:800,
      fontSize:14,letterSpacing:1,boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
      animation:'slideDown 0.4s ease'
    }}>
      🔊 VOLUME SPIKE — {spike.side} | {fmtUSD(spike.price)} × {spike.ratio?.toFixed(1)}x avg
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ticker,           setTicker]           = useState(null);
  const [signal15m,        setSignal15m]        = useState(null);
  const [signal1h,         setSignal1h]         = useState(null);
  const [sentiment,        setSentiment]        = useState(null);
  const [overallSentiment, setOverallSentiment] = useState(null);
  const [options,          setOptions]          = useState(null);
  const [optionsStrategy,  setOptionsStrategy]  = useState(null);
  const [keyLevels,        setKeyLevels]        = useState(null);
  const [alerts,           setAlerts]           = useState([]);
  const [connected,        setConnected]        = useState(false);
  const [lastUpdate,       setLastUpdate]       = useState(null);
  const [executing,        setExecuting]        = useState(false);
  const [tradeResult,      setTradeResult]      = useState(null);
  const [trades,           setTrades]           = useState([]);
  const [tab,              setTab]              = useState('15m');
  const [mobileTab,        setMobileTab]        = useState('chart'); // 'chart' | 'left' | 'right'
  const [volumeSpike,      setVolumeSpike]      = useState(null);
  const [maxPain,          setMaxPain]          = useState(null);
  const priceRef  = useRef(null);
  const wsRef     = useRef(null);
  const prevPrice = useRef(null);

  // Compute Max Pain from options OI
  useEffect(() => {
    if (!options?.calls?.length && !options?.puts?.length) return;
    const strikes = {};
    [...(options.calls||[]),...(options.puts||[])].forEach(item=>{
      if (!strikes[item.strike]) strikes[item.strike]=0;
      strikes[item.strike]+=item.oi_usd;
    });
    const maxKey = Object.entries(strikes).sort((a,b)=>b[1]-a[1])[0];
    if (maxKey) setMaxPain(Number(maxKey[0]));
  }, [options]);

  // Volume spike detection
  const checkVolumeSpike = useCallback((newTicker) => {
    if (!newTicker) return;
    const vol = parseFloat(newTicker.volume||0);
    const prev= parseFloat(prevPrice.current?.volume||0);
    if (prev>0 && vol > prev*2.5) {
      const price = parseFloat(newTicker.mark_price||0);
      const open  = parseFloat(newTicker.open||price);
      const side  = price>=open?'BUY':'SELL';
      setVolumeSpike({side,price,ratio:vol/prev});
      playBeep(side==='BUY'?660:440);
      setTimeout(()=>setVolumeSpike(null),5000);
    }
    prevPrice.current = newTicker;
  }, []);

  // WebSocket connection with auto-reconnect
  const connect = useCallback(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    wsRef.current = ws;
    ws.onopen  = ()=>setConnected(true);
    ws.onclose = ()=>{ setConnected(false); setTimeout(connect,3000); };
    ws.onerror = ()=>ws.close();
    ws.onmessage = (e)=>{
      const msg = JSON.parse(e.data);
      if (msg.type==='INITIAL_STATE'||msg.type==='ANALYSIS_UPDATE') {
        const d=msg.data;
        if (d.ticker)            setTicker(d.ticker);
        if (d.signal)            { setSignal15m(d.signal); setLastUpdate(new Date().toLocaleTimeString()); }
        if (d.signal_1h)         setSignal1h(d.signal_1h);
        if (d.sentiment)         setSentiment(d.sentiment);
        if (d.overall_sentiment) setOverallSentiment(d.overall_sentiment);
        if (d.options)           setOptions(d.options);
        if (d.options_strategy)  setOptionsStrategy(d.options_strategy);
        if (d.key_levels)        setKeyLevels(d.key_levels);
        if (d.alerts)            setAlerts(d.alerts);
        // sound alert on new signal
        if (d.signal?.signal==='BUY')  playBeep(880,0.3);
        if (d.signal?.signal==='SELL') playBeep(220,0.3);
      } else if (msg.type==='TICKER_UPDATE') {
        setTicker(msg.data);
        checkVolumeSpike(msg.data);
        if (priceRef.current) {
          priceRef.current.classList.remove('pulse-price');
          void priceRef.current.offsetWidth;
          priceRef.current.classList.add('pulse-price');
        }
      }
    };
  },[checkVolumeSpike]);

  useEffect(()=>{ connect(); return ()=>wsRef.current?.close(); },[connect]);

  // REST fallback when WS down
  useEffect(()=>{
    if (connected) return;
    const id=setInterval(async()=>{
      try{
        const r=await fetch('http://localhost:8000/api/analysis');
        const d=await r.json();
        if(d.ticker)            setTicker(d.ticker);
        if(d.signal)            setSignal15m(d.signal);
        if(d.signal_1h)         setSignal1h(d.signal_1h);
        if(d.sentiment)         setSentiment(d.sentiment);
        if(d.overall_sentiment) setOverallSentiment(d.overall_sentiment);
        if(d.options)           setOptions(d.options);
        if(d.options_strategy)  setOptionsStrategy(d.options_strategy);
        if(d.key_levels)        setKeyLevels(d.key_levels);
        if(d.alerts)            setAlerts(d.alerts);
      }catch{}
    },10000);
    return ()=>clearInterval(id);
  },[connected]);

  const executeTrade = async()=>{
    if (!signal15m||signal15m.signal==='NEUTRAL') return;
    setExecuting(true); setTradeResult(null);
    try{
      const r=await fetch('http://localhost:8000/api/execute-trade',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:signal15m.signal,size:1})
      });
      const d=await r.json();
      if (r.ok){
        setTradeResult({type:'success',msg:'✅ Order placed on Delta Exchange!'});
        setTrades(prev=>[{
          id: Date.now(),
          side: signal15m.signal,
          entry: signal15m.entry,
          size: 1,
          time: new Date().toLocaleTimeString()
        },...prev].slice(0,10));
      } else {
        setTradeResult({type:'error',msg:d.detail||'Failed to execute'});
      }
    }catch{setTradeResult({type:'error',msg:'Network error'});}
    finally{setExecuting(false);}
  };

  const handleSimulateTrade = (side) => {
    const currentP = parseFloat(ticker?.mark_price || ticker?.close || 77000);
    setTrades(prev => [{
      id: Date.now(),
      side,
      entry: currentP,
      size: 1,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 10));
    playBeep(side === 'BUY' ? 880 : 440, 0.2);
  };

  const handleCloseTrade = (id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  const price   = parseFloat(ticker?.mark_price||ticker?.close||0);
  const change  = parseFloat(ticker?.ltp_change_24h||0);
  const funding = parseFloat(ticker?.funding_rate||0);
  const vol24h  = parseFloat(ticker?.volume||0);
  const trend   = keyLevels?.trend||'NEUTRAL';
  const trendCl = trend==='BULLISH'?'c-buy':trend==='BEARISH'?'c-sell':'c-neutral';
  const tvInt   = tab==='1h'?'60':'15';

  return (
    <div className="app-root">
      {/* Volume Spike Banner */}
      <VolumeBanner spike={volumeSpike}/>

      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="btc-icon">₿</div>
          Pro Bitcoin Trader
        </div>
        <div style={{display:'flex',alignItems:'center',gap:20, flexWrap:'wrap'}}>
          <div ref={priceRef} className="topbar-price" style={{color:change>=0?'var(--buy)':'var(--sell)'}}>
            {price?fmtUSD(price):'Loading…'}
          </div>
          <div className="mini-stats">
            <div className="mini-stat"><div className="label">24H</div><div className={`value ${change>=0?'c-buy':'c-sell'}`}>{fmtPct(change)}</div></div>
            <div className="mini-stat"><div className="label">FUNDING</div><div className={`value ${funding<0?'c-sell':'c-buy'}`}>{(funding*100).toFixed(4)}%</div></div>
            <div className="mini-stat"><div className="label">TREND</div><div className={`value ${trendCl}`}>{trend}</div></div>
            <div className="mini-stat"><div className="label">MAX PAIN</div><div className="value c-warn">{maxPain?fmtUSD(maxPain):'---'}</div></div>
            <div className="mini-stat">
              <div className="label">SIGNAL</div>
              <div className={`value ${signal15m?.signal==='BUY'?'c-buy':signal15m?.signal==='SELL'?'c-sell':'c-neutral'}`}>
                {signal15m?.signal||'---'}
              </div>
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className={`status-dot ${connected?'live':'dead'}`}/>
          <span style={{fontSize:13,fontWeight:600}}>{connected?'LIVE':'Connecting…'}</span>
          {lastUpdate&&<span style={{fontSize:11,color:'var(--muted)'}}>Updated {lastUpdate}</span>}
        </div>
      </header>

      {/* ── Mobile View Tabs ── */}
      <div className="mobile-nav-bar">
        <button
          className={`mobile-nav-btn ${mobileTab === 'chart' ? 'active' : ''}`}
          onClick={() => setMobileTab('chart')}
        >
          📈 Chart
        </button>
        <button
          className={`mobile-nav-btn ${mobileTab === 'left' ? 'active' : ''}`}
          onClick={() => setMobileTab('left')}
        >
          ⚡ Signals &amp; P&amp;L
        </button>
        <button
          className={`mobile-nav-btn ${mobileTab === 'right' ? 'active' : ''}`}
          onClick={() => setMobileTab('right')}
        >
          🧭 Sentiment &amp; Options
        </button>
      </div>

      {/* ── Dashboard Grid ── */}
      <div className="dashboard">

        {/* ── LEFT PANEL ── */}
        <div className="panel" style={{ display: typeof window !== 'undefined' && window.innerWidth <= 992 && mobileTab !== 'left' ? 'none' : 'flex' }}>

          {/* Countdown */}
          <div className="panel-card">
            <CountdownTimer lastUpdate={lastUpdate}/>
          </div>

          {/* Signal Card */}
          <div className="panel-card" style={{padding:0,overflow:'hidden'}}>
            <SignalCard signal={signal15m} executing={executing} tradeResult={tradeResult} onExecute={executeTrade}/>
          </div>

          {/* Multi-TF Table */}
          <div className="panel-card">
            <div className="card-title">📊 Multi-Timeframe Signals (15m + 1H)</div>
            <MultiTFTable signal15m={signal15m} signal1h={signal1h}/>
          </div>

          {/* Stats */}
          <div className="panel-card">
            <div className="card-title">📈 Market Stats</div>
            <div className="stats-grid">
              <div className="stat-item"><div className="stat-label">MARK PRICE</div><div className="stat-value c-accent">{fmtUSD(price)}</div></div>
              <div className="stat-item"><div className="stat-label">MAX PAIN</div><div className="stat-value c-warn">{maxPain?fmtUSD(maxPain):'---'}</div></div>
              <div className="stat-item"><div className="stat-label">24H VOL</div><div className="stat-value">{fmt(vol24h,1)} BTC</div></div>
              <div className="stat-item"><div className="stat-label">FUNDING</div><div className={`stat-value ${funding<0?'c-sell':'c-buy'}`}>{(funding*100).toFixed(4)}%</div></div>
              <div className="stat-item"><div className="stat-label">24H HIGH</div><div className="stat-value c-buy">{fmtUSD(keyLevels?.h24)}</div></div>
              <div className="stat-item"><div className="stat-label">24H LOW</div><div className="stat-value c-sell">{fmtUSD(keyLevels?.l24)}</div></div>
            </div>
          </div>

          {/* P&L Tracker */}
          <div className="panel-card">
            <div className="card-title">💰 Live P&amp;L Tracker</div>
            <PnLTracker
              trades={trades}
              currentPrice={price}
              onSimulateTrade={handleSimulateTrade}
              onCloseTrade={handleCloseTrade}
            />
          </div>

          {/* Alerts */}
          <div className="panel-card">
            <div className="card-title">🚨 Signal Alerts &amp; Confluence</div>
            <AlertsFeed alerts={alerts}/>
          </div>
        </div>

        {/* ── CENTRE (Chart) ── */}
        <div className="chart-area" style={{ display: typeof window !== 'undefined' && window.innerWidth <= 992 && mobileTab !== 'chart' ? 'none' : 'flex' }}>
          <div className="chart-topbar">
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontWeight:700,fontSize:14}}>BTC/USDT Perpetual</span>
              <span style={{fontSize:12,color:'var(--muted)'}}>Delta Exchange</span>
            </div>
            <div className="chart-tabs">
              {['15m','1h'].map(t=>(
                <button key={t} className={`chart-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-embed">
            <iframe
              key={tab}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_btc&symbol=BYBIT%3ABTCUSDT.P&interval=${tvInt}&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=0&saveimage=0&toolbarbg=0d1117&studies=RSI%40tv-basicstudies%1FMACD%40tv-basicstudies&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&locale=en`}
              style={{width:'100%',height:'100%',border:'none'}}
              title="BTC Chart"
              allowFullScreen
            />
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="panel" style={{ display: typeof window !== 'undefined' && window.innerWidth <= 992 && mobileTab !== 'right' ? 'none' : 'flex' }}>

          {/* Overall Sentiment Meter */}
          <div className="panel-card">
            <div className="card-title">🧭 Overall Bitcoin Sentiment Meter</div>
            <OverallSentimentMeter sentiment={overallSentiment}/>
          </div>

          {/* Key Levels */}
          <div className="panel-card">
            <div className="card-title">📐 Key S/R Levels</div>
            <KeyLevels levels={keyLevels} price={price} maxPain={maxPain}/>
          </div>

          {/* Options Expiry Strategy */}
          <div className="panel-card">
            <div className="card-title">💡 Expiry Options Strategy</div>
            <OptionsStrategyCard strategy={optionsStrategy}/>
          </div>

          {/* OI Chart */}
          <div className="panel-card">
            <div className="card-title">⛓️ Options OI (Delta Exchange)</div>
            <OIChart calls={options?.calls||[]} puts={options?.puts||[]}/>
          </div>

          {/* News Sentiment */}
          <div className="panel-card">
            <div className="card-title">🌐 Breaking Crypto News &amp; Flow</div>
            <SentimentWidget sentiment={sentiment}/>
          </div>

        </div>
      </div>
    </div>
  );
}
