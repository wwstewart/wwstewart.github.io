// Copy email button. The address is always visible and selectable;
// this only adds a one click copy where the browser allows it.
(function () {
  'use strict';

  var button = document.querySelector("[data-copy]");
  if (!button) return;

  var status = document.getElementById("copy-status");
  var target = document.getElementById(button.getAttribute("data-copy-target"));
  var timer;

  button.hidden = false;

  function show(message, copied) {
    button.classList.toggle("is-done", copied);
    if (status) status.textContent = message;
    clearTimeout(timer);
    timer = setTimeout(function () {
      button.classList.remove("is-done");
      if (status) status.textContent = "";
    }, 2000);
  }

  function selectAddress() {
    if (!target) return;
    var range = document.createRange();
    range.selectNodeContents(target);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    show("Address selected. Press Ctrl+C, or Command+C on a Mac, to copy it.", false);
  }

  button.addEventListener("click", function () {
    var text = button.getAttribute("data-copy");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        show("Email address copied.", true);
      }, selectAddress);
    } else {
      selectAddress();
    }
  });
})();
