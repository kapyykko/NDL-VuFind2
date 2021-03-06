/*global VuFind, finna, removeHashFromLocation, getNewRecordTab, ajaxLoadTab */
finna.record = (function finnaRecord() {
  function initDescription() {
    var description = $('#description_text');
    if (description.length) {
      var id = description.data('id');
      var url = VuFind.path + '/AJAX/JSON?method=getDescription&id=' + id;
      $.getJSON(url)
        .done(function onGetDescriptionDone(response) {
          if (response.data.length > 0) {
            description.html(response.data);

            // Make sure any links open in a new window
            description.find('a').attr('target', '_blank');

            description.wrapInner('<div class="truncate-field wide"><p class="summary"></p></div>');
            finna.layout.initTruncate(description);
            if (!$('.hide-details-button').hasClass('hidden')) {
              $('.record-information .description').addClass('too-long');
              $('.record-information .description .more-link.wide').click();
            }
          } else {
            description.hide();
          }
        })
        .fail(function onGetDescriptionFail() {
          description.hide();
        });
    }
  }

  function initHideDetails() {
    $('.show-details-button').click(function onClickShowDetailsButton() {
      $('.record-information .record-details-more').removeClass('hidden');
      $(this).addClass('hidden');
      $('.hide-details-button').removeClass('hidden');
      $('.record .description .more-link.wide').click();
      sessionStorage.setItem('finna_record_details', '1');
    });
    $('.hide-details-button').click (function onClickHideDetailsButton() {
      $('.record-information .record-details-more').addClass('hidden');
      $(this).addClass('hidden');
      $('.show-details-button').removeClass('hidden');
      $('.record .description .less-link.wide').click();
      sessionStorage.removeItem('finna_record_details');
    });
    if ($('.record-information').height() > 350 && $('.show-details-button')[0]) {
      $('.record-information .description').addClass('too-long');
      if (sessionStorage.getItem('finna_record_details')) {
        $('.show-details-button').click();
      } else {
        $('.hide-details-button').click();
      }
    }
  }

  function getRequestLinkData(element, recordId) {
    var vars = {}, hash;
    var hashes = element.href.slice(element.href.indexOf('?') + 1).split('&');

    for (var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      var x = hash[0];
      var y = hash[1];
      vars[x] = y;
    }
    vars.id = recordId;
    return vars;
  }

  function checkRequestsAreValid(elements, requestType) {
    if (!elements[0]) {
      return;
    }
    var recordId = elements[0].href.match(/\/Record\/([^/]+)\//)[1];

    var vars = [];
    $.each(elements, function handleElement(idx, element) {
      vars.push(getRequestLinkData(element, recordId));
    });


    var url = VuFind.path + '/AJAX/JSON?method=checkRequestsAreValid';
    $.ajax({
      dataType: 'json',
      data: {id: recordId, requestType: requestType, data: vars},
      method: 'POST',
      cache: false,
      url: url
    })
      .done(function onCheckRequestDone(responses) {
        $.each(responses.data, function handleResponse(idx, response) {
          var element = elements[idx];
          if (response.status) {
            $(element).removeClass('disabled')
              .html(response.msg);
          } else {
            $(element).remove();
          }
        });
      });
  }

  function setUpCheckRequest() {
    checkRequestsAreValid($('.expandedCheckRequest').removeClass('expandedCheckRequest'), 'Hold');
    checkRequestsAreValid($('.expandedCheckStorageRetrievalRequest').removeClass('expandedCheckStorageRetrievalRequest'), 'StorageRetrievalRequest');
    checkRequestsAreValid($('.expandedCheckILLRequest').removeClass('expandedCheckILLRequest'), 'ILLRequest');
  }

  function initHoldingsControls() {
    $('.holdings-container-heading').click(function onClickHeading(e) {
      if ($(e.target).hasClass('location-service') || $(e.target).parents().hasClass('location-service')) {
        return;
      }
      $(this).nextUntil('.holdings-container-heading').toggleClass('collapsed');
      if ($('.location .fa', this).hasClass('fa-arrow-down')) {
        $('.location .fa', this).removeClass('fa-arrow-down');
        $('.location .fa', this).addClass('fa-arrow-right');
      }
      else {
        $('.location .fa', this).removeClass('fa-arrow-right');
        $('.location .fa', this).addClass('fa-arrow-down');
        var rows = $(this).nextUntil('.holdings-container-heading');
        checkRequestsAreValid(rows.find('.collapsedCheckRequest').removeClass('collapsedCheckRequest'), 'Hold', 'holdBlocked');
        checkRequestsAreValid(rows.find('.collapsedCheckStorageRetrievalRequest').removeClass('collapsedCheckStorageRetrievalRequest'), 'StorageRetrievalRequest', 'StorageRetrievalRequestBlocked');
        checkRequestsAreValid(rows.find('.collapsedCheckILLRequest').removeClass('collapsedCheckILLRequest'), 'ILLRequest', 'ILLRequestBlocked');
      }
    });
  }

  function setupHoldingsTab() {
    initHoldingsControls();
    setUpCheckRequest();
    finna.layout.initLocationService();
    finna.layout.initJumpMenus($('.holdings-tab'));
    VuFind.lightbox.bind($('.holdings-tab'));
  }

  function initRecordNaviHashUpdate() {
    $(window).on('hashchange', function onHashChange() {
      $('.pager a').each(function updateHash(i, a) {
        a.hash = window.location.hash;
      });
    });
    $(window).trigger('hashchange');
  }

  function initRecordAccordions() {
    $('.record-accordions .accordion-toggle').click(function accordionClicked(e) {
      return _toggleAccordion($(e.target).closest('.accordion'));
    });
  }

  function applyRecordAccordionHash() {
    var newTab = typeof window.location.hash !== 'undefined'
      ? window.location.hash.toLowerCase() : '';

    // Open tab in url hash
    var $tab = $("a[data-tab='" + newTab.substr(1) + "']");
    var accordion = (newTab.length <= 1 || newTab === '#tabnav' || $tab.length === 0)
      ? $('.record-accordions .accordion.initiallyActive')
      : $tab.closest('.accordion');
    _toggleAccordion(accordion, true);
  }

  // The accordion has a delicate relationship with the tabs. Handle with care!
  function _toggleAccordion(accordion, _initialLoad) {
    var initialLoad = typeof _initialLoad === 'undefined' ? false : _initialLoad;
    var tabid = accordion.find('.accordion-toggle a').data('tab');
    var $recordTabs = $('.record-tabs');
    var $tabContent = $recordTabs.find('.tab-content');
    if (!initialLoad && accordion.hasClass('active')) {
      $('.record-accordions').find('.accordion.active').removeClass('active');
      // Hide tab from accordion
      $recordTabs.find('.tab-pane.active').removeClass('active');
      // Deactivate any tab since it can't follow the state of a collapsed accordion
      $recordTabs.find('.nav-tabs li.active').removeClass('active');
      removeHashFromLocation();
      // Move tab content out from accordions
      $tabContent.insertAfter($('.record-accordions'));
    } else {
      // Move tab content under the correct accordion toggle
      $tabContent.insertAfter(accordion);
      if (accordion.hasClass('noajax') && !$recordTabs.find('.' + tabid + '-tab').length) {
        return true;
      }
      $('.record-accordions').find('.accordion.active').removeClass('active');
      accordion.addClass('active');
      $recordTabs.find('.tab-pane.active').removeClass('active');
      if (!initialLoad && $('.record-accordions').is(':visible')) {
        $('html, body').animate({scrollTop: accordion.offset().top - 64}, 150);
      }

      $(this).tab('show');
      if ($recordTabs.find('.' + tabid + '-tab').length > 0) {
        $recordTabs.find('.' + tabid + '-tab').addClass('active');
        if ($(this).parent().hasClass('initiallyActive')) {
          removeHashFromLocation();
        } else {
          window.location.hash = tabid;
        }
        return false;
      } else {
        var newTab = getNewRecordTab(tabid).addClass('active');
        $recordTabs.find('.tab-content').append(newTab);
        return ajaxLoadTab(newTab, tabid, !$(this).parent().hasClass('initiallyActive'));
      }
    }
    return false;
  }

  function loadSimilarRecords()
  {
    $('.sidebar .similar-records').load(
      VuFind.path + '/AJAX/SimilarRecords',
      {id: $('.similar-records').data('id')},
      function loadDone() {
        $('.similar-records .fa-spinner').addClass('hidden');
      }
    );
  }

  function init() {
    initHideDetails();
    initDescription();
    initRecordNaviHashUpdate();
    initRecordAccordions();
    applyRecordAccordionHash();
    $(window).on('hashchange', applyRecordAccordionHash);
    loadSimilarRecords();
  }

  var my = {
    checkRequestsAreValid: checkRequestsAreValid,
    init: init,
    setupHoldingsTab: setupHoldingsTab
  };

  return my;
})();
