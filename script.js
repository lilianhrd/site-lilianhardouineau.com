'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const filmGallery = $('filmGallery');
  const photoGallery = $('photoGallery');
  const dialogs = {video:$('videoModal'), photo:$('photoLightbox'), about:$('aboutModal')};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const metadataCache = new Map();
  let films = [], series = [], cards = [], view = 'films', filter = 'all';
  let current = null, lastTrigger = null, videoIndex = 0, photoIndex = 0;
  let videoRequest = 0, photoTarget = null, photoTimer = 0, photoStarted = false;
  let beforeDialogScroll = 0;
  let renderingPhoto = false;
  // Each gallery is a browser-history entry; project viewers sit above it.
  const initialView = history.state?.portfolioView === 'photos' ? 'photos' : 'films';
  history.replaceState({portfolioView:initialView, filter:history.state?.filter || 'all', scroll:0}, '');

  function localPath(...parts) {
    return parts.map(part => encodeURIComponent(part)).join('/');
  }
  function parseProjects(text) {
    const [filmText, photoText = ''] = text.split('[PHOTOS]');
    const rows = block => block.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('['));
    films = rows(filmText).map((line, i) => {
      const parts = line.split('/');
      const title = parts.shift().trim(), subtitle = (parts.shift() || '').trim();
      const thumbnail = (parts.shift() || '').trim();
      const preview = /\.mp4$/i.test(parts[0] || '') ? parts.shift().trim() : '';
      const category = (parts.pop() || 'personal').trim();
      const links = parts.join('/').replace(/^carrousel:/, '').split(',').map(l => l.trim()).filter(Boolean);
      if (!title || !thumbnail || !links.length) throw new Error(`Film incomplet, ligne ${i + 1}.`);
      return {id:`film-${i}`, title, subtitle, thumbnail, preview, category, links};
    });
    series = rows(photoText).map((line, i) => {
      const [title, folder, prefix, count, cover, extension] = line.split('|').map(v => v.trim());
      if (!title || !folder || !prefix || !/^(auto|[1-9]\d*)$/i.test(count || '')) throw new Error(`Série photo invalide : ${line}`);
      return {id:`photo-${i}`, title, folder, prefix, count:count.toLowerCase() === 'auto' ? 0 : Number(count), extension:extension || 'JPG', items:null};
    });
  }

  function createFilm(film, originalIndex) {
    const article = document.createElement('article'); article.className = 'film-card';
    const button = document.createElement('button'); button.className = 'film-open'; button.type = 'button';
    button.setAttribute('aria-label', `Play ${film.title}${film.subtitle ? ', ' + film.subtitle : ''}`);
    const media = document.createElement('span'); media.className = 'film-media';
    const image = document.createElement('img');
    image.src = localPath('images', film.thumbnail); image.alt = `${film.title} ${film.subtitle}`.trim();
    image.loading = originalIndex === 0 ? 'eager' : 'lazy'; image.decoding = 'async';
    if (originalIndex === 0) image.fetchPriority = 'high';
    media.append(image);
    if (film.preview) {
      const preview = document.createElement('video'); preview.muted = true; preview.loop = true;
      preview.playsInline = true; preview.preload = 'none'; preview.setAttribute('aria-hidden', 'true');
      media.append(preview);
      let wantsPreview = false;
      let previewIntent = 0;
      const showDecodedFrame = () => {
        const ticket = previewIntent;
        const reveal = () => {
          if (ticket !== previewIntent || !wantsPreview || current) return;
          if (preview.readyState >= 2) button.classList.add('is-preview-playing');
        };
        if (typeof preview.requestVideoFrameCallback === 'function') preview.requestVideoFrameCallback(reveal);
        else reveal();
      };
      const start = () => {
        if (!hover.matches || reduceMotion.matches || current) return;
        wantsPreview = true;
        previewIntent++;
        if (!preview.getAttribute('src')) preview.src = localPath('preview', film.preview);
        preview.play().then(showDecodedFrame).catch(() => {
          button.classList.remove('is-preview-playing');
        });
      };
      const stop = () => {
        wantsPreview = false;
        previewIntent++;
        preview.pause();
        button.classList.remove('is-preview-playing');
      };
      button.addEventListener('pointerenter', start);
      button.addEventListener('pointerleave', stop);
      button.addEventListener('focus', start);
      button.addEventListener('blur', stop);
      preview.addEventListener('error', stop);
      preview.addEventListener('playing', showDecodedFrame);
      // Keep the last decoded video frame during buffering. Do not flash the photo underneath.
    }
    const caption = document.createElement('span'); caption.className = 'film-caption';
    const words = document.createElement('span');
    const title = document.createElement('span'); title.className = 'film-title'; title.textContent = film.title;
    const subtitle = document.createElement('span'); subtitle.className = 'film-subtitle'; subtitle.textContent = film.subtitle;
    words.append(title, subtitle); caption.append(words); button.append(media, caption); article.append(button);
    button.addEventListener('click', () => openProject('video', film, 0, button));
    return article;
  }

  function applyFilter() {
    cards.forEach(({film, element}) => {
      const visible = filter === 'all' || film.category.split('+').includes(filter);
      element.hidden = !visible;
      if (!visible) {
        element.querySelector('video')?.pause(); element.querySelector('button').classList.remove('is-preview-playing');
      }
    });
    document.querySelectorAll('[data-filter]').forEach(button => {
      const on = button.dataset.filter === filter; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on));
    });
  }

  function switchView(nextView, push = false) {
    if (push && nextView !== view) {
      history.replaceState({...history.state, portfolioView:view, filter, scroll:window.scrollY}, '');
      history.pushState({portfolioView:nextView, filter, scroll:0}, '');
    }
    view = nextView;
    filmGallery.hidden = view !== 'films'; photoGallery.hidden = view !== 'photos';
    $('filmToolbar').hidden = view !== 'films';
    document.querySelectorAll('[data-view]').forEach(button => {
      const on = button.dataset.view === view; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on));
    });
    if (view === 'films') applyFilter();
    else loadPhotos();
    document.querySelectorAll('.film-open video').forEach(video => video.pause());
    document.querySelectorAll('.is-preview-playing').forEach(button => button.classList.remove('is-preview-playing'));
  }

  // Fit the complete mobile About content; never substitute an abridged biography.
  let aboutFitFrame = 0;
  function fitAbout() {
    const dialog = dialogs.about;
    if (!dialog.open) return;
    const inner = dialog.querySelector('.about-inner');
    if (!window.matchMedia('(max-width: 600px)').matches) {
      inner.style.removeProperty('--about-fit-font');
      return;
    }
    const available = dialog.clientHeight - 10;
    let low = 5, high = 16;
    const setSize = size => inner.style.setProperty('--about-fit-font', `${size}px`);
    setSize(high);
    if (inner.getBoundingClientRect().height > available) {
      for (let step = 0; step < 12; step++) {
        const size = (low + high) / 2;
        setSize(size);
        if (inner.getBoundingClientRect().height <= available) low = size;
        else high = size;
      }
      setSize(Math.floor(low * 100) / 100);
    }
    dialog.scrollTop = 0;
  }
  function scheduleAboutFit() {
    cancelAnimationFrame(aboutFitFrame);
    aboutFitFrame = requestAnimationFrame(fitAbout);
  }
  document.fonts?.ready.then(scheduleAboutFit);
  window.visualViewport?.addEventListener('resize', scheduleAboutFit);

  function showDialog(kind, project, index, trigger, push) {
    if (current) dismiss();
    beforeDialogScroll = window.scrollY;
    lastTrigger = trigger || document.activeElement;
    current = {kind, project};
    if (push) {
      history.replaceState({...history.state, portfolioView:view, filter, scroll:beforeDialogScroll}, '');
      history.pushState({portfolioView:view, filter, portfolio:kind, id:project?.id, index:index || 0}, '');
    }
    document.querySelectorAll('.film-open video').forEach(video => video.pause());
    dialogs[kind].showModal(); dialogs[kind].scrollTop = 0; document.body.classList.add('dialog-open');
    if (kind === 'about') fitAbout();
  }
  function openProject(kind, project, index = 0, trigger = null, push = true) {
    showDialog(kind, project, index, trigger, push);
    if (kind === 'video') { videoIndex = index; playVideo(); }
    if (kind === 'photo') { photoIndex = index; renderPhotoViewer(); }
  }
  function dismiss() {
    videoRequest++; clearTimeout(photoTimer); photoTarget = null;
    $('videoFrameWrapper').replaceChildren();
    Object.values(dialogs).forEach(dialog => { if (dialog.open) dialog.close(); });
    current = null; document.body.classList.remove('dialog-open');
    lastTrigger?.focus({preventScroll:true});
    window.scrollTo({top:beforeDialogScroll, behavior:'instant'});
  }
  function requestClose() {
    if (history.state?.portfolio) history.back(); else dismiss();
  }
  function storeIndex(index) {
    if (current && history.state?.portfolio) history.replaceState({...history.state, portfolio:current.kind, id:current.project?.id, index}, '');
  }

  function vimeoId(url) { return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]; }
  function embedURL(url) {
    const id = vimeoId(url);
    if (id) {
      const embed = new URL(`https://player.vimeo.com/video/${id}`);
      embed.searchParams.set('autoplay', '1'); embed.searchParams.set('playsinline', '1');
      embed.searchParams.set('dnt', '1');
      const hash = new URL(url).searchParams.get('h') || url.match(/vimeo\.com\/\d+\/([a-zA-Z0-9]+)/)?.[1];
      if (hash) embed.searchParams.set('h', hash);
      return embed.toString();
    }
    const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/)?.[1];
    return youtube ? `https://www.youtube.com/embed/${youtube}?autoplay=1&playsinline=1&rel=0` : null;
  }
  function metadata(url) {
    if (metadataCache.has(url)) return metadataCache.get(url);
    const task = (async () => {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const endpoint = vimeoId(url) ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}` : `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(endpoint, {signal:controller.signal});
        return response.ok ? await response.json() : null;
      } catch { return null; } finally { clearTimeout(timer); }
    })();
    metadataCache.set(url, task); return task;
  }
  async function playVideo() {
    if (current?.kind !== 'video') return;
    const request = ++videoRequest, project = current.project, url = project.links[videoIndex];
    storeIndex(videoIndex);
    $('videoInfoTitle').textContent = project.title; $('videoInfoSubtitle').textContent = project.subtitle;
    $('videoCounter').textContent = `${videoIndex + 1} / ${project.links.length}`;
    const multiple = project.links.length > 1;
    document.querySelector('.video-pagination').hidden = !multiple;
    $('previousVideo').disabled = videoIndex === 0; $('nextVideo').disabled = videoIndex === project.links.length - 1;
    $('videoCreditsDetails').scrollTop = 0;
    $('videoCredits').textContent = 'Loading credits…';
    $('videoVersions').replaceChildren(); $('videoVersions').hidden = !multiple;
    if (multiple) project.links.forEach((link, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'version-button';
      button.classList.toggle('active', i === videoIndex);
      button.setAttribute('aria-label', `Play video ${i + 1}`);
      button.setAttribute('aria-pressed', String(i === videoIndex));
      const image = document.createElement('img');
      const fallback = localPath('images', project.thumbnail);
      image.src = fallback;
      image.alt = `${project.title} — video ${i + 1}`;
      image.width = 96; image.height = 54; image.decoding = 'async';
      image.addEventListener('error', () => {
        if (image.getAttribute('src') !== fallback) image.src = fallback;
      });
      button.append(image);
      metadata(link).then(data => {
        if (!button.isConnected || request !== videoRequest) return;
        if (data?.thumbnail_url) image.src = data.thumbnail_url;
      });
      button.addEventListener('click', () => { videoIndex = i; playVideo(); });
      $('videoVersions').append(button);
      if (i === videoIndex) requestAnimationFrame(() => {
        const strip = $('videoVersions');
        strip.scrollTo({left:Math.max(0, button.offsetLeft - strip.offsetLeft - (strip.clientWidth - button.clientWidth) / 2), behavior:'instant'});
      });
    });
    const wrapper = $('videoFrameWrapper');
    $('videoModal').style.setProperty('--video-ratio', 16 / 9);
    wrapper.style.setProperty('--video-ratio', 16 / 9); wrapper.replaceChildren();
    const src = embedURL(url);
    if (src) {
      const frame = document.createElement('iframe'); frame.src = src; frame.title = `${project.title} — ${project.subtitle}`;
      frame.allow = 'autoplay; fullscreen; picture-in-picture'; frame.allowFullscreen = true; wrapper.append(frame);
    } else {
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Watch film ↗'; wrapper.append(link);
    }
    const data = await metadata(url);
    if (request !== videoRequest || current?.project !== project) return;
    if (data?.width && data?.height) {
      wrapper.style.setProperty('--video-ratio', data.width / data.height);
      $('videoModal').style.setProperty('--video-ratio', data.width / data.height);
    }
    // A carousel shares the main project's credits, as in the original site.
    const creditsData = project.links.length > 1 ? await metadata(project.links[0]) : data;
    if (request !== videoRequest || current?.project !== project) return;
    const description = (creditsData?.description || data?.description || '').trim();
    if (description) $('videoCredits').textContent = description;
    else {
      $('videoCredits').replaceChildren(); const link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'View project and credits on the video platform ↗'; $('videoCredits').append(link);
    }
  }

  function probe(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({src, width:img.naturalWidth, height:img.naturalHeight});
      img.onerror = () => resolve(null); img.src = src;
    });
  }
  function photoPath(s, number, extension = s.extension) { return localPath('photos', s.folder, `${s.prefix}-${number}.${extension}`); }
  async function loadSeries(s) {
    let first;
    for (const extension of [...new Set([s.extension, 'JPG', 'jpg', 'jpeg', 'JPEG', 'webp', 'png', 'PNG'])]) {
      first = await probe(photoPath(s, 1, extension));
      if (first) { s.extension = extension; break; }
    }
    if (!first) throw new Error(`Images introuvables : photos/${s.folder}. Vérifie le préfixe et les majuscules.`);
    const items = [first];
    if (s.count) {
      const rest = await Promise.all(Array.from({length:s.count - 1}, (_, i) => probe(photoPath(s, i + 2))));
      if (rest.some(item => !item)) throw new Error(`Une photo manque dans photos/${s.folder}. Vérifie la numérotation.`);
      items.push(...rest);
    } else {
      for (let i = 2; i <= 200; i++) {
        const item = await probe(photoPath(s, i)); if (!item) break; items.push(item);
      }
    }
    s.items = items;
  }
  async function loadPhotos() {
    if (photoStarted) return; photoStarted = true; photoGallery.replaceChildren();
    if (!series.length) { const p = document.createElement('p'); p.className = 'load-status'; p.textContent = 'No photo series yet.'; photoGallery.append(p); return; }
    const sections = series.map(s => {
      const section = document.createElement('section'); section.className = 'photo-series';
      const status = document.createElement('p'); status.className = 'load-status'; status.textContent = `${s.title} — loading…`;
      section.append(status); photoGallery.append(section); return section;
    });
    await Promise.all(series.map(async (s, i) => {
      try { await loadSeries(s); renderPhotoSeries(s, sections[i]); }
      catch (error) { sections[i].firstChild.textContent = error.message; }
    }));
  }
  function renderPhotoSeries(s, section) {
    section.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'photo-series-head';
    const title = document.createElement('h2'); title.textContent = s.title;
    const count = document.createElement('span'); count.className = 'photo-series-count'; count.textContent = `${s.items.length} photographs`;
    heading.append(title, count);
    const row = document.createElement('div'); row.className = 'photo-series-row';
    const visible = s.items.slice(0, 4); row.style.gridTemplateColumns = visible.map(item => `${item.width / item.height}fr`).join(' ');
    visible.forEach((item, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-tile';
      button.setAttribute('aria-label', `Open ${s.title}, photograph ${i + 1} of ${s.items.length}`);
      const img = document.createElement('img'); img.src = item.src; img.width = item.width; img.height = item.height;
      img.alt = `${s.title} — ${i + 1}`; img.loading = 'lazy'; img.decoding = 'async';
      button.append(img); button.addEventListener('click', () => openProject('photo', s, i, button)); row.append(button);
    });
    section.append(heading, row);
  }
  function renderPhotoViewer() {
    const project = current.project, track = $('photoTrack'), initialIndex = photoIndex;
    renderingPhoto = true;
    track.replaceChildren();
    $('photoHeaderTitle').textContent = project.title;
    const spacer = () => { const element = document.createElement('div'); element.className = 'photo-track-spacer'; element.setAttribute('aria-hidden', 'true'); return element; };
    track.append(spacer());
    project.items.forEach((item, i) => {
      const slide = document.createElement('div'); slide.className = 'photo-slide'; slide.dataset.ratio = item.width / item.height;
      const img = document.createElement('img'); img.src = item.src; img.alt = `${project.title} — ${i + 1}`;
      img.width = item.width; img.height = item.height; img.draggable = false; img.decoding = 'async';
      slide.append(img); slide.addEventListener('click', () => goPhoto(i)); track.append(slide);
    });
    track.append(spacer());
    requestAnimationFrame(() => { sizeSlides(); goPhoto(initialIndex, false); renderingPhoto = false; });
  }
  function sizeSlides() {
    const track = $('photoTrack'), height = track.clientHeight;
    track.querySelectorAll('.photo-slide').forEach(slide => {
      slide.style.width = `${Math.min(window.innerWidth * (window.innerWidth < 600 ? .90 : .82), height * Number(slide.dataset.ratio))}px`;
    });
  }
  function updatePhotoControls() {
    if (current?.kind !== 'photo') return;
    $('photoCounter').textContent = `${String(photoIndex + 1).padStart(2, '0')} / ${String(current.project.items.length).padStart(2, '0')}`;
    $('previousPhoto').disabled = photoIndex === 0; $('nextPhoto').disabled = photoIndex === current.project.items.length - 1;
    storeIndex(photoIndex);
  }
  function goPhoto(index, smooth = true) {
    if (current?.kind !== 'photo') return;
    photoIndex = Math.max(0, Math.min(index, current.project.items.length - 1)); photoTarget = photoIndex;
    const track = $('photoTrack'), slide = track.querySelectorAll('.photo-slide')[photoIndex];
    if (!slide) return;
    track.scrollTo({left:slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2, behavior:smooth && !reduceMotion.matches ? 'smooth' : 'instant'});
    updatePhotoControls();
    clearTimeout(photoTimer); photoTimer = setTimeout(() => { photoTarget = null; }, 600);
  }
  function settlePhoto() {
    if (current?.kind !== 'photo' || renderingPhoto) return;
    photoTarget = null;
    const track = $('photoTrack'), center = track.scrollLeft + track.clientWidth / 2;
    let best = Infinity;
    track.querySelectorAll('.photo-slide').forEach((slide, i) => {
      const distance = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
      if (distance < best) { best = distance; photoIndex = i; }
    });
    updatePhotoControls();
  }

  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { switchView(button.dataset.view, true); window.scrollTo({top:0, behavior:'instant'}); }));
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; applyFilter(); }));
  $('homeLink').addEventListener('click', event => { event.preventDefault(); switchView('films', true); filter = 'all'; applyFilter(); window.scrollTo({top:0, behavior:reduceMotion.matches ? 'instant' : 'smooth'}); });
  $('backToTop').addEventListener('click', () => window.scrollTo({top:0, behavior:reduceMotion.matches ? 'instant' : 'smooth'}));
  $('aboutButton').addEventListener('click', event => openProject('about', null, 0, event.currentTarget));
  ['videoBack', 'videoClose', 'photoBack', 'photoClose', 'aboutClose'].forEach(id => $(id).addEventListener('click', requestClose));
  Object.values(dialogs).forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); }));
  $('previousVideo').addEventListener('click', () => { if (videoIndex > 0) { videoIndex--; playVideo(); } });
  $('nextVideo').addEventListener('click', () => { if (videoIndex < current.project.links.length - 1) { videoIndex++; playVideo(); } });
  $('previousPhoto').addEventListener('click', () => goPhoto(photoIndex - 1));
  $('nextPhoto').addEventListener('click', () => goPhoto(photoIndex + 1));
  $('photoTrack').addEventListener('scrollend', settlePhoto);
  $('photoTrack').addEventListener('scroll', () => {
    if (photoTarget !== null) return;
    clearTimeout(photoTimer); photoTimer = setTimeout(settlePhoto, 120);
  }, {passive:true});
  document.addEventListener('keydown', event => {
    if (!current || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    if (current.kind === 'photo') { event.preventDefault(); goPhoto(photoIndex + direction); }
    if (current.kind === 'video') {
      event.preventDefault(); const next = videoIndex + direction;
      if (next >= 0 && next < current.project.links.length) { videoIndex = next; playVideo(); }
    }
  });
  document.querySelectorAll('.lang-button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.lang-button').forEach(b => { const active = b.dataset.lang === button.dataset.lang; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    document.querySelectorAll('.bio-text').forEach(text => text.classList.toggle('active', text.dataset.langContent === button.dataset.lang));
    fitAbout();
  }));
  window.addEventListener('resize', () => {
    scheduleAboutFit();
    if (current?.kind === 'photo') { sizeSlides(); goPhoto(photoIndex, false); }
  });
  window.addEventListener('popstate', () => {
    const state = history.state;
    if (current) dismiss();
    filter = state?.filter || 'all';
    switchView(state?.portfolioView === 'photos' ? 'photos' : 'films');
    if (!state?.portfolio) {
      requestAnimationFrame(() => window.scrollTo({top:state?.scroll || 0, behavior:'instant'}));
      return;
    }
    if (state.portfolio === 'about') openProject('about', null, 0, null, false);
    else {
      const project = (state.portfolio === 'video' ? films : series).find(p => p.id === state.id);
      if (project && (state.portfolio !== 'photo' || project.items)) openProject(state.portfolio, project, state.index || 0, null, false);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.querySelectorAll('.film-open video').forEach(video => video.pause());
      document.querySelectorAll('.is-preview-playing').forEach(button => button.classList.remove('is-preview-playing'));
    }
  });

  async function init() {
    try {
      const response = await fetch('projects.txt');
      if (!response.ok) throw new Error('Impossible de charger projects.txt.');
      parseProjects(await response.text()); filmGallery.replaceChildren();
      cards = films.map((film, i) => { const element = createFilm(film, i); filmGallery.append(element); return {film, element}; });
      filter = history.state?.filter || 'all';
      switchView(initialView);
    } catch (error) {
      filmGallery.replaceChildren(); $('loadError').hidden = false; $('loadError').textContent = error.message;
    }
  }
  init();
});
