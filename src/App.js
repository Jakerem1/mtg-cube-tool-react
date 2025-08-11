import React, { useState, useRef, useMemo } from "react";

// mtg-cube-react — fixed version
// - Remove button bug fixed (removes by stable id)
// - Each deck has a selection checkbox (default: selected) to include/exclude it from cube aggregation
// - Upload uses a visible button; multiple .txt files create one deck per file
// - Manual paste add resets inputs after adding

export default function App(){
  const [decks, setDecks] = useState([]);
  const [manualText, setManualText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualColor, setManualColor] = useState("#ffffff");
  const [manualColorText, setManualColorText] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("shared");

  const fileInputRef = useRef(null);
  const importRef = useRef(null);

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
      let name = parsed.name && parsed.name !== 'deck' ? parsed.name : '';
      if (!name){
        const firstCard = Object.keys(parsed.cards || {})[0];
        if (firstCard) name = firstCard.replace(/\s+/g,'_');
        else name = f.name.replace(/\.[^/.]+$/, '') || `deck_${Date.now()}`;
      }
      let colour = parsed.colour || '';
      if ((!colour || !colour.trim()) && manualColorText && manualColorText.trim()) colour = manualColorText.trim();
      if ((!colour || !colour.trim()) && manualColor) colour = manualColor;
      return { id: makeId(), name, cards: parsed.cards, colour, selected: true };
    }));

    setDecks(prev => [...prev, ...results]);
    if (fileInputRef.current) fileInputRef.current.value = null;
    setManualText('');
  }

  function removeDeck(id){
    setDecks(prev => prev.filter(d => d.id !== id));
  }
  function toggleSelected(id){ setDecks(prev => prev.map(d => d.id===id ? {...d, selected: !d.selected} : d)); }
  function renameDeck(id){
    const d = decks.find(x=>x.id===id);
    if (!d) return;
    const newName = window.prompt('Rename deck', d.name);
    if (!newName || !newName.trim()) return;
    setDecks(prev => prev.map(x=> x.id===id ? {...x, name:newName.trim()} : x));
  }

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

  return (
    <div style={{padding:16,display:'grid',gridTemplateColumns:'320px 1fr 320px',gap:16}}>
      <div style={{background:'#111',padding:12,borderRadius:8}}>
        <h3 style={{margin:0,marginBottom:8,color:'#eee'}}>Decks</h3>

        <label style={{color:'#bbb',fontSize:13}}>Paste deck text</label>
        <textarea value={manualText} onChange={e=>setManualText(e.target.value)} rows={6} style={{width:'100%',padding:8,borderRadius:6,background:'#090909',color:'#eee'}} placeholder={'1 Lightning Bolt\n2 Mountain'} />

        <input value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Deck name (optional)" style={{width:'100%',marginTop:8,padding:8,borderRadius:6,background:'#090909',color:'#eee'}} />

        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <input type="color" value={manualColor} onChange={e=>setManualColor(e.target.value)} />
          <input value={manualColorText} onChange={e=>setManualColorText(e.target.value)} placeholder="CSS color (name/#hex/rgba)" style={{flex:1,padding:8,borderRadius:6,background:'#090909',color:'#eee'}} />
        </div>

        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button onClick={addManualDeck} style={{padding:'8px 12px',background:'#2563eb',color:'#fff',border:'none',borderRadius:8}}>Add deck</button>
          <button onClick={()=>fileInputRef.current && fileInputRef.current.click()} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:8}}>Upload Deck(s)</button>
          <input ref={fileInputRef} type="file" accept=".txt" multiple style={{display:'none'}} onChange={handleFileChange} />
          <button onClick={()=>{ setManualText(''); setManualName(''); setManualColor('#ffffff'); setManualColorText(''); }} style={{padding:'8px 12px',background:'#374151',color:'#fff',border:'none',borderRadius:8}}>Clear</button>
        </div>

        <div style={{marginTop:12}}>
          <div style={{color:'#bbb',fontSize:13,marginBottom:6}}>Active Decks (uncheck to exclude)</div>
          <div>
            {decks.map(d => (
              <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #0d0d0d'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" checked={d.selected} onChange={()=>toggleSelected(d.id)} />
                  <div style={{width:18,height:18,background:d.colour||'#fff',borderRadius:6,border:'1px solid #222'}} />
                  <div style={{color:'#fff'}}>{d.name}</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button onClick={()=>renameDeck(d.id)} style={{padding:'6px 8px',background:'#374151',color:'#fff',border:'none',borderRadius:6}}>Rename</button>
                  <button onClick={()=>removeDeck(d.id)} style={{padding:'6px 8px',background:'#ef4444',color:'#fff',border:'none',borderRadius:6}}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{background:'#111',padding:12,borderRadius:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0,color:'#eee'}}>Cards</h3>
          <div>
            <input placeholder="Search cards" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:8,borderRadius:6,background:'#090909',color:'#eee'}} />
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{marginLeft:8,padding:8,borderRadius:6,background:'#090909',color:'#eee'}}>
              <option value="shared">Shared (most decks)</option>
              <option value="alpha">Alphabetical</option>
              <option value="decks">Deck list</option>
            </select>
          </div>
        </div>

        <div style={{marginTop:12, maxHeight:'70vh', overflow:'auto'}}>
          {cardList.map(([card, info]) => (
            <div key={card} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:8,borderBottom:'1px solid #0d0d0d'}}>
              <div>
                <div style={{fontWeight:600,color:'#fff'}}>{card}</div>
                <div style={{color:'#9ca3af',fontSize:13}}>Appears in: {Object.keys(info).map(dn => `${dn} (${info[dn].number})`).join(', ')}</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                {Object.entries(info).map(([dname,dinfo]) => (
                  <div key={dname} style={{background:dinfo.colour||'#777',padding:'4px 8px',borderRadius:8,color:'#000'}}>{dname}: {dinfo.number}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:'#111',padding:12,borderRadius:8}}>
        <h3 style={{margin:0,color:'#eee'}}>Storage</h3>
        <div style={{marginTop:8}}>
          <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImportFile} />
          <div style={{display:'flex',gap:8}}>
            <button onClick={exportCube} style={{padding:'8px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:8}}>Export JSON</button>
            <button onClick={()=>importRef.current && importRef.current.click()} style={{padding:'8px 12px',background:'#4b5563',color:'#fff',border:'none',borderRadius:8}}>Import JSON</button>
          </div>
        </div>

        <div style={{marginTop:12,color:'#9ca3af',fontSize:13}}>You can export your decks to JSON and re-import them later. Selected decks are excluded from cube aggregation when unchecked.</div>
      </div>
    </div>
  );
}
