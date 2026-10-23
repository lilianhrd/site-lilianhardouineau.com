document.addEventListener('DOMContentLoaded', function () {
  const videoGallery = document.querySelector('.video-gallery');
  const modal = document.getElementById('videoModal');
  const modalInner = document.getElementById('modalInner');
  const modalShell = document.querySelector('.modal-shell');

  let videoFrame = document.getElementById('videoFrame');

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
    lastTrigger: null,
    historyEntryAdded: false
  };

  const aspectRatioCache = new Map();
  const metadataCache = new Map();
  const DEFAULT_RATIO = 16 / 9;


  /* =========================================================
     PROJECTS
     ========================================================= */

  async function loadProjects() {
    try {
      const response = await fetch('projects.txt');

      if (!response.ok) {
        throw new Error(
          'Erreur lors du chargement de projects.txt'
        );
      }

      const projects = parseProjects(
        (await response.text()).split('[PHOTOS]')[0]
      );

      projects.forEach(project => {
        const projectKey =
          `${project.title}/${project.subtitle}`;

        if (project.type === 'single') {
          videoGallery.appendChild(
            createProjectElement(project, false)
          );
        } else if (
          confirmedCarousels.includes(projectKey)
        ) {
          videoGallery.appendChild(
            createProjectElement(project, true)
          );
        } else {
          videoGallery.appendChild(
            createProjectElement(
              {
                ...project,
                links: [project.links[0]],
                firstLink: project.links[0],
                type: 'single'
              },
              false
            )
          );
        }
      });

      setActiveFilter(document.querySelector('.filter-button.active')?.dataset.filter || 'all');
    } catch (error) {
      console.error(
        'Erreur de chargement :',
        error
      );
    }
  }


  function parseProjects(data) {
    const validCategories = [
      'commercial',
      'music-video',
      'personal'
    ];

    return data
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('['))
      .map(line => {

        const parts = line.split('/');

        const title =
          (parts[0] || '').trim();

        const subtitle =
          (parts[1] || '').trim();

        const thumbnail =
          (parts[2] || '').trim();

        const previewCandidate =
          (parts[3] || '').trim();

        const preview =
          /\.mp4$/i.test(previewCandidate)
            ? previewCandidate
            : '';

        const linksStartIndex =
          preview ? 4 : 3;

        const categoryCandidate =
          (parts[parts.length - 1] || '')
            .trim()
            .toLowerCase();

        const categoryList =
          categoryCandidate
            .split('+')
            .map(category => category.trim())
            .filter(Boolean);

        const hasCategory =
          categoryList.length > 0 &&
          categoryList.every(
            category =>
              validCategories.includes(category)
          );

        const category =
          hasCategory
            ? categoryList.join('+')
            : 'personal';

        const linksRaw =
          (
            hasCategory
              ? parts.slice(
                  linksStartIndex,
                  -1
                )
              : parts.slice(
                  linksStartIndex
                )
          )
            .join('/')
            .trim();

        const links =
          linksRaw
            .replace('carrousel:', '')
            .split(',')
            .map(link => link.trim())
            .filter(Boolean);

        return {
          title,
          subtitle,
          thumbnail,
          preview,
          links,
          firstLink: links[0] || '',
          type:
            links.length > 1
              ? 'carousel'
              : 'single',
          category
        };
      });
  }


  /* =========================================================
     VIDEO URLS
     ========================================================= */

  function getVimeoId(url) {
    const match =
      url.match(
        /vimeo\.com\/(?:video\/)?(\d+)/
      );

    return match
      ? match[1]
      : null;
  }


  function getYouTubeId(url) {
    try {
      if (url.includes('youtu.be/')) {
        return url
          .split('youtu.be/')[1]
          .split(/[?&]/)[0];
      }

      if (url.includes('youtube.com/watch')) {
        return new URL(url)
          .searchParams
          .get('v');
      }

      if (url.includes('youtube.com/embed/')) {
        return url
          .split('embed/')[1]
          .split(/[?&]/)[0];
      }

      return null;

    } catch (error) {
      return null;
    }
  }


  function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
      const videoId =
        getVimeoId(url);

      return videoId
        ? `https://player.vimeo.com/video/${videoId}`
        : url;
    }

    if (
      url.includes('youtu.be') ||
      url.includes('youtube.com')
    ) {
      const videoId =
        getYouTubeId(url);

      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : url;
    }

    return url;
  }


  function appendQueryParams(url, params) {
    try {
      const finalUrl = new URL(url);

      Object.entries(params).forEach(
        ([key, value]) => {
          finalUrl.searchParams.set(
            key,
            value
          );
        }
      );

      return finalUrl.toString();

    } catch (error) {
      return url;
    }
  }


  /* =========================================================
     VIDEO METADATA
     ========================================================= */

  async function getVideoAspectRatio(url) {
    if (
      aspectRatioCache.has(url)
    ) {
      return aspectRatioCache.get(url);
    }

    let ratio = DEFAULT_RATIO;

    try {
      const endpoint =
        url.includes('vimeo.com')
          ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
          : `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

      const response =
        await fetch(endpoint);

      if (response.ok) {
        const data =
          await response.json();

        if (
          data.width &&
          data.height
        ) {
          ratio =
            data.width /
            data.height;
        }
      }

    } catch (error) {
      console.warn(
        'Ratio vidéo indisponible, utilisation du format 16:9.'
      );
    }

    aspectRatioCache.set(
      url,
      ratio
    );

    return ratio;
  }


  async function getVideoMetadata(url) {
    if (!url) {
      return null;
    }

    if (
      metadataCache.has(url)
    ) {
      return metadataCache.get(url);
    }

    let metadata = null;

    try {
      const endpoint =
        url.includes('vimeo.com')
          ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
          : `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

      const response =
        await fetch(endpoint);

      if (response.ok) {
        const data =
          await response.json();

        metadata = {
          title:
            data.title || '',
          authorName:
            data.author_name || '',
          description:
            data.description || ''
        };
      }

    } catch (error) {
      console.warn(
        'Métadonnées vidéo indisponibles.'
      );
    }

    metadataCache.set(
      url,
      metadata
    );

    return metadata;
  }


  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[character]
    );
  }


  function parseCredits(description) {
    if (
      !description ||
      !description.trim()
    ) {
      return `
        <p class="credits-empty">
          Credits unavailable.
        </p>
      `;
    }

    return description
      .replace(/\r\n?/g, '\n')
      .trim()
      .split(/\n\s*\n/)
      .map(
        paragraph =>
          paragraph.trim()
      )
      .filter(Boolean)
      .map(
        paragraph =>
          `<p class="credit-paragraph">${escapeHtml(
            paragraph
          ).replace(
            /\n/g,
            '<br>'
          )}</p>`
      )
      .join('');
  }


  /* =========================================================
     MODAL LAYOUT
     ========================================================= */

  function applyVideoRatio(ratio) {
    videoFrameWrapper.style.setProperty(
      '--video-ratio',
      ratio
    );
  }


  function updateModalLayout(ratio) {
    const verticalDesktop =
      window.innerWidth > 980 &&
      ratio < 1;

    modalInner.classList.toggle(
      'is-vertical-layout',
      verticalDesktop
    );

    modalInner.classList.toggle(
      'is-horizontal-layout',
      !verticalDesktop
    );
  }


  function updateStickyMetrics() {
    requestAnimationFrame(() => {
      const frameRect =
        videoFrameWrapper.getBoundingClientRect();

      const stageRect =
        videoStage.getBoundingClientRect();

      modalInner.style.setProperty(
        '--video-frame-width',
        `${Math.round(
          frameRect.width
        )}px`
      );

      modalInner.style.setProperty(
        '--video-frame-height',
        `${Math.round(
          frameRect.height
        )}px`
      );

      modalInner.style.setProperty(
        '--video-stage-height',
        `${Math.round(
          stageRect.height
        )}px`
      );
    });
  }


  function updateCreditsColumnMode() {
    videoCredits.classList.remove(
      'is-long'
    );

    if (
      window.innerWidth > 980 &&
      !modalInner.classList.contains(
        'is-vertical-layout'
      ) &&
      (
        (
          videoCredits.textContent ||
          ''
        ).trim().length > 420 ||
        videoCredits.children.length > 11
      )
    ) {
      videoCredits.classList.add(
        'is-long'
      );
    }
  }


  async function renderInfoPanel(project) {
    const sourceLink =
      project.firstLink ||
      project.links[0] ||
      '';

    const metadata =
      await getVideoMetadata(
        sourceLink
      );

    videoInfoTitle.textContent =
      project.title || '';

    videoInfoSubtitle.textContent =
      project.subtitle || '';

    videoCredits.innerHTML =
      parseCredits(
        metadata &&
        metadata.description
      );

    updateCreditsColumnMode();
    updateStickyMetrics();
  }


  /* =========================================================
     GALLERY
     ========================================================= */

  function createProjectElement(
    project,
    isCarousel
  ) {
    const article =
      document.createElement('article');

    article.classList.add(
      'video-thumbnail'
    );

    if (isCarousel) {
      article.classList.add(
        'has-carousel'
      );
    }

    article.tabIndex = 0;

    article.dataset.category =
      project.category;

    const image =
      document.createElement('img');

    image.src =
      `images/${project.thumbnail}`;

    image.alt =
      `${project.title} ${project.subtitle}`.trim();

    image.loading = 'lazy';


    const textContainer =
      document.createElement('div');

    textContainer.className =
      'video-text-container';


    const title =
      document.createElement('span');

    title.className =
      'video-title';

    title.textContent =
      project.title;


    const subtitle =
      document.createElement('span');

    subtitle.className =
      'video-subtitle';

    subtitle.textContent =
      project.subtitle;


    textContainer.append(
      title,
      subtitle
    );

    article.append(
      image,
      textContainer
    );


    /* LOCAL MP4 PREVIEW */

    if (project.preview) {
      const previewVideo =
        document.createElement('video');

      previewVideo.className =
        'local-preview-video';

      previewVideo.src =
        `preview/${project.preview}`;

      previewVideo.muted = true;
      previewVideo.loop = true;
      previewVideo.playsInline = true;
      previewVideo.preload = 'auto';

      previewVideo.setAttribute(
        'aria-hidden',
        'true'
      );


      previewVideo.addEventListener(
        'error',
        () => {
          article.classList.remove(
            'is-local-preview-playing'
          );
        }
      );


      previewVideo.load();

      article.insertBefore(
        previewVideo,
        textContainer
      );


      const startPreview = () => {
        if (
          window.innerWidth <= 768
        ) {
          return;
        }

        article.classList.add(
          'is-local-preview-playing'
        );

        const playPromise =
          previewVideo.play();

        if (
          playPromise &&
          typeof playPromise.catch ===
            'function'
        ) {
          playPromise.catch(
            () => {}
          );
        }
      };


      const stopPreview = () => {
        previewVideo.pause();

        try {
          previewVideo.currentTime = 0;
        } catch (error) {}

        article.classList.remove(
          'is-local-preview-playing'
        );
      };


      article.addEventListener(
        'pointerenter',
        startPreview
      );

      article.addEventListener(
        'pointerleave',
        stopPreview
      );

      article.addEventListener(
        'focusin',
        startPreview
      );

      article.addEventListener(
        'focusout',
        stopPreview
      );
    }


    const open = () => {
      isCarousel
        ? openCarousel(
            project,
            article
          )
        : openVideo(
            project,
            article
          );
    };


    article.addEventListener(
      'click',
      open
    );


    article.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          open();
        }
      }
    );


    return article;
  }


  /* =========================================================
     FILTERS
     ========================================================= */

  function setActiveFilter(category) {
    videoGallery.hidden = category === 'photography';
    document.dispatchEvent(new CustomEvent('portfoliofilter', {detail: category}));
    filterButtons.forEach(
      button => {
        const active =
          button.dataset.filter ===
          category;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          String(active)
        );
      }
    );


    document
      .querySelectorAll(
        '.video-thumbnail'
      )
      .forEach(
        project => {

          const projectCategories =
            project.dataset.category
              .split('+')
              .map(
                item =>
                  item.trim()
              );

          const visible =
            category === 'all' ||
            projectCategories.includes(
              category
            );

          project.classList.toggle(
            'is-filtered-out',
            !visible
          );
        }
      );
  }


  /* =========================================================
     CAROUSEL
     ========================================================= */

  function renderCarouselThumbnails(
    project
  ) {
    carouselThumbnails.innerHTML =
      '';

    carouselThumbnails.style.display =
      'flex';


    project.links.forEach(
      (link, index) => {

        const thumb =
          document.createElement(
            'img'
          );

        const vimeoId =
          getVimeoId(link);

        thumb.src =
          vimeoId
            ? `https://vumbnail.com/${vimeoId}.jpg`
            : 'images/youtube-placeholder.jpg';

        thumb.className =
          'carousel-thumbnail';

        thumb.alt =
          `Miniature vidéo ${index + 1}`;

        thumb.loading = 'lazy';


        thumb.addEventListener(
          'click',
          event => {

            event.stopPropagation();

            modalState.currentVideoIndex =
              index;

            playCurrentVideo();
          }
        );


        carouselThumbnails.appendChild(
          thumb
        );
      }
    );
  }


  function updateActiveThumbnail() {
    carouselThumbnails
      .querySelectorAll(
        '.carousel-thumbnail'
      )
      .forEach(
        (thumb, index) => {
          thumb.classList.toggle(
            'active',
            index ===
              modalState.currentVideoIndex
          );
        }
      );
  }


  function scrollActiveThumbIntoView() {
    const activeThumb =
      carouselThumbnails.querySelector(
        '.carousel-thumbnail.active'
      );

    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }


  /* =========================================================
     VIDEO FRAME
     ========================================================= */

  function setVideoFrameWithoutHistory(
    url
  ) {
    const oldFrame =
      videoFrame;

    const parent =
      oldFrame.parentNode;

    if (!parent) {
      return;
    }


    const newFrame =
      document.createElement(
        'iframe'
      );


    Array.from(
      oldFrame.attributes
    ).forEach(
      attribute => {

        if (
          attribute.name !== 'src'
        ) {
          newFrame.setAttribute(
            attribute.name,
            attribute.value
          );
        }
      }
    );


    newFrame.src =
      url;


    parent.replaceChild(
      newFrame,
      oldFrame
    );


    videoFrame =
      newFrame;
  }


  /* =========================================================
     STOP VIDEO
     ========================================================= */

  function stopVideoPlayback() {
    if (
      !videoFrame ||
      !videoFrame.parentNode
    ) {
      return;
    }


    const oldFrame =
      videoFrame;

    const parent =
      oldFrame.parentNode;


    const blankFrame =
      document.createElement(
        'iframe'
      );


    Array.from(
      oldFrame.attributes
    ).forEach(
      attribute => {

        if (
          attribute.name !== 'src'
        ) {
          blankFrame.setAttribute(
            attribute.name,
            attribute.value
          );
        }
      }
    );


    parent.replaceChild(
      blankFrame,
      oldFrame
    );


    videoFrame =
      blankFrame;
  }


  /* =========================================================
     PLAY CURRENT VIDEO
     ========================================================= */

  async function playCurrentVideo() {

    if (
      !modalState.currentProject
    ) {
      return;
    }


    const project =
      modalState.currentProject;


    const url =
      project.links[
        modalState.currentVideoIndex
      ];


    const baseUrl =
      formatVideoUrl(url);


    const ratio =
      await getVideoAspectRatio(
        url
      );


    applyVideoRatio(
      ratio
    );

    updateModalLayout(
      ratio
    );


    const isYouTube =
      baseUrl.includes(
        'youtube.com/embed/'
      );


    /*
     * IMPORTANT :
     *
     * muted=0 demande explicitement
     * à Vimeo de conserver le son.
     */

    const videoUrl =
      appendQueryParams(
        baseUrl,
        isYouTube
          ? {
              autoplay: '1',
              rel: '0',
              playsinline: '1',
              muted: '0'
            }
          : {
              autoplay: '1',
              playsinline: '1',
              muted: '0'
            }
      );


    setVideoFrameWithoutHistory(
      videoUrl
    );


    updateActiveThumbnail();

    scrollActiveThumbIntoView();

    await renderInfoPanel(
      project
    );

    updateStickyMetrics();
  }


  /* =========================================================
     RESET MODAL
     ========================================================= */

  function resetModalUI() {

    carouselThumbnails.innerHTML =
      '';

    carouselThumbnails.style.display =
      'none';

    previousButton.style.display =
      'none';

    nextButton.style.display =
      'none';


    /*
     * Coupe réellement Vimeo.
     */

    stopVideoPlayback();


    videoInfoTitle.textContent =
      '';

    videoInfoSubtitle.textContent =
      '';

    videoCredits.innerHTML =
      '';

    videoCredits.classList.remove(
      'is-long'
    );


    modalState.currentProject =
      null;

    modalState.currentVideoIndex =
      0;


    applyVideoRatio(
      DEFAULT_RATIO
    );

    updateModalLayout(
      DEFAULT_RATIO
    );


    modal.classList.remove(
      'has-carousel',
      'no-carousel',
      'is-mobile-carousel-layout'
    );


    if (modalShell) {
      modalShell.scrollTop = 0;
    }
  }


  /* =========================================================
     OPEN / CLOSE
     ========================================================= */

  function openModal() {

    modal.style.display =
      'block';

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'modal-open'
    );


    if (
      !modalState.historyEntryAdded
    ) {

      history.pushState(
        {
          videoModal: true
        },
        '',
        window.location.href
      );

      modalState.historyEntryAdded =
        true;
    }
  }


  function closeModal(
    fromHistory = false
  ) {

    const lastTrigger =
      modalState.lastTrigger;


    const shouldGoBack =
      !fromHistory &&
      modalState.historyEntryAdded;


    resetModalUI();


    modal.style.display =
      'none';

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.classList.remove(
      'modal-open'
    );


    modalState.historyEntryAdded =
      false;


    if (lastTrigger) {
      lastTrigger.focus();
    }


    if (shouldGoBack) {
      history.back();
    }
  }


  /* =========================================================
     OPEN VIDEO
     ========================================================= */

  function openVideo(
    project,
    trigger
  ) {

    resetModalUI();

    closeAboutModal();


    modalState.lastTrigger =
      trigger;


    modalState.currentProject = {
      ...project,
      firstLink:
        project.firstLink ||
        project.links[0]
    };


    modal.classList.add(
      'no-carousel'
    );


    openModal();

    playCurrentVideo();
  }


  /* =========================================================
     OPEN CAROUSEL
     ========================================================= */

  function openCarousel(
    project,
    trigger
  ) {

    resetModalUI();

    closeAboutModal();


    modalState.lastTrigger =
      trigger;


    modalState.currentProject = {
      ...project,
      firstLink:
        project.firstLink ||
        project.links[0]
    };


    modal.classList.add(
      'has-carousel'
    );


    modal.classList.toggle(
      'is-mobile-carousel-layout',
      window.innerWidth <= 768
    );


    renderCarouselThumbnails(
      project
    );


    previousButton.style.display =
      'flex';

    nextButton.style.display =
      'flex';


    openModal();

    playCurrentVideo();
  }


  /* =========================================================
     CAROUSEL NAVIGATION
     ========================================================= */

  function goToPreviousVideo() {

    if (
      !modalState.currentProject
    ) {
      return;
    }


    const total =
      modalState.currentProject
        .links.length;


    modalState.currentVideoIndex =
      (
        modalState.currentVideoIndex -
        1 +
        total
      ) % total;


    playCurrentVideo();
  }


  function goToNextVideo() {

    if (
      !modalState.currentProject
    ) {
      return;
    }


    modalState.currentVideoIndex =
      (
        modalState.currentVideoIndex +
        1
      ) %
      modalState.currentProject
        .links.length;


    playCurrentVideo();
  }


  /* =========================================================
     ABOUT
     ========================================================= */

  function openAboutModal() {

    aboutModal.classList.add(
      'open'
    );

    aboutModal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'modal-open'
    );


    menuToggle.classList.add(
      'open'
    );

    menuToggle.setAttribute(
      'aria-expanded',
      'true'
    );
  }


  function closeAboutModal() {

    aboutModal.classList.remove(
      'open'
    );

    aboutModal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.classList.remove(
      'modal-open'
    );


    menuToggle.classList.remove(
      'open'
    );

    menuToggle.setAttribute(
      'aria-expanded',
      'false'
    );
  }


  function toggleAbout(event) {

    event.preventDefault();

    aboutModal.classList.contains(
      'open'
    )
      ? closeAboutModal()
      : openAboutModal();
  }


  /* =========================================================
     HEADER
     ========================================================= */

  function updateHeaderState() {

    topHeader.classList.toggle(
      'is-scrolled',
      window.scrollY > 24
    );
  }


  /* =========================================================
     FILTER BUTTONS
     ========================================================= */

  filterButtons.forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          setActiveFilter(
            button.dataset.filter
          );


          window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
          });
        }
      );
    }
  );


  /* =========================================================
     BUTTONS
     ========================================================= */

  aboutButton.addEventListener(
    'click',
    toggleAbout
  );


  menuToggle.addEventListener(
    'click',
    toggleAbout
  );


  aboutClose.addEventListener(
    'click',
    closeAboutModal
  );


  closeButton.addEventListener(
    'click',
    () => closeModal()
  );


  previousButton.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      goToPreviousVideo();
    }
  );


  nextButton.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      goToNextVideo();
    }
  );


  /* =========================================================
     CLICK OUTSIDE
     ========================================================= */

  modal.addEventListener(
    'click',
    event => {

      if (
        event.target === modal
      ) {
        closeModal();
      }
    }
  );


  aboutModal.addEventListener(
    'click',
    event => {

      if (
        event.target === aboutModal
      ) {
        closeAboutModal();
      }
    }
  );


  /* =========================================================
     LANGUAGE
     ========================================================= */

  langButtons.forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          const language =
            button.dataset.lang;


          langButtons.forEach(
            item => {

              item.classList.toggle(
                'active',
                item.dataset.lang ===
                  language
              );
            }
          );


          bioTexts.forEach(
            text => {

              text.classList.toggle(
                'active',
                text.dataset.langContent ===
                  language
              );
            }
          );
        }
      );
    }
  );


  /* =========================================================
     KEYBOARD
     ========================================================= */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        if (
          modal.getAttribute(
            'aria-hidden'
          ) === 'false'
        ) {
          closeModal();
        }


        if (
          aboutModal.getAttribute(
            'aria-hidden'
          ) === 'false'
        ) {
          closeAboutModal();
        }
      }


      if (
        !modalState.currentProject ||
        modal.getAttribute(
          'aria-hidden'
        ) === 'true'
      ) {
        return;
      }


      if (
        modalState.currentProject
          .links.length > 1
      ) {

        if (
          event.key === 'ArrowLeft'
        ) {
          goToPreviousVideo();
        }


        if (
          event.key === 'ArrowRight'
        ) {
          goToNextVideo();
        }
      }
    }
  );


  /* =========================================================
     BROWSER BACK
     ========================================================= */

  window.addEventListener(
    'popstate',
    () => {

      if (
        modalState.currentProject
      ) {
        closeModal(true);
      }
    }
  );


  /* =========================================================
     RESIZE
     ========================================================= */

  window.addEventListener(
    'resize',
    () => {

      if (
        !modalState.currentProject
      ) {
        return;
      }


      modal.classList.toggle(
        'is-mobile-carousel-layout',
        modalState.currentProject
          .links.length > 1 &&
        window.innerWidth <= 768
      );


      const url =
        modalState.currentProject
          .links[
            modalState.currentVideoIndex
          ];


      getVideoAspectRatio(
        url
      ).then(
        ratio => {

          applyVideoRatio(
            ratio
          );

          updateModalLayout(
            ratio
          );

          updateCreditsColumnMode();

          updateStickyMetrics();
        }
      );
    }
  );


  /* =========================================================
     SCROLL
     ========================================================= */

  window.addEventListener(
    'scroll',
    updateHeaderState,
    {
      passive: true
    }
  );


  /* =========================================================
     TOUCH SWIPE
     ========================================================= */

  let touchStartX = 0;


  videoFrameWrapper.addEventListener(
    'touchstart',
    event => {

      touchStartX =
        event.changedTouches[0]
          .clientX;

    },
    {
      passive: true
    }
  );


  videoFrameWrapper.addEventListener(
    'touchend',
    event => {

      if (
        !modalState.currentProject ||
        modalState.currentProject
          .links.length <= 1
      ) {
        return;
      }


      const delta =
        event.changedTouches[0]
          .clientX -
        touchStartX;


      if (
        Math.abs(delta) < 40
      ) {
        return;
      }


      if (delta > 0) {
        goToPreviousVideo();
      } else {
        goToNextVideo();
      }
    },
    {
      passive: true
    }
  );


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  updateHeaderState();

  loadProjects();
});

/* PHOTOGRAPHY */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const gallery = document.getElementById('photoGallery');
  const viewer = document.getElementById('photoLightbox');
  if (!gallery || !viewer) return;

  // Replaces the old single-image viewer with a horizontal gallery.
  viewer.innerHTML = `
    <div class="photo-viewer-top">
      <button id="photoReturn" type="button" aria-label="Retour aux photos" title="Retour aux photos">←</button>
      <p id="photoCounter" aria-live="polite"></p>
      <button id="photoLightboxClose" type="button" aria-label="Fermer">×</button>
    </div>
    <div id="photoTrack" class="photo-track" tabindex="0" aria-label="Photographies de la série"></div>
    <div class="photo-viewer-bottom">
      <button id="photoPrev" type="button" aria-label="Photo précédente">←</button>
      <p id="photoSeriesName"></p>
      <button id="photoNext" type="button" aria-label="Photo suivante">→</button>
    </div>`;

  const track = document.getElementById('photoTrack');
  const counter = document.getElementById('photoCounter');
  const previous = document.getElementById('photoPrev');
  const next = document.getElementById('photoNext');
  let current = null, index = 0, trigger = null, frame = 0;
  let seriesList = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const photoPath = (s, n, ext = s.extension) =>
    ['photos', s.folder, `${s.prefix}-${n}.${ext}`].map(encodeURIComponent).join('/');

  function probe(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({src, width: img.naturalWidth, height: img.naturalHeight});
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadSeries(s) {
    let first = null;
    for (const ext of [...new Set([s.extension, 'JPG', 'jpg', 'jpeg', 'JPEG', 'png', 'PNG', 'webp'])]) {
      first = await probe(photoPath(s, 1, ext));
      if (first) { s.extension = ext; break; }
    }
    if (!first) throw new Error(`Images introuvables : photos/${s.folder}`);
    const items = [first];
    if (s.count) {
      const rest = await Promise.all(Array.from({length:s.count - 1}, (_, i) => probe(photoPath(s, i + 2))));
      if (rest.some(item => !item)) throw new Error(`Photo manquante dans photos/${s.folder} : vérifie la numérotation et le nombre.`);
      items.push(...rest);
    } else {
      for (let n = 2; n <= 200; n++) {
        const item = await probe(photoPath(s, n));
        if (!item) break;
        items.push(item);
      }
    }
    s.items = items;
  }

  function updateControls() {
    if (!current) return;
    counter.textContent = `${index + 1} / ${current.items.length}`;
    previous.disabled = index === 0;
    next.disabled = index === current.items.length - 1;
    track.querySelectorAll('.photo-slide').forEach((slide, i) => {
      if (i === index) slide.setAttribute('aria-current', 'true');
      else slide.removeAttribute('aria-current');
    });
  }

  function goTo(i, smooth = true) {
    if (!current) return;
    index = Math.max(0, Math.min(i, current.items.length - 1));
    const slide = track.children[index];
    const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    track.scrollTo({left, behavior:smooth && !reduced.matches ? 'smooth' : 'instant'});
    updateControls();
  }

  function openSeries(s, i, button, push = true) {
    current = s; index = i; trigger = button || trigger;
    track.replaceChildren();
    document.getElementById('photoSeriesName').textContent = s.title;
    s.items.forEach((item, n) => {
      const slide = document.createElement('div');
      slide.className = 'photo-slide';
      slide.style.setProperty('--photo-ratio', item.width / item.height);
      const img = document.createElement('img');
      img.src = item.src; img.width = item.width; img.height = item.height;
      img.alt = `${s.title} — ${n + 1}`; img.draggable = false; img.decoding = 'async';
      slide.append(img); slide.addEventListener('click', () => goTo(n));
      track.append(slide);
    });
    if (push) history.pushState({photoViewer:s.id}, '');
    if (!viewer.open) viewer.showModal();
    document.body.classList.add('photo-viewer-open');
    requestAnimationFrame(() => goTo(i, false));
  }

  function hideViewer() {
    current = null;
    if (viewer.open) viewer.close();
    document.body.classList.remove('photo-viewer-open');
    track.replaceChildren();
    trigger?.focus({preventScroll:true});
  }

  function closeViewer() {
    if (history.state?.photoViewer && viewer.open) history.back();
    else hideViewer();
  }

  function renderSeries(s, section) {
    section.replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = s.title;
    if (s.items.length > 4) {
      const count = document.createElement('span');
      count.className = 'photo-series-count';
      count.textContent = `${s.items.length} photos`;
      heading.append(count);
    }
    const visibleItems = s.items.slice(0, 4);
    const row = document.createElement('div'); row.className = 'photo-series-row';
    // Each column is proportional to the image ratio: all images have equal height.
    row.style.gridTemplateColumns = visibleItems.map(item => `${item.width / item.height}fr`).join(' ');
    visibleItems.forEach((item, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-tile';
      button.setAttribute('aria-label', `Agrandir ${s.title}, photo ${i + 1} sur ${s.items.length}`);
      const img = document.createElement('img');
      img.src = item.src; img.width = item.width; img.height = item.height;
      img.alt = `${s.title} — ${i + 1}`; img.loading = 'lazy'; img.decoding = 'async';
      button.append(img); button.addEventListener('click', () => openSeries(s, i, button));
      row.append(button);
    });
    section.append(heading, row);
  }

  document.getElementById('photoReturn').addEventListener('click', closeViewer);
  document.getElementById('photoLightboxClose').addEventListener('click', closeViewer);
  previous.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));
  viewer.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); goTo(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!current) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let closest = 0, distance = Infinity;
      Array.from(track.children).forEach((slide, i) => {
        const delta = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
        if (delta < distance) { distance = delta; closest = i; }
      });
      index = closest; updateControls();
    });
  }, {passive:true});
  window.addEventListener('resize', () => { if (current) goTo(index, false); });
  window.addEventListener('popstate', () => {
    const s = seriesList.find(s => s.id === history.state?.photoViewer);
    if (s?.items) {
      document.querySelector('[data-filter="photography"]').click();
      openSeries(s, 0, null, false);
    } else if (viewer.open) hideViewer();
  });
  document.addEventListener('portfoliofilter', event => {
    gallery.hidden = event.detail !== 'photography';
    const oldAlbum = document.getElementById('photoAlbum');
    if (oldAlbum) oldAlbum.hidden = true;
  });

  async function init() {
    try {
      const response = await fetch('projects.txt');
      if (!response.ok) throw new Error('Impossible de charger projects.txt.');
      const block = (await response.text()).split('[PHOTOS]')[1] || '';
      seriesList = block.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map((line, i) => {
        const [title, folder, prefix, count, cover, extension] = line.split('|').map(v => v.trim());
        if (!title || !folder || !prefix || !/^(auto|[1-9]\d*)$/i.test(count || '') || [folder,prefix].some(v => v.includes('/') || v === '..')) throw new Error(`Ligne photo invalide : ${line}`);
        return {id:`photo-${i}`, title, folder, prefix, count:count.toLowerCase() === 'auto' ? 0 : Number(count), extension:extension || 'JPG'};
      });
      gallery.replaceChildren();
      if (!seriesList.length) { gallery.textContent = 'Aucune série photo pour le moment.'; return; }
      // Placeholders keep the order from projects.txt, regardless of loading time.
      await Promise.all(seriesList.map(async s => {
        const section = document.createElement('section'); section.className = 'photo-series';
        const status = document.createElement('p'); status.className = 'photo-status'; status.textContent = `${s.title} — chargement…`;
        section.append(status); gallery.append(section);
        try { await loadSeries(s); renderSeries(s, section); }
        catch (error) { status.textContent = error.message; }
      }));
    } catch (error) { gallery.textContent = error.message; }
  }
  init();
});
