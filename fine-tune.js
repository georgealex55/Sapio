/* SAPIO UI fine tuning: responsive card modes + stronger Nocturne EROS weighting. */
(() => {
  const realMedia = item => item?.sourceImage || (item?.image && !String(item.image).startsWith('assets/') ? item.image : null);
  const isEros = item => Boolean(item && (item.eros || item.primaryCategory === 'EROS INDEX' || item.categories?.includes('EROS INDEX')));
  const afterDark = () => typeof noct === 'function' && noct();

  if (typeof renderPeeks === 'function') {
    renderPeeks = function () {
      const holder = document.querySelector('#directionPeeks');
      if (holder) holder.replaceChildren();
    };
  }

  if (typeof fscore === 'function') {
    const baseFocusScore = fscore;
    fscore = function (item, focus) {
      const base = baseFocusScore(item, focus);
      if (!afterDark()) return base;
      return base + (isEros(item) ? 240 : 0);
    };
  }

  function sourceLine(item) {
    const names = (item?.sourceNames || []).filter(Boolean).slice(0, 4);
    if (names.length) return names.join(' · ');
    return item?.publisher || 'SAPIO SIGNAL';
  }

  function textCardBody(item, lane) {
    const eros = isEros(item);
    const eyebrow = eros && afterDark() ? 'EROS // AFTER DARK · ADULT CULTURE' : `${item.primaryCategory || 'SIGNAL'} · ${Math.round(age(item.publishedAt))}H · ${item.sources || 1} SOURCES`;
    const summary = item.summary || 'No summary available. Open the preview for the source and full signal context.';
    return `<div class="spatial-body text-card-body">
      <div class="spatial-meta">${esc(eyebrow)}</div>
      <h3>${esc(item.title)}</h3>
      <p class="solo-summary expanded-summary">${esc(summary)}</p>
      <div class="text-card-context">
        <span>${esc(sourceLine(item))}</span>
        <span>${esc(DIR[lane].label)}</span>
      </div>
      <div class="spatial-foot"><span>${saved(item.id) ? '♥ SAVED' : liked(item.id) ? '♥ LIKED' : 'CLICK FOR PREVIEW'}</span><span>SCROLL TO SNAP</span></div>
    </div>`;
  }

  function mixedCardBody(item, lane) {
    const eyebrow = isEros(item) && afterDark() ? 'EROS // AFTER DARK' : `${item.primaryCategory || 'SIGNAL'} · ${Math.round(age(item.publishedAt))}H`;
    return `<div class="spatial-body compact-media-copy">
      <div class="spatial-meta">${esc(eyebrow)}</div>
      <h3>${esc(item.title)}</h3>
      <div class="spatial-foot"><span>${esc(DIR[lane].label)}</span><span>${saved(item.id) ? '♥ SAVED' : liked(item.id) ? '♥ LIKED' : 'PREVIEW'}</span></div>
    </div>`;
  }

  function classifyMedia(cardEl, imageEl) {
    if (!cardEl || !imageEl) return;
    const apply = () => {
      const pixels = imageEl.naturalWidth * imageEl.naturalHeight;
      const large = imageEl.naturalWidth >= 1000 || imageEl.naturalHeight >= 760 || pixels >= 700000;
      cardEl.classList.toggle('image-only-card', large);
      cardEl.classList.toggle('mixed-media-card', !large);
    };
    if (imageEl.complete) apply();
    else imageEl.addEventListener('load', apply, { once: true });
    imageEl.addEventListener('error', () => {
      cardEl.classList.remove('image-only-card', 'mixed-media-card');
      cardEl.classList.add('text-only-card');
      imageEl.closest('.spatial-image')?.remove();
      const item = typeof current === 'function' ? current() : null;
      if (item && !cardEl.querySelector('.text-card-body')) {
        const lane = nearest(ivec(item));
        cardEl.insertAdjacentHTML('beforeend', textCardBody(item, lane));
      }
    }, { once: true });
  }

  if (typeof card === 'function') {
    card = function () {
      const item = current();
      const world = document.querySelector('#spatialWorld');
      const holder = document.querySelector('#directionPeeks');
      if (holder) holder.replaceChildren();
      if (!item) {
        world.innerHTML = '<div class="map-empty">NO FRESH SIGNALS IN THIS CHANNEL</div>';
        return;
      }

      const lane = nearest(ivec(item));
      const offset = OFF[S.dir] || OFF.CENTER;
      const media = realMedia(item);
      const erosClass = isEros(item) ? ' eros-card' : '';

      if (!media) {
        world.innerHTML = `<article class="spatial-card solo snap-enter text-only-card${erosClass}" style="--enter-x:${offset[0]}px;--enter-y:${offset[1]}px" tabindex="0">${textCardBody(item, lane)}</article>`;
      } else {
        world.innerHTML = `<article class="spatial-card solo snap-enter media-candidate${erosClass}" style="--enter-x:${offset[0]}px;--enter-y:${offset[1]}px" tabindex="0">
          <div class="spatial-image responsive-source-image"><img src="${esc(media)}" alt="${esc(item.title)}"><span>${esc(item.stage || 'SIGNAL')}</span></div>
          ${mixedCardBody(item, lane)}
        </article>`;
      }

      const cardEl = world.querySelector('.spatial-card');
      if (!cardEl) return;
      cardEl.onclick = () => preview(item);
      cardEl.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          preview(item);
        }
      };
      if (media) classifyMedia(cardEl, cardEl.querySelector('img'));
    };
  }

  function decorateTimeline() {
    const cards = document.querySelectorAll('.timeline-card[data-id]');
    cards.forEach(el => {
      const item = typeof all === 'function' ? all().find(x => x.id === el.dataset.id) : null;
      const eros = isEros(item);
      el.classList.toggle('eros-card', eros);
      if (eros && afterDark()) {
        const meta = el.querySelector('.meta');
        if (meta && !meta.querySelector('.after-dark-badge')) {
          meta.insertAdjacentHTML('afterbegin', '<span class="after-dark-badge">EROS // AFTER DARK</span>');
        }
      }
    });
    const erosChip = [...document.querySelectorAll('.chip')].find(x => x.dataset.c === 'EROS INDEX');
    if (erosChip && afterDark()) {
      const count = erosChip.querySelector('span')?.textContent || '';
      erosChip.innerHTML = `EROS // AFTER DARK <span>${esc(count)}</span>`;
      erosChip.classList.add('eros-after-dark-chip');
    }
  }

  if (typeof timeline === 'function') {
    const baseTimeline = timeline;
    timeline = function () {
      baseTimeline();
      decorateTimeline();
    };
  }

  if (typeof renderChannels === 'function') {
    const baseChannels = renderChannels;
    renderChannels = function () {
      baseChannels();
      decorateTimeline();
    };
  }

  if (typeof preview === 'function') {
    const basePreview = preview;
    preview = function (item) {
      basePreview(item);
      const panel = document.querySelector('#previewPanel');
      panel?.classList.toggle('eros-preview', isEros(item) && afterDark());
      if (isEros(item) && afterDark()) {
        const meta = document.querySelector('#previewMeta');
        if (meta && !meta.querySelector('.after-dark-badge')) meta.insertAdjacentHTML('afterbegin', '<span class="after-dark-badge">EROS // AFTER DARK</span>');
      }
    };
  }

  queueMicrotask(() => {
    try {
      document.querySelector('#directionPeeks')?.replaceChildren();
      if (typeof renderAll === 'function') renderAll();
      else if (typeof card === 'function') card();
      decorateTimeline();
    } catch {}
  });
})();
