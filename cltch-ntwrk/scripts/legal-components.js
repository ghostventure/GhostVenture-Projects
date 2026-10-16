(function () {
  var localLaws = null;

  function fetchLocalLawData() {
    if (localLaws) {
      return Promise.resolve(localLaws);
    }
    return fetch('data/local-laws.json').then(function (res) {
      if (!res.ok) throw new Error('local laws data unavailable');
      return res.json();
    }).then(function (data) {
      localLaws = Array.isArray(data) ? data : [];
      return localLaws;
    }).catch(function () {
      localLaws = [];
      return localLaws;
    });
  }

  function createElement(tag, options) {
    var el = document.createElement(tag);
    if (options) {
      Object.keys(options).forEach(function (key) {
        if (key === 'className') {
          el.className = options[key];
        } else if (key === 'text') {
          el.textContent = options[key];
        } else if (key === 'html') {
          el.innerHTML = options[key];
        } else {
          el.setAttribute(key, options[key]);
        }
      });
    }
    return el;
  }

  function renderComplianceSnapshot(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var cards = [
	      { title: 'Accessibility', body: 'WCAG 2.2 AA is the practical target for public pages and core booking workflows.' },
	      { title: 'Privacy Rights', body: 'Verified privacy requests are acknowledged promptly and generally completed within 45 days.' },
	      { title: 'Copyright / DMCA', body: 'DMCA notices, counter-notices, portfolio content, flyers, and repeat-infringer signals are handled through the legal path.' },
	      { title: 'Local Obligations', body: 'Hosts, venues, and performers remain responsible for permits, insurance, age rules, licensing, and event-specific requirements.' }
    ];
    target.innerHTML = '';
    var grid = createElement('div', { className: 'compliance-grid' });
    cards.forEach(function (card) {
      var panel = createElement('div', { className: 'compliance-card' });
      panel.appendChild(createElement('h3', { text: card.title }));
      panel.appendChild(createElement('p', { text: card.body }));
      grid.appendChild(panel);
    });
    target.appendChild(grid);
    fetchLocalLawData().then(function (laws) {
      if (!laws.length) return;
      var list = createElement('ul', { className: 'local-law-list' });
      laws.slice(0, 3).forEach(function (law) {
        var text = law.jurisdiction + ' (' + law.type + ') – ' + law.notes.join(' · ');
        list.appendChild(createElement('li', { text: text }));
      });
      var footer = createElement('div', { className: 'local-law-footer' });
      footer.textContent = 'Learn more about local obligations where you transact.';
      target.appendChild(list);
      target.appendChild(footer);
    });
  }

  function renderFAQ(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var groups = [
      {
        label: 'Getting Started',
        items: [
	          { q: 'How do I create an account?', a: 'Sign up, verify your email if prompted, and choose the Host or Performer workspace that fits what you need to do.' },
	          { q: 'Who can use CLTCH?', a: 'CLTCH.NTWRK is limited to users 18 and older. Hosts, venues, performers, DJs, musicians, photographers, cinematographers, models, and related creative talent can use the platform when they provide accurate profile information.' }
        ]
      },
      {
        label: 'Pricing & Fees',
        items: [
	          { q: 'What does CLTCH charge?', a: 'CLTCH may show platform fees, processing fees, or optional paid profile features where those features are active. Pricing shown in-product controls the specific workflow.' },
	          { q: 'When do payouts occur?', a: 'If CLTCH provides an active payout or payment path, the displayed payment terms apply. If payment is handled directly between host and performer, those users remain responsible for that payment relationship.' }
        ]
      },
      {
        label: 'Legal & Compliance',
        items: [
	          { q: 'Which laws cover my bookings?', a: 'CLTCH designs for privacy, accessibility, copyright, consumer-protection, and trust/safety obligations, but hosts and performers remain responsible for event permits, licenses, insurance, age rules, taxes, and local venue requirements.' },
	          { q: 'How do I manage privacy rights?', a: 'Email privacy@cltch.ntwrk or use the contact form. We usually acknowledge within 10 business days and resolve requests within 45, unless a lawful extension is needed.' },
	          { q: 'Why can’t minors sign up?', a: 'Accounts are limited to users 18 and older. If we learn that an underage person created an account, we close it and delete or restrict associated data as required.' }
        ]
      },
      {
        label: 'Hosts & Performers',
        items: [
          { q: 'How does Gig Radar match opportunities?', a: 'We weight role, genres, availability, location, and intent filters to deliver high-match gigs; saved gigs and insights help you decide quickly.' },
	          { q: 'How do I report compliance issues?', a: 'Use support.html or email legal@cltch.ntwrk to flag safety, copyright, privacy, payment, accessibility, or suspicious booking concerns.' }
        ]
      }
    ];
    target.innerHTML = '';
    var toolbar = createElement('div', { className: 'faq-tools', role: 'search', 'aria-label': 'Search frequently asked questions' });
    var search = createElement('input', { type: 'search', className: 'faq-search', placeholder: 'Search questions and answers', 'aria-label': 'Search questions and answers' });
    var expand = createElement('button', { type: 'button', className: 'faq-tool-button', text: 'Expand all' });
    var collapse = createElement('button', { type: 'button', className: 'faq-tool-button', text: 'Collapse all' });
    var status = createElement('p', { className: 'faq-search-status', role: 'status', 'aria-live': 'polite' });
    toolbar.appendChild(search); toolbar.appendChild(expand); toolbar.appendChild(collapse);
    target.appendChild(toolbar); target.appendChild(status);
    var allItems = [];
    groups.forEach(function (group, groupIndex) {
      var wrapper = createElement('div', { className: 'faq-group' });
      wrapper.setAttribute('data-faq-group', '');
      wrapper.appendChild(createElement('h2', { className: 'section-label', text: group.label }));
      group.items.forEach(function (item, itemIndex) {
        var faqItem = createElement('article', { className: 'faq-item' });
        var answerId = 'faq-answer-' + groupIndex + '-' + itemIndex;
        var question = createElement('button', { type: 'button', className: 'faq-q', 'aria-expanded': 'false', 'aria-controls': answerId });
        var questionText = createElement('span', { text: item.q });
        var arrow = createElement('span', { className: 'faq-chevron', 'aria-hidden': 'true', text: '⌄' });
        question.appendChild(questionText); question.appendChild(arrow);
        var answer = createElement('div', { className: 'faq-a', id: answerId, hidden: '' });
        answer.textContent = item.a;
        question.addEventListener('click', function () {
          var isOpen = question.getAttribute('aria-expanded') === 'true';
          question.setAttribute('aria-expanded', String(!isOpen));
          answer.hidden = isOpen;
          faqItem.classList.toggle('open', !isOpen);
        });
        faqItem.appendChild(question);
        faqItem.appendChild(answer);
        wrapper.appendChild(faqItem);
        allItems.push({ item: faqItem, question: question, answer: answer, text: (group.label + ' ' + item.q + ' ' + item.a).toLocaleLowerCase() });
      });
      target.appendChild(wrapper);
    });
    function setExpanded(entry, open) {
      entry.question.setAttribute('aria-expanded', String(open));
      entry.answer.hidden = !open;
      entry.item.classList.toggle('open', open);
    }
    expand.addEventListener('click', function () { allItems.forEach(function (entry) { if (!entry.item.hidden) setExpanded(entry, true); }); });
    collapse.addEventListener('click', function () { allItems.forEach(function (entry) { setExpanded(entry, false); }); });
    search.addEventListener('input', function () {
      var query = search.value.trim().toLocaleLowerCase();
      var visible = 0;
      allItems.forEach(function (entry) {
        var show = !query || entry.text.indexOf(query) !== -1;
        entry.item.hidden = !show;
        if (!show) setExpanded(entry, false);
        if (show) visible += 1;
      });
      target.querySelectorAll('[data-faq-group]').forEach(function (group) {
        group.hidden = !group.querySelector('.faq-item:not([hidden])');
      });
      status.textContent = query ? (visible ? visible + ' matching question' + (visible === 1 ? '' : 's') + '.' : 'No questions match that search.') : allItems.length + ' questions. Search or choose a category.';
    });
    search.dispatchEvent(new Event('input'));
  }

  function showAccessibilityBanner(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var banner = createElement('div', { className: 'accessibility-banner' });
	    banner.innerHTML = '<strong>Accessibility & Compliance</strong>: keyboard-first navigation, visible focus states, policy pages, and clear escalation routes are part of the product workflow. <a href="accessibility.html">Learn more</a> or review <a href="compliance.html">Compliance</a>.';
    target.appendChild(banner);
  }

  function initPolicyLayout() {
    var main = document.querySelector('main.container');
    if (!main) return;
    main.classList.add('legal-layout');
    var sections = main.querySelectorAll('h2');
    var table = createElement('div', { className: 'legal-table-grid', role: 'table' });
    sections.forEach(function (heading) {
      var wrapper = heading.closest('section');
      if (wrapper) {
        table.appendChild(wrapper);
        return;
      }
      var section = createElement('section', { className: 'legal-section', role: 'row' });
      var titleCell = createElement('div', { className: 'legal-section-title', role: 'rowheader' });
      var bodyCell = createElement('div', { className: 'legal-section-body', role: 'cell' });
      var sibling = heading.nextElementSibling;
      heading.parentNode.insertBefore(section, heading);
      titleCell.appendChild(heading);
      section.appendChild(titleCell);
      section.appendChild(bodyCell);
      while (sibling && sibling.tagName !== 'H2') {
        var next = sibling.nextElementSibling;
        bodyCell.appendChild(sibling);
        sibling = next;
      }
      table.appendChild(section);
    });
    if (table.children.length) {
      main.appendChild(table);
    }
  }

  window.LegalComponents = {
    renderComplianceSnapshot: renderComplianceSnapshot,
    renderFAQ: renderFAQ,
    showAccessibilityBanner: showAccessibilityBanner,
    initPolicyLayout: initPolicyLayout,
    fetchLocalLawData: fetchLocalLawData
  };
})();
