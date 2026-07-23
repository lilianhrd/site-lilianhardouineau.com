document.addEventListener('DOMContentLoaded', function () {
  const videoGallery = document.querySelector('.video-gallery');
  const modal = document.getElementById('videoModal');
  const modalInner = document.getElementById('modalInner');
  const modalShell = document.querySelector('.modal-shell');
  const videoFrame = document.getElementById('videoFrame');
  const videoFrameWrapper = document.querySelector('.video-frame-wrapper');
  const videoStage = document.querySelector('.video-stage');
  const carouselThumbnails = document.getElementById('carouselThumbnails');
  const previousButton = document.getElementById('previousButton');
  const nextButton = document.getElementById('nextButton');
  const closeButton = document.getElementById('closeButton');
  const videoInfoTitle = document.getElementById('videoInfoTitle');
  const videoInfoSubtitle = document.getElementById('videoInfoSubtitle');
  const videoCredits = document.getElementById('videoCredits');
  const aboutModal = document.getElementById('aboutModal');
  const aboutButton = document.getElementById('aboutButton');
  const aboutClose = document.getElementById('aboutClose');
  const menuToggle = document.getElementById('menuToggle');
  const topHeader = document.getElementById('topHeader');
  const langButtons = document.querySelectorAll('.lang-button');
  const bioTexts = document.querySelectorAll('.bio-text');
  const filterButtons = document.querySelectorAll('.filter-button');

  const confirmedCarousels = [
    'LOUIS VUITTON/Perpetual motion',
    'AGAR AGAR/Teaser',
    'LOUIS VUITTON/show23',
    'SIMILI GUM/Dedipix + T pas si triste',
    'GIVENCHY/Rose Perfecto',
    'LOUIS VUITTON/Cruise 24 — Guests',
    'KENZO/Lunar Year'
  ];

  const modalState = {
    currentProject: null,
    currentVideoIndex: 0,
    lastTrigger: null
  };

  const aspectRatioCache = new Map();
  const metadataCache = new Map();
  const DEFAULT_RATIO = 16 / 9;

  async function loadProjects() {
    try {
      const response = await fetch('projects.txt');
      if (!response.ok) throw new Error('Erreur lors du chargement de projects.txt');

      const projects = parseProjects(await response.text());

      projects.forEach(project => {
        const projectKey = `${project.title}/${project.subtitle}`;

        if (project.type === 'single') {
          videoGallery.appendChild(createProjectElement(project, false));
        } else if (confirmedCarousels.includes(projectKey)) {
          videoGallery.appendChild(createProjectElement(project, true));
        } else {
          videoGallery.appendChild(createProjectElement({
            ...project,
            links: [project.links[0]],
            firstLink: project.links[0],
            type: 'single'
          }, false));
        }
      });
    } catch (error) {
      console.error('Erreur de chargement :', error);
    }
  }

  function parseProjects(data) {
    const validCategories = ['commercial', 'music-video', 'personal'];

    return data
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('/');
        const title = (parts[0] || '').trim();
        const subtitle = (parts[1] || '').trim();
        const thumbnail = (parts[2] || '').trim();
        const categoryCandidate = (parts[parts.length - 1] || '').trim().toLowerCase();
        const categoryList = categoryCandidate
          .split('+')
          .map(category => category.trim())
          .filter(Boolean);
        const hasCategory =
          categoryList.length > 0 &&
          categoryList.every(category => validCategories.includes(category));
        const category = hasCategory ? categoryList.join('+') : 'personal';
        const linksRaw = (hasCategory ? parts.slice(3, -1) : parts.slice(3))
          .join('/')
          .trim();
        const links = linksRaw
          .replace('carrousel:', '')
          .split(',')
          .map(link => link.trim())
          .filter(Boolean);

        return {
          title,
          subtitle,
          thumbnail,
          links,
          firstLink: links[0] || '',
          type: links.length > 1 ? 'carousel' : 'single',
          category
        };
      });
  }

  function getVimeoId(url) {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  }

  function getYouTubeId(url) {
    try {
      if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0];
      if (url.includes('youtube.com/watch')) return new URL(url).searchParams.get('v');
      if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split(/[?&]/)[0];
      return null;
    } catch (error) {
      return null;
    }
  }

  function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
      const videoId = getVimeoId(url);
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }

    if (url.includes('youtu.be') || url.includes('youtube.com')) {
      const videoId = getYouTubeId(url);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }

    return url;
  }

  function appendQueryParams(url, params) {
    try {
      const finalUrl = new URL(url);
      Object.entries(params).forEach(([key, value]) => finalUrl.searchParams.set(key, value));
      return finalUrl.toString();
    } catch (error) {
      return url;
    }
  }

  async function getVideoAspectRatio(url) {
    if (aspectRatioCache.has(url)) return aspectRatioCache.get(url);

    let ratio = DEFAULT_RATIO;

    try {
      const endpoint = url.includes('vimeo.com')
        ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        : `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();
        if (data.width && data.height) ratio = data.width / data.height;
      }
    } catch (error) {
      console.warn('Ratio vidéo indisponible, utilisation du format 16:9.');
    }

    aspectRatioCache.set(url, ratio);
    return ratio;
  }

  async function getVideoMetadata(url) {
    if (!url) return null;
    if (metadataCache.has(url)) return metadataCache.get(url);

    let metadata = null;

    try {
      const endpoint = url.includes('vimeo.com')
        ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        : `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();
        metadata = {
          title: data.title || '',
          authorName: data.author_name || '',
          description: data.description || ''
        };
      }
    } catch (error) {
      console.warn('Métadonnées vidéo indisponibles.');
    }

    metadataCache.set(url, metadata);
    return metadata;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]);
  }

  function parseCredits(description) {
    if (!description || !description.trim()) {
      return '<p class="credits-empty">Credits unavailable.</p>';
    }

    return description
      .replace(/\r\n?/g, '\n')
      .trim()
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean)
      .map(paragraph => `<p class="credit-paragraph">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function applyVideoRatio(ratio) {
    videoFrameWrapper.style.setProperty('--video-ratio', ratio);
  }

  function updateModalLayout(ratio) {
    const verticalDesktop = window.innerWidth > 980 && ratio < 1;
    modalInner.classList.toggle('is-vertical-layout', verticalDesktop);
    modalInner.classList.toggle('is-horizontal-layout', !verticalDesktop);
  }

  function updateStickyMetrics() {
    requestAnimationFrame(() => {
      const frameRect = videoFrameWrapper.getBoundingClientRect();
      const stageRect = videoStage.getBoundingClientRect();
      modalInner.style.setProperty('--video-frame-width', `${Math.round(frameRect.width)}px`);
      modalInner.style.setProperty('--video-frame-height', `${Math.round(frameRect.height)}px`);
      modalInner.style.setProperty('--video-stage-height', `${Math.round(stageRect.height)}px`);
    });
  }

  function updateCreditsColumnMode() {
    videoCredits.classList.remove('is-long');

    if (
      window.innerWidth > 980 &&
      !modalInner.classList.contains('is-vertical-layout') &&
      ((videoCredits.textContent || '').trim().length > 420 || videoCredits.children.length > 11)
    ) {
      videoCredits.classList.add('is-long');
    }
  }

  async function renderInfoPanel(project) {
    const sourceLink = project.firstLink || project.links[0] || '';
    const metadata = await getVideoMetadata(sourceLink);

    videoInfoTitle.textContent = project.title || '';
    videoInfoSubtitle.textContent = project.subtitle || '';
    videoCredits.innerHTML = parseCredits(metadata && metadata.description);
    updateCreditsColumnMode();
    updateStickyMetrics();
  }

  function createProjectElement(project, isCarousel) {
    const article = document.createElement('article');
    article.classList.add('video-thumbnail');
    if (isCarousel) article.classList.add('has-carousel');
    article.tabIndex = 0;
    article.dataset.category = project.category;

    const image = document.createElement('img');
    image.src = `images/${project.thumbnail}`;
    image.alt = `${project.title} ${project.subtitle}`.trim();
    image.loading = 'lazy';

    const textContainer = document.createElement('div');
    textContainer.className = 'video-text-container';

    const title = document.createElement('span');
    title.className = 'video-title';
    title.textContent = project.title;

    const subtitle = document.createElement('span');
    subtitle.className = 'video-subtitle';
    subtitle.textContent = project.subtitle;

    textContainer.append(title, subtitle);
    article.append(image, textContainer);

    const open = () => isCarousel ? openCarousel(project, article) : openVideo(project, article);
    article.addEventListener('click', open);
    article.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    return article;
  }

  function setActiveFilter(category) {
    filterButtons.forEach(button => {
      const active = button.dataset.filter === category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('.video-thumbnail').forEach(project => {
      const projectCategories = project.dataset.category
        .split('+')
        .map(item => item.trim());
      const visible = category === 'all' || projectCategories.includes(category);
      project.classList.toggle('is-filtered-out', !visible);
    });
  }

  function renderCarouselThumbnails(project) {
    carouselThumbnails.innerHTML = '';
    carouselThumbnails.style.display = 'flex';

    project.links.forEach((link, index) => {
      const thumb = document.createElement('img');
      const vimeoId = getVimeoId(link);
      thumb.src = vimeoId ? `https://vumbnail.com/${vimeoId}.jpg` : 'images/youtube-placeholder.jpg';
      thumb.className = 'carousel-thumbnail';
      thumb.alt = `Miniature vidéo ${index + 1}`;
      thumb.loading = 'lazy';
      thumb.addEventListener('click', event => {
        event.stopPropagation();
        modalState.currentVideoIndex = index;
        playCurrentVideo();
      });
      carouselThumbnails.appendChild(thumb);
    });
  }

  function updateActiveThumbnail() {
    carouselThumbnails.querySelectorAll('.carousel-thumbnail').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === modalState.currentVideoIndex);
    });
  }

  function scrollActiveThumbIntoView() {
    const activeThumb = carouselThumbnails.querySelector('.carousel-thumbnail.active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  async function playCurrentVideo() {
    if (!modalState.currentProject) return;

    const project = modalState.currentProject;
    const url = project.links[modalState.currentVideoIndex];
    const baseUrl = formatVideoUrl(url);
    const ratio = await getVideoAspectRatio(url);

    applyVideoRatio(ratio);
    updateModalLayout(ratio);

    const isYouTube = baseUrl.includes('youtube.com/embed/');
    videoFrame.src = appendQueryParams(
      baseUrl,
      isYouTube
        ? { autoplay: '1', rel: '0', playsinline: '1' }
        : { autoplay: '1', playsinline: '1' }
    );

    updateActiveThumbnail();
    scrollActiveThumbIntoView();
    await renderInfoPanel(project);
    updateStickyMetrics();
  }

  function resetModalUI() {
    carouselThumbnails.innerHTML = '';
    carouselThumbnails.style.display = 'none';
    previousButton.style.display = 'none';
    nextButton.style.display = 'none';
    videoFrame.src = '';
    videoInfoTitle.textContent = '';
    videoInfoSubtitle.textContent = '';
    videoCredits.innerHTML = '';
    videoCredits.classList.remove('is-long');
    modalState.currentProject = null;
    modalState.currentVideoIndex = 0;
    applyVideoRatio(DEFAULT_RATIO);
    updateModalLayout(DEFAULT_RATIO);
    modal.classList.remove('has-carousel', 'no-carousel', 'is-mobile-carousel-layout');
    if (modalShell) modalShell.scrollTop = 0;
  }

  function openModal() {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const lastTrigger = modalState.lastTrigger;
    resetModalUI();
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastTrigger) lastTrigger.focus();
  }

  function openVideo(project, trigger) {
    resetModalUI();
    closeAboutModal();
    modalState.lastTrigger = trigger;
    modalState.currentProject = { ...project, firstLink: project.firstLink || project.links[0] };
    modal.classList.add('no-carousel');
    openModal();
    playCurrentVideo();
  }

  function openCarousel(project, trigger) {
    resetModalUI();
    closeAboutModal();
    modalState.lastTrigger = trigger;
    modalState.currentProject = { ...project, firstLink: project.firstLink || project.links[0] };
    modal.classList.add('has-carousel');
    modal.classList.toggle('is-mobile-carousel-layout', window.innerWidth <= 768);
    renderCarouselThumbnails(project);
    previousButton.style.display = 'flex';
    nextButton.style.display = 'flex';
    openModal();
    playCurrentVideo();
  }

  function goToPreviousVideo() {
    if (!modalState.currentProject) return;
    const total = modalState.currentProject.links.length;
    modalState.currentVideoIndex = (modalState.currentVideoIndex - 1 + total) % total;
    playCurrentVideo();
  }

  function goToNextVideo() {
    if (!modalState.currentProject) return;
    modalState.currentVideoIndex = (modalState.currentVideoIndex + 1) % modalState.currentProject.links.length;
    playCurrentVideo();
  }

  function openAboutModal() {
    aboutModal.classList.add('open');
    aboutModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    menuToggle.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeAboutModal() {
    aboutModal.classList.remove('open');
    aboutModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleAbout(event) {
    event.preventDefault();
    aboutModal.classList.contains('open') ? closeAboutModal() : openAboutModal();
  }

  function updateHeaderState() {
    topHeader.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => setActiveFilter(button.dataset.filter));
  });

  aboutButton.addEventListener('click', toggleAbout);
  menuToggle.addEventListener('click', toggleAbout);
  aboutClose.addEventListener('click', closeAboutModal);
  closeButton.addEventListener('click', closeModal);
  previousButton.addEventListener('click', event => {
    event.stopPropagation();
    goToPreviousVideo();
  });
  nextButton.addEventListener('click', event => {
    event.stopPropagation();
    goToNextVideo();
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  aboutModal.addEventListener('click', event => {
    if (event.target === aboutModal) closeAboutModal();
  });

  langButtons.forEach(button => {
    button.addEventListener('click', () => {
      const language = button.dataset.lang;
      langButtons.forEach(item => item.classList.toggle('active', item.dataset.lang === language));
      bioTexts.forEach(text => text.classList.toggle('active', text.dataset.langContent === language));
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (modal.getAttribute('aria-hidden') === 'false') closeModal();
      if (aboutModal.getAttribute('aria-hidden') === 'false') closeAboutModal();
    }

    if (!modalState.currentProject || modal.getAttribute('aria-hidden') === 'true') return;
    if (modalState.currentProject.links.length > 1) {
      if (event.key === 'ArrowLeft') goToPreviousVideo();
      if (event.key === 'ArrowRight') goToNextVideo();
    }
  });

  window.addEventListener('resize', () => {
    if (!modalState.currentProject) return;
    modal.classList.toggle(
      'is-mobile-carousel-layout',
      modalState.currentProject.links.length > 1 && window.innerWidth <= 768
    );

    const url = modalState.currentProject.links[modalState.currentVideoIndex];
    getVideoAspectRatio(url).then(ratio => {
      applyVideoRatio(ratio);
      updateModalLayout(ratio);
      updateCreditsColumnMode();
      updateStickyMetrics();
    });
  });

  window.addEventListener('scroll', updateHeaderState, { passive: true });

  let touchStartX = 0;
  videoFrameWrapper.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  videoFrameWrapper.addEventListener('touchend', event => {
    if (!modalState.currentProject || modalState.currentProject.links.length <= 1) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) < 40) return;
    delta > 0 ? goToPreviousVideo() : goToNextVideo();
  }, { passive: true });

  updateHeaderState();
  loadProjects();
});
