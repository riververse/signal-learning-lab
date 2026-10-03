/* Shared directory only. Experiment controls and calculations are independent. */
(function () {
  'use strict';
  const header = document.querySelector('.lab-site-header');
  if (!header) return;
  const toggle = header.querySelector('.lab-nav-toggle');
  const topics = [...header.querySelectorAll('.lab-nav-topic')];
  const smallScreen = window.matchMedia('(max-width: 1120px)');
  let open = false;
  function closeTopics(except) {
    topics.forEach(function (topic) { if (topic !== except) topic.open = false; });
  }
  function render() {
    header.dataset.menuOpen = String(open);
    toggle.setAttribute('aria-expanded', String(!smallScreen.matches || open));
  }
  toggle.hidden = false;
  header.dataset.navigationReady = 'true';
  toggle.addEventListener('click', function () {
    open = !open;
    if (!open) closeTopics();
    render();
  });
  topics.forEach(function (topic) {
    topic.addEventListener('toggle', function () {
      if (topic.open) closeTopics(topic);
    });
  });
  header.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const activeTopic = topics.find(function (topic) { return topic.open; });
    if (activeTopic) {
      event.preventDefault();
      activeTopic.open = false;
      activeTopic.querySelector('summary').focus();
    } else if (open && smallScreen.matches) {
      event.preventDefault();
      open = false;
      render();
      toggle.focus();
    }
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.lab-nav-topic')) closeTopics();
    if (!header.contains(event.target) && open && smallScreen.matches) {
      open = false;
      render();
    }
  });
  document.addEventListener('focusin', function (event) {
    closeTopics(event.target.closest('.lab-nav-topic'));
  });
  function resize() {
    const focusedTopic = topics.find(function (topic) { return topic.contains(document.activeElement); });
    const focusWasInNav = header.querySelector('.lab-site-nav').contains(document.activeElement);
    closeTopics();
    open = false;
    render();
    if (smallScreen.matches && focusWasInNav) toggle.focus();
    else if (focusedTopic) focusedTopic.querySelector('summary').focus();
  }
  if (smallScreen.addEventListener) smallScreen.addEventListener('change', resize);
  else smallScreen.addListener(resize);
  render();
})();
