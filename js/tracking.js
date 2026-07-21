/* ==========================================================================
   GLOBAL NETWORK TRANSIT — tracking page logic
   Demo-only: generates placeholder shipment records client-side.
   No backend, no real carrier data. Swap generateShipment() for a real
   API call when ready.
   ========================================================================== */

(function(){

  // ---------------------------------------------------------------- data

  // China origin hubs GNT picks up from.
  const ORIGINS = [
    { label: "Shenzhen, Guangdong, China", lat: 22.5431, lng: 114.0579 },
    { label: "Guangzhou, Guangdong, China", lat: 23.1291, lng: 113.2644 },
    { label: "Ningbo, Zhejiang, China",     lat: 29.8683, lng: 121.5440 },
    { label: "Shanghai, China",             lat: 31.2304, lng: 121.4737 },
    { label: "Yiwu, Zhejiang, China",       lat: 29.3060, lng: 120.0757 }
  ];

  // Small curated lookup so a typed address can be placed on the map
  // without needing a live geocoding API. Matched by substring, case-insensitive.
  // "for now on any region" — extend this list as real regions are needed.
  const CITY_LOOKUP = [
    { keys:["new york","nyc"], label:"New York, NY, USA", lat:40.7128, lng:-74.0060 },
    { keys:["los angeles","la, ca"], label:"Los Angeles, CA, USA", lat:34.0522, lng:-118.2437 },
    { keys:["chicago"], label:"Chicago, IL, USA", lat:41.8781, lng:-87.6298 },
    { keys:["houston"], label:"Houston, TX, USA", lat:29.7604, lng:-95.3698 },
    { keys:["austin"], label:"Austin, TX, USA", lat:30.2672, lng:-97.7431 },
    { keys:["dallas"], label:"Dallas, TX, USA", lat:32.7767, lng:-96.7970 },
    { keys:["miami"], label:"Miami, FL, USA", lat:25.7617, lng:-80.1918 },
    { keys:["newark","new jersey", "nj"], label:"Newark, NJ, USA", lat:40.7357, lng:-74.1724 },
    { keys:["seattle"], label:"Seattle, WA, USA", lat:47.6062, lng:-122.3321 },
    { keys:["san francisco","bay area"], label:"San Francisco, CA, USA", lat:37.7749, lng:-122.4194 },
    { keys:["toronto"], label:"Toronto, ON, Canada", lat:43.6532, lng:-79.3832 },
    { keys:["vancouver"], label:"Vancouver, BC, Canada", lat:49.2827, lng:-123.1207 },
    { keys:["mexico city"], label:"Mexico City, Mexico", lat:19.4326, lng:-99.1332 },
    { keys:["london","uk","united kingdom"], label:"London, United Kingdom", lat:51.5072, lng:-0.1276 },
    { keys:["manchester"], label:"Manchester, United Kingdom", lat:53.4808, lng:-2.2426 },
    { keys:["paris","france"], label:"Paris, France", lat:48.8566, lng:2.3522 },
    { keys:["berlin","germany"], label:"Berlin, Germany", lat:52.5200, lng:13.4050 },
    { keys:["madrid","spain"], label:"Madrid, Spain", lat:40.4168, lng:-3.7038 },
    { keys:["rome","italy"], label:"Rome, Italy", lat:41.9028, lng:12.4964 },
    { keys:["amsterdam","netherlands"], label:"Amsterdam, Netherlands", lat:52.3676, lng:4.9041 },
    { keys:["dublin","ireland"], label:"Dublin, Ireland", lat:53.3498, lng:-6.2603 },
    { keys:["lagos"], label:"Lagos, Nigeria", lat:6.5244, lng:3.3792 },
    { keys:["nairobi","kenya"], label:"Nairobi, Kenya", lat:-1.2921, lng:36.8219 },
    { keys:["johannesburg","south africa"], label:"Johannesburg, South Africa", lat:-26.2041, lng:28.0473 },
    { keys:["cairo","egypt"], label:"Cairo, Egypt", lat:30.0444, lng:31.2357 },
    { keys:["dubai","uae"], label:"Dubai, United Arab Emirates", lat:25.2048, lng:55.2708 },
    { keys:["riyadh","saudi"], label:"Riyadh, Saudi Arabia", lat:24.7136, lng:46.6753 },
    { keys:["mumbai"], label:"Mumbai, India", lat:19.0760, lng:72.8777 },
    { keys:["delhi"], label:"New Delhi, India", lat:28.6139, lng:77.2090 },
    { keys:["singapore"], label:"Singapore", lat:1.3521, lng:103.8198 },
    { keys:["kuala lumpur","malaysia"], label:"Kuala Lumpur, Malaysia", lat:3.1390, lng:101.6869 },
    { keys:["bangkok","thailand"], label:"Bangkok, Thailand", lat:13.7563, lng:100.5018 },
    { keys:["jakarta","indonesia"], label:"Jakarta, Indonesia", lat:-6.2088, lng:106.8456 },
    { keys:["manila","philippines"], label:"Manila, Philippines", lat:14.5995, lng:120.9842 },
    { keys:["tokyo","japan"], label:"Tokyo, Japan", lat:35.6762, lng:139.6503 },
    { keys:["seoul","korea"], label:"Seoul, South Korea", lat:37.5665, lng:126.9780 },
    { keys:["sydney"], label:"Sydney, Australia", lat:-33.8688, lng:151.2093 },
    { keys:["melbourne"], label:"Melbourne, Australia", lat:-37.8136, lng:144.9631 },
    { keys:["auckland","new zealand"], label:"Auckland, New Zealand", lat:-36.8509, lng:174.7645 },
    { keys:["sao paulo","brazil"], label:"São Paulo, Brazil", lat:-23.5505, lng:-46.6333 },
    { keys:["buenos aires","argentina"], label:"Buenos Aires, Argentina", lat:-34.6037, lng:-58.3816 },
    { keys:["bogota","colombia"], label:"Bogotá, Colombia", lat:4.7110, lng:-74.0721 },
    { keys:["lima","peru"], label:"Lima, Peru", lat:-12.0464, lng:-77.0428 }
  ];

  const DEFAULT_DEST = { label:"destination address on file", lat:39.8283, lng:-98.5795, approximate:true };

  // Pre-seeded demo shipments so the "track existing ID" flow works immediately.
  const shipments = {
    "GNT-4471928-CN": buildShipment("Los Angeles, CA, USA", { daysAgo: 6, stageIndex: 3 }),
    "GNT-8802341-CN": buildShipment("London, United Kingdom", { daysAgo: 2, stageIndex: 1 })
  };

  // ---------------------------------------------------------------- helpers

  function findDestination(text){
    const q = (text || "").toLowerCase().trim();
    for(const c of CITY_LOOKUP){
      if(c.keys.some(k => q.includes(k))){
        return { label: text.trim() || c.label, lat: c.lat, lng: c.lng, matchedLabel: c.label, approximate: false };
      }
    }
    return { label: text.trim() || DEFAULT_DEST.label, lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng, approximate: true };
  }

  function generateTrackingId(){
    let id;
    do {
      const digits = Math.floor(1000000 + Math.random()*8999999);
      id = `GNT-${digits}-CN`;
    } while (shipments[id]);
    return id;
  }

  function fmtDate(d){
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function addDays(base, days){
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Builds a full shipment record: origin, destination, tracking id, and a
  // stage timeline. `opts.stageIndex` controls how far along the shipment is;
  // if omitted, one is picked at random so demo shipments feel alive.
  function buildShipment(destText, opts){
    opts = opts || {};
    const origin = ORIGINS[Math.floor(Math.random()*ORIGINS.length)];
    const destination = findDestination(destText);
    const mode = Math.random() > 0.5 ? "Air Freight" : "Sea Freight";
    const totalTransitDays = mode === "Air Freight" ? 6 : 21;

    const pickupDate = addDays(new Date(), -(opts.daysAgo ?? Math.floor(Math.random()*5)+1));

    const stageDefs = [
      { key:"picked_up",  title:"Picked Up",              desc:`Collected from origin facility in ${origin.label}.` },
      { key:"departed",   title:"Departed Origin Hub",    desc:`Cleared origin customs and departed via ${mode.toLowerCase()}.` },
      { key:"in_transit", title:"In Transit",              desc:`Moving via ${mode.toLowerCase()} toward destination country.` },
      { key:"arrived",    title:"Arrived Destination Country", desc:"Cleared destination customs and entered local network." },
      { key:"out_for_delivery", title:"Out for Delivery",  desc:"Loaded onto final-mile vehicle for delivery." },
      { key:"delivered",  title:"Delivered",               desc:`Delivered to ${destination.label}.` }
    ];

    const stageIndex = opts.stageIndex !== undefined
      ? opts.stageIndex
      : Math.min(4, Math.floor(Math.random()*5)); // rarely auto-generate as fully delivered

    const gapDays = totalTransitDays / (stageDefs.length - 1);
    const stages = stageDefs.map((s, i) => ({
      ...s,
      date: addDays(pickupDate, Math.round(gapDays * i)),
      status: i < stageIndex ? "done" : (i === stageIndex ? "current" : "pending")
    }));

    const eta = addDays(pickupDate, totalTransitDays);
    const isDelivered = stageIndex >= stageDefs.length - 1;

    return {
      id: opts.id || generateTrackingId(),
      origin, destination, mode,
      pickupDate, eta, stages,
      status: isDelivered ? "Delivered" : stages[stageIndex].title
    };
  }

  // ---------------------------------------------------------------- map

  let map, originMarker, destMarker, routeLine;

  function ensureMap(){
    if(map) return;
    map = L.map('trackMap', { zoomControl:true, attributionControl:true }).setView([20,0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function iconFor(color){
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px ${color};"></div>`,
      iconSize: [16,16],
      iconAnchor: [8,8]
    });
  }

  function renderMap(shipment){
    ensureMap();
    if(originMarker) map.removeLayer(originMarker);
    if(destMarker) map.removeLayer(destMarker);
    if(routeLine) map.removeLayer(routeLine);

    originMarker = L.marker([shipment.origin.lat, shipment.origin.lng], { icon: iconFor('#FF5A1F') })
      .addTo(map).bindPopup(`<b>Origin</b><br>${shipment.origin.label}`);
    destMarker = L.marker([shipment.destination.lat, shipment.destination.lng], { icon: iconFor('#1C8A5B') })
      .addTo(map).bindPopup(`<b>Destination</b><br>${shipment.destination.label}`);

    routeLine = L.polyline(
      [[shipment.origin.lat, shipment.origin.lng], [shipment.destination.lat, shipment.destination.lng]],
      { color:'#16395C', weight:3, dashArray:'6 8' }
    ).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding:[48,48] });

    const note = document.getElementById('mapNote');
    note.textContent = shipment.destination.approximate
      ? `Approximate pin — "${shipment.destination.label}" didn't match a known city, showing a placeholder location for this demo.`
      : `Route shown is a straight demo line, not an actual carrier path.`;
  }

  // ---------------------------------------------------------------- render

  function renderResults(shipment){
    document.getElementById('sumId').textContent = shipment.id;
    document.getElementById('sumStatus').textContent = shipment.status;
    document.getElementById('sumOrigin').textContent = shipment.origin.label;
    document.getElementById('sumEta').textContent = fmtDate(shipment.eta);

    const list = document.getElementById('stageList');
    list.innerHTML = '';
    shipment.stages.forEach(stage => {
      const el = document.createElement('div');
      el.className = `stage ${stage.status === 'done' ? 'done' : ''} ${stage.status === 'current' ? 'current' : ''}`.trim();
      el.innerHTML = `
        <div class="stage-top">
          <h4>${stage.title}</h4>
          <time>${stage.status === 'pending' ? 'Pending' : fmtDate(stage.date)}</time>
        </div>
        <p>${stage.desc}</p>`;
      list.appendChild(el);
    });

    document.getElementById('trackResults').classList.add('show');
    document.getElementById('trackError').classList.remove('show');
    renderMap(shipment);
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  // ---------------------------------------------------------------- events

  document.getElementById('trackForm').addEventListener('submit', function(e){
    e.preventDefault();
    const id = document.getElementById('trackId').value.trim().toUpperCase();
    const shipment = shipments[id];
    if(shipment){
      renderResults(shipment);
    } else {
      document.getElementById('trackError').classList.add('show');
      document.getElementById('trackResults').classList.remove('show');
    }
  });

  document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('trackId').value = btn.dataset.demo;
      document.getElementById('trackForm').requestSubmit();
    });
  });

})();