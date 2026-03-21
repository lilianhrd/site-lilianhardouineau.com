document.addEventListener('DOMContentLoaded', function () {
  const videoGallery = document.querySelector('.video-gallery');
  const modal = document.getElementById('videoModal');
  const videoFrame = document.getElementById('videoFrame');
  const carouselThumbnails = document.getElementById('carouselThumbnails');
  const previousButton = document.getElementById('previousButton');
  const nextButton = document.getElementById('nextButton');
  const closeButton = document.getElementById('closeButton');

  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const topHeader = document.getElementById('topHeader');

  const confirmedCarousels = [
    "LOUIS VUITTON/SS23",
    "AGAR AGAR/Teaser",
    "CYDFLM/",
    "COURRÈGES/Loop Bag FW22",
    "LOUIS VUITTON/show.s",
    "SIMILI GUM/Dedipix + T pas si triste",
    "GIVENCHY/Rose Perfecto"
  ];

  const modalState = {
    currentProject: null,
    currentVideoIndex: 0
  };

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

  function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
      const videoId = url.split('/').pop().split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }

    if (url.includes('youtu.be')) {
      const videoId = url.split('/').pop().split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }

    if (url.includes('youtube.com')) {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }

    return url;
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

  function playCurrentVideo() {
    if (!modalState.currentProject) return;

    const url = modalState.currentProject.links[modalState.currentVideoIndex];
    const baseUrl = formatVideoUrl(url);

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
        const vimeoId = link.split('/').pop().split('?')[0];
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
    closeMobileMenu();

    modalState.currentProject = {
      links: [videoUrl]
    };

    playCurrentVideo();
    openModal();
  }

  function openCarousel(project) {
    resetModalUI();
    closeMobileMenu();

    modalState.currentProject = project;
    modalState.currentVideoIndex = 0;

    renderCarouselThumbnails(project);

    if (project.links.length > 1) {
      previousButton.style.display = 'flex';
      nextButton.style.display = 'flex';
    }

    playCurrentVideo();
    openModal();
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

  function openMobileMenu() {
    mobileMenu.classList.add('open');
    menuToggle.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    mobileMenu.setAttribute('aria-hidden', 'false');
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }

  function toggleMobileMenu(event) {
    event.stopPropagation();

    if (mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function updateHeaderState() {
    if (window.scrollY > 24) {
      topHeader.classList.add('is-scrolled');
    } else {
      topHeader.classList.remove('is-scrolled');
    }
  }

  menuToggle.addEventListener('click', toggleMobileMenu);

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('click', event => {
    const clickInsideMenu = mobileMenu.contains(event.target);
    const clickOnToggle = menuToggle.contains(event.target);

    if (!clickInsideMenu && !clickOnToggle) {
      closeMobileMenu();
    }
  });

  previousButton.addEventListener('click', event => {
    event.stopPropagation();
    goToPreviousVideo();
  });

  nextButton.addEventListener('click', event => {
    event.stopPropagation();
    goToNextVideo();
  });

  closeButton.addEventListener('click', closeModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      closeMobileMenu();
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
