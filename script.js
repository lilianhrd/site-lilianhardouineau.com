document.addEventListener('DOMContentLoaded', function () {
  const videoGallery = document.querySelector('.video-gallery');
  const modal = document.getElementById('videoModal');
  const modalInner = document.getElementById('modalInner');
  const modalShell = document.querySelector('.modal-shell');
  const videoFrame = document.getElementById('videoFrame');
  const carouselThumbnails = document.getElementById('carouselThumbnails');
  const previousButton = document.getElementById('previousButton');
  const nextButton = document.getElementById('nextButton');
  const closeButton = document.getElementById('closeButton');
  const videoFrameWrapper = document.querySelector('.video-frame-wrapper');
  const videoStage = document.querySelector('.video-stage');

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

  const confirmedCarousels = [
    'LOUIS VUITTON/SS23',
    'AGAR AGAR/Teaser',
    'CYDFLM/',
    'COURRÈGES/Loop Bag FW22',
    'LOUIS VUITTON/show23',
    'SIMILI GUM/Dedipix + T pas si triste',
    'GIVENCHY/Rose Perfecto',
    'LOUIS VUITTON/Cruise 24 — Guests'
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

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de projects.txt');
      }

      const data = await response.text();
      const projects = parseProjects(data);

      projects.forEach(project => {
        const projectKey = `${project.title}/${project.subtitle}`;

        if (project.type === 'single') {
          videoGallery.appendChild(createSingleProjectElement(project));
        } else if (
          project.type === 'carousel' &&
          confirmedCarousels.includes(projectKey)
        ) {
          videoGallery.appendChild(createCarouselProjectElement(project));
        } else if (project.type === 'carousel') {
          videoGallery.appendChild(
            createSingleProjectElement({
              ...project,
              links: [project.links[0]],
              firstLink: project.links[0],
              type: 'single'
            })
          );
        }
      });
    } catch (error) {
      console.error('Erreur de chargement :', error);
    }
  }

  function parseProjects(data) {
    const lines = data
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    return lines.map(line => {
      const parts = line.split('/');
      const title = (parts[0] || '').trim();
      const subtitle = (parts[1] || '').trim();
      const thumbnail = (parts[2] || '').trim();

      const linksRaw = parts.slice(3).join('/').trim();
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
        type: links.length > 1 ? 'carousel' : 'single'
      };
    });
  }

  function getVimeoId(url) {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  }

  function getYouTubeId(url) {
    try {
      if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split(/[?&]/)[0];
      }

      if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
      }

      if (url.includes('youtube.com/embed/')) {
        return url.split('embed/')[1].split(/[?&]/)[0];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function appendQueryParams(url, params) {
    try {
      const finalUrl = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        finalUrl.searchParams.set(key, value);
      });
      return finalUrl.toString();
    } catch (error) {
      return url;
    }
  }

  function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
      const videoId = getVimeoId(url);
      return `https://player.vimeo.com/video/${videoId}`;
    }

    if (url.includes('youtu.be') || url.includes('youtube.com')) {
      const videoId = getYouTubeId(url);
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return url;
  }

  async function getVideoAspectRatio(url) {
    if (aspectRatioCache.has(url)) {
      return aspectRatioCache.get(url);
    }

    let ratio = DEFAULT_RATIO;

    try {
      if (url.includes('vimeo.com')) {
        const response = await fetch(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.width && data.height) {
            ratio = data.width / data.height;
          }
        }
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.width && data.height) {
            ratio = data.width / data.height;
          }
        }
      }
    } catch (error) {
      console.warn('Impossible de récupérer le ratio vidéo, fallback 16:9.', error);
    }

    aspectRatioCache.set(url, ratio);
    return ratio;
  }

  async function getVideoMetadata(url) {
    if (!url) return null;

    if (metadataCache.has(url)) {
      return metadataCache.get(url);
    }

    let metadata = null;

    try {
      if (url.includes('vimeo.com')) {
        const response = await fetch(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        );

        if (response.ok) {
          const data = await response.json();
          metadata = {
            provider: 'vimeo',
            title: data.title || '',
            authorName: data.author_name || '',
            description: data.description || ''
          };
        }
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );

        if (response.ok) {
          const data = await response.json();
          metadata = {
            provider: 'youtube',
            title: data.title || '',
            authorName: data.author_name || '',
            description: ''
          };
        }
      }
    } catch (error) {
      console.warn('Impossible de récupérer les métadonnées vidéo.', error);
    }

    metadataCache.set(url, metadata);
    return metadata;
  }

  function applyVideoRatio(ratio) {
    if (!videoFrameWrapper) return;
    videoFrameWrapper.style.setProperty('--video-ratio', ratio);
  }

  function updateModalLayout(ratio) {
    if (!modalInner) return;

    const isDesktop = window.innerWidth > 980;
    const isVertical = ratio < 1;

    modalInner.classList.toggle('is-vertical-layout', isDesktop && isVertical);
    modalInner.classList.toggle('is-horizontal-layout', !(isDesktop && isVertical));
  }

  function updateStickyMetrics() {
    if (!videoFrameWrapper || !videoStage || !modalInner) return;

    requestAnimationFrame(() => {
      const frameRect = videoFrameWrapper.getBoundingClientRect();
      const stageRect = videoStage.getBoundingClientRect();

      modalInner.style.setProperty('--video-frame-width', `${Math.round(frameRect.width)}px`);
      modalInner.style.setProperty('--video-frame-height', `${Math.round(frameRect.height)}px`);
      modalInner.style.setProperty('--video-stage-height', `${Math.round(stageRect.height)}px`);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (match) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return map[match];
    });
  }

  function parseCredits(description) {
    if (!description || !description.trim()) {
      return '<p class="credits-empty">Credits unavailable.</p>';
    }

    const normalized = description
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    const lines = normalized.split('\n');

    const blocks = [];
    let paragraphBuffer = [];

    function flushParagraph() {
      if (!paragraphBuffer.length) return;

      const text = paragraphBuffer.join('\n').trim();
      if (text) {
        blocks.push({
          type: 'paragraph',
          text
        });
      }
      paragraphBuffer = [];
    }

    lines.forEach(line => {
      const rawLine = line;
      const trimmed = rawLine.trim();

      if (!trimmed) {
        flushParagraph();
        blocks.push({ type: 'spacer' });
        return;
      }

      const isCreditLine = /^[A-Za-zÀ-ÿ0-9&'().,+\-\s]{2,42}\s*:\s*.+$/.test(trimmed);

      if (isCreditLine) {
        flushParagraph();

        const parts = trimmed.split(':');
        const role = parts.shift().trim();
        const value = parts.join(':').trim();

        blocks.push({
          type: 'credit',
          role,
          value
        });
      } else {
        paragraphBuffer.push(rawLine);
      }
    });

    flushParagraph();

    const cleanedBlocks = [];
    let previousWasSpacer = true;

    blocks.forEach(block => {
      if (block.type === 'spacer') {
        if (!previousWasSpacer) {
          cleanedBlocks.push(block);
        }
        previousWasSpacer = true;
      } else {
        cleanedBlocks.push(block);
        previousWasSpacer = false;
      }
    });

    while (cleanedBlocks.length && cleanedBlocks[cleanedBlocks.length - 1].type === 'spacer') {
      cleanedBlocks.pop();
    }

    if (!cleanedBlocks.length) {
      return '<p class="credits-empty">Credits unavailable.</p>';
    }

    return cleanedBlocks.map(block => {
      if (block.type === 'credit') {
        return `
          <div class="credit-line">
            <span class="credit-role">${escapeHtml(block.role)}</span>
            <span class="credit-name">${escapeHtml(block.value)}</span>
          </div>
        `;
      }

      if (block.type === 'spacer') {
        return `<div class="credit-spacer" aria-hidden="true"></div>`;
      }

      return `<p class="credit-paragraph">${escapeHtml(block.text)}</p>`;
    }).join('');
  }

  function updateCreditsColumnMode() {
    if (!videoCredits || !modalInner) return;

    const isVertical = modalInner.classList.contains('is-vertical-layout');
    const isDesktop = window.innerWidth > 980;

    videoCredits.classList.remove('is-long');

    if (!isDesktop || isVertical) return;

    const textLength = (videoCredits.textContent || '').trim().length;
    const blockCount = videoCredits.children.length;

    if (textLength > 420 || blockCount > 11) {
      videoCredits.classList.add('is-long');
    }
  }

  async function renderInfoPanel(project) {
    if (!project) return;

    const sourceLink = project.firstLink || (project.links && project.links[0]) || '';
    const metadata = await getVideoMetadata(sourceLink);

    videoInfoTitle.textContent = project.title || '';
    videoInfoSubtitle.textContent = project.subtitle || '';

    const description = metadata && metadata.description ? metadata.description : '';
    videoCredits.innerHTML = parseCredits(description);

    updateCreditsColumnMode();
    updateStickyMetrics();
  }

  function scrollActiveThumbIntoView() {
    const activeThumb = carouselThumbnails.querySelector('.carousel-thumbnail.active');
    if (!activeThumb) return;

    activeThumb.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest'
    });
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
    const embedUrl = appendQueryParams(baseUrl, isYouTube
      ? { autoplay: '1', rel: '0', playsinline: '1' }
      : { autoplay: '1', playsinline: '1' });

    videoFrame.src = embedUrl;

    updateActiveThumbnail();
    scrollActiveThumbIntoView();

    await renderInfoPanel(project);
    updateStickyMetrics();
  }

  function updateActiveThumbnail() {
    const thumbs = carouselThumbnails.querySelectorAll('.carousel-thumbnail');

    thumbs.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === modalState.currentVideoIndex);
    });
  }

  function renderCarouselThumbnails(project) {
    carouselThumbnails.innerHTML = '';
    carouselThumbnails.style.display = 'flex';

    project.links.forEach((link, index) => {
      const thumb = document.createElement('img');

      if (link.includes('vimeo')) {
        const vimeoId = getVimeoId(link);
        thumb.src = `https://vumbnail.com/${vimeoId}.jpg`;
      } else {
        thumb.src = 'images/youtube-placeholder.jpg';
      }

      thumb.classList.add('carousel-thumbnail');
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

  function createProjectImage(project) {
    const img = document.createElement('img');
    img.src = `images/${project.thumbnail}`;
    img.alt = `${project.title} ${project.subtitle}`.trim();
    img.loading = 'lazy';
    return img;
  }

  function createProjectText(title, subtitle) {
    const textContainer = document.createElement('div');
    textContainer.classList.add('video-text-container');

    const titleEl = document.createElement('span');
    titleEl.classList.add('video-title');
    titleEl.textContent = title;

    const subtitleEl = document.createElement('span');
    subtitleEl.classList.add('video-subtitle');
    subtitleEl.textContent = subtitle;

    textContainer.appendChild(titleEl);
    textContainer.appendChild(subtitleEl);

    return textContainer;
  }

  function createSingleProjectElement(project) {
    const article = document.createElement('article');
    article.classList.add('video-thumbnail');
    article.tabIndex = 0;

    article.addEventListener('click', () => openVideo(project, article));
    article.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openVideo(project, article);
      }
    });

    article.appendChild(createProjectImage(project));
    article.appendChild(createProjectText(project.title, project.subtitle));

    return article;
  }

  function createCarouselProjectElement(project) {
    const article = document.createElement('article');
    article.classList.add('video-thumbnail', 'has-carousel');
    article.tabIndex = 0;

    article.addEventListener('click', () => openCarousel(project, article));
    article.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCarousel(project, article);
      }
    });

    article.appendChild(createProjectImage(project));
    article.appendChild(createProjectText(project.title, project.subtitle));

    return article;
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
    modalInner.style.removeProperty('--video-frame-width');
    modalInner.style.removeProperty('--video-frame-height');
    modalInner.style.removeProperty('--video-stage-height');
    if (modalShell) modalShell.scrollTop = 0;
  }

  function openModal() {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    resetModalUI();
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    if (modalState.lastTrigger) {
      modalState.lastTrigger.focus();
    }
  }

  function openAboutModal() {
    if (!aboutModal) return;

    aboutModal.classList.add('open');
    aboutModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (menuToggle) {
      menuToggle.classList.add('open');
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  }

  function closeAboutModal() {
    if (!aboutModal) return;

    aboutModal.classList.remove('open');
    aboutModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    if (menuToggle) {
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function openVideo(project, triggerElement = null) {
    resetModalUI();
    closeAboutModal();

    modalState.lastTrigger = triggerElement;
    modalState.currentProject = {
      ...project,
      firstLink: project.firstLink || project.links[0]
    };

    openModal();
    playCurrentVideo();
  }

  function openCarousel(project, triggerElement = null) {
    resetModalUI();
    closeAboutModal();

    modalState.lastTrigger = triggerElement;
    modalState.currentProject = {
      ...project,
      firstLink: project.firstLink || project.links[0]
    };
    modalState.currentVideoIndex = 0;

    renderCarouselThumbnails(project);

    if (project.links.length > 1) {
      previousButton.style.display = 'flex';
      nextButton.style.display = 'flex';
    }

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

    const total = modalState.currentProject.links.length;
    modalState.currentVideoIndex = (modalState.currentVideoIndex + 1) % total;
    playCurrentVideo();
  }

  function updateHeaderState() {
    if (!topHeader) return;

    if (window.scrollY > 24) {
      topHeader.classList.add('is-scrolled');
    } else {
      topHeader.classList.remove('is-scrolled');
    }
  }

  if (aboutButton) {
    aboutButton.addEventListener('click', function (event) {
      event.preventDefault();

      if (aboutModal.classList.contains('open')) {
        closeAboutModal();
      } else {
        openAboutModal();
      }
    });
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function (event) {
      event.preventDefault();

      if (aboutModal.classList.contains('open')) {
        closeAboutModal();
      } else {
        openAboutModal();
      }
    });
  }

  if (aboutClose) {
    aboutClose.addEventListener('click', function () {
      closeAboutModal();
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', closeModal);
  }

  if (previousButton) {
    previousButton.addEventListener('click', event => {
      event.stopPropagation();
      goToPreviousVideo();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', event => {
      event.stopPropagation();
      goToNextVideo();
    });
  }

  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener('click', event => {
      if (event.target === aboutModal) {
        closeAboutModal();
      }
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      closeAboutModal();
    }

    if (!modalState.currentProject || modal.getAttribute('aria-hidden') === 'true') return;

    if (modalState.currentProject.links.length > 1) {
      if (event.key === 'ArrowLeft') {
        goToPreviousVideo();
      }

      if (event.key === 'ArrowRight') {
        goToNextVideo();
      }
    }
  });

  langButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selectedLang = button.dataset.lang;

      langButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === selectedLang);
      });

      bioTexts.forEach(text => {
        text.classList.toggle(
          'active',
          text.dataset.langContent === selectedLang
        );
      });
    });
  });

  window.addEventListener('resize', () => {
    if (!modalState.currentProject) return;
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
  let touchEndX = 0;

  if (videoFrameWrapper) {
    videoFrameWrapper.addEventListener('touchstart', event => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    videoFrameWrapper.addEventListener('touchend', event => {
      touchEndX = event.changedTouches[0].clientX;

      if (!modalState.currentProject || modalState.currentProject.links.length <= 1) return;

      const delta = touchEndX - touchStartX;
      if (Math.abs(delta) < 40) return;

      if (delta > 0) {
        goToPreviousVideo();
      } else {
        goToNextVideo();
      }
    }, { passive: true });
  }

  window.openVideo = openVideo;
  window.openCarousel = openCarousel;
  window.closeVideo = closeModal;

  updateHeaderState();
  loadProjects();
});
