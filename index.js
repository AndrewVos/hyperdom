var h = require('virtual-dom/h');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var createElement = require('virtual-dom/create-element');

var globalRefresh;

function renderWithRefresh(render, model, refresh) {
  var tree;

  console.log('started renderWithRefresh');
  try {
    globalRefresh = refresh;
    tree = render(model);
  } finally {
    globalRefresh = undefined;
  }
  console.log('finished renderWithRefresh');

  return tree;
}

exports.attach = function (element, render, model, options) {
  var requestRender = (options && options.requestRender) || window.requestAnimationFrame || setTimeout;
  var requested = false;

  function refresh() {
    if (!requested) {
      requestRender(function () {
        requested = false;

        var newTree = renderWithRefresh(render, model, refresh);
        var patches = diff(tree, newTree);
        rootNode = patch(rootNode, patches);
        tree = newTree;
      });
      requested = true;
    }
  }

  var tree = renderWithRefresh(render, model, refresh);
  var rootNode = createElement(tree);
  element.appendChild(rootNode);
};

exports.bind = function (obj, prop) {
  return {
    get: function () {
      return obj[prop];
    },
    set: function (value) {
      obj[prop] = value;
    }
  };
};

function refreshFunction(fn) {
  var r = globalRefresh;

  return function () {
    var result = fn.apply(undefined, arguments);
    if (result && typeof(result) == 'function') {
      result(r);
    } else if (result && typeof(result.then) == 'function') {
      result.then(r, r);
    } else {
      r();
      return result;
    }
  };
}

function bindTextInput(attributes, children, get, set) {
  var textEventNames = ['onkeydown', 'oninput', 'onpaste', 'textInput'];

  attributes.value = get();

  attachEventHandler(attributes, textEventNames, function (ev) {
    set(ev.target.value);
  });
}

function sequenceFunctions(handler1, handler2) {
  return function (ev) {
    handler1(ev);
    return handler2(ev);
  };
}

function insertEventHandler(attributes, eventName, handler) {
  var previousHandler = attributes[eventName];
  if (previousHandler) {
    attributes[eventName] = sequenceFunctions(handler, previousHandler);
  } else {
    attributes[eventName] = handler;
  }
}

function attachEventHandler(attributes, eventNames, handler) {
  if (eventNames instanceof Array) {
    eventNames.forEach(function (eventName) {
      insertEventHandler(attributes, eventName, handler);
    });
  } else {
    insertEventHandler(attributes, eventNames, handler);
  }
}

function bindModel(attributes, children, type) {
  var inputTypeBindings = {
    text: bindTextInput,
    textarea: bindTextInput,
    checkbox: function (attributes, children, get, set) {
      attributes.checked = get();

      attachEventHandler(attributes, 'onclick', function (ev) {
        set(ev.target.checked);
      });
    },
    radio: function (attributes, children, get, set) {
      var value = attributes.value;
      attributes.checked = get() == attributes.value;

      attachEventHandler(attributes, 'onclick', function (ev) {
        set(value);
      });
    },
    select: function (attributes, children, get, set) {
      var currentValue = get();

      var options = children.filter(function (child) {
        return child.tagName.toLowerCase() == 'option';
      });

      var selectedOption = options.filter(function (child) {
        return child.properties.value == currentValue;
      })[0];

      var values = options.map(function (option) {
        return option.properties.value;
      });

      options.forEach(function (option, index) {
        option.properties.selected = option == selectedOption;
        option.properties.value = index;
      });

      attachEventHandler(attributes, 'onchange', function (ev) {
        set(values[ev.target.value]);
      });
    },
    file: function (attributes, children, get, set) {
      var multiple = attributes.multiple;

      attachEventHandler(attributes, 'onchange', function (ev) {
        if (multiple) {
          set(ev.target.files);
        } else {
          set(ev.target.files[0]);
        }
      });
    }
  };

  var binding = inputTypeBindings[type] || bindTextInput;

  binding(attributes, children, attributes.binding.get, refreshFunction(attributes.binding.set));
}

function inputType(selector, attributes) {
  if (/^textarea\b/i.test(selector)) {
    return 'textarea';
  } else if (/^select\b/i.test(selector)) {
    return 'select';
  } else {
    return attributes.type || 'text';
  }
}

function flatten(array) {
  var flatArray = [];

  function append(array) {
    array.forEach(function(item) {
      if (item instanceof Array) {
        append(item);
      } else {
        flatArray.push(item);
      }
    });
  }

  append(array);

  return flatArray;
}

function normaliseChildren(children) {
  return children.map(function (child) {
    if (child === undefined || child == null) {
      return undefined;
    } else if (typeof(child) != 'object') {
      return String(child);
    } else if (child instanceof Date) {
      return String(child);
    } else {
      return child;
    }
  });
}

