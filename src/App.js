import React, { useState, useRef, useMemo, useEffect } from "react";

export default function App(){
  const [decks, setDecks] = useState([]);
  const [manualText, setManualText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualColor, setManualColor] = useState("#ffffff");
  const [manualColorText, setManualColorText] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("shared");
  const [scrollingDeckId, setScrollingDeckId] = useState(null); // which deck name is auto-scrolling

  const fileInputRef = useRef(null);
  const importRef = useRef(null);
  const scrollRefs = useRef({}); // per-deck name container element
  const scrollAnimRef = useRef(null); // rAF handle

  const makeId = () => `${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`;

  function parseDeckText(text, fallbackName='deck'){
    const deck = { name: fallbackName, cards: {}, colour: '' };
    if (!text) return deck;
    const lines = String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    for (let raw of lines){
      const line = raw.trim();
      if (!line) continue;
      const up = line.toUpperCase();
      if ((up.startsWith('COLOUR') || up.startsWith('COLOR')) && line.includes('=')){
        const rhs = line.split('=')[1] || '';
        const commentIdx = rhs.indexOf('#');
        let val = commentIdx >= 0 ? rhs.slice(0, commentIdx) : rhs;
        val = val.trim();
        if (val) deck.colour = val;
        continue;
      }
      const tokens = line.split(/\s+/);
      const maybeNum = parseInt(tokens[0], 10);
      if (!isNaN(maybeNum) && tokens.length > 1){
        let name = tokens.slice(1).join(' ');
        const pidx = name.indexOf('(');
        if (pidx >= 0) name = name.slice(0, pidx).trim();
        if (name) deck.cards[name] = (deck.cards[name] || 0) + maybeNum;
      }
    }
    return deck;
  }

  function addManualDeck(){
    const parsed = parseDeckText(manualText);
    let name = (manualName||'').trim();
    if (!name){
      const cardKeys = Object.keys(parsed.cards || {});
      if (cardKeys.length) name = cardKeys[0].replace(/\s+/g,'_');
      else name = `deck_${decks.length+1}`;
    }
    let colour = parsed.colour || '';
    if ((!colour || !colour.trim()) && manualColorText && manualColorText.trim()) colour = manualColorText.trim();
    if ((!colour || !colour.trim()) && manualColor) colour = manualColor;

    const newDeck = { id: makeId(), name, cards: parsed.cards, colour, selected: true };
    setDecks(prev => [...prev, newDeck]);
    setManualText(''); setManualName(''); setManualColor('#ffffff'); setManualColorText('');
  }

  async function handleFileChange(e){
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const results = await Promise.all(files.map(async (f) => {
      const txt = await f.text();
      const parsed = parseDeckText(txt);
      // Always use filename (without extension) as deck name
      let name = f.name.replace(/\.[^/.]+$/, '') || `deck_${Date.now()}`;
      let colour = parsed.colour || '';
      if ((!colour || !colour.trim()) && manualColorText && manualColorText.trim()) colour = manualColorText.trim();
      if ((!colour || !colour.trim()) && manualColor) colour = manualColor;
      return { id: makeId(), name, cards: parsed.cards, colour, selected: true };
    }));

    setDecks(prev => [...prev, ...results]);
    if (fileInputRef.current) fileInputRef.current.value = null;
    setManualText('');
  }

  function removeDeck(id){ setDecks(prev => prev.filter(d => d.id !== id)); }
  function toggleSelected(id){ setDecks(prev => prev.map(d => d.id===id ? {...d, selected: !d.selected} : d)); }
  function renameDeck(id){
    const d = decks.find(x=>x.id===id);
    if (!d) return;
    const newName = window.prompt('Rename deck', d.name);
    if (!newName || !newName.trim()) return;
    setDecks(prev => prev.map(x=> x.id===id ? {...x, name:newName.trim()} : x));
  }
  function changeDeckColor(id, newColor){ setDecks(prev => prev.map(d => d.id === id ? {...d, colour: newColor} : d)); }

  // Aggregated (selected decks only)
  const aggregated = useMemo(()=>{
    const map = {};
    for (const d of decks){ if (!d.selected) continue; for (const [card,num] of Object.entries(d.cards || {})){ map[card] = map[card] || {}; map[card][d.name] = { number: num, colour: d.colour }; } }
    return map;
  }, [decks]);

  const cardList = useMemo(()=>{
    const q = (search||'').toLowerCase();
    const items = Object.entries(aggregated).filter(([card]) => card.toLowerCase().includes(q));
    if (sortBy === 'alpha') items.sort((a,b)=> a[0].localeCompare(b[0]));
    else if (sortBy === 'decks') items.sort((a,b)=> Object.keys(a[1]).join(',').localeCompare(Object.keys(b[1]).join(',')));
    else items.sort((a,b)=> (Object.keys(b[1]).length - Object.keys(a[1]).length) || a[0].localeCompare(b[0]));
    return items;
  }, [aggregated, search, sortBy]);

  // Stats (only selected decks)
  const totalCards = useMemo(() => decks.filter(d=>d.selected)
    .reduce((sum, deck) => sum + Object.values(deck.cards || {}).reduce((a,b) => a+b, 0), 0), [decks]);
  const cubeMinCards = useMemo(() => {
    const maxPerCard = {};
    for (const deck of decks.filter(d=>d.selected)){
      for (const [card, num] of Object.entries(deck.cards || {})){
        maxPerCard[card] = Math.max(maxPerCard[card] || 0, num);
      }
    }
    return Object.values(maxPerCard).reduce((a,b) => a+b, 0);
  }, [decks]);
  const cubePercent = totalCards ? ((cubeMinCards / totalCards) * 100).toFixed(1) : 0;

  function exportCube(){
    const payload = { decks };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cube.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function handleImportFile(e){
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.decks)){
          const withIds = parsed.decks.map(d => ({ id: makeId(), ...d, selected: d.selected !== false }));
          setDecks(prev => [...prev, ...withIds]);
        } else alert('Invalid import format');
      } catch(e){ alert('Invalid JSON'); }
    };
    reader.readAsText(f);
    if (importRef.current) importRef.current.value = null;
  }

  // Click-to-scroll (marquee) animation for deck names
  useEffect(()=>{
    // stop previous animation
    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    // reset previous scroller position if any
    Object.entries(scrollRefs.current).forEach(([id, el])=>{
      if (!el) return;
      if (!scrollingDeckId || id !== String(scrollingDeckId)) el.scrollLeft = 0;
    });

    if (!scrollingDeckId) return; // nothing to animate

    const el = scrollRefs.current[scrollingDeckId];
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 0) return; // no overflow, nothing to animate

    let pos = 0;
    let direction = 1; // 1 -> right, -1 -> left
    let lastTime = performance.now();
    let pauseUntil = 0; // timestamp to hold during pauses

    const speed = 40; // px/sec (slow)
    const pauseMs = 500; // pause at edges

    const step = (time)=>{
      if (time < pauseUntil){
        scrollAnimRef.current = requestAnimationFrame(step);
        return;
      }
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      pos += direction * speed * dt;

      if (pos >= maxScroll){
        pos = maxScroll;
        direction = -1;
        pauseUntil = time + pauseMs;
      } else if (pos <= 0){
        pos = 0;
        direction = 1;
        pauseUntil = time + pauseMs;
      }

      el.scrollLeft = pos;
      scrollAnimRef.current = requestAnimationFrame(step);
    };

    scrollAnimRef.current = requestAnimationFrame(step);
    return ()=> { if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current); };
  }, [scrollingDeckId]);

  // helper: toggle which deck is scrolling
  const toggleScroll = (id)=>{
    setScrollingDeckId(prev => prev === id ? null : id);
  };

  return (
    <div className="app-root">
      {/* Global styles for layout, responsiveness, and background fill */}
      <style>{`
        html, body, #root { height: 100%; }
        body { margin: 0; background: #223344; }
        .app-root { height: 100%; }
        .app-grid {
          height: 100vh; /* include padding via border-box */
          box-sizing: border-box;
          padding: 16px;
          display: grid;
          gap: 16px;
          /* Desktop/tablet: Decks and Storage are half width of Cards (1:2:1) */
          grid-template-columns: minmax(320px, 1fr) minmax(560px, 2fr) minmax(320px, 1fr);
          background: #223344; /* full-page background */
        }
        /* Mobile: stack widgets */
        @media (max-width: 900px){
          .app-grid { grid-template-columns: 1fr; height: auto; min-height: 100vh; }
          .panel { height: auto; }
        }
        .panel { background:#111; border-radius: 8px; padding: 12px; display:flex; flex-direction:column; height: 100%; min-width: 0; }
        .panel h3 { margin: 0; color: #eee; }
        .input, .select, .textarea { background:#090909; color:#eee; border-radius:6px; padding:8px; box-sizing:border-box; }
        .textarea { width:100%; }
        .row { display:flex; gap:8px; align-items:center; }
        .btn { padding:8px 12px; border:none; border-radius:8px; color:#fff; cursor:pointer; }
        .btn.gray { background:#374151; }
        .btn.blue { background:#2563eb; }
        .btn.green { background:#10b981; }
        .btn.green2 { background:#16a34a; }
        .btn.slate { background:#4b5563; }
        .decks-list { margin-top:12px; flex:1; overflow:auto; }
        .deck-row { display:flex; align-items:center; padding:6px 0; border-bottom:1px solid #0d0d0d; min-width:0; }
        .deck-color { width:18px; height:18px; border:none; padding:0; margin:0 6px; border-radius:6px; background:transparent; }
        /* Name box: fixed width so long names overflow and can be animated; clicking triggers marquee */
        .deck-name { color:#fff; overflow:hidden; white-space:nowrap; cursor:pointer; width:160px; flex:0 0 160px; }
        .deck-actions { margin-left:auto; display:flex; gap:4px; flex-shrink:0; }
        .btn.icon { padding:4px 6px; border-radius:4px; font-size:10px; }

        /* Cards list area fills remaining height; internal scroll only */
        .cards-list { margin-top:12px; flex:1; overflow:auto; }

        /* Search/sort row stays single line and shrinks gracefully */
        .search-sort { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; overflow:hidden; }
        .search-input { min-width: 130px; flex: 1 1 auto; }
        .sort-select { flex: 0 0 auto; }
      `}</style>

      <div className="app-grid">
        {/* Decks */}
        <div className="panel">
          <h3>Decks</h3>
          <div className="row" style={{marginBottom:10}}>
            <button className="btn green" onClick={()=>fileInputRef.current && fileInputRef.current.click()}>Upload Deck(s)</button>
            <input ref={fileInputRef} type="file" accept=".txt" multiple style={{display:'none'}} onChange={handleFileChange} />
          </div>

          <label style={{color:'#bbb',fontSize:13}}>Paste deck text</label>
          <textarea className="textarea" rows={6} value={manualText} onChange={e=>setManualText(e.target.value)} placeholder={'1 Lightning Bolt\n2 Mountain'} />

          <input className="input" value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Deck name (optional)" style={{marginTop:8}} />

          <div className="row" style={{marginTop:8}}>
            <input type="color" value={manualColor} onChange={e=>setManualColor(e.target.value)} />
            <input className="input" value={manualColorText} onChange={e=>setManualColorText(e.target.value)} placeholder="CSS color (name/#hex/rgba)" style={{flex:1}} />
          </div>

          <div className="row" style={{marginTop:10}}>
            <button className="btn blue" onClick={addManualDeck}>Add deck</button>
            <button className="btn gray" onClick={()=>{ setManualText(''); setManualName(''); setManualColor('#ffffff'); setManualColorText(''); }}>Clear</button>
          </div>

          <div className="decks-list">
            {decks.map(d => (
              <div key={d.id} className="deck-row">
                <input type="checkbox" checked={d.selected} onChange={()=>toggleSelected(d.id)} />
                <input
                  type="color"
                  defaultValue={d.colour || '#ffffff'}
                  onBlur={(e)=>changeDeckColor(d.id, e.target.value)}
                  className="deck-color"
                  title="Click to change colour, updates on blur"
                />
                <div
                  ref={el=>{ if (el) scrollRefs.current[d.id] = el; }}
                  className="deck-name"
                  onClick={()=>toggleScroll(d.id)}
                  title="Click to scroll name"
                >{d.name}</div>
                <div className="deck-actions">
                  <button className="btn gray icon" onClick={()=>renameDeck(d.id)}>✎</button>
                  <button className="btn" style={{background:'#ef4444'}} onClick={()=>removeDeck(d.id)}>✖</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="panel">
          <div className="row" style={{justifyContent:'space-between'}}>
            <h3>Cards</h3>
            <div className="search-sort">
              <input className="input search-input" placeholder="Search cards" value={search} onChange={e=>setSearch(e.target.value)} />
              <select className="select sort-select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="shared">Shared (most decks)</option>
                <option value="alpha">Alphabetical</option>
                <option value="decks">Deck list</option>
              </select>
            </div>
          </div>

          <div className="cards-list">
            {cardList.map(([card, info]) => (
              <div key={card} style={{padding:8,borderBottom:'1px solid #0d0d0d'}}>
                <div style={{fontWeight:600,color:'#fff',marginBottom:4}}>{card}</div>
                {/* tags underneath, wrapping; single-line per tag */}
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {Object.entries(info).map(([dname,dinfo]) => (
                    <div key={dname} style={{
                      background:dinfo.colour||'#777', padding:'4px 8px', borderRadius:8, color:'#000', whiteSpace:'nowrap'
                    }}>{dname}: {dinfo.number}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Storage */}
        <div className="panel">
          <div>
            <h3>Storage</h3>
            <div style={{marginTop:8}}>
              <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImportFile} />
              <div className="row">
                <button className="btn green2" onClick={exportCube}>Export JSON</button>
                <button className="btn slate" onClick={()=>importRef.current && importRef.current.click()}>Import JSON</button>
              </div>
            </div>
            <div style={{marginTop:12,color:'#9ca3af',fontSize:13}}>You can export your decks to JSON and re-import them later.</div>
          </div>
          <div style={{marginTop:20,color:'#eee',fontSize:14,textAlign:'right'}}>
            {totalCards} cards total, {cubeMinCards} cards in cube = {cubePercent}%
          </div>
        </div>
      </div>
    </div>
  );
}
