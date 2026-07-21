/* ==========================================================================
   GLOBAL NETWORK TRANSIT — live support chat widget
   Front-end only for now: messages typed here are handed to our team by
   email (infoglobalnetworktransit@gmail.com) so a real person can reply.
   To make this fully real-time later, swap this file's contents for an
   embed script from a live-chat provider (e.g. Tawk.to, Crisp, WhatsApp
   Business) — the launcher button and panel markup below can stay as-is.
   ========================================================================== */

(function(){

  const SUPPORT_EMAIL = "infoglobalnetworktransit@gmail.com";

  const widgetHTML = `
    <button class="chat-launcher" id="chatLauncher" aria-label="Open live chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="chat-dot"></span>
    </button>

    <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Live support chat">
      <div class="chat-head">
        <div class="chat-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="15" height="11"/><path d="M16 10h4l3 3v5h-7z"/><circle cx="5.5" cy="20" r="1.8"/><circle cx="18.5" cy="20" r="1.8"/></svg>
        </div>
        <div class="chat-head-text">
          <b>GNT Support</b>
          <span><span class="status-dot"></span>Typically replies within minutes</span>
        </div>
        <button class="chat-close" id="chatClose" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="chat-body" id="chatBody">
        <div class="chat-msg from-agent">Hi 👋 you're through to Global Network Transit support. Have a tracking ID, a quote question, or something else?</div>
      </div>

      <div class="chat-quick" id="chatQuick">
        <button type="button" data-q="I'd like a shipping quote">Get a quote</button>
        <button type="button" data-q="I have a question about my tracking ID">Tracking question</button>
        <button type="button" data-q="I'd like to speak to a person">Talk to a person</button>
      </div>

      <form class="chat-input-row" id="chatForm">
        <input type="text" id="chatInput" placeholder="Type a message…" autocomplete="off" required>
        <button type="submit" class="chat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
      <p class="chat-footnote">Messages are sent to our team at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> so a live agent can reply directly.</p>
    </div>
  `;

  document.addEventListener('DOMContentLoaded', function(){
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    const launcher = document.getElementById('chatLauncher');
    const panel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('chatClose');
    const body = document.getElementById('chatBody');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const quick = document.getElementById('chatQuick');

    function addMessage(text, who){
      const el = document.createElement('div');
      el.className = `chat-msg ${who}`;
      el.textContent = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }

    function addSystem(text){
      const el = document.createElement('div');
      el.className = 'chat-msg system';
      el.textContent = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }

    function sendToTeam(message){
      addMessage(message, 'from-user');
      quick.style.display = 'none';
      const subject = encodeURIComponent(`Live chat message from website — Global Network Transit`);
      const bodyText = encodeURIComponent(
        `A visitor sent the following message from the website chat widget:\n\n"${message}"\n\nReply directly to this email to continue the conversation with them.`
      );
      // Hand off to a real inbox so a live agent can pick it up.
      window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${bodyText}`, '_blank');
      addSystem('Handed off to our team — your email app should open so you can send this straight to a live agent.');
    }

    launcher.addEventListener('click', () => {
      panel.classList.add('open');
      launcher.style.display = 'none';
      input.focus();
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('open');
      launcher.style.display = 'flex';
    });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      const msg = input.value.trim();
      if(!msg) return;
      sendToTeam(msg);
      input.value = '';
    });

    quick.querySelectorAll('button[data-q]').forEach(btn => {
      btn.addEventListener('click', () => sendToTeam(btn.dataset.q));
    });
  });

})();