function applyAttributeRenames(attributes) {
  var renames = {
    for: 'htmlFor',
    class: 'className'
  };

  Object.keys(renames).forEach(function (key) {
    if (attributes[key] !== undefined) {
      attributes[renames[key]] = attributes[key];
    }
  });
}

exports.html = function (selector) {
  var attributes;
  var childElements;

  if (arguments[1] && arguments[1].constructor == Object) {
    attributes = arguments[1];
    childElements = normaliseChildren(flatten(Array.prototype.slice.call(arguments, 2)));

    Object.keys(attributes).forEach(function (key) {
      if (typeof(attributes[key]) == 'function') {
        attributes[key] = refreshFunction(attributes[key]);
      }
    });

    applyAttributeRenames(attributes);

    if (attributes.className) {
      attributes.className = generateClassName(attributes.className);
    }

    if (attributes.binding) {
      bindModel(attributes, childElements, inputType(selector, attributes));
    }

    return h.call(undefined, selector, attributes, childElements);
  } else {
    childElements = normaliseChildren(flatten(Array.prototype.slice.call(arguments, 1)));
    return h.call(undefined, selector, childElements);
  }
};

function RawHtmlWidget(selector, options, html) {
  this.selector = selector;
  this.options = options;
  this.html = html;
}

RawHtmlWidget.prototype.type = 'Widget';

RawHtmlWidget.prototype.init = function () {
  var element = createElement(exports.html(this.selector, this.options));
  element.innerHTML = this.html;
  return element;
};

RawHtmlWidget.prototype.update = function (previous, element) {
  element.parentNode.replaceChild(this.init(), element);
};

RawHtmlWidget.prototype.destroy = function (element) {
};


exports.html.rawHtml = function (selector, options, html) {
  if (arguments.length == 2) {
    return new RawHtmlWidget(selector, undefined, options);
  } else {
    return new RawHtmlWidget(selector, options, html);
  }
};

function WindowWidget(attributes) {
  this.attributes = attributes;

  var self = this;
  this.cache = {};
  Object.keys(this.attributes).forEach(function (key) {
    self.cache[key] = refreshFunction(self.attributes[key]);
  });
}

function applyAttribute(attributes, name, element) {
  if (/^on/.test(name)) {
    element.addEventListener(name.substr(2), this[name]);
  }
}

WindowWidget.prototype.type = 'Widget';
WindowWidget.prototype.init = function () {
  console.log('init', this.attributes);

  applyPropertyDiffs(window, {}, this.attributes, {}, this.cache);

  return document.createTextNode('');
};

function uniq(array) {
  var sortedArray = array.slice();
  sortedArray.sort();

  var last;

  for(var n = 0; n < sortedArray.length;) {
    var current = sortedArray[n];

    if (last === current) {
      sortedArray.splice(n, 1);
    } else {
      n++;
    }
    last = current;
  }

  return sortedArray;
}

function applyPropertyDiffs(element, previous, current, previousCache, currentCache) {
  uniq(Object.keys(previous).concat(Object.keys(current))).forEach(function (key) {
    if (/^on/.test(key)) {
      var event = key.slice(2);

      var prev = previous[key];
      var curr = current[key];
      var refreshPrev = previousCache[key];
      var refreshCurr = currentCache[key];

      if (prev !== undefined && curr === undefined) {
        console.log('removing listener for ', key);
        element.removeEventListener(event, refreshPrev);
      } else if (prev !== undefined && curr !== undefined && prev !== curr) {
        console.log('updating listener for ', key);
        element.removeEventListener(event, refreshPrev);
        element.addEventListener(event, refreshCurr);
      } else if (prev === undefined && curr !== undefined) {
        console.log('adding listener for ', key);
        element.addEventListener(event, refreshCurr);
      } else {
        console.log('leaving listener for ', key);
      }
    }
  });
}

WindowWidget.prototype.update = function (previous) {
  var self = this;
  console.log('update');
  applyPropertyDiffs(window, previous.attributes, this.attributes, previous.cache, this.cache);
};

WindowWidget.prototype.destroy = function () {
  console.log('destroy');
  applyPropertyDiffs(window, this.attributes, {}, this.cache, {});
};

exports.html.window = function (attributes) {
  return new WindowWidget(attributes);
};

function generateClassName(obj) {
  if (typeof(obj) == 'object') {
    if (obj instanceof Array) {
      return obj.join(' ');
    } else {
      return Object.keys(obj).filter(function (key) {
        return obj[key];
      }).join(' ');
    }
  } else {
    return obj;
  }
};
