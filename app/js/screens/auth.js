/* Sign-in screen: pick a name, avatar, gender and country. Phone/Google hooks are documented in docs/DEPLOYMENT.md */
(function () {
  const { esc, I, avatar, toast, sheet } = UI;
  const C = () => CF.catalog;

  Screens.auth = {
    nav: false,
    render(root) {
      let seed = 'u' + Math.random().toString(36).slice(2, 8); let gender = 'f'; let country = 'IN';
      root.innerHTML = `
        <div class="screen-body auth">
          <div class="brand"><img src="assets/logo.svg" alt=""><span class="word">Classic Friends</span></div>
          <h1>Pull up a mic.</h1>
          <p class="lead">Voice rooms, gifts and new friends — every night. Tell us what to call you.</p>
          <div class="avatar-picker">
            <span id="av">${avatar({ avatar: seed, gender }, 'xl')}</span>
            <div class="col"><div style="font-weight:700">Your avatar</div><div class="muted" style="font-size:13px">Tap shuffle until you like it</div><button class="btn sm mt-2" id="shuffle">${I.shuffle} Shuffle</button></div>
          </div>
          <div class="field"><label>Name</label><input class="input" id="name" maxlength="24" placeholder="e.g. Priya, Arjun, DJ Rahul" autocomplete="nickname"></div>
          <div class="field"><label>I am</label><div class="gender-pills"><button data-g="f" class="active">👩 Female</button><button data-g="m">👨 Male</button></div></div>
          <div class="field"><label>Country</label><select class="input" id="country">${C().COUNTRIES.map(c => `<option value="${c.code}" ${c.code === country ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('')}</select></div>
          <button class="btn primary block" id="go" style="height:52px;font-size:17px">Start talking</button>
          <div class="alt"><button class="btn ghost" data-alt="phone">📱 Phone</button><button class="btn ghost" data-alt="google">G Google</button></div>
          <p class="legal">By continuing you agree to the <a href="site/terms.html" target="_blank"><u>Terms</u></a> and <a href="site/privacy.html" target="_blank"><u>Privacy Policy</u></a>. Be kind — rooms are moderated.</p>
        </div>`;
      const av = root.querySelector('#av');
      root.querySelector('#shuffle').onclick = () => { seed = 'u' + Math.random().toString(36).slice(2, 8); av.innerHTML = avatar({ avatar: seed, gender }, 'xl'); UI.haptic(); };
      root.querySelector('.gender-pills').onclick = e => { const b = e.target.closest('button'); if (!b) return; gender = b.dataset.g; root.querySelectorAll('.gender-pills button').forEach(x => x.classList.toggle('active', x === b)); av.innerHTML = avatar({ avatar: seed, gender }, 'xl'); };
      root.querySelector('.alt').onclick = e => { const b = e.target.closest('button'); if (b) toast('Connect ' + (b.dataset.alt === 'phone' ? 'OTP' : 'Google') + ' sign-in in production — see docs/DEPLOYMENT.md', '', 3000); };
      const go = async () => {
        const name = root.querySelector('#name').value.trim(); if (!name) { toast('Please enter a name'); root.querySelector('#name').focus(); return; }
        country = root.querySelector('#country').value; const btn = root.querySelector('#go'); btn.disabled = true; btn.textContent = 'Connecting…';
        try { await App.login({ name, gender, country, avatarSeed: seed }); } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Start talking'; }
      };
      root.querySelector('#go').onclick = go;
      root.querySelector('#name').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      setTimeout(() => root.querySelector('#name').focus(), 300);
    }
  };
})();
