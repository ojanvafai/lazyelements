(function() {

// TODO: Make this work across same-domain frames if root is not passed in.
// TODO: Make this (mostly) work cross-domain. Maybe the polyfill just shouldn't do this?
// TODO: Is threshold based off the boundingClientRect or the intersectionRect?
// TODO: Maybe only include the intersectionRect if threshold is non-0? Seems expensive to calculate.
// TODO: Have threshold take a number or a list of numbers.
// TODO: Need to turn off the polling when the IntersectionObserver, root and all observedElements form a ref-loop.
// Is that even possible? How does MutationObserver polyfill handle this?
// TODO: Make all the error messages correct.
// TODO: Do high frequency polling during touchmove, scroll, drag, etc.
// TODO: Stop/Start polling on page visibility change.

function IntersectionObserver(data) {
  // TODO: Assert all the threshold values are numbers?
  // TODO: What the right way to check if something is an array these days?
  if (!data.threshold) {
    this._thresholds = [0];
  } else if (!data.threshold.length) {
    this._thresholds = [data.threshold];
  } else {
    // TODO: Make sure this sort makes it into the spec.
    this._thresholds = data.threshold.sort();
  }

  this._root = data.root;

  this._margin = data.margin;
  this._parseMargins();

  this._callback = data.callback;

  this._observedElements = new Map();
  this._pendingChangeRecords = [];
  this._pollInterval = null;
  this._changeRecordTimer = null;

  // TODO: This is almost certainly not right or the best way to get the viewport's bounding client rect.
  if (!this._root) {
    this._dummyRoot = document.createElement('this-is-a-dummy-name-noone-should-every-use');
    document.documentElement.appendChild(this._dummyRoot);
    this._dummyRoot.style.cssText = 'z-index: -1; position: fixed; top: 0; right: 0; bottom: 0; left: 0; visibility; hidden;';
  }
}

var PIXEL = 'px';
var PERCENT = '%';

IntersectionObserver.prototype = {
  _parseCSSValue: function(value) {
    var pixel = value.split('px');
    if (pixel.length == 2) {
      var number = Number(pixel[0]);
      if (isNaN(number))
        throw("Invalid margin.")
      return {
        type: PIXEL,
        value: number,
      }
    }

    var percent = value.split('%');
    if (percent.length == 2) {
      var number = Number(percent[0]);
      if (isNaN(number))
        throw("Invalid margin.")
      return {
        type: PERCENT,
        value: number / 100,
      }
    }

    throw("Invalid margin.");
  },
  _parseMargins: function() {
    if (!this._margin)
      return;

    // TODO: Make this actually conform to CSS parsing rules.
    var splitMargins = this._margin.split(' ');
    switch (splitMargins.length) {
      case 1:
        splitMargins[1] = splitMargins[2] = splitMargins[3] = splitMargins[0];
        break;

      case 2:
        splitMargins[2] = splitMargins[0];
        splitMargins[3] = splitMargins[1];
        break;

      case 3:
        splitMargins[3] = splitMargins[1];
        break;

      case 4:
        break;

      default:
        throw("Invalid margin.");
    }
    this._parsedMargins = [];
    for (var i = 0; i < splitMargins.length; i++) {
      this._parsedMargins.push(this._parseCSSValue(splitMargins[i]));
    }
  },
  _computeMargin: function(parsedMargin, rootDimension) {
    // TODO: Spec should state that horizontal margins compute against the width.
    if (parsedMargin.type == PIXEL)
      return parsedMargin.value;

    // TODO: assert parsedMargin.type == PERCENT
    return parsedMargin.value * rootDimension;
  },
  _recomputeMargins: function(rootSize) {
    this._computedMargins = [];
    for (var i = 0; i < this._parsedMargins.length; i++) {
      var rootDimension = i == 0 || i == 2 ? rootSize.height : rootSize.width;
      this._computedMargins.push(this._computeMargin(this._parsedMargins[i], rootDimension));
    }
  },
  _poll: function() {
    var root = this._root || this._dummyRoot;
    var rootRect = root.getBoundingClientRect();

    if (this._margin) {
      this._recomputeMargins(rootRect);
      rootRect = {
        top: rootRect.top - this._computedMargins[0],
        right: rootRect.right + this._computedMargins[1],
        bottom: rootRect.bottom + this._computedMargins[2],
        left: rootRect.left - this._computedMargins[3],
      }
      this._addRectSize(rootRect);
    }

    for (var element of this._observedElements.keys()) {
      this._updateElement(element, rootRect);
    }
    if (!this._changeRecordTimer && this._pendingChangeRecords.length)
      this._changeRecordTimer = setTimeout(this._deliverChangeRecords.bind(this), 0);
  },
  _takeRecords: function() {
    clearTimeout(this._changeRecordTimer);
    this._changeRecordTimer = null;
    var changeRecords = this._pendingChangeRecords;
    this._pendingChangeRecords = [];
    return changeRecords;
  },
  _deliverChangeRecords: function() {
    // Assert changeRecords.length.
    var changeRecords = this._takeRecords();
    this._callback(changeRecords);
  },
  _intersectionRect: function(rect1, rect2) {
    var top = Math.max(rect1.top, rect2.top);
    var bottom = Math.min(rect1.bottom, rect2.bottom);
    var left = Math.max(rect1.left, rect2.left);
    var right = Math.min(rect1.right, rect2.right);

    // TODO: Take overflow clipping from ancestors up to the root into account.
    if (top < bottom && left < right) {
      rect = {
        top: top,
        bottom: bottom,
        left: left,
        right: right,
      }
      this._addRectSize(rect);
      return rect;
    }
    return null;
  },
  _addRectSize: function(rect) {
    rect.width = rect.right - rect.left;
    rect.height = rect.bottom - rect.top;
  },
  _updateElement: function(element, rootRect) {
    var elementRect = element.getBoundingClientRect();
    var intersectionRect = this._intersectionRect(elementRect, rootRect);

    var newThresholdIndex = null;
    if (intersectionRect) {
      // TODO: To be more efficient, start at oldThresholdIndex and just check one
      // threshold before and one after?
      for (var i = 0; i < this._thresholds.length; i++) {
        var threshold = this._thresholds[i];
        if (threshold == 0) {
          newThresholdIndex = i;
          continue;
        }

        var elementArea = elementRect.width * elementRect.height;
        var intersectionArea = intersectionRect.width * intersectionRect.height;
        if ((intersectionArea / elementArea) >= threshold) {
          newThresholdIndex = i;
        } else {
          break;
        }
      }
    }

    var oldThresholdIndex = this._observedElements.get(element);
    if (oldThresholdIndex != newThresholdIndex) {
      this._queueChangeRecord(element, elementRect, rootRect, intersectionRect);
      this._observedElements.set(element, newThresholdIndex);
    }
  },
  _queueChangeRecord: function(element, elementRect, rootRect, intersectionRect) {
    // TODO: Get these names right.
    // TODO: File bug asking if change record should include which threshold was exceeded?
    this._pendingChangeRecords.push({
      boundingClientRect: elementRect,
      intersectionRect: intersectionRect,
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
    if (!element)
      throw("Cannot observe a null element");

    // TODO: Walk up shadow boundaries.
    var root = this._root || document.documentElement;
    var ancestor = element.parentNode;
    while (ancestor != root) {
      if (!ancestor)
        throw("Observed element must be a descendant of the observer’s root element.");
      ancestor = ancestor.parentNode;   
    }

    // TODO: Queue a change record if it starts out visible when observe is called?
    // Always queue a change record when observe is called?
    // TODO: unobserve when the element is removed from the DOM. Do this during the poll?
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
  takeRecords: function() {
    this._poll();
    return this._takeRecords();
  }
}

window['IntersectionObserver'] = IntersectionObserver;

})();
