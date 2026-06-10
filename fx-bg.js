(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var container = document.getElementById('bg-fx');
  if (!container) return;

  /* ── 背景照片輪播 ── */
  var stack = container.querySelector('.fx-photo-stack');
  var photoUrls = [
    'images/shop/shop-2.png',
    'images/shop/shop-4.png',
    'images/shop/shop-3.png',
    'images/shop/shop-1.png'
  ];
  var photoIndex = 0;
  var photoEls = [];

  if (stack) {
    photoUrls.forEach(function (url, i) {
      var el = document.createElement('div');
      el.className = 'fx-shop-photo' + (i === 0 ? ' active' : '');
      el.style.backgroundImage = "url('" + url + "')";
      stack.appendChild(el);
      photoEls.push(el);
    });

    if (!reducedMotion && photoEls.length > 1) {
      window.setInterval(function () {
        photoEls[photoIndex].classList.remove('active');
        photoIndex = (photoIndex + 1) % photoEls.length;
        photoEls[photoIndex].classList.add('active');
      }, 10000);
    }
  }

  if (reducedMotion) return;

  /* ── 餘燼粒子 ── */
  var canvas = container.querySelector('.fx-embers-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var particles = [];
  var count = window.innerWidth < 640 ? 28 : 48;
  var w = 0;
  var h = 0;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function spawn() {
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: h + Math.random() * h * 0.3,
        r: Math.random() * 1.8 + 0.4,
        vy: -(Math.random() * 0.35 + 0.15),
        vx: (Math.random() - 0.5) * 0.25,
        life: Math.random(),
        hue: Math.random() > 0.65 ? 28 : 16
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx + Math.sin(p.life * 6) * 0.08;
      p.y += p.vy;
      p.life += 0.004;

      var alpha = Math.sin(p.life * Math.PI) * 0.55;
      if (alpha <= 0 || p.y < -10) {
        p.x = Math.random() * w;
        p.y = h + Math.random() * 40;
        p.life = 0;
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + p.hue + ', 85%, 58%, ' + alpha + ')';
      ctx.fill();

      if (p.r > 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue + ', 90%, 50%, ' + (alpha * 0.15) + ')';
        ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  }

  resize();
  spawn();
  tick();
  window.addEventListener('resize', function () {
    resize();
    spawn();
  });
})();
