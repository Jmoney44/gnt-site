/* ==========================================================================
   GLOBAL NETWORK TRANSIT — tracking page logic
   Live shipment data comes from a Google Apps Script Web App bound to the
   "GNT Shipment Tracking" sheet (see Code.gs). Staff update a row's Status
   cell directly in the sheet; this page fetches that row live — no cache
   delay, unlike the old "publish to web" CSV approach.

   ---------------------------------------------------------------- SETUP ---
   1. Deploy Code.gs as a Web App (see instructions at the top of that
      file) and paste the resulting URL below as APPS_SCRIPT_URL.
   2. Status in the sheet must be exactly one of (case-insensitive):
        Picked Up | Departed Origin Hub | In Transit |
        Arrived Destination Country | Out For Delivery | Delivered
   ========================================================================== */

const APPS_SCRIPT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaKPAwjkfkEbbTyqS5jwQhq9VrBH59aGjoJNemMqDxUYe131Va0zi4FDBLM_KxeUeMtC_pu7doH7GN/pub?output=csv";

(function(){

  const STAGE_ORDER = [
    { key:"picked_up",        title:"Picked Up",                                  match:"picked up",                                   desc:"Collected from the origin facility." },
    { key:"departed",         title:"Departed Origin Hub",                        match:"departed origin hub",                         desc:"Cleared origin customs and departed." },
    { key:"in_transit",       title:"In Transit",                                 match:"in transit",                                  desc:"Moving toward the destination country." },
    { key:"arrived",          title:"Arrived Destination Country",                match:"arrived destination country",                 desc:"Cleared destination customs and entered local network." },
    { key:"held_customs",     title:"Held at Customs — Awaiting Duty Payment",    match:"held at customs — awaiting duty payment",     desc:"Customs has placed the package on hold pending duty payment. Contact us for the invoice." },
    { key:"out_for_delivery", title:"Out for Delivery",                           match:"out for delivery",                            desc:"Loaded onto final-mile vehicle for delivery." },
    { key:"delivered",        title:"Delivered",                                  match:"delivered",                                   desc:"Delivered to the recipient." }
  ];

  // Local fallback demo shipments — work even before Apps Script is deployed,
  // so the page never looks broken during setup, and so sales demos always work.
  const DEMO_SHIPMENTS = {
    "GNT-4471928-CN": {
      id:"GNT-4471928-CN", reference:"DEMO-REF-001", serviceType:"Air Freight",
      status:"In Transit",
      origin:{ label:"Shenzhen, Guangdong, China", lat:22.5431, lng:114.0579 },
      current:{ label:"Dubai International Hub, UAE", lat:25.2532, lng:55.3657 },
      destination:{ label:"Los Angeles, CA, USA", lat:34.0522, lng:-118.2437 },
      eta:"2026-07-30", lastUpdated:"2026-07-20", note:""
    },
    "GNT-8802341-CN": {
      id:"GNT-8802341-CN", reference:"DEMO-REF-002", serviceType:"Sea Freight",
      status:"Out For Delivery",
      origin:{ label:"Ningbo, Zhejiang, China", lat:29.8683, lng:121.5440 },
      current:{ label:"London Local Delivery Hub, UK", lat:51.4700, lng:-0.1200 },
      destination:{ label:"London, United Kingdom", lat:51.5072, lng:-0.1276 },
      eta:"2026-07-24", lastUpdated:"2026-07-21", note:""
    }
  };

  let lastLookupId = null;
  let autoRefreshTimer = null;

  // ---------------------------------------------------------------- helpers

  function stageIndexFor(statusText){
    const q = (statusText || "").trim().toLowerCase();
    const idx = STAGE_ORDER.findIndex(s => s.match === q);
    return idx === -1 ? 0 : idx;
  }

  function num(v){
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function rowToShipment(row){
    const origin = { label: row.OriginLabel || "Origin facility", lat: num(row.OriginLat), lng: num(row.OriginLng) };
    const current = { label: row.CurrentLabel || row.OriginLabel || "In transit", lat: num(row.CurrentLat) ?? origin.lat, lng: num(row.CurrentLng) ?? origin.lng };
    const destination = { label: row.Destination || "Destination address", lat: num(row.DestLat), lng: num(row.DestLng) };
    return {
      id: (row.TrackingNumber || "").trim(),
      reference: row.Reference || "",
      serviceType: row.ServiceType || "",
      status: row.Status || "Picked Up",
      origin, current, destination,
      eta: row.EstimatedDelivery || "",
      lastUpdated: row.LastUpdated || "",
      note: row.Note || ""
    };
  }

  // Fetches the live row for one tracking ID from the Apps Script endpoint.
  function fetchFromAppsScript(trackingId){
    if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PASTE_YOUR") === 0){
      return Promise.reject(new Error("Apps Script URL not configured yet"));
    }
    const url = APPS_SCRIPT_URL + "?id=" + encodeURIComponent(trackingId.trim());
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        if(!data.success) return null;
        return rowToShipment(data.shipment);
      });
  }

  function findShipment(trackingId){
    const id = trackingId.trim().toUpperCase();
    if(DEMO_SHIPMENTS[id]) return Promise.resolve(DEMO_SHIPMENTS[id]);
    return fetchFromAppsScript(trackingId).catch(err => {
      console.error("GNT tracking: lookup failed for", trackingId, "—", err);
      return null;
    });
  }

  function fmtDate(str){
    if(!str) return "—";
    const d = new Date(str);
    if(isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function addStageRow(list, title, desc, statusClass){
    const el = document.createElement('div');
    el.className = `stage ${statusClass === 'done' ? 'done' : ''} ${statusClass === 'current' ? 'current' : ''}`.trim();
    el.innerHTML = `
      <div class="stage-top">
        <h4>${title}</h4>
        <time>${statusClass === 'pending' ? 'Pending' : ''}</time>
      </div>
      <p>${desc}</p>`;
    list.appendChild(el);
  }

  // ---------------------------------------------------------------- map

  let map, originMarker, currentMarker, destMarker, traveledLine, remainingLine;

  function ensureMap(){
    if(map) return;
    map = L.map('trackMap', { zoomControl:true, attributionControl:true }).setView([20,0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function iconFor(color, pulse){
    if(pulse){
      return L.divIcon({
        className: '',
        html: `<div class="pulse-dot" style="background:${color};"></div>`,
        iconSize: [14,14], iconAnchor: [7,7]
      });
    }
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px ${color};"></div>`,
      iconSize: [16,16], iconAnchor: [8,8]
    });
  }

  function renderMap(shipment){
    ensureMap();
    [originMarker, currentMarker, destMarker, traveledLine, remainingLine].forEach(l => { if(l) map.removeLayer(l); });

    const hasOrigin = shipment.origin.lat != null && shipment.origin.lng != null;
    const hasCurrent = shipment.current.lat != null && shipment.current.lng != null;
    const hasDest = shipment.destination.lat != null && shipment.destination.lng != null;

    const bounds = [];

    if(hasOrigin){
      originMarker = L.marker([shipment.origin.lat, shipment.origin.lng], { icon: iconFor('#FF5A1F') })
        .addTo(map).bindPopup(`<b>Origin</b><br>${shipment.origin.label}`);
      bounds.push([shipment.origin.lat, shipment.origin.lng]);
    }
    if(hasCurrent){
      currentMarker = L.marker([shipment.current.lat, shipment.current.lng], { icon: iconFor('#1C8A5B', true) })
        .addTo(map).bindPopup(`<b>Current Location</b><br>${shipment.current.label}`);
      bounds.push([shipment.current.lat, shipment.current.lng]);
    }
    if(hasDest){
      destMarker = L.marker([shipment.destination.lat, shipment.destination.lng], { icon: iconFor('#16395C') })
        .addTo(map).bindPopup(`<b>Destination</b><br>${shipment.destination.label}`);
      bounds.push([shipment.destination.lat, shipment.destination.lng]);
    }

    if(hasOrigin && hasCurrent){
      traveledLine = L.polyline(
        [[shipment.origin.lat, shipment.origin.lng], [shipment.current.lat, shipment.current.lng]],
        { color:'#1C8A5B', weight:3 }
      ).addTo(map);
    }
    if(hasCurrent && hasDest){
      remainingLine = L.polyline(
        [[shipment.current.lat, shipment.current.lng], [shipment.destination.lat, shipment.destination.lng]],
        { color:'#16395C', weight:3, dashArray:'6 8' }
      ).addTo(map);
    }

    if(bounds.length > 1){
      map.fitBounds(bounds, { padding:[48,48] });
    } else if(bounds.length === 1){
      map.setView(bounds[0], 5);
    }

    document.getElementById('mapNote').textContent = shipment.lastUpdated
      ? `Last updated ${fmtDate(shipment.lastUpdated)}`
      : '';
  }

  // ---------------------------------------------------------------- render

  function renderResults(shipment){
    document.getElementById('sumId').textContent = shipment.id;
    document.getElementById('sumStatus').textContent = shipment.status;
    document.getElementById('sumOrigin').textContent = shipment.origin.label;
    document.getElementById('sumCurrent').textContent = shipment.current.label;
    document.getElementById('sumEta').textContent = fmtDate(shipment.eta);

    const currentIdx = stageIndexFor(shipment.status);
    const list = document.getElementById('stageList');
    list.innerHTML = '';

    addStageRow(list, "Picked Up", "Collected from the origin facility.",
      currentIdx === 0 ? 'current' : (currentIdx > 0 ? 'done' : 'pending'));

    addStageRow(list, "Departed Origin Hub", "Cleared origin customs and departed.",
      currentIdx === 1 ? 'current' : (currentIdx > 1 ? 'done' : 'pending'));

    if(currentIdx > 1){
      const stage = STAGE_ORDER[currentIdx];
      const desc = stage.desc + (shipment.note ? ' — ' + shipment.note : '');
      addStageRow(list, stage.title, desc, 'current');
    } else {
      addStageRow(list, "Next Update", "We'll update this once the shipment moves further.", 'pending');
    }

    document.getElementById('trackResults').classList.add('show');
    document.getElementById('trackError').classList.remove('show');
    renderMap(shipment);
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function showError(){
    document.getElementById('trackError').classList.add('show');
    document.getElementById('trackResults').classList.remove('show');
  }

  function lookupAndRender(id, isRefresh){
    const refreshBtn = document.getElementById('refreshBtn');
    if(isRefresh) refreshBtn.classList.add('spinning');
    findShipment(id).then(shipment => {
      if(isRefresh) refreshBtn.classList.remove('spinning');
      if(shipment){
        lastLookupId = id;
        renderResults(shipment);
      } else if(!isRefresh){
        showError();
      }
    }).catch(() => {
      if(isRefresh) refreshBtn.classList.remove('spinning');
      if(!isRefresh) showError();
    });
  }

  // ---------------------------------------------------------------- events

  document.getElementById('trackForm').addEventListener('submit', function(e){
    e.preventDefault();
    const id = document.getElementById('trackId').value.trim();
    if(!id) return;
    lookupAndRender(id, false);

    if(autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      if(lastLookupId) lookupAndRender(lastLookupId, true);
    }, 60000);
  });

  document.getElementById('refreshBtn').addEventListener('click', function(){
    if(lastLookupId) lookupAndRender(lastLookupId, true);
  });

  document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('trackId').value = btn.dataset.demo;
      document.getElementById('trackForm').requestSubmit();
    });
  });

  // If the page loads with ?id=GNT-xxxx-CN in the URL (e.g. linked from the
  // shipment request confirmation), auto-fill and look it up.
  const params = new URLSearchParams(window.location.search);
  const prefillId = params.get('id');
  if(prefillId){
    document.getElementById('trackId').value = prefillId;
    document.getElementById('trackForm').requestSubmit();
  }

})();