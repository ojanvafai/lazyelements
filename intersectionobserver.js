(function() {

function IntersectionObserver(data) {
  // TODO: Implement threshold
  this._threshold = data.threshold;
  // TODO: Implement root
  this._root = data.root;
  // TODO: Implement margin
  this._margin = data.margin;
  this._callback = data.callback;

  this._observedElements = new Map();
  this._pendingChangeRecords = [];
  this._pollInterval = null;
  this._changeRecordTimer = null;

  // TODO: This is almost certainly not right or the best way to do this.
  this._dummyRoot = document.createElement('this-is-a-dummy-name-noone-should-every-use');
  document.documentElement.appendChild(this._dummyRoot);
  this._dummyRoot.style.cssText = 'z-index: -1; position: fixed; top: 0; right: 0; bottom: 0; left: 0; visibility; hidden;';
}

// TODO: Do high frequency polling during touchmove, scroll, drag, etc.
// TODO: Stop/Start polling on page visibility change.

IntersectionObserver.prototype = {
  _poll: function() {
    for (var element of this._observedElements.keys()) {
      this._updateElement(element);
    }
    if (!this._changeRecordTimer && this._pendingChangeRecords.length)
      this._changeRecordTimer = setTimeout(this._deliverChangeRecords.bind(this), 0);
  },
  _deliverChangeRecords: function() {
    this._changeRecordTimer = null;

    // Assert this._pendingChangeRecords.length.
    var changeRecords = this._pendingChangeRecords;
    this._pendingChangeRecords = [];
    this._callback(changeRecords);
  },
  _intersects: function(rect1, rect2) {
    var top = Math.max(rect1.top, rect2.top);
    var bottom = Math.min(rect1.bottom, rect2.bottom);
    var left = Math.max(rect1.left, rect2.left);
    var right = Math.min(rect1.right, rect2.right);

    return top < bottom && left < right;
  },
  _updateElement: function(element) {
    var elementRect = element.getBoundingClientRect();
    // TODO: This is almost certainly not right or the best way to do this.
    var rootRect = this._dummyRoot.getBoundingClientRect();

    var didIntersect = this._observedElements.get(element);
    var doesIntersect = this._intersects(elementRect, rootRect);

    if (didIntersect ^ doesIntersect) {
      this._queueChangeRecord(element, elementRect, rootRect);
      this._observedElements.set(element, doesIntersect);
    }
  },
  _queueChangeRecord: function(element, elementRect, rootRect) {
    // TODO: Include intersectionRect
    // TODO: Get these names right.
    this._pendingChangeRecords.push({
      boundingClientRect: elementRect,
      rootBoundingClientRect: rootRect,
      element: element,
    });
  },
  _startPolling: function() {
    if (!this._pollInterval)
      this._pollInterval = setInterval(this._poll.bind(this), 100);
  },
  _stopPolling: function() {
    if (!this._observedElements.size) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  },
  observe: function(element) {
    // TODO: throw instead of
    if (!element)
      throw("Cannot observe a null element");

    // TODO: Queue a change record if it starts out visible when observe is called?
    // Always queue a change record when observe is called?
    // TODO: Assert element is a descendant of root.
    // TODO: unobserve when the element is removed from the DOM.
    this._observedElements.set(element, null);
    this._startPolling();
  },
  unobserve: function(element) {
    this._observedElements.delete(element);
    this._stopPolling();
  },
  disconnect: function() {
    this._observedElements.clear();
    this._stopPolling();
  },
}

window['IntersectionObserver'] = IntersectionObserver;

})();
