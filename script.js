document.addEventListener('DOMContentLoaded', function () {
  const videoGallery = document.querySelector('.video-gallery');
  const modal = document.getElementById('videoModal');
  const videoFrame = document.getElementById('videoFrame');
  const carouselThumbnails = document.getElementById('carouselThumbnails');
  const previousButton = document.getElementById('previousButton');
  const nextButton = document.getElementById('nextButton');
  const closeButton = document.getElementById('closeButton');
  const videoFrameWrapper = document.querySelector('.video-frame-wrapper');

  const aboutModal = document.getElementById('aboutModal');
  const aboutButton = document.getElementById('aboutButton');
  const aboutClose = document.getElementById('aboutClose');

  const menuToggle = document.getElementById('menuToggle');
  const topHeader = document.getElementById('topHeader');

  const confirmedCarousels = [
    "LOUIS VUITTON/SS23",
    "AGAR AGAR/Teaser",
    "CYDFLM/",
    "COURRÈGES/Loop Bag FW22",
    "LOUIS VUITTON/show.s",
    "SIMILI GUM/Dedipix + T pas si triste",
    "GIVENCHY/Rose Perfecto",
    "LOUIS VUITTON/Cruise 24 — Guests"
  ];

  const modalState = {
    currentProject: null,
    currentVideoIndex: 0
  };

  const aspectRatioCache = new Map();
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
        } else if (project.type === 'carousel' && confirmedCarousels.includes(projectKey)) {
          videoGallery.appendChild(createCarouselProjectElement(project));
        } else if (project.type === 'carousel') {
          videoGallery.appendChild(
            createSingleProjectElement({
              ...project,
              links: [project.links[0]],
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

  function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
      const videoId = getVimeoId(url);
      return `https://player.vimeo.com/video/${videoId}`;
    }

    if (url.includes('youtu.be')) {
      const videoId = getYouTubeId(url);
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }

    if (url.includes('youtube.com')) {
      const videoId = getYouTubeId(url);
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
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

  function applyVideoRatio(ratio) {
    if (!videoFrameWrapper) return;
    videoFrameWrapper.style.setProperty('--video-ratio', ratio);
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
    article.addEventListener('click', () => openVideo(project.links[0]));

    article.appendChild(createProjectImage(project));
    article.appendChild(createProjectText(project.title, project.subtitle));

    return article;
  }

  function createCarouselProjectElement(project) {
    const article = document.createElement('article');
    article.classList.add('video-thumbnail', 'has-carousel');
    article.addEventListener('click', () => openCarousel(project));

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
    modalState.currentProject = null;
    modalState.currentVideoIndex = 0;
    applyVideoRatio(DEFAULT_RATIO);
  }

  function openModal() {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    resetModalUI();
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
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

  async function playCurrentVideo() {
    if (!modalState.currentProject) return;

    const url = modalState.currentProject.links[modalState.currentVideoIndex];
    const baseUrl = formatVideoUrl(url);

    const ratio = await getVideoAspectRatio(url);
    applyVideoRatio(ratio);

    if (baseUrl.includes('youtube.com/embed/')) {
      videoFrame.src = baseUrl;
    } else {
      videoFrame.src = `${baseUrl}?autoplay=1`;
    }

    updateActiveThumbnail();
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

      thumb.addEventListener('click', event => {
        event.stopPropagation();
        modalState.currentVideoIndex = index;
        playCurrentVideo();
      });

      carouselThumbnails.appendChild(thumb);
    });
  }

  function openVideo(videoUrl) {
    resetModalUI();
    closeAboutModal();

    modalState.currentProject = {
      links: [videoUrl]
    };

    openModal();
    playCurrentVideo();
  }

  function openCarousel(project) {
    resetModalUI();
    closeAboutModal();

    modalState.currentProject = project;
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
      openAboutModal();
    });
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function (event) {
      event.preventDefault();
      openAboutModal();
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

  previousButton.addEventListener('click', event => {
    event.stopPropagation();
    goToPreviousVideo();
  });

  nextButton.addEventListener('click', event => {
    event.stopPropagation();
    goToNextVideo();
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });

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

    if (!modalState.currentProject || modal.style.display !== 'flex') return;

    if (modalState.currentProject.links.length > 1) {
      if (event.key === 'ArrowLeft') {
        goToPreviousVideo();
      }

      if (event.key === 'ArrowRight') {
        goToNextVideo();
      }
    }
  });

  window.addEventListener('scroll', updateHeaderState, { passive: true });

  window.openVideo = openVideo;
  window.openCarousel = openCarousel;
  window.closeVideo = closeModal;

  updateHeaderState();
  loadProjects();
});
