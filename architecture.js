/* Shared navigation is static HTML so it remains usable without JavaScript. */
(function () {
 'use strict';
 document.documentElement.classList.add('architecture-ready');
 // New pages and legacy notebooks expose the same current-topic hint to the question helper.
 const page = location.pathname.split('/').pop() || 'index.html';
 const map = {'transforms.html':'transforms','notes-transforms.html':'transforms','notes-iir-fir.html':'iir-fir','engineering.html':'iir-fir','kalman.html':'kalman','notes-kalman.html':'kalman','frequency.html':'spectrum','motion.html':'control','pressure.html':'iir-fir'};
 const requested = new URLSearchParams(location.search).get('topic');
 const valid = ['transforms','iir-fir','kalman','control','transfer','pll','spectrum'];
 const topic = valid.includes(requested) ? requested : map[page];
 if (topic) document.body.dataset.learningTopic = topic;
})();
