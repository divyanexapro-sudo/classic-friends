/* ============================================================
   Classic Friends voice engine (WebRTC mesh)
   Rule: whoever is on a mic seat ("speaker") opens a one-way audio
   connection to every other person in the room.
   A listener asks each speaker for audio ({ want }) when it enters a room,
   re-syncs after a refresh/reconnect, or loses a connection; the speaker
   answers by (re)creating its connection. Every offer carries a session id
   (sid) so late candidates from a replaced connection are ignored.
   Signaling goes through the server (rtc:signal). ICE servers (STUN/TURN)
   come from the server at login, falling back to CF_CONFIG.STUN.
   For production scale, swap this file for Agora/LiveKit (see docs/ARCHITECTURE.md).
   ============================================================ */
(function () {
  const RETRY_MS = [1500, 4000, 10000];  // listener re-asks a speaker after a failed connection
  const Voice = {
    stream: null, ctx: null, analyser: null, buf: null, loop: null,
    muted: false, speakerMuted: false, active: false, level: 0,
    out: new Map(),                      // peerId → { pc, sid }   (I am speaking to them)
    inn: new Map(),                      // peerId → { pc, audio, sid, queue }   (they speak to me)
    retries: new Map(),                  // peerId → { n, timer }
    onLevel: null,                       // UI callback(level)
    lastSent: 0, lastLevelSent: 0, warmed: false,

    get supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
    ice() {
      const fromServer = window.Net && window.Net.iceServers;
      return { iceServers: fromServer && fromServer.length ? fromServer : (window.CF_CONFIG.STUN || []).map(u => ({ urls: u })) };
    },
    // The first RTCPeerConnection in a page initialises the browser's WebRTC stack, which can block
    // the main thread for 1–4 s (measured in Chrome/Edge, with or without ICE servers); later ones take ~2 ms.
    // The first offer/answer also spends ~2 s (async) setting up audio codecs, so run one local exchange too.
    // Pay all of that once behind the splash screen instead of in the middle of joining a room.
    warmup() {
      if (this.warmed || typeof RTCPeerConnection === 'undefined') return; this.warmed = true;
      setTimeout(async () => {   // let the splash paint first
        let a, b;
        try {
          a = new RTCPeerConnection(); b = new RTCPeerConnection(); a.addTransceiver('audio', { direction: 'sendonly' });
          await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription);
          await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription);
        } catch (e) { console.warn('voice warmup', e); }
        try { a && a.close(); b && b.close(); } catch (e) { }
      }, 50);
    },

    /* ---------- microphone ---------- */
    async start() {
      if (this.stream) return true;
      if (!this.supported) throw new Error('Microphone is not available in this browser');
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      this.active = true; this.muted = false;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        const src = this.ctx.createMediaStreamSource(this.stream);
        this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = .6;
        src.connect(this.analyser); this.buf = new Uint8Array(this.analyser.fftSize);
        this.loop = setInterval(() => this.tickLevel(), 90);
      } catch (e) { console.warn('analyser unavailable', e); }
      return true;
    },
    stop() {
      this.active = false;
      if (this.loop) { clearInterval(this.loop); this.loop = null; }
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      this.analyser = null; this.setLevel(0, true);
      for (const id of [...this.out.keys()]) this.closeOut(id);   // tell listeners right away instead of waiting for ICE to time out
    },
    setMuted(m) { this.muted = !!m; if (this.stream) this.stream.getAudioTracks().forEach(t => { t.enabled = !this.muted; }); if (this.muted) this.setLevel(0, true); },
    setSpeakerMuted(m) { this.speakerMuted = !!m; for (const { audio } of this.inn.values()) audio.muted = this.speakerMuted; },
    tickLevel() {
      if (!this.analyser || this.muted) return;
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0; for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / this.buf.length); const level = Math.min(1, Math.max(0, (rms - 0.015) * 6));
      this.setLevel(level);
    },
    setLevel(level, force) {
      this.level = level; this.onLevel && this.onLevel(level);
      const now = Date.now(); const speakingNow = level > 0.08, speakingBefore = this.lastLevelSent > 0.08;
      if (force || (now - this.lastSent > 280 && (speakingNow || speakingBefore))) { this.lastSent = now; this.lastLevelSent = level; window.Net && window.Net.act('speaking', { level: speakingNow ? level : 0 }); }
    },

    /* ---------- mesh ---------- */
    myId() { return window.Net && window.Net.myId; },
    live() { return !!(window.Net && window.Net.mode === 'live'); },
    channel(a, b) { return a + '>' + b; },
    newSid() { return Math.random().toString(36).slice(2, 10); },
    connectToAll(memberIds) { if (!this.live() || !this.stream) return; for (const id of memberIds) this.createOut(id); },
    async createOut(peerId) {
      if (!this.stream || this.out.has(peerId) || !this.live() || peerId === this.myId()) return;
      const sid = this.newSid(); const pc = new RTCPeerConnection(this.ice()); const o = { pc, sid }; this.out.set(peerId, o);
      const ch = this.channel(this.myId(), peerId);
      this.stream.getAudioTracks().forEach(t => pc.addTrack(t, this.stream));
      pc.onicecandidate = e => { if (e.candidate && this.out.get(peerId) === o) window.Net.signal(peerId, { candidate: e.candidate, sid }, ch); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && this.out.get(peerId) === o) this.closeOut(peerId); };
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: false }); await pc.setLocalDescription(offer);
        if (this.out.get(peerId) === o) window.Net.signal(peerId, { sdp: pc.localDescription, sid }, ch);
      } catch (e) { console.warn('offer failed', e); if (this.out.get(peerId) === o) this.closeOut(peerId); }
    },
    // silent: the peer already knows (it left, or it asked for a fresh connection) — don't send bye
    closeOut(peerId, silent) {
      const o = this.out.get(peerId); if (!o) return; this.out.delete(peerId); try { o.pc.close(); } catch (e) { }
      if (!silent && window.Net) window.Net.signal(peerId, { bye: true, sid: o.sid }, this.channel(this.myId(), peerId));
    },
    closeIn(peerId) { const x = this.inn.get(peerId); if (!x) return; this.inn.delete(peerId); try { x.pc.close(); } catch (e) { } try { x.audio.srcObject = null; x.audio.remove(); } catch (e) { } },
    onMemberLeft(peerId) { this.closeOut(peerId, true); this.closeIn(peerId); this.cancelRetry(peerId); },
    leaveRoom() { this.stop(); for (const id of [...this.inn.keys()]) this.closeIn(id); for (const id of [...this.retries.keys()]) this.cancelRetry(id); },

    /* ---------- listener side: ask speakers for audio ---------- */
    // speakerIds: everyone currently on a mic seat. Drops connections to people no longer speaking.
    requestAudio(speakerIds) {
      if (!this.live()) return; const me = this.myId(); const want = new Set(speakerIds.filter(id => id && id !== me));
      for (const id of [...this.inn.keys()]) if (!want.has(id)) this.closeIn(id);
      for (const id of want) this.ask(id);
    },
    ask(peerId) { if (this.live() && peerId !== this.myId()) window.Net.signal(peerId, { want: true }, this.channel(peerId, this.myId())); },
    // connection to a speaker died: ask again with backoff while they are still on a mic
    scheduleRetry(peerId) {
      const r = this.retries.get(peerId) || { n: 0, timer: null }; if (r.timer || r.n >= RETRY_MS.length) return;
      r.timer = setTimeout(() => {
        r.timer = null; r.n++;
        const room = window.S && window.S.room; const seated = room && room.seats.some(s => s.user && s.user.id === peerId);
        if (seated && !this.inn.has(peerId)) this.ask(peerId);
      }, RETRY_MS[r.n]);
      this.retries.set(peerId, r);
    },
    cancelRetry(peerId) { const r = this.retries.get(peerId); if (r && r.timer) clearTimeout(r.timer); this.retries.delete(peerId); },

    async handleSignal(msg) {
      const { from, data, channel } = msg || {}; if (!data || !channel || !from) return;
      const me = this.myId(); const iAmSender = channel === this.channel(me, from);
      if (!iAmSender && channel !== this.channel(from, me)) return;
      if (iAmSender) {  // messages about my outbound connection to `from`
        if (data.want) {  // listener wants (fresh) audio from me
          if (!this.active || !this.stream) return;
          this.closeOut(from, true); this.createOut(from); return;
        }
        const o = this.out.get(from); if (!o || (data.sid && data.sid !== o.sid)) return;
        if (data.bye) { this.closeOut(from, true); return; }
        try { if (data.sdp) await o.pc.setRemoteDescription(data.sdp); else if (data.candidate) await o.pc.addIceCandidate(data.candidate); } catch (e) { console.warn('out signal', e); }
        return;
      }
      // inbound: `from` is a speaker sending to me
      let x = this.inn.get(from);
      if (data.bye) { if (x && (!data.sid || data.sid === x.sid)) this.closeIn(from); return; }
      if (data.sdp && data.sdp.type === 'offer') {
        if (x) this.closeIn(from);
        const sid = data.sid; const pc = new RTCPeerConnection(this.ice()); const audio = document.createElement('audio'); audio.autoplay = true; audio.playsInline = true; audio.muted = this.speakerMuted; audio.dataset.peer = from; document.body.appendChild(audio);
        x = { pc, audio, sid, queue: [] }; this.inn.set(from, x); const mine = x;
        pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(() => { window.UI && window.UI.toast('Tap the speaker button to hear the room'); }); };
        pc.onicecandidate = e => { if (e.candidate && this.inn.get(from) === mine) window.Net.signal(from, { candidate: e.candidate, sid }, channel); };
        pc.onconnectionstatechange = () => {
          const st = pc.connectionState;
          if (st === 'connected') { this.cancelRetry(from); return; }
          if (st === 'failed' || st === 'disconnected') setTimeout(() => {
            if (this.inn.get(from) !== mine || !['failed', 'disconnected'].includes(pc.connectionState)) return;
            this.closeIn(from); this.scheduleRetry(from);
          }, st === 'failed' ? 0 : 3000);
        };
        try {
          await pc.setRemoteDescription(data.sdp); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          if (this.inn.get(from) !== mine) return;
          window.Net.signal(from, { sdp: pc.localDescription, sid }, channel);
          for (const c of mine.queue) await pc.addIceCandidate(c).catch(() => { }); mine.queue = [];
        } catch (e) { console.warn('answer failed', e); if (this.inn.get(from) === mine) { this.closeIn(from); this.scheduleRetry(from); } }
      } else if (data.candidate) {
        if (!x || (data.sid && data.sid !== x.sid)) return;
        if (x.pc.remoteDescription) x.pc.addIceCandidate(data.candidate).catch(() => { }); else x.queue.push(data.candidate);
      }
    },
    resumeAudio() { for (const { audio } of this.inn.values()) audio.play().catch(() => { }); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  };
  window.Voice = Voice;
})();
