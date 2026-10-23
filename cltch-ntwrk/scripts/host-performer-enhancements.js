(function () {
  function initAssurancePack(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var items = [
      'Stage safety checklist completed',
      'Insurance certificates uploaded',
      'Child performer supervision notes (if needed)',
      'Venue emergency contacts logged'
    ];
    var list = document.createElement('ul');
    list.className = 'assurance-list';
    items.forEach(function (label) {
      var li = document.createElement('li');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'assurance-' + label.replace(/\s+/g, '-');
      li.appendChild(checkbox);
      var span = document.createElement('span');
      span.textContent = ' ' + label;
      li.appendChild(span);
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function initFeedbackForms(hostFormId, perfFormId) {
    var hostForm = document.getElementById(hostFormId);
    var perfForm = document.getElementById(perfFormId);
    function attach(form, role) {
      if (!form) return;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var data = new FormData(form);
        var summary = Array.from(data.entries()).map(function (entry) {
          return entry[0] + ': ' + entry[1];
        }).join(' | ');
        alert(role + ' feedback submitted: ' + summary);
        form.reset();
      });
    }
    attach(hostForm, 'Host');
    attach(perfForm, 'Performer');
  }

  function initLocalLawAlerts(triggerId, messageId) {
    var trigger = document.getElementById(triggerId);
    var message = document.getElementById(messageId);
    if (!trigger || !message || !window.LegalComponents) return;
    trigger.addEventListener('change', function () {
      var zip = trigger.value.trim();
      if (!zip) return;
      window.LegalComponents.fetchLocalLawData().then(function (laws) {
        var match = laws.find(function (law) {
          return law.jurisdiction.toLowerCase().includes(zip.toLowerCase());
        });
        if (match) {
          message.textContent = 'Local rule alert: ' + match.notes.join('; ');
          message.hidden = false;
        } else {
          message.textContent = 'Operating under standard nationwide compliance protocols.';
          message.hidden = false;
        }
      });
    });
  }

  function initDocumentVault(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var list = document.createElement('div');
    list.className = 'document-vault-list';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Describe document (contract, rider, insurance)';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Add to Vault';
    button.addEventListener('click', function () {
      if (!input.value.trim()) return;
      var chip = document.createElement('span');
      chip.className = 'vault-chip';
      chip.textContent = input.value.trim();
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        list.removeChild(chip);
      });
      chip.appendChild(remove);
      list.appendChild(chip);
      input.value = '';
    });
    container.appendChild(input);
    container.appendChild(button);
    container.appendChild(list);
  }

  function initCommandCenter(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var tasks = [
      'Verify insurance renewal (due 5 days before gig)',
      'Child performer permit check (if flagged)',
      'Confirm background checks for new crew',
      'Review compliance checklist before closing a booking'
    ];
    var list = document.createElement('ul');
    list.className = 'command-center-list';
    tasks.forEach(function (task) {
      var li = document.createElement('li');
      li.textContent = task;
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function initIntentFilters(filterId) {
    var filter = document.getElementById(filterId);
    if (!filter) return;
    filter.addEventListener('change', function () {
      var value = filter.value;
      var entries = document.querySelectorAll('.gig-entry');
      entries.forEach(function (entry) {
        if (!value || value === 'all' || entry.dataset.intent === value) {
          entry.hidden = false;
        } else {
          entry.hidden = true;
        }
      });
    });
  }

  window.Enhancements = {
    initAssurancePack: initAssurancePack,
    initFeedbackForms: initFeedbackForms,
    initLocalLawAlerts: initLocalLawAlerts,
    initDocumentVault: initDocumentVault,
    initCommandCenter: initCommandCenter,
    initIntentFilters: initIntentFilters
  };
})();
