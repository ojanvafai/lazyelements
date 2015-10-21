(function() {
// TODO: Share code with deferred since all that's different is the

function intersects(rect1, rect2) {
  var top = Math.max(rect1.top, rect2.top);
  var bottom = Math.min(rect1.bottom, rect2.bottom);
  var left = Math.max(rect1.left, rect2.left);
  var right = Math.min(rect1.right, rect2.right);

  return top < bottom && left < right;
}

function handleVisibilityChange(records) {
  records.forEach(function(record) {
    var display = 'block';
    var element = record.element;

    if (element.tagName == 'X-OPTIONAL') {
      var doesIntersect = intersects(record.boundingClientRect, record.rootBoundingClientRect);
      display = doesIntersect ? 'block' : 'none';
    } else {
      staticIntersectionObserver.unobserve(element);
    }

    var wrapper = element.shadowRoot.querySelector('wrapper');
    wrapper.style.display = display;
  });
}

var staticIntersectionObserver = new IntersectionObserver({
  callback: handleVisibilityChange,
});

var proto = Object.create(HTMLElement.prototype);

proto.createdCallback = function() {
  var shadow = this.createShadowRoot();
  // TODO: Apply basic contain:strict sizing rules? Or should this just be contain: style/paint?
  // Will want contain:strict for infinite list, but maybe infinite list should apply it.
  // Can the outer page override the :host value? What if they strip the contain entirely?
  shadow.innerHTML = "<style>:host { display: block; contain: strict; } wrapper { display: none};</style> <wrapper><content></content></wrapper>";
};

proto.attachedCallback = function() {
  staticIntersectionObserver.observe(this);
};

proto.detachedCallback = function() {
  // TODO: If it's already been unobserved, is it OK to unobserve again?
  staticIntersectionObserver.unobserve(this);
};

document.registerElement('x-optional', {prototype: proto});
document.registerElement('x-deferred', {prototype: Object.create(proto)});
})();
