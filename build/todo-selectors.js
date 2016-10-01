(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.todoSelectors = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(selectors, getState, ...args) {
	return Object.keys(selectors).reduce((p, selectorKey) => {
		Object.defineProperty(p, selectorKey, {
			get: function() { return selectors[selectorKey](getState(), ...args) },
			enumerable: true
		});
		return p;
	}, {});
};

},{}],2:[function(require,module,exports){
if (typeof Map !== 'function' || (process && process.env && process.env.TEST_MAPORSIMILAR === 'true')) {
	module.exports = require('./similar');
}
else {
	module.exports = Map;
}
},{"./similar":3}],3:[function(require,module,exports){
function Similar() {
	this.list = [];
	this.lastItem = undefined;
	this.size = 0;

	return this;
}

Similar.prototype.get = function(key) {
	var index;

	if (this.lastItem && this.isEqual(this.lastItem.key, key)) {
		return this.lastItem.val;
	}

	index = this.indexOf(key);
	if (index >= 0) {
		this.lastItem = this.list[index];
		return this.list[index].val;
	}

	return undefined;
};

Similar.prototype.set = function(key, val) {
	var index;

	if (this.lastItem && this.isEqual(this.lastItem.key, key)) {
		this.lastItem.val = val;
		return this;
	}

	index = this.indexOf(key);
	if (index >= 0) {
		this.lastItem = this.list[index];
		this.list[index].val = val;
		return this;
	}

	this.lastItem = { key: key, val: val };
	this.list.push(this.lastItem);
	this.size++;

	return this;
};

Similar.prototype.delete = function(key) {
	var index;

	if (this.lastItem && this.isEqual(this.lastItem.key, key)) {
		this.lastItem = undefined;
	}

	index = this.indexOf(key);
	if (index >= 0) {
		this.size--;
		return this.list.splice(index, 1)[0];
	}

	return undefined;
};


// important that has() doesn't use get() in case an existing key has a falsy value, in which case has() would return false
Similar.prototype.has = function(key) {
	var index;

	if (this.lastItem && this.isEqual(this.lastItem.key, key)) {
		return true;
	}

	index = this.indexOf(key);
	if (index >= 0) {
		this.lastItem = this.list[index];
		return true;
	}

	return false;
};

Similar.prototype.forEach = function(callback, thisArg) {
	var i;
	for (i = 0; i < this.size; i++) {
		callback.call(thisArg || this, this.list[i].val, this.list[i].key, this);
	}
};

Similar.prototype.indexOf = function(key) {
	var i;
	for (i = 0; i < this.size; i++) {
		if (this.isEqual(this.list[i].key, key)) {
			return i;
		}
	}
	return -1;
};

// check if the numbers are equal, or whether they are both precisely NaN (isNaN returns true for all non-numbers)
Similar.prototype.isEqual = function(val1, val2) {
	return val1 === val2 || (val1 !== val1 && val2 !== val2);
};

module.exports = Similar;
},{}],4:[function(require,module,exports){
var MapOrSimilar = require('map-or-similar');

module.exports = function (limit) {
	var cache = new MapOrSimilar(),
		lru = [];

	return function (fn) {
		var memoizerific = function () {
			var currentCache = cache,
				newMap,
				fnResult,
				argsLengthMinusOne = arguments.length - 1,
				lruPath = Array(argsLengthMinusOne + 1),
				isMemoized = true,
				i;

			if ((memoizerific.numArgs || memoizerific.numArgs === 0) && memoizerific.numArgs !== argsLengthMinusOne + 1) {
				throw new Error('Memoizerific functions should always be called with the same number of arguments');
			}

			// loop through each argument to traverse the map tree
			for (i = 0; i < argsLengthMinusOne; i++) {
				lruPath[i] = {
					cacheItem: currentCache,
					arg: arguments[i]
				};

				// climb through the hierarchical map tree until the second-last argument has been found, or an argument is missing.
				// if all arguments up to the second-last have been found, this will potentially be a cache hit (determined below)
				if (currentCache.has(arguments[i])) {
					currentCache = currentCache.get(arguments[i]);
					continue;
				}

				isMemoized = false;

				// make maps until last value
				newMap = new MapOrSimilar();
				currentCache.set(arguments[i], newMap);
				currentCache = newMap;
			}

			// we are at the last arg, check if it is really memoized
			if (isMemoized) {
				if (currentCache.has(arguments[argsLengthMinusOne])) {
					fnResult = currentCache.get(arguments[argsLengthMinusOne]);
				}
				else {
					isMemoized = false;
				}
			}

			if (!isMemoized) {
				fnResult = fn.apply(null, arguments);
				currentCache.set(arguments[argsLengthMinusOne], fnResult);
			}

			if (limit > 0) {
				lruPath[argsLengthMinusOne] = {
					cacheItem: currentCache,
					arg: arguments[argsLengthMinusOne]
				};

				if (isMemoized) {
					moveToMostRecentLru(lru, lruPath);
				}
				else {
					lru.push(lruPath);
				}

				if (lru.length > limit) {
					removeCachedResult(lru.shift());
				}
			}

			memoizerific.wasMemoized = isMemoized;
			memoizerific.numArgs = argsLengthMinusOne + 1;

			return fnResult;
		};

		memoizerific.limit = limit;
		memoizerific.wasMemoized = false;
		memoizerific.cache = cache;
		memoizerific.lru = lru;

		return memoizerific;
	};
};

// move current args to most recent position
function moveToMostRecentLru(lru, lruPath) {
	var lruLen = lru.length,
		lruPathLen = lruPath.length,
		isMatch,
		i, ii;

	for (i = 0; i < lruLen; i++) {
		isMatch = true;
		for (ii = 0; ii < lruPathLen; ii++) {
			if (!isEqual(lru[i][ii].arg, lruPath[ii].arg)) {
				isMatch = false;
				break;
			}
		}
		if (isMatch) {
			break;
		}
	}

	lru.push(lru.splice(i, 1)[0]);
}

// remove least recently used cache item and all dead branches
function removeCachedResult(removedLru) {
	var removedLruLen = removedLru.length,
		currentLru = removedLru[removedLruLen - 1],
		tmp,
		i;

	currentLru.cacheItem.delete(currentLru.arg);

	// walk down the tree removing dead branches (size 0) along the way
	for (i = removedLruLen - 2; i >= 0; i--) {
		currentLru = removedLru[i];
		tmp = currentLru.cacheItem.get(currentLru.arg);

		if (!tmp || !tmp.size) {
			currentLru.cacheItem.delete(currentLru.arg);
		} else {
			break;
		}
	}
}

// check if the numbers are equal, or whether they are both precisely NaN (isNaN returns true for all non-numbers)
function isEqual(val1, val2) {
	return val1 === val2 || (val1 !== val1 && val2 !== val2);
}
},{"map-or-similar":2}],5:[function(require,module,exports){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var t;t="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,t.todoReactComponents=e()}}(function(){var e;return function e(t,n,o){function a(l,r){if(!n[l]){if(!t[l]){var u="function"==typeof require&&require;if(!r&&u)return u(l,!0);if(s)return s(l,!0);var c=new Error("Cannot find module '"+l+"'");throw c.code="MODULE_NOT_FOUND",c}var i=n[l]={exports:{}};t[l][0].call(i.exports,function(e){var n=t[l][1][e];return a(n?n:e)},i,i.exports,e,t,n,o)}return n[l].exports}for(var s="function"==typeof require&&require,l=0;l<o.length;l++)a(o[l]);return a}({1:[function(t,n){!function(){"use strict";function t(){for(var e=[],n=0;n<arguments.length;n++){var a=arguments[n];if(a){var s=typeof a;if("string"===s||"number"===s)e.push(a);else if(Array.isArray(a))e.push(t.apply(null,a));else if("object"===s)for(var l in a)o.call(a,l)&&a[l]&&e.push(l)}}return e.join(" ")}var o={}.hasOwnProperty;"undefined"!=typeof n&&n.exports?n.exports=t:"function"==typeof e&&"object"==typeof e.amd&&e.amd?e("classnames",[],function(){return t}):window.classNames=t}()},{}],2:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,s=o(a),l=e("classnames"),r=o(l),u=e("../site/site-header"),c=o(u),i=function(e){return s.default.createElement("div",null,s.default.createElement(c.default,e.siteHeader),s.default.createElement("main",{className:r.default("page",e.className)},"About Page"))};i.propTypes={className:s.default.PropTypes.string,siteHeader:s.default.PropTypes.object},n.default=i},{"../site/site-header":6,classnames:1}],3:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}function a(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function s(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function l(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var r=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},u=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o)}}return function(t,n,o){return n&&e(t.prototype,n),o&&e(t,o),t}}(),c="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,i=o(c),f=function(e){function t(e){a(this,t);var n=s(this,(t.__proto__||Object.getPrototypeOf(t)).call(this,e));return n.handleClick=function(e){n.props.target||n.props.href&&0===n.props.href.indexOf("mailto:")||0===!e.button||e.metaKey||e.altKey||e.ctrlKey||e.shiftKey||(e.preventDefault(),n.props.onClick&&n.props.onClick(n.props.href))},n.handleClick=n.handleClick.bind(n),n}return l(t,e),u(t,[{key:"render",value:function(){return i.default.createElement("a",r({},this.props,{href:this.props.href,className:"link "+this.props.className,onClick:this.handleClick}))}}]),t}(c.Component);f.propTypes={className:c.PropTypes.string,href:c.PropTypes.string,target:c.PropTypes.string,onClick:c.PropTypes.func},n.default=f},{}],4:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e};n.default=function(e,t){var n=void 0;switch(t.url!==window.location.pathname&&window.history.pushState(null,null,t.url),t.selectedPage){case u.ABOUT:n=l.default.createElement(d.default,{className:"about-page",siteHeader:t.siteHeader});break;default:n=l.default.createElement(i.default,a({className:"todos-page"},t.todos,{siteHeader:t.siteHeader}))}r.render(n,e)};var s="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,l=o(s),r="undefined"!=typeof window?window.ReactDOM:"undefined"!=typeof global?global.ReactDOM:null,u=e("./site/constants/pages"),c=e("./todos/todos-page"),i=o(c),f=e("./about/about-page"),d=o(f)},{"./about/about-page":2,"./site/constants/pages":5,"./todos/todos-page":12}],5:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0});n.HOME="HOME",n.ABOUT="ABOUT"},{}],6:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,s=o(a),l=e("classnames"),r=o(l),u=e("../site/constants/pages"),c=e("../common/link"),i=o(c),f=function(e){return s.default.createElement("header",{className:r.default("site-header",e.className)},s.default.createElement("nav",null,s.default.createElement(i.default,{className:r.default({selected:e.selectedPage===u.HOME}),href:e.hrefHome,onClick:e.onClickHome},e.labelHome),s.default.createElement(i.default,{className:r.default({selected:e.selectedPage===u.ABOUT}),href:e.hrefAbout,onClick:e.onClickAbout},e.labelAbout)))};f.propTypes={className:s.default.PropTypes.string,selectedPage:s.default.PropTypes.string,labelHome:s.default.PropTypes.string,labelAbout:s.default.PropTypes.string,hrefHome:s.default.PropTypes.string,hrefAbout:s.default.PropTypes.string,onClickHome:s.default.PropTypes.func,onClickAbout:s.default.PropTypes.func},n.default=f},{"../common/link":3,"../site/constants/pages":5,classnames:1}],7:[function(e,t,n){"use strict";function o(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[n]=e[n]);return t.default=e,t}function a(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0}),n.constants=n.component=void 0;var s=e("./component"),l=a(s),r=e("./site/constants/pages"),u=o(r),c=e("./todos/constants/statuses"),i=o(c),f={PAGES:u,TODO_STATUSES:i};n.default={component:l.default,constants:f},n.component=l.default,n.constants=f},{"./component":4,"./site/constants/pages":5,"./todos/constants/statuses":8}],8:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0});n.PENDING="PENDING",n.COMPLETE="COMPLETE",n.TOTAL="TOTAL"},{}],9:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,s=o(a),l=e("classnames"),r=o(l),u=function(e){return s.default.createElement("article",{className:r.default("list-item",{checked:e.isComplete},e.className)},s.default.createElement("label",{className:"description"},s.default.createElement("input",{className:"checkbox",type:"checkbox",checked:e.isComplete,onChange:e.onCheckboxToggled}),e.description),s.default.createElement("button",{className:"button",onClick:e.onButtonClicked},e.buttonLabel))};u.propTypes={className:s.default.PropTypes.string,description:s.default.PropTypes.string,isComplete:s.default.PropTypes.bool,buttonLabel:s.default.PropTypes.string,onButtonClicked:s.default.PropTypes.func,onCheckboxToggled:s.default.PropTypes.func},n.default=u},{classnames:1}],10:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},s="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,l=o(s),r=e("classnames"),u=o(r),c=e("../todos/todo-item"),i=o(c),f=function(e){return l.default.createElement("section",{className:u.default("list",e.className)},!!e.todos&&e.todos.map(function(e){return l.default.createElement(i.default,a({key:e.id},e))}))};f.propTypes={className:l.default.PropTypes.string,todos:l.default.PropTypes.array},n.default=f},{"../todos/todo-item":9,classnames:1}],11:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}function a(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function s(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function l(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var r=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o)}}return function(t,n,o){return n&&e(t.prototype,n),o&&e(t,o),t}}(),u="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,c=o(u),i=e("classnames"),f=o(i),d=function(e){function t(e){a(this,t);var n=s(this,(t.__proto__||Object.getPrototypeOf(t)).call(this,e));return n.handleOnChange=function(e){n.setState({value:e.target.value})},n.handleOnSubmit=function(e){e.preventDefault(),n.setState({value:""}),n.props.onSubmit(n.state.value)},n.state={value:n.props.value||""},n.handleOnChange=n.handleOnChange.bind(n),n.handleOnSubmit=n.handleOnSubmit.bind(n),n}return l(t,e),r(t,[{key:"render",value:function(){var e=this.props,t=this.state;return c.default.createElement("form",{className:f.default(e.className),onSubmit:this.handleOnSubmit},c.default.createElement("input",{className:"todos-new-form-input",value:t.value,placeholder:e.placeholder,onChange:this.handleOnChange}))}}]),t}(u.Component);d.propTypes={className:c.default.PropTypes.string,placeholder:c.default.PropTypes.string,onSubmit:c.default.PropTypes.func},n.default=d},{classnames:1}],12:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},s="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,l=o(s),r=e("classnames"),u=o(r),c=e("../site/site-header"),i=o(c),f=e("../todos/todos-new-form"),d=o(f),p=e("../todos/todos-list"),m=o(p),y=e("../todos/todos-summary"),b=o(y),g=function(e){return l.default.createElement("div",null,l.default.createElement(i.default,e.siteHeader),l.default.createElement("main",{className:u.default("page",e.className)},!!e.newForm&&l.default.createElement(d.default,a({className:"todos-new-form"},e.newForm)),!!e.list&&l.default.createElement(m.default,{className:"todos-list",todos:e.list}),!!e.summary&&l.default.createElement(b.default,a({className:"todos-summary"},e.summary))))};g.propTypes={className:l.default.PropTypes.string,siteHeader:l.default.PropTypes.object,newForm:l.default.PropTypes.object,list:l.default.PropTypes.array,summary:l.default.PropTypes.object},n.default=g},{"../site/site-header":6,"../todos/todos-list":10,"../todos/todos-new-form":11,"../todos/todos-summary":13,classnames:1}],13:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(n,"__esModule",{value:!0});var a="undefined"!=typeof window?window.React:"undefined"!=typeof global?global.React:null,s=o(a),l=e("classnames"),r=o(l),u=e("../todos/constants/statuses"),c=function(e){return s.default.createElement("section",{className:r.default("todo-summary",e.className)},s.default.createElement("span",{className:r.default("todo-summary-pending",{"is-selected":e.selectedSummaryStatus===u.PENDING}),onClick:e.onClickPending},e.countIncomplete),s.default.createElement("span",{className:r.default("todo-summary-complete",{"is-selected":e.selectedSummaryStatus===u.COMPLETE}),onClick:e.onClickComplete},e.countComplete),s.default.createElement("span",{className:r.default("todo-summary-total",{"is-selected":e.selectedSummaryStatus===u.TOTAL}),onClick:e.onClickTotal},e.countTotal))};c.propTypes={className:s.default.PropTypes.string,countIncomplete:s.default.PropTypes.string,countComplete:s.default.PropTypes.string,countTotal:s.default.PropTypes.string,selectedSummaryStatus:s.default.PropTypes.oneOf([u.PENDING,u.COMPLETE,u.TOTAL]),onClickPending:s.default.PropTypes.func,onClickComplete:s.default.PropTypes.func,onClickTotal:s.default.PropTypes.func},n.default=c},{"../todos/constants/statuses":8,classnames:1}]},{},[7])(7)});
},{}],6:[function(require,module,exports){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.todoReduxState = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
function createThunkMiddleware(extraArgument) {
  return function (_ref) {
    var dispatch = _ref.dispatch;
    var getState = _ref.getState;
    return function (next) {
      return function (action) {
        if (typeof action === 'function') {
          return action(dispatch, getState, extraArgument);
        }

        return next(action);
      };
    };
  };
}

var thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

exports['default'] = thunk;
},{}],2:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports['default'] = applyMiddleware;

var _compose = _dereq_('./compose');

var _compose2 = _interopRequireDefault(_compose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
function applyMiddleware() {
  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function (reducer, preloadedState, enhancer) {
      var store = createStore(reducer, preloadedState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = _compose2['default'].apply(undefined, chain)(store.dispatch);

      return _extends({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
},{"./compose":5}],3:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = bindActionCreators;
function bindActionCreator(actionCreator, dispatch) {
  return function () {
    return dispatch(actionCreator.apply(undefined, arguments));
  };
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass a single function as the first argument,
 * and get a function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 */
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error('bindActionCreators expected an object or a function, instead received ' + (actionCreators === null ? 'null' : typeof actionCreators) + '. ' + 'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?');
  }

  var keys = Object.keys(actionCreators);
  var boundActionCreators = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
},{}],4:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = combineReducers;

var _createStore = _dereq_('./createStore');

var _isPlainObject = _dereq_('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _warning = _dereq_('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionName = actionType && '"' + actionType.toString() + '"' || 'an action';

  return 'Given action ' + actionName + ', reducer "' + key + '" returned undefined. ' + 'To ignore an action, you must explicitly return the previous state.';
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === _createStore.ActionTypes.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!(0, _isPlainObject2['default'])(inputState)) {
    return 'The ' + argumentName + ' has unexpected type of "' + {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + '". Expected argument to be an object with the following ' + ('keys: "' + reducerKeys.join('", "') + '"');
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });

  unexpectedKeys.forEach(function (key) {
    unexpectedKeyCache[key] = true;
  });

  if (unexpectedKeys.length > 0) {
    return 'Unexpected ' + (unexpectedKeys.length > 1 ? 'keys' : 'key') + ' ' + ('"' + unexpectedKeys.join('", "') + '" found in ' + argumentName + '. ') + 'Expected to find one of the known reducer keys instead: ' + ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.');
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, { type: _createStore.ActionTypes.INIT });

    if (typeof initialState === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined during initialization. ' + 'If the state passed to the reducer is undefined, you must ' + 'explicitly return the initial state. The initial state may ' + 'not be undefined.');
    }

    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
    if (typeof reducer(undefined, { type: type }) === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined when probed with a random type. ' + ('Don\'t try to handle ' + _createStore.ActionTypes.INIT + ' or other actions in "redux/*" ') + 'namespace. They are considered private. Instead, you must return the ' + 'current state for any unknown actions, unless it is undefined, ' + 'in which case you must return the initial state, regardless of the ' + 'action type. The initial state may not be undefined.');
    }
  });
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if ("development" !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        (0, _warning2['default'])('No reducer provided for key "' + key + '"');
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  var finalReducerKeys = Object.keys(finalReducers);

  if ("development" !== 'production') {
    var unexpectedKeyCache = {};
  }

  var sanityError;
  try {
    assertReducerSanity(finalReducers);
  } catch (e) {
    sanityError = e;
  }

  return function combination() {
    var state = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var action = arguments[1];

    if (sanityError) {
      throw sanityError;
    }

    if ("development" !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);
      if (warningMessage) {
        (0, _warning2['default'])(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};
    for (var i = 0; i < finalReducerKeys.length; i++) {
      var key = finalReducerKeys[i];
      var reducer = finalReducers[key];
      var previousStateForKey = state[key];
      var nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(key, action);
        throw new Error(errorMessage);
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
},{"./createStore":6,"./utils/warning":8,"lodash/isPlainObject":12}],5:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
exports["default"] = compose;
/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  var last = funcs[funcs.length - 1];
  var rest = funcs.slice(0, -1);
  return function () {
    return rest.reduceRight(function (composed, f) {
      return f(composed);
    }, last.apply(undefined, arguments));
  };
}
},{}],6:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
exports.ActionTypes = undefined;
exports['default'] = createStore;

var _isPlainObject = _dereq_('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _symbolObservable = _dereq_('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = exports.ActionTypes = {
  INIT: '@@redux/INIT'
};

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!(0, _isPlainObject2['default'])(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[_symbolObservable2['default']] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[_symbolObservable2['default']] = observable, _ref2;
}
},{"lodash/isPlainObject":12,"symbol-observable":13}],7:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
exports.compose = exports.applyMiddleware = exports.bindActionCreators = exports.combineReducers = exports.createStore = undefined;

var _createStore = _dereq_('./createStore');

var _createStore2 = _interopRequireDefault(_createStore);

var _combineReducers = _dereq_('./combineReducers');

var _combineReducers2 = _interopRequireDefault(_combineReducers);

var _bindActionCreators = _dereq_('./bindActionCreators');

var _bindActionCreators2 = _interopRequireDefault(_bindActionCreators);

var _applyMiddleware = _dereq_('./applyMiddleware');

var _applyMiddleware2 = _interopRequireDefault(_applyMiddleware);

var _compose = _dereq_('./compose');

var _compose2 = _interopRequireDefault(_compose);

var _warning = _dereq_('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if ("development" !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  (0, _warning2['default'])('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

exports.createStore = _createStore2['default'];
exports.combineReducers = _combineReducers2['default'];
exports.bindActionCreators = _bindActionCreators2['default'];
exports.applyMiddleware = _applyMiddleware2['default'];
exports.compose = _compose2['default'];
},{"./applyMiddleware":2,"./bindActionCreators":3,"./combineReducers":4,"./compose":5,"./createStore":6,"./utils/warning":8}],8:[function(_dereq_,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = warning;
/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}
},{}],9:[function(_dereq_,module,exports){
var overArg = _dereq_('./_overArg');

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;

},{"./_overArg":10}],10:[function(_dereq_,module,exports){
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;

},{}],11:[function(_dereq_,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],12:[function(_dereq_,module,exports){
var getPrototype = _dereq_('./_getPrototype'),
    isObjectLike = _dereq_('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || objectToString.call(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

module.exports = isPlainObject;

},{"./_getPrototype":9,"./isObjectLike":11}],13:[function(_dereq_,module,exports){
module.exports = _dereq_('./lib/index');

},{"./lib/index":14}],14:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _ponyfill = _dereq_('./ponyfill');

var _ponyfill2 = _interopRequireDefault(_ponyfill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var root = undefined; /* global window */

if (typeof global !== 'undefined') {
	root = global;
} else if (typeof window !== 'undefined') {
	root = window;
}

var result = (0, _ponyfill2['default'])(root);
exports['default'] = result;
},{"./ponyfill":15}],15:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports['default'] = symbolObservablePonyfill;
function symbolObservablePonyfill(root) {
	var result;
	var _Symbol = root.Symbol;

	if (typeof _Symbol === 'function') {
		if (_Symbol.observable) {
			result = _Symbol.observable;
		} else {
			result = _Symbol('observable');
			_Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
};
},{}],16:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.subscribe = exports.constants = exports.actions = undefined;

var _store = _dereq_('../src/store');

var _store2 = _interopRequireDefault(_store);

var _pages = _dereq_('./site/constants/pages');

var PAGES = _interopRequireWildcard(_pages);

var _statuses = _dereq_('./todos/constants/statuses');

var TODOS_STATUSES = _interopRequireWildcard(_statuses);

var _updateSelectedPage = _dereq_('./site/actions/update-selected-page');

var _updateSelectedPage2 = _interopRequireDefault(_updateSelectedPage);

var _addTodo = _dereq_('./todos/actions/add-todo');

var _addTodo2 = _interopRequireDefault(_addTodo);

var _loadTodos = _dereq_('./todos/actions/load-todos');

var _loadTodos2 = _interopRequireDefault(_loadTodos);

var _removeTodo = _dereq_('./todos/actions/remove-todo');

var _removeTodo2 = _interopRequireDefault(_removeTodo);

var _completeTodo = _dereq_('./todos/actions/complete-todo');

var _completeTodo2 = _interopRequireDefault(_completeTodo);

var _updateSelectedSummaryStatus = _dereq_('./todos/actions/update-selected-summary-status');

var _updateSelectedSummaryStatus2 = _interopRequireDefault(_updateSelectedSummaryStatus);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var actionsSet = {
	site: {
		updateSelectedPage: _updateSelectedPage2.default
	},
	todos: {
		addTodo: _addTodo2.default,
		loadTodos: _loadTodos2.default,
		removeTodo: _removeTodo2.default,
		completeTodo: _completeTodo2.default,
		updateSelectedSummaryStatus: _updateSelectedSummaryStatus2.default
	}
};

var actions = Object.keys(actionsSet).reduce(function (p1, key1) {
	p1[key1] = Object.keys(actionsSet[key1]).reduce(function (p2, key2) {
		p2[key2] = function () {
			var action = actionsSet[key1][key2].apply(null, arguments);
			_store2.default.dispatch(action);
			return action;
		};
		return p2;
	}, {});
	return p1;
}, {});

var constants = {
	PAGES: PAGES,
	TODOS_STATUSES: TODOS_STATUSES
};

var subscribe = _store2.default.subscribe;

var final = {
	actions: actions,
	constants: constants,
	subscribe: subscribe
};

Object.defineProperty(final, "state", { get: _store2.default.getState });

exports.default = final;
exports.actions = actions;
exports.constants = constants;
exports.subscribe = subscribe;


Object.defineProperty(exports, "state", { get: _store2.default.getState });

},{"../src/store":20,"./site/actions/update-selected-page":17,"./site/constants/pages":18,"./todos/actions/add-todo":21,"./todos/actions/complete-todo":22,"./todos/actions/load-todos":23,"./todos/actions/remove-todo":24,"./todos/actions/update-selected-summary-status":25,"./todos/constants/statuses":27}],17:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (newSelectedPage) {
	return function (dispatch, getState) {
		var _getState = getState();

		var selectedPage = _getState.selectedPage;

		if (selectedPage !== newSelectedPage) {
			dispatch({ type: UPDATE_SELECTED_PAGE, selectedPage: newSelectedPage });
		}
	};
};

var UPDATE_SELECTED_PAGE = exports.UPDATE_SELECTED_PAGE = 'UPDATE_SELECTED_PAGE';

},{}],18:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var HOME = exports.HOME = 'HOME';
var ABOUT = exports.ABOUT = 'ABOUT';

},{}],19:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {
	var selectedPage = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _pages.HOME;
	var action = arguments[1];

	switch (action.type) {
		case _updateSelectedPage.UPDATE_SELECTED_PAGE:
			return action.selectedPage;

		default:
			return selectedPage;
	}
};

var _updateSelectedPage = _dereq_('../../site/actions/update-selected-page');

var _pages = _dereq_('../../site/constants/pages');

},{"../../site/actions/update-selected-page":17,"../../site/constants/pages":18}],20:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _redux = _dereq_('redux');

var _reduxThunk = _dereq_('redux-thunk');

var _reduxThunk2 = _interopRequireDefault(_reduxThunk);

var _selectedPage = _dereq_('./site/reducers/selected-page');

var _selectedPage2 = _interopRequireDefault(_selectedPage);

var _todos = _dereq_('./todos/reducers/todos');

var _todos2 = _interopRequireDefault(_todos);

var _selectedSummaryStatus = _dereq_('./todos/reducers/selected-summary-status');

var _selectedSummaryStatus2 = _interopRequireDefault(_selectedSummaryStatus);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var reducers = {
	selectedPage: _selectedPage2.default,
	todos: _todos2.default,
	selectedSummaryStatus: _selectedSummaryStatus2.default
};

// middleware that logs all actions to console


// reducers
var consoleLog = function consoleLog(store) {
	return function (next) {
		return function (action) {
			if (typeof action !== 'function') {
				console.log(action);
			}
			return next(action);
		};
	};
};

// middleware
var middleWare = void 0;
if (process.env.NODE_ENV !== 'production') {
	middleWare = (0, _redux.applyMiddleware)(consoleLog, _reduxThunk2.default);
} else {
	middleWare = (0, _redux.applyMiddleware)(_reduxThunk2.default);
}

// create store
exports.default = (0, _redux.createStore)((0, _redux.combineReducers)(reducers), middleWare);

},{"./site/reducers/selected-page":19,"./todos/reducers/selected-summary-status":28,"./todos/reducers/todos":29,"redux":7,"redux-thunk":1}],21:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (description) {
	return function (dispatch, getState) {
		if (!description || !description.length) {
			return Promise.resolve(null);
		}

		return (0, _newTodo2.default)(description).then(function (todo) {
			var id = todo.id;
			delete todo.id;
			dispatch((0, _updateTodos3.default)(_defineProperty({}, id, todo)));
		});
	};
};

var _newTodo = _dereq_('../../todos/services/fake-backend/new-todo');

var _newTodo2 = _interopRequireDefault(_newTodo);

var _updateTodos2 = _dereq_('../../todos/actions/update-todos');

var _updateTodos3 = _interopRequireDefault(_updateTodos2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

},{"../../todos/actions/update-todos":26,"../../todos/services/fake-backend/new-todo":32}],22:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (id, isComplete) {
	return function (dispatch, getState) {
		var _getState = getState();

		var todos = _getState.todos;

		var todo = todos[id];

		if (!todo) {
			return;
		}

		todo.isComplete = isComplete;

		return (0, _saveTodo2.default)(id, todo).then(function (res) {
			dispatch((0, _updateTodos3.default)(_defineProperty({}, res.id, res.todo)));
		});
	};
};

var _saveTodo = _dereq_('../../todos/services/fake-backend/save-todo');

var _saveTodo2 = _interopRequireDefault(_saveTodo);

var _updateTodos2 = _dereq_('../../todos/actions/update-todos');

var _updateTodos3 = _interopRequireDefault(_updateTodos2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

},{"../../todos/actions/update-todos":26,"../../todos/services/fake-backend/save-todo":33}],23:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.LOAD_TODOS = undefined;

exports.default = function (todos) {
	return function (dispatch, getState) {
		return (0, _loadAllTodos2.default)().then(function (todos) {
			if (!todos) {
				return Promise.resolve(null);
			}
			dispatch((0, _updateTodos2.default)(todos));
		});
	};
};

var _loadAllTodos = _dereq_('../../todos/services/fake-backend/load-all-todos');

var _loadAllTodos2 = _interopRequireDefault(_loadAllTodos);

var _updateTodos = _dereq_('../../todos/actions/update-todos');

var _updateTodos2 = _interopRequireDefault(_updateTodos);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var LOAD_TODOS = exports.LOAD_TODOS = 'LOAD_TODOS';

},{"../../todos/actions/update-todos":26,"../../todos/services/fake-backend/load-all-todos":31}],24:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (id) {
	return function (dispatch, getState) {
		return (0, _deleteTodo2.default)(id).then(function (todo) {
			dispatch((0, _updateTodos3.default)(_defineProperty({}, id, null)));
		});
	};
};

var _deleteTodo = _dereq_('../../todos/services/fake-backend/delete-todo');

var _deleteTodo2 = _interopRequireDefault(_deleteTodo);

var _updateTodos2 = _dereq_('../../todos/actions/update-todos');

var _updateTodos3 = _interopRequireDefault(_updateTodos2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

},{"../../todos/actions/update-todos":26,"../../todos/services/fake-backend/delete-todo":30}],25:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (selectedSummaryStatus) {
	return { type: UPDATE_SELECTED_SUMMARY_STATUS, selectedSummaryStatus: selectedSummaryStatus };
};

var UPDATE_SELECTED_SUMMARY_STATUS = exports.UPDATE_SELECTED_SUMMARY_STATUS = 'UPDATE_SELECTED_SUMMARY_STATUS';

},{}],26:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (todos) {
	return { type: UPDATE_TODOS, todos: todos };
};

var UPDATE_TODOS = exports.UPDATE_TODOS = 'UPDATE_TODOS';

},{}],27:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var PENDING = exports.PENDING = 'PENDING';
var COMPLETE = exports.COMPLETE = 'COMPLETE';
var TOTAL = exports.TOTAL = 'TOTAL';

},{}],28:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {
	var selectedSummaryStatus = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _statuses.TOTAL;
	var action = arguments[1];

	switch (action.type) {
		case _updateSelectedSummaryStatus.UPDATE_SELECTED_SUMMARY_STATUS:
			return action.selectedSummaryStatus;

		default:
			return selectedSummaryStatus;
	}
};

var _updateSelectedSummaryStatus = _dereq_('../../todos/actions/update-selected-summary-status');

var _statuses = _dereq_('../../todos/constants/statuses');

},{"../../todos/actions/update-selected-summary-status":25,"../../todos/constants/statuses":27}],29:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function () {
	var todos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	var action = arguments[1];

	var newTodos = void 0;

	switch (action.type) {
		case _updateTodos.UPDATE_TODOS:
			newTodos = _extends({}, todos);

			Object.keys(action.todos).forEach(function (key) {
				if (action.todos[key]) {
					newTodos[key] = action.todos[key];
				} else {
					delete newTodos[key];
				}
			});

			return newTodos;

		default:
			return todos;
	}
};

var _updateTodos = _dereq_('../../todos/actions/update-todos');

},{"../../todos/actions/update-todos":26}],30:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (id) {
	return new Promise(function (r, x) {
		setTimeout(function () {
			return r(true);
		}, 50);
	});
};

},{}],31:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {
	var todos = {
		'10': {
			description: 'Buy tomatoes from grocery store',
			dateCreated: '2016-09-19T18:44:15.635',
			isComplete: false
		},
		'3': {
			description: 'Finish writing blog post',
			dateCreated: '2016-09-20T18:44:18.635',
			isComplete: false
		}
	};

	return new Promise(function (r, x) {
		setTimeout(function () {
			return r(todos);
		}, 50);
	});
};

},{}],32:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (description) {
	var id = Math.round(Math.random() * 10000).toFixed();
	var newTodo = {
		id: id,
		description: description,
		dateCreated: new Date().toISOString(),
		isComplete: false
	};

	return new Promise(function (r, x) {
		setTimeout(function () {
			return r(newTodo);
		}, 50);
	});
};

},{}],33:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (id, todo) {
	return new Promise(function (r, x) {
		setTimeout(function () {
			return r({ id: id, todo: todo });
		}, 50);
	});
};

},{}]},{},[16])(16)
});
},{}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.subscribe = exports.constants = exports.actions = exports.selectors = undefined;

var _combineSelectors = require('combine-selectors');

var _combineSelectors2 = _interopRequireDefault(_combineSelectors);

var _todoReduxState = require('todo-redux-state');

var _selectedPage = require('./site/selected-page');

var _selectedPage2 = _interopRequireDefault(_selectedPage);

var _url = require('./site/url');

var _url2 = _interopRequireDefault(_url);

var _siteHeader = require('./site/site-header');

var _siteHeader2 = _interopRequireDefault(_siteHeader);

var _todos = require('./todos/todos');

var _todos2 = _interopRequireDefault(_todos);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rawSelectors = {
	selectedPage: _selectedPage2.default,
	url: _url2.default,
	siteHeader: _siteHeader2.default,
	todos: _todos2.default
};

var selectors = (0, _combineSelectors2.default)(rawSelectors, function () {
	return _todoReduxState.state;
});

var final = {
	selectors: selectors,
	actions: _todoReduxState.actions,
	constants: _todoReduxState.constants,
	subscribe: _todoReduxState.subscribe
};

Object.defineProperty(final, "state", { get: function get() {
		return _todoReduxState.state;
	} });

exports.default = final;
exports.selectors = selectors;
exports.actions = _todoReduxState.actions;
exports.constants = _todoReduxState.constants;
exports.subscribe = _todoReduxState.subscribe;


Object.defineProperty(exports, "state", { get: function get() {
		return _todoReduxState.state;
	} });

},{"./site/selected-page":9,"./site/site-header":10,"./site/url":11,"./todos/todos":12,"combine-selectors":1,"todo-redux-state":6}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var HOME = exports.HOME = '/';
var ABOUT = exports.ABOUT = '/about';

},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.selectSelectedPage = undefined;

exports.default = function (state) {
	var selectedPage = state.selectedPage;

	return selectSelectedPage(selectedPage);
};

var _memoizerific = require('memoizerific');

var _memoizerific2 = _interopRequireDefault(_memoizerific);

var _todoReactComponents = require('todo-react-components');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var selectSelectedPage = exports.selectSelectedPage = (0, _memoizerific2.default)(1)(function (selectedPage) {
	return _todoReactComponents.constants.PAGES[selectedPage];
});

},{"memoizerific":4,"todo-react-components":5}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.selectSiteHeader = undefined;

exports.default = function (state) {
	var selectedPage = state.selectedPage;

	return selectSiteHeader(selectedPage);
};

var _memoizerific = require('memoizerific');

var _memoizerific2 = _interopRequireDefault(_memoizerific);

var _todoReduxState = require('todo-redux-state');

var _paths = require('../site/constants/paths');

var PATHS = _interopRequireWildcard(_paths);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var selectSiteHeader = exports.selectSiteHeader = (0, _memoizerific2.default)(1)(function (selectedPage) {

	return {
		labelHome: 'Todo App',
		labelAbout: 'About',

		hrefHome: PATHS[_todoReduxState.constants.PAGES.HOME],
		hrefAbout: PATHS[_todoReduxState.constants.PAGES.ABOUT],

		selectedPage: selectedPage,

		onClickHome: function onClickHome() {
			return _todoReduxState.actions.site.updateSelectedPage(_todoReduxState.constants.PAGES.HOME);
		},
		onClickAbout: function onClickAbout() {
			return _todoReduxState.actions.site.updateSelectedPage(_todoReduxState.constants.PAGES.ABOUT);
		}
	};
});

},{"../site/constants/paths":8,"memoizerific":4,"todo-redux-state":6}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.selectURL = undefined;

exports.default = function (state) {
	var selectedPage = state.selectedPage;

	return selectURL(selectedPage);
};

var _memoizerific = require('memoizerific');

var _memoizerific2 = _interopRequireDefault(_memoizerific);

var _paths = require('../site/constants/paths');

var PATHS = _interopRequireWildcard(_paths);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var selectURL = exports.selectURL = (0, _memoizerific2.default)(1)(function (selectedPage) {
	var SITE_PATHS = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : PATHS;

	return SITE_PATHS[selectedPage];
});

},{"../site/constants/paths":8,"memoizerific":4}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.selectTodos = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function (state) {
	var todos = state.todos;
	var selectedSummaryStatus = state.selectedSummaryStatus;


	return selectTodos(todos, selectedSummaryStatus);
};

var _memoizerific = require('memoizerific');

var _memoizerific2 = _interopRequireDefault(_memoizerific);

var _todoReduxState = require('todo-redux-state');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var selectTodos = exports.selectTodos = (0, _memoizerific2.default)(1)(function (todos, selectedSummaryStatus) {

	var newForm = {
		placeholder: 'What do you need to do?',
		onSubmit: function onSubmit(description) {
			return _todoReduxState.actions.todos.addTodo(description);
		}
	};

	var list = Object.keys(todos).map(function (key) {
		return _extends({}, todos[key], {
			id: key,
			buttonLabel: 'delete',
			onButtonClicked: function onButtonClicked() {
				return _todoReduxState.actions.todos.removeTodo(key);
			},
			onCheckboxToggled: function onCheckboxToggled() {
				return _todoReduxState.actions.todos.completeTodo(key, !todos[key].isComplete);
			}
		});
	});

	var summary = list.reduce(function (p, todo) {
		!todo.isComplete && p.countIncomplete++;
		todo.isComplete && p.countComplete++;
		p.countTotal++;
		return p;
	}, {
		countIncomplete: 0,
		countComplete: 0,
		countTotal: 0
	});

	list = list.filter(function (todo) {
		return selectedSummaryStatus === _todoReduxState.constants.TODOS_STATUSES.TOTAL || selectedSummaryStatus === _todoReduxState.constants.TODOS_STATUSES.COMPLETE && todo.isComplete || selectedSummaryStatus === _todoReduxState.constants.TODOS_STATUSES.PENDING && !todo.isComplete;
	}).sort(function (a, b) {
		if (a.dateCreated < b.dateCreated) {
			return -1;
		}
		if (a.dateCreated > b.dateCreated) {
			return 1;
		}
		if (a.id < b.id) {
			return -1;
		}
		return 1;
	});

	summary.countIncomplete = summary.countIncomplete + ' pending';
	summary.countComplete = summary.countComplete + ' complete';
	summary.countTotal = summary.countTotal + ' total';

	summary.selectedSummaryStatus = selectedSummaryStatus;

	summary.onClickPending = function () {
		return _todoReduxState.actions.todos.updateSelectedSummaryStatus(_todoReduxState.constants.TODOS_STATUSES.PENDING);
	};
	summary.onClickComplete = function () {
		return _todoReduxState.actions.todos.updateSelectedSummaryStatus(_todoReduxState.constants.TODOS_STATUSES.COMPLETE);
	};
	summary.onClickTotal = function () {
		return _todoReduxState.actions.todos.updateSelectedSummaryStatus(_todoReduxState.constants.TODOS_STATUSES.TOTAL);
	};

	return {
		newForm: newForm,
		list: list,
		summary: summary
	};
});

},{"memoizerific":4,"todo-redux-state":6}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY29tYmluZS1zZWxlY3RvcnMvc3JjL2NvbWJpbmUtc2VsZWN0b3JzLmpzIiwibm9kZV9tb2R1bGVzL21lbW9pemVyaWZpYy9ub2RlX21vZHVsZXMvbWFwLW9yLXNpbWlsYXIvc3JjL21hcC1vci1zaW1pbGFyLmpzIiwibm9kZV9tb2R1bGVzL21lbW9pemVyaWZpYy9ub2RlX21vZHVsZXMvbWFwLW9yLXNpbWlsYXIvc3JjL3NpbWlsYXIuanMiLCJub2RlX21vZHVsZXMvbWVtb2l6ZXJpZmljL3NyYy9tZW1vaXplcmlmaWMuanMiLCJub2RlX21vZHVsZXMvdG9kby1yZWFjdC1jb21wb25lbnRzL2J1aWxkL3RvZG8tcmVhY3QtY29tcG9uZW50cy5qcyIsIm5vZGVfbW9kdWxlcy90b2RvLXJlZHV4LXN0YXRlL2J1aWxkL3RvZG8tcmVkdXgtc3RhdGUuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvc2l0ZS9jb25zdGFudHMvcGF0aHMuanMiLCJzcmMvc2l0ZS9zZWxlY3RlZC1wYWdlLmpzIiwic3JjL3NpdGUvc2l0ZS1oZWFkZXIuanMiLCJzcmMvc2l0ZS91cmwuanMiLCJzcmMvdG9kb3MvdG9kb3MuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7QUNqMENBOzs7O0FBQ0E7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBLElBQU0sZUFBZTtBQUNwQixxQ0FEb0I7QUFFcEIsbUJBRm9CO0FBR3BCLGlDQUhvQjtBQUlwQjtBQUpvQixDQUFyQjs7QUFPQSxJQUFNLFlBQVksZ0NBQWlCLFlBQWpCLEVBQStCO0FBQUE7QUFBQSxDQUEvQixDQUFsQjs7QUFFQSxJQUFNLFFBQVE7QUFDYixxQkFEYTtBQUViLGlDQUZhO0FBR2IscUNBSGE7QUFJYjtBQUphLENBQWQ7O0FBT0EsT0FBTyxjQUFQLENBQXNCLEtBQXRCLEVBQTZCLE9BQTdCLEVBQXNDLEVBQUUsS0FBSztBQUFBO0FBQUEsRUFBUCxFQUF0Qzs7a0JBRWUsSztRQUdkLFMsR0FBQSxTO1FBQ0EsTztRQUNBLFM7UUFDQSxTOzs7QUFHRCxPQUFPLGNBQVAsQ0FBc0IsT0FBdEIsRUFBK0IsT0FBL0IsRUFBd0MsRUFBRSxLQUFLO0FBQUE7QUFBQSxFQUFQLEVBQXhDOzs7Ozs7OztBQ25DTyxJQUFNLHNCQUFPLEdBQWI7QUFDQSxJQUFNLHdCQUFRLFFBQWQ7Ozs7Ozs7Ozs7a0JDRVEsVUFBVSxLQUFWLEVBQWlCO0FBQUEsS0FDdkIsWUFEdUIsR0FDTixLQURNLENBQ3ZCLFlBRHVCOztBQUUvQixRQUFPLG1CQUFtQixZQUFuQixDQUFQO0FBQ0EsQzs7QUFORDs7OztBQUNBOzs7O0FBT08sSUFBTSxrREFBcUIsNEJBQWEsQ0FBYixFQUFnQixVQUFDLFlBQUQsRUFBa0I7QUFDbkUsUUFBTywrQkFBVSxLQUFWLENBQWdCLFlBQWhCLENBQVA7QUFDQSxDQUZpQyxDQUEzQjs7Ozs7Ozs7OztrQkNIUSxVQUFVLEtBQVYsRUFBaUI7QUFBQSxLQUN2QixZQUR1QixHQUNOLEtBRE0sQ0FDdkIsWUFEdUI7O0FBRS9CLFFBQU8saUJBQWlCLFlBQWpCLENBQVA7QUFDQSxDOztBQVJEOzs7O0FBQ0E7O0FBRUE7O0lBQVksSzs7Ozs7O0FBT0wsSUFBTSw4Q0FBbUIsNEJBQWEsQ0FBYixFQUFnQixVQUFDLFlBQUQsRUFBa0I7O0FBRWpFLFFBQU87QUFDTixhQUFXLFVBREw7QUFFTixjQUFZLE9BRk47O0FBSU4sWUFBVSxNQUFNLDBCQUFVLEtBQVYsQ0FBZ0IsSUFBdEIsQ0FKSjtBQUtOLGFBQVcsTUFBTSwwQkFBVSxLQUFWLENBQWdCLEtBQXRCLENBTEw7O0FBT04sZ0JBQWMsWUFQUjs7QUFTTixlQUFhO0FBQUEsVUFBTSx3QkFBUSxJQUFSLENBQWEsa0JBQWIsQ0FBZ0MsMEJBQVUsS0FBVixDQUFnQixJQUFoRCxDQUFOO0FBQUEsR0FUUDtBQVVOLGdCQUFjO0FBQUEsVUFBTSx3QkFBUSxJQUFSLENBQWEsa0JBQWIsQ0FBZ0MsMEJBQVUsS0FBVixDQUFnQixLQUFoRCxDQUFOO0FBQUE7QUFWUixFQUFQO0FBWUEsQ0FkK0IsQ0FBekI7Ozs7Ozs7Ozs7a0JDUFEsVUFBVSxLQUFWLEVBQWlCO0FBQUEsS0FDdkIsWUFEdUIsR0FDTixLQURNLENBQ3ZCLFlBRHVCOztBQUUvQixRQUFPLFVBQVUsWUFBVixDQUFQO0FBQ0EsQzs7QUFORDs7OztBQUNBOztJQUFZLEs7Ozs7OztBQU9MLElBQU0sZ0NBQVksNEJBQWEsQ0FBYixFQUFnQixVQUFDLFlBQUQsRUFBc0M7QUFBQSxLQUF2QixVQUF1Qix1RUFBVixLQUFVOztBQUM5RSxRQUFPLFdBQVcsWUFBWCxDQUFQO0FBQ0EsQ0FGd0IsQ0FBbEI7Ozs7Ozs7Ozs7OztrQkNMUSxVQUFVLEtBQVYsRUFBaUI7QUFBQSxLQUN2QixLQUR1QixHQUNVLEtBRFYsQ0FDdkIsS0FEdUI7QUFBQSxLQUNoQixxQkFEZ0IsR0FDVSxLQURWLENBQ2hCLHFCQURnQjs7O0FBRy9CLFFBQU8sWUFBWSxLQUFaLEVBQW1CLHFCQUFuQixDQUFQO0FBQ0EsQzs7QUFQRDs7OztBQUNBOzs7O0FBUU8sSUFBTSxvQ0FBYyw0QkFBYSxDQUFiLEVBQWdCLFVBQUMsS0FBRCxFQUFRLHFCQUFSLEVBQWtDOztBQUU1RSxLQUFNLFVBQVU7QUFDZixlQUFhLHlCQURFO0FBRWYsWUFBVTtBQUFBLFVBQWUsd0JBQVEsS0FBUixDQUFjLE9BQWQsQ0FBc0IsV0FBdEIsQ0FBZjtBQUFBO0FBRkssRUFBaEI7O0FBS0EsS0FBSSxPQUFPLE9BQU8sSUFBUCxDQUFZLEtBQVosRUFBbUIsR0FBbkIsQ0FBdUIsZUFBTztBQUN4QyxzQkFDSSxNQUFNLEdBQU4sQ0FESjtBQUVDLE9BQUksR0FGTDtBQUdDLGdCQUFhLFFBSGQ7QUFJQyxvQkFBaUI7QUFBQSxXQUFNLHdCQUFRLEtBQVIsQ0FBYyxVQUFkLENBQXlCLEdBQXpCLENBQU47QUFBQSxJQUpsQjtBQUtDLHNCQUFtQjtBQUFBLFdBQU0sd0JBQVEsS0FBUixDQUFjLFlBQWQsQ0FBMkIsR0FBM0IsRUFBZ0MsQ0FBQyxNQUFNLEdBQU4sRUFBVyxVQUE1QyxDQUFOO0FBQUE7QUFMcEI7QUFPQSxFQVJVLENBQVg7O0FBVUEsS0FBTSxVQUFVLEtBQUssTUFBTCxDQUFZLFVBQUMsQ0FBRCxFQUFJLElBQUosRUFBYTtBQUN2QyxHQUFDLEtBQUssVUFBTixJQUFvQixFQUFFLGVBQUYsRUFBcEI7QUFDQSxPQUFLLFVBQUwsSUFBbUIsRUFBRSxhQUFGLEVBQW5CO0FBQ0EsSUFBRSxVQUFGO0FBQ0EsU0FBTyxDQUFQO0FBQ0EsRUFMYyxFQUtaO0FBQ0YsbUJBQWlCLENBRGY7QUFFRixpQkFBZSxDQUZiO0FBR0YsY0FBWTtBQUhWLEVBTFksQ0FBaEI7O0FBV0EsUUFBTyxLQUNMLE1BREssQ0FDRTtBQUFBLFNBQ1AsMEJBQTBCLDBCQUFVLGNBQVYsQ0FBeUIsS0FBbkQsSUFDQywwQkFBMEIsMEJBQVUsY0FBVixDQUF5QixRQUFuRCxJQUErRCxLQUFLLFVBRHJFLElBRUMsMEJBQTBCLDBCQUFVLGNBQVYsQ0FBeUIsT0FBbkQsSUFBOEQsQ0FBQyxLQUFLLFVBSDlEO0FBQUEsRUFERixFQU1MLElBTkssQ0FNQSxVQUFDLENBQUQsRUFBSSxDQUFKLEVBQVU7QUFDZixNQUFJLEVBQUUsV0FBRixHQUFnQixFQUFFLFdBQXRCLEVBQW1DO0FBQUUsVUFBTyxDQUFDLENBQVI7QUFBWTtBQUNqRCxNQUFJLEVBQUUsV0FBRixHQUFnQixFQUFFLFdBQXRCLEVBQW1DO0FBQUUsVUFBTyxDQUFQO0FBQVc7QUFDaEQsTUFBSSxFQUFFLEVBQUYsR0FBTyxFQUFFLEVBQWIsRUFBaUI7QUFBRSxVQUFPLENBQUMsQ0FBUjtBQUFZO0FBQy9CLFNBQU8sQ0FBUDtBQUNBLEVBWEssQ0FBUDs7QUFhQSxTQUFRLGVBQVIsR0FBNkIsUUFBUSxlQUFyQztBQUNBLFNBQVEsYUFBUixHQUEyQixRQUFRLGFBQW5DO0FBQ0EsU0FBUSxVQUFSLEdBQXdCLFFBQVEsVUFBaEM7O0FBRUEsU0FBUSxxQkFBUixHQUFnQyxxQkFBaEM7O0FBRUEsU0FBUSxjQUFSLEdBQXlCO0FBQUEsU0FBTSx3QkFBUSxLQUFSLENBQWMsMkJBQWQsQ0FBMEMsMEJBQVUsY0FBVixDQUF5QixPQUFuRSxDQUFOO0FBQUEsRUFBekI7QUFDQSxTQUFRLGVBQVIsR0FBMEI7QUFBQSxTQUFNLHdCQUFRLEtBQVIsQ0FBYywyQkFBZCxDQUEwQywwQkFBVSxjQUFWLENBQXlCLFFBQW5FLENBQU47QUFBQSxFQUExQjtBQUNBLFNBQVEsWUFBUixHQUF1QjtBQUFBLFNBQU0sd0JBQVEsS0FBUixDQUFjLDJCQUFkLENBQTBDLDBCQUFVLGNBQVYsQ0FBeUIsS0FBbkUsQ0FBTjtBQUFBLEVBQXZCOztBQUVBLFFBQU87QUFDTixrQkFETTtBQUVOLFlBRk07QUFHTjtBQUhNLEVBQVA7QUFLQSxDQXhEMEIsQ0FBcEIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWxlY3RvcnMsIGdldFN0YXRlLCAuLi5hcmdzKSB7XG5cdHJldHVybiBPYmplY3Qua2V5cyhzZWxlY3RvcnMpLnJlZHVjZSgocCwgc2VsZWN0b3JLZXkpID0+IHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkocCwgc2VsZWN0b3JLZXksIHtcblx0XHRcdGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBzZWxlY3RvcnNbc2VsZWN0b3JLZXldKGdldFN0YXRlKCksIC4uLmFyZ3MpIH0sXG5cdFx0XHRlbnVtZXJhYmxlOiB0cnVlXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHA7XG5cdH0sIHt9KTtcbn07XG4iLCJpZiAodHlwZW9mIE1hcCAhPT0gJ2Z1bmN0aW9uJyB8fCAocHJvY2VzcyAmJiBwcm9jZXNzLmVudiAmJiBwcm9jZXNzLmVudi5URVNUX01BUE9SU0lNSUxBUiA9PT0gJ3RydWUnKSkge1xuXHRtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc2ltaWxhcicpO1xufVxuZWxzZSB7XG5cdG1vZHVsZS5leHBvcnRzID0gTWFwO1xufSIsImZ1bmN0aW9uIFNpbWlsYXIoKSB7XG5cdHRoaXMubGlzdCA9IFtdO1xuXHR0aGlzLmxhc3RJdGVtID0gdW5kZWZpbmVkO1xuXHR0aGlzLnNpemUgPSAwO1xuXG5cdHJldHVybiB0aGlzO1xufVxuXG5TaW1pbGFyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihrZXkpIHtcblx0dmFyIGluZGV4O1xuXG5cdGlmICh0aGlzLmxhc3RJdGVtICYmIHRoaXMuaXNFcXVhbCh0aGlzLmxhc3RJdGVtLmtleSwga2V5KSkge1xuXHRcdHJldHVybiB0aGlzLmxhc3RJdGVtLnZhbDtcblx0fVxuXG5cdGluZGV4ID0gdGhpcy5pbmRleE9mKGtleSk7XG5cdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0dGhpcy5sYXN0SXRlbSA9IHRoaXMubGlzdFtpbmRleF07XG5cdFx0cmV0dXJuIHRoaXMubGlzdFtpbmRleF0udmFsO1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cblNpbWlsYXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsKSB7XG5cdHZhciBpbmRleDtcblxuXHRpZiAodGhpcy5sYXN0SXRlbSAmJiB0aGlzLmlzRXF1YWwodGhpcy5sYXN0SXRlbS5rZXksIGtleSkpIHtcblx0XHR0aGlzLmxhc3RJdGVtLnZhbCA9IHZhbDtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGluZGV4ID0gdGhpcy5pbmRleE9mKGtleSk7XG5cdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0dGhpcy5sYXN0SXRlbSA9IHRoaXMubGlzdFtpbmRleF07XG5cdFx0dGhpcy5saXN0W2luZGV4XS52YWwgPSB2YWw7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHR0aGlzLmxhc3RJdGVtID0geyBrZXk6IGtleSwgdmFsOiB2YWwgfTtcblx0dGhpcy5saXN0LnB1c2godGhpcy5sYXN0SXRlbSk7XG5cdHRoaXMuc2l6ZSsrO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxuU2ltaWxhci5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24oa2V5KSB7XG5cdHZhciBpbmRleDtcblxuXHRpZiAodGhpcy5sYXN0SXRlbSAmJiB0aGlzLmlzRXF1YWwodGhpcy5sYXN0SXRlbS5rZXksIGtleSkpIHtcblx0XHR0aGlzLmxhc3RJdGVtID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0aW5kZXggPSB0aGlzLmluZGV4T2Yoa2V5KTtcblx0aWYgKGluZGV4ID49IDApIHtcblx0XHR0aGlzLnNpemUtLTtcblx0XHRyZXR1cm4gdGhpcy5saXN0LnNwbGljZShpbmRleCwgMSlbMF07XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufTtcblxuXG4vLyBpbXBvcnRhbnQgdGhhdCBoYXMoKSBkb2Vzbid0IHVzZSBnZXQoKSBpbiBjYXNlIGFuIGV4aXN0aW5nIGtleSBoYXMgYSBmYWxzeSB2YWx1ZSwgaW4gd2hpY2ggY2FzZSBoYXMoKSB3b3VsZCByZXR1cm4gZmFsc2VcblNpbWlsYXIucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGtleSkge1xuXHR2YXIgaW5kZXg7XG5cblx0aWYgKHRoaXMubGFzdEl0ZW0gJiYgdGhpcy5pc0VxdWFsKHRoaXMubGFzdEl0ZW0ua2V5LCBrZXkpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpbmRleCA9IHRoaXMuaW5kZXhPZihrZXkpO1xuXHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdHRoaXMubGFzdEl0ZW0gPSB0aGlzLmxpc3RbaW5kZXhdO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufTtcblxuU2ltaWxhci5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG5cdHZhciBpO1xuXHRmb3IgKGkgPSAwOyBpIDwgdGhpcy5zaXplOyBpKyspIHtcblx0XHRjYWxsYmFjay5jYWxsKHRoaXNBcmcgfHwgdGhpcywgdGhpcy5saXN0W2ldLnZhbCwgdGhpcy5saXN0W2ldLmtleSwgdGhpcyk7XG5cdH1cbn07XG5cblNpbWlsYXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbihrZXkpIHtcblx0dmFyIGk7XG5cdGZvciAoaSA9IDA7IGkgPCB0aGlzLnNpemU7IGkrKykge1xuXHRcdGlmICh0aGlzLmlzRXF1YWwodGhpcy5saXN0W2ldLmtleSwga2V5KSkge1xuXHRcdFx0cmV0dXJuIGk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiAtMTtcbn07XG5cbi8vIGNoZWNrIGlmIHRoZSBudW1iZXJzIGFyZSBlcXVhbCwgb3Igd2hldGhlciB0aGV5IGFyZSBib3RoIHByZWNpc2VseSBOYU4gKGlzTmFOIHJldHVybnMgdHJ1ZSBmb3IgYWxsIG5vbi1udW1iZXJzKVxuU2ltaWxhci5wcm90b3R5cGUuaXNFcXVhbCA9IGZ1bmN0aW9uKHZhbDEsIHZhbDIpIHtcblx0cmV0dXJuIHZhbDEgPT09IHZhbDIgfHwgKHZhbDEgIT09IHZhbDEgJiYgdmFsMiAhPT0gdmFsMik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNpbWlsYXI7IiwidmFyIE1hcE9yU2ltaWxhciA9IHJlcXVpcmUoJ21hcC1vci1zaW1pbGFyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGxpbWl0KSB7XG5cdHZhciBjYWNoZSA9IG5ldyBNYXBPclNpbWlsYXIoKSxcblx0XHRscnUgPSBbXTtcblxuXHRyZXR1cm4gZnVuY3Rpb24gKGZuKSB7XG5cdFx0dmFyIG1lbW9pemVyaWZpYyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBjdXJyZW50Q2FjaGUgPSBjYWNoZSxcblx0XHRcdFx0bmV3TWFwLFxuXHRcdFx0XHRmblJlc3VsdCxcblx0XHRcdFx0YXJnc0xlbmd0aE1pbnVzT25lID0gYXJndW1lbnRzLmxlbmd0aCAtIDEsXG5cdFx0XHRcdGxydVBhdGggPSBBcnJheShhcmdzTGVuZ3RoTWludXNPbmUgKyAxKSxcblx0XHRcdFx0aXNNZW1vaXplZCA9IHRydWUsXG5cdFx0XHRcdGk7XG5cblx0XHRcdGlmICgobWVtb2l6ZXJpZmljLm51bUFyZ3MgfHwgbWVtb2l6ZXJpZmljLm51bUFyZ3MgPT09IDApICYmIG1lbW9pemVyaWZpYy5udW1BcmdzICE9PSBhcmdzTGVuZ3RoTWludXNPbmUgKyAxKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTWVtb2l6ZXJpZmljIGZ1bmN0aW9ucyBzaG91bGQgYWx3YXlzIGJlIGNhbGxlZCB3aXRoIHRoZSBzYW1lIG51bWJlciBvZiBhcmd1bWVudHMnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gbG9vcCB0aHJvdWdoIGVhY2ggYXJndW1lbnQgdG8gdHJhdmVyc2UgdGhlIG1hcCB0cmVlXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgYXJnc0xlbmd0aE1pbnVzT25lOyBpKyspIHtcblx0XHRcdFx0bHJ1UGF0aFtpXSA9IHtcblx0XHRcdFx0XHRjYWNoZUl0ZW06IGN1cnJlbnRDYWNoZSxcblx0XHRcdFx0XHRhcmc6IGFyZ3VtZW50c1tpXVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vIGNsaW1iIHRocm91Z2ggdGhlIGhpZXJhcmNoaWNhbCBtYXAgdHJlZSB1bnRpbCB0aGUgc2Vjb25kLWxhc3QgYXJndW1lbnQgaGFzIGJlZW4gZm91bmQsIG9yIGFuIGFyZ3VtZW50IGlzIG1pc3NpbmcuXG5cdFx0XHRcdC8vIGlmIGFsbCBhcmd1bWVudHMgdXAgdG8gdGhlIHNlY29uZC1sYXN0IGhhdmUgYmVlbiBmb3VuZCwgdGhpcyB3aWxsIHBvdGVudGlhbGx5IGJlIGEgY2FjaGUgaGl0IChkZXRlcm1pbmVkIGJlbG93KVxuXHRcdFx0XHRpZiAoY3VycmVudENhY2hlLmhhcyhhcmd1bWVudHNbaV0pKSB7XG5cdFx0XHRcdFx0Y3VycmVudENhY2hlID0gY3VycmVudENhY2hlLmdldChhcmd1bWVudHNbaV0pO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aXNNZW1vaXplZCA9IGZhbHNlO1xuXG5cdFx0XHRcdC8vIG1ha2UgbWFwcyB1bnRpbCBsYXN0IHZhbHVlXG5cdFx0XHRcdG5ld01hcCA9IG5ldyBNYXBPclNpbWlsYXIoKTtcblx0XHRcdFx0Y3VycmVudENhY2hlLnNldChhcmd1bWVudHNbaV0sIG5ld01hcCk7XG5cdFx0XHRcdGN1cnJlbnRDYWNoZSA9IG5ld01hcDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gd2UgYXJlIGF0IHRoZSBsYXN0IGFyZywgY2hlY2sgaWYgaXQgaXMgcmVhbGx5IG1lbW9pemVkXG5cdFx0XHRpZiAoaXNNZW1vaXplZCkge1xuXHRcdFx0XHRpZiAoY3VycmVudENhY2hlLmhhcyhhcmd1bWVudHNbYXJnc0xlbmd0aE1pbnVzT25lXSkpIHtcblx0XHRcdFx0XHRmblJlc3VsdCA9IGN1cnJlbnRDYWNoZS5nZXQoYXJndW1lbnRzW2FyZ3NMZW5ndGhNaW51c09uZV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGlzTWVtb2l6ZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWlzTWVtb2l6ZWQpIHtcblx0XHRcdFx0Zm5SZXN1bHQgPSBmbi5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuXHRcdFx0XHRjdXJyZW50Q2FjaGUuc2V0KGFyZ3VtZW50c1thcmdzTGVuZ3RoTWludXNPbmVdLCBmblJlc3VsdCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChsaW1pdCA+IDApIHtcblx0XHRcdFx0bHJ1UGF0aFthcmdzTGVuZ3RoTWludXNPbmVdID0ge1xuXHRcdFx0XHRcdGNhY2hlSXRlbTogY3VycmVudENhY2hlLFxuXHRcdFx0XHRcdGFyZzogYXJndW1lbnRzW2FyZ3NMZW5ndGhNaW51c09uZV1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAoaXNNZW1vaXplZCkge1xuXHRcdFx0XHRcdG1vdmVUb01vc3RSZWNlbnRMcnUobHJ1LCBscnVQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRscnUucHVzaChscnVQYXRoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChscnUubGVuZ3RoID4gbGltaXQpIHtcblx0XHRcdFx0XHRyZW1vdmVDYWNoZWRSZXN1bHQobHJ1LnNoaWZ0KCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdG1lbW9pemVyaWZpYy53YXNNZW1vaXplZCA9IGlzTWVtb2l6ZWQ7XG5cdFx0XHRtZW1vaXplcmlmaWMubnVtQXJncyA9IGFyZ3NMZW5ndGhNaW51c09uZSArIDE7XG5cblx0XHRcdHJldHVybiBmblJlc3VsdDtcblx0XHR9O1xuXG5cdFx0bWVtb2l6ZXJpZmljLmxpbWl0ID0gbGltaXQ7XG5cdFx0bWVtb2l6ZXJpZmljLndhc01lbW9pemVkID0gZmFsc2U7XG5cdFx0bWVtb2l6ZXJpZmljLmNhY2hlID0gY2FjaGU7XG5cdFx0bWVtb2l6ZXJpZmljLmxydSA9IGxydTtcblxuXHRcdHJldHVybiBtZW1vaXplcmlmaWM7XG5cdH07XG59O1xuXG4vLyBtb3ZlIGN1cnJlbnQgYXJncyB0byBtb3N0IHJlY2VudCBwb3NpdGlvblxuZnVuY3Rpb24gbW92ZVRvTW9zdFJlY2VudExydShscnUsIGxydVBhdGgpIHtcblx0dmFyIGxydUxlbiA9IGxydS5sZW5ndGgsXG5cdFx0bHJ1UGF0aExlbiA9IGxydVBhdGgubGVuZ3RoLFxuXHRcdGlzTWF0Y2gsXG5cdFx0aSwgaWk7XG5cblx0Zm9yIChpID0gMDsgaSA8IGxydUxlbjsgaSsrKSB7XG5cdFx0aXNNYXRjaCA9IHRydWU7XG5cdFx0Zm9yIChpaSA9IDA7IGlpIDwgbHJ1UGF0aExlbjsgaWkrKykge1xuXHRcdFx0aWYgKCFpc0VxdWFsKGxydVtpXVtpaV0uYXJnLCBscnVQYXRoW2lpXS5hcmcpKSB7XG5cdFx0XHRcdGlzTWF0Y2ggPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChpc01hdGNoKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRscnUucHVzaChscnUuc3BsaWNlKGksIDEpWzBdKTtcbn1cblxuLy8gcmVtb3ZlIGxlYXN0IHJlY2VudGx5IHVzZWQgY2FjaGUgaXRlbSBhbmQgYWxsIGRlYWQgYnJhbmNoZXNcbmZ1bmN0aW9uIHJlbW92ZUNhY2hlZFJlc3VsdChyZW1vdmVkTHJ1KSB7XG5cdHZhciByZW1vdmVkTHJ1TGVuID0gcmVtb3ZlZExydS5sZW5ndGgsXG5cdFx0Y3VycmVudExydSA9IHJlbW92ZWRMcnVbcmVtb3ZlZExydUxlbiAtIDFdLFxuXHRcdHRtcCxcblx0XHRpO1xuXG5cdGN1cnJlbnRMcnUuY2FjaGVJdGVtLmRlbGV0ZShjdXJyZW50THJ1LmFyZyk7XG5cblx0Ly8gd2FsayBkb3duIHRoZSB0cmVlIHJlbW92aW5nIGRlYWQgYnJhbmNoZXMgKHNpemUgMCkgYWxvbmcgdGhlIHdheVxuXHRmb3IgKGkgPSByZW1vdmVkTHJ1TGVuIC0gMjsgaSA+PSAwOyBpLS0pIHtcblx0XHRjdXJyZW50THJ1ID0gcmVtb3ZlZExydVtpXTtcblx0XHR0bXAgPSBjdXJyZW50THJ1LmNhY2hlSXRlbS5nZXQoY3VycmVudExydS5hcmcpO1xuXG5cdFx0aWYgKCF0bXAgfHwgIXRtcC5zaXplKSB7XG5cdFx0XHRjdXJyZW50THJ1LmNhY2hlSXRlbS5kZWxldGUoY3VycmVudExydS5hcmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cblxuLy8gY2hlY2sgaWYgdGhlIG51bWJlcnMgYXJlIGVxdWFsLCBvciB3aGV0aGVyIHRoZXkgYXJlIGJvdGggcHJlY2lzZWx5IE5hTiAoaXNOYU4gcmV0dXJucyB0cnVlIGZvciBhbGwgbm9uLW51bWJlcnMpXG5mdW5jdGlvbiBpc0VxdWFsKHZhbDEsIHZhbDIpIHtcblx0cmV0dXJuIHZhbDEgPT09IHZhbDIgfHwgKHZhbDEgIT09IHZhbDEgJiYgdmFsMiAhPT0gdmFsMik7XG59IiwiIWZ1bmN0aW9uKGUpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlKW1vZHVsZS5leHBvcnRzPWUoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoW10sZSk7ZWxzZXt2YXIgdDt0PVwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmP3NlbGY6dGhpcyx0LnRvZG9SZWFjdENvbXBvbmVudHM9ZSgpfX0oZnVuY3Rpb24oKXt2YXIgZTtyZXR1cm4gZnVuY3Rpb24gZSh0LG4sbyl7ZnVuY3Rpb24gYShsLHIpe2lmKCFuW2xdKXtpZighdFtsXSl7dmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighciYmdSlyZXR1cm4gdShsLCEwKTtpZihzKXJldHVybiBzKGwsITApO3ZhciBjPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbCtcIidcIik7dGhyb3cgYy5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGN9dmFyIGk9bltsXT17ZXhwb3J0czp7fX07dFtsXVswXS5jYWxsKGkuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W2xdWzFdW2VdO3JldHVybiBhKG4/bjplKX0saSxpLmV4cG9ydHMsZSx0LG4sbyl9cmV0dXJuIG5bbF0uZXhwb3J0c31mb3IodmFyIHM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxsPTA7bDxvLmxlbmd0aDtsKyspYShvW2xdKTtyZXR1cm4gYX0oezE6W2Z1bmN0aW9uKHQsbil7IWZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gdCgpe2Zvcih2YXIgZT1bXSxuPTA7bjxhcmd1bWVudHMubGVuZ3RoO24rKyl7dmFyIGE9YXJndW1lbnRzW25dO2lmKGEpe3ZhciBzPXR5cGVvZiBhO2lmKFwic3RyaW5nXCI9PT1zfHxcIm51bWJlclwiPT09cyllLnB1c2goYSk7ZWxzZSBpZihBcnJheS5pc0FycmF5KGEpKWUucHVzaCh0LmFwcGx5KG51bGwsYSkpO2Vsc2UgaWYoXCJvYmplY3RcIj09PXMpZm9yKHZhciBsIGluIGEpby5jYWxsKGEsbCkmJmFbbF0mJmUucHVzaChsKX19cmV0dXJuIGUuam9pbihcIiBcIil9dmFyIG89e30uaGFzT3duUHJvcGVydHk7XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG4mJm4uZXhwb3J0cz9uLmV4cG9ydHM9dDpcImZ1bmN0aW9uXCI9PXR5cGVvZiBlJiZcIm9iamVjdFwiPT10eXBlb2YgZS5hbWQmJmUuYW1kP2UoXCJjbGFzc25hbWVzXCIsW10sZnVuY3Rpb24oKXtyZXR1cm4gdH0pOndpbmRvdy5jbGFzc05hbWVzPXR9KCl9LHt9XSwyOltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e2RlZmF1bHQ6ZX19T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIGE9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3cuUmVhY3Q6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWwuUmVhY3Q6bnVsbCxzPW8oYSksbD1lKFwiY2xhc3NuYW1lc1wiKSxyPW8obCksdT1lKFwiLi4vc2l0ZS9zaXRlLWhlYWRlclwiKSxjPW8odSksaT1mdW5jdGlvbihlKXtyZXR1cm4gcy5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIixudWxsLHMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KGMuZGVmYXVsdCxlLnNpdGVIZWFkZXIpLHMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwibWFpblwiLHtjbGFzc05hbWU6ci5kZWZhdWx0KFwicGFnZVwiLGUuY2xhc3NOYW1lKX0sXCJBYm91dCBQYWdlXCIpKX07aS5wcm9wVHlwZXM9e2NsYXNzTmFtZTpzLmRlZmF1bHQuUHJvcFR5cGVzLnN0cmluZyxzaXRlSGVhZGVyOnMuZGVmYXVsdC5Qcm9wVHlwZXMub2JqZWN0fSxuLmRlZmF1bHQ9aX0se1wiLi4vc2l0ZS9zaXRlLWhlYWRlclwiOjYsY2xhc3NuYW1lczoxfV0sMzpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7cmV0dXJuIGUmJmUuX19lc01vZHVsZT9lOntkZWZhdWx0OmV9fWZ1bmN0aW9uIGEoZSx0KXtpZighKGUgaW5zdGFuY2VvZiB0KSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpfWZ1bmN0aW9uIHMoZSx0KXtpZighZSl0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7cmV0dXJuIXR8fFwib2JqZWN0XCIhPXR5cGVvZiB0JiZcImZ1bmN0aW9uXCIhPXR5cGVvZiB0P2U6dH1mdW5jdGlvbiBsKGUsdCl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgdCYmbnVsbCE9PXQpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIrdHlwZW9mIHQpO2UucHJvdG90eXBlPU9iamVjdC5jcmVhdGUodCYmdC5wcm90b3R5cGUse2NvbnN0cnVjdG9yOnt2YWx1ZTplLGVudW1lcmFibGU6ITEsd3JpdGFibGU6ITAsY29uZmlndXJhYmxlOiEwfX0pLHQmJihPYmplY3Quc2V0UHJvdG90eXBlT2Y/T2JqZWN0LnNldFByb3RvdHlwZU9mKGUsdCk6ZS5fX3Byb3RvX189dCl9T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIHI9T2JqZWN0LmFzc2lnbnx8ZnVuY3Rpb24oZSl7Zm9yKHZhciB0PTE7dDxhcmd1bWVudHMubGVuZ3RoO3QrKyl7dmFyIG49YXJndW1lbnRzW3RdO2Zvcih2YXIgbyBpbiBuKU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuLG8pJiYoZVtvXT1uW29dKX1yZXR1cm4gZX0sdT1mdW5jdGlvbigpe2Z1bmN0aW9uIGUoZSx0KXtmb3IodmFyIG49MDtuPHQubGVuZ3RoO24rKyl7dmFyIG89dFtuXTtvLmVudW1lcmFibGU9by5lbnVtZXJhYmxlfHwhMSxvLmNvbmZpZ3VyYWJsZT0hMCxcInZhbHVlXCJpbiBvJiYoby53cml0YWJsZT0hMCksT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsby5rZXksbyl9fXJldHVybiBmdW5jdGlvbih0LG4sbyl7cmV0dXJuIG4mJmUodC5wcm90b3R5cGUsbiksbyYmZSh0LG8pLHR9fSgpLGM9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3cuUmVhY3Q6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWwuUmVhY3Q6bnVsbCxpPW8oYyksZj1mdW5jdGlvbihlKXtmdW5jdGlvbiB0KGUpe2EodGhpcyx0KTt2YXIgbj1zKHRoaXMsKHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YodCkpLmNhbGwodGhpcyxlKSk7cmV0dXJuIG4uaGFuZGxlQ2xpY2s9ZnVuY3Rpb24oZSl7bi5wcm9wcy50YXJnZXR8fG4ucHJvcHMuaHJlZiYmMD09PW4ucHJvcHMuaHJlZi5pbmRleE9mKFwibWFpbHRvOlwiKXx8MD09PSFlLmJ1dHRvbnx8ZS5tZXRhS2V5fHxlLmFsdEtleXx8ZS5jdHJsS2V5fHxlLnNoaWZ0S2V5fHwoZS5wcmV2ZW50RGVmYXVsdCgpLG4ucHJvcHMub25DbGljayYmbi5wcm9wcy5vbkNsaWNrKG4ucHJvcHMuaHJlZikpfSxuLmhhbmRsZUNsaWNrPW4uaGFuZGxlQ2xpY2suYmluZChuKSxufXJldHVybiBsKHQsZSksdSh0LFt7a2V5OlwicmVuZGVyXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gaS5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoXCJhXCIscih7fSx0aGlzLnByb3BzLHtocmVmOnRoaXMucHJvcHMuaHJlZixjbGFzc05hbWU6XCJsaW5rIFwiK3RoaXMucHJvcHMuY2xhc3NOYW1lLG9uQ2xpY2s6dGhpcy5oYW5kbGVDbGlja30pKX19XSksdH0oYy5Db21wb25lbnQpO2YucHJvcFR5cGVzPXtjbGFzc05hbWU6Yy5Qcm9wVHlwZXMuc3RyaW5nLGhyZWY6Yy5Qcm9wVHlwZXMuc3RyaW5nLHRhcmdldDpjLlByb3BUeXBlcy5zdHJpbmcsb25DbGljazpjLlByb3BUeXBlcy5mdW5jfSxuLmRlZmF1bHQ9Zn0se31dLDQ6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe3JldHVybiBlJiZlLl9fZXNNb2R1bGU/ZTp7ZGVmYXVsdDplfX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KTt2YXIgYT1PYmplY3QuYXNzaWdufHxmdW5jdGlvbihlKXtmb3IodmFyIHQ9MTt0PGFyZ3VtZW50cy5sZW5ndGg7dCsrKXt2YXIgbj1hcmd1bWVudHNbdF07Zm9yKHZhciBvIGluIG4pT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG4sbykmJihlW29dPW5bb10pfXJldHVybiBlfTtuLmRlZmF1bHQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj12b2lkIDA7c3dpdGNoKHQudXJsIT09d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lJiZ3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCxudWxsLHQudXJsKSx0LnNlbGVjdGVkUGFnZSl7Y2FzZSB1LkFCT1VUOm49bC5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoZC5kZWZhdWx0LHtjbGFzc05hbWU6XCJhYm91dC1wYWdlXCIsc2l0ZUhlYWRlcjp0LnNpdGVIZWFkZXJ9KTticmVhaztkZWZhdWx0Om49bC5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoaS5kZWZhdWx0LGEoe2NsYXNzTmFtZTpcInRvZG9zLXBhZ2VcIn0sdC50b2Rvcyx7c2l0ZUhlYWRlcjp0LnNpdGVIZWFkZXJ9KSl9ci5yZW5kZXIobixlKX07dmFyIHM9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3cuUmVhY3Q6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWwuUmVhY3Q6bnVsbCxsPW8ocykscj1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdy5SZWFjdERPTTpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbC5SZWFjdERPTTpudWxsLHU9ZShcIi4vc2l0ZS9jb25zdGFudHMvcGFnZXNcIiksYz1lKFwiLi90b2Rvcy90b2Rvcy1wYWdlXCIpLGk9byhjKSxmPWUoXCIuL2Fib3V0L2Fib3V0LXBhZ2VcIiksZD1vKGYpfSx7XCIuL2Fib3V0L2Fib3V0LXBhZ2VcIjoyLFwiLi9zaXRlL2NvbnN0YW50cy9wYWdlc1wiOjUsXCIuL3RvZG9zL3RvZG9zLXBhZ2VcIjoxMn1dLDU6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KTtuLkhPTUU9XCJIT01FXCIsbi5BQk9VVD1cIkFCT1VUXCJ9LHt9XSw2OltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e2RlZmF1bHQ6ZX19T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIGE9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3cuUmVhY3Q6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWwuUmVhY3Q6bnVsbCxzPW8oYSksbD1lKFwiY2xhc3NuYW1lc1wiKSxyPW8obCksdT1lKFwiLi4vc2l0ZS9jb25zdGFudHMvcGFnZXNcIiksYz1lKFwiLi4vY29tbW9uL2xpbmtcIiksaT1vKGMpLGY9ZnVuY3Rpb24oZSl7cmV0dXJuIHMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwiaGVhZGVyXCIse2NsYXNzTmFtZTpyLmRlZmF1bHQoXCJzaXRlLWhlYWRlclwiLGUuY2xhc3NOYW1lKX0scy5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoXCJuYXZcIixudWxsLHMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KGkuZGVmYXVsdCx7Y2xhc3NOYW1lOnIuZGVmYXVsdCh7c2VsZWN0ZWQ6ZS5zZWxlY3RlZFBhZ2U9PT11LkhPTUV9KSxocmVmOmUuaHJlZkhvbWUsb25DbGljazplLm9uQ2xpY2tIb21lfSxlLmxhYmVsSG9tZSkscy5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoaS5kZWZhdWx0LHtjbGFzc05hbWU6ci5kZWZhdWx0KHtzZWxlY3RlZDplLnNlbGVjdGVkUGFnZT09PXUuQUJPVVR9KSxocmVmOmUuaHJlZkFib3V0LG9uQ2xpY2s6ZS5vbkNsaWNrQWJvdXR9LGUubGFiZWxBYm91dCkpKX07Zi5wcm9wVHlwZXM9e2NsYXNzTmFtZTpzLmRlZmF1bHQuUHJvcFR5cGVzLnN0cmluZyxzZWxlY3RlZFBhZ2U6cy5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsbGFiZWxIb21lOnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLGxhYmVsQWJvdXQ6cy5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsaHJlZkhvbWU6cy5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsaHJlZkFib3V0OnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLG9uQ2xpY2tIb21lOnMuZGVmYXVsdC5Qcm9wVHlwZXMuZnVuYyxvbkNsaWNrQWJvdXQ6cy5kZWZhdWx0LlByb3BUeXBlcy5mdW5jfSxuLmRlZmF1bHQ9Zn0se1wiLi4vY29tbW9uL2xpbmtcIjozLFwiLi4vc2l0ZS9jb25zdGFudHMvcGFnZXNcIjo1LGNsYXNzbmFtZXM6MX1dLDc6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe2lmKGUmJmUuX19lc01vZHVsZSlyZXR1cm4gZTt2YXIgdD17fTtpZihudWxsIT1lKWZvcih2YXIgbiBpbiBlKU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlLG4pJiYodFtuXT1lW25dKTtyZXR1cm4gdC5kZWZhdWx0PWUsdH1mdW5jdGlvbiBhKGUpe3JldHVybiBlJiZlLl9fZXNNb2R1bGU/ZTp7ZGVmYXVsdDplfX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KSxuLmNvbnN0YW50cz1uLmNvbXBvbmVudD12b2lkIDA7dmFyIHM9ZShcIi4vY29tcG9uZW50XCIpLGw9YShzKSxyPWUoXCIuL3NpdGUvY29uc3RhbnRzL3BhZ2VzXCIpLHU9byhyKSxjPWUoXCIuL3RvZG9zL2NvbnN0YW50cy9zdGF0dXNlc1wiKSxpPW8oYyksZj17UEFHRVM6dSxUT0RPX1NUQVRVU0VTOml9O24uZGVmYXVsdD17Y29tcG9uZW50OmwuZGVmYXVsdCxjb25zdGFudHM6Zn0sbi5jb21wb25lbnQ9bC5kZWZhdWx0LG4uY29uc3RhbnRzPWZ9LHtcIi4vY29tcG9uZW50XCI6NCxcIi4vc2l0ZS9jb25zdGFudHMvcGFnZXNcIjo1LFwiLi90b2Rvcy9jb25zdGFudHMvc3RhdHVzZXNcIjo4fV0sODpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO09iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pO24uUEVORElORz1cIlBFTkRJTkdcIixuLkNPTVBMRVRFPVwiQ09NUExFVEVcIixuLlRPVEFMPVwiVE9UQUxcIn0se31dLDk6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe3JldHVybiBlJiZlLl9fZXNNb2R1bGU/ZTp7ZGVmYXVsdDplfX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KTt2YXIgYT1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdy5SZWFjdDpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbC5SZWFjdDpudWxsLHM9byhhKSxsPWUoXCJjbGFzc25hbWVzXCIpLHI9byhsKSx1PWZ1bmN0aW9uKGUpe3JldHVybiBzLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcImFydGljbGVcIix7Y2xhc3NOYW1lOnIuZGVmYXVsdChcImxpc3QtaXRlbVwiLHtjaGVja2VkOmUuaXNDb21wbGV0ZX0sZS5jbGFzc05hbWUpfSxzLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIse2NsYXNzTmFtZTpcImRlc2NyaXB0aW9uXCJ9LHMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIix7Y2xhc3NOYW1lOlwiY2hlY2tib3hcIix0eXBlOlwiY2hlY2tib3hcIixjaGVja2VkOmUuaXNDb21wbGV0ZSxvbkNoYW5nZTplLm9uQ2hlY2tib3hUb2dnbGVkfSksZS5kZXNjcmlwdGlvbikscy5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIix7Y2xhc3NOYW1lOlwiYnV0dG9uXCIsb25DbGljazplLm9uQnV0dG9uQ2xpY2tlZH0sZS5idXR0b25MYWJlbCkpfTt1LnByb3BUeXBlcz17Y2xhc3NOYW1lOnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLGRlc2NyaXB0aW9uOnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLGlzQ29tcGxldGU6cy5kZWZhdWx0LlByb3BUeXBlcy5ib29sLGJ1dHRvbkxhYmVsOnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLG9uQnV0dG9uQ2xpY2tlZDpzLmRlZmF1bHQuUHJvcFR5cGVzLmZ1bmMsb25DaGVja2JveFRvZ2dsZWQ6cy5kZWZhdWx0LlByb3BUeXBlcy5mdW5jfSxuLmRlZmF1bHQ9dX0se2NsYXNzbmFtZXM6MX1dLDEwOltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e2RlZmF1bHQ6ZX19T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIGE9T2JqZWN0LmFzc2lnbnx8ZnVuY3Rpb24oZSl7Zm9yKHZhciB0PTE7dDxhcmd1bWVudHMubGVuZ3RoO3QrKyl7dmFyIG49YXJndW1lbnRzW3RdO2Zvcih2YXIgbyBpbiBuKU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuLG8pJiYoZVtvXT1uW29dKX1yZXR1cm4gZX0scz1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdy5SZWFjdDpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbC5SZWFjdDpudWxsLGw9byhzKSxyPWUoXCJjbGFzc25hbWVzXCIpLHU9byhyKSxjPWUoXCIuLi90b2Rvcy90b2RvLWl0ZW1cIiksaT1vKGMpLGY9ZnVuY3Rpb24oZSl7cmV0dXJuIGwuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiLHtjbGFzc05hbWU6dS5kZWZhdWx0KFwibGlzdFwiLGUuY2xhc3NOYW1lKX0sISFlLnRvZG9zJiZlLnRvZG9zLm1hcChmdW5jdGlvbihlKXtyZXR1cm4gbC5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoaS5kZWZhdWx0LGEoe2tleTplLmlkfSxlKSl9KSl9O2YucHJvcFR5cGVzPXtjbGFzc05hbWU6bC5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsdG9kb3M6bC5kZWZhdWx0LlByb3BUeXBlcy5hcnJheX0sbi5kZWZhdWx0PWZ9LHtcIi4uL3RvZG9zL3RvZG8taXRlbVwiOjksY2xhc3NuYW1lczoxfV0sMTE6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe3JldHVybiBlJiZlLl9fZXNNb2R1bGU/ZTp7ZGVmYXVsdDplfX1mdW5jdGlvbiBhKGUsdCl7aWYoIShlIGluc3RhbmNlb2YgdCkpdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKX1mdW5jdGlvbiBzKGUsdCl7aWYoIWUpdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO3JldHVybiF0fHxcIm9iamVjdFwiIT10eXBlb2YgdCYmXCJmdW5jdGlvblwiIT10eXBlb2YgdD9lOnR9ZnVuY3Rpb24gbChlLHQpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIHQmJm51bGwhPT10KXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiB0KTtlLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKHQmJnQucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6ZSxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSx0JiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZihlLHQpOmUuX19wcm90b19fPXQpfU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pO3ZhciByPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gZShlLHQpe2Zvcih2YXIgbj0wO248dC5sZW5ndGg7bisrKXt2YXIgbz10W25dO28uZW51bWVyYWJsZT1vLmVudW1lcmFibGV8fCExLG8uY29uZmlndXJhYmxlPSEwLFwidmFsdWVcImluIG8mJihvLndyaXRhYmxlPSEwKSxPYmplY3QuZGVmaW5lUHJvcGVydHkoZSxvLmtleSxvKX19cmV0dXJuIGZ1bmN0aW9uKHQsbixvKXtyZXR1cm4gbiYmZSh0LnByb3RvdHlwZSxuKSxvJiZlKHQsbyksdH19KCksdT1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdy5SZWFjdDpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbC5SZWFjdDpudWxsLGM9byh1KSxpPWUoXCJjbGFzc25hbWVzXCIpLGY9byhpKSxkPWZ1bmN0aW9uKGUpe2Z1bmN0aW9uIHQoZSl7YSh0aGlzLHQpO3ZhciBuPXModGhpcywodC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZih0KSkuY2FsbCh0aGlzLGUpKTtyZXR1cm4gbi5oYW5kbGVPbkNoYW5nZT1mdW5jdGlvbihlKXtuLnNldFN0YXRlKHt2YWx1ZTplLnRhcmdldC52YWx1ZX0pfSxuLmhhbmRsZU9uU3VibWl0PWZ1bmN0aW9uKGUpe2UucHJldmVudERlZmF1bHQoKSxuLnNldFN0YXRlKHt2YWx1ZTpcIlwifSksbi5wcm9wcy5vblN1Ym1pdChuLnN0YXRlLnZhbHVlKX0sbi5zdGF0ZT17dmFsdWU6bi5wcm9wcy52YWx1ZXx8XCJcIn0sbi5oYW5kbGVPbkNoYW5nZT1uLmhhbmRsZU9uQ2hhbmdlLmJpbmQobiksbi5oYW5kbGVPblN1Ym1pdD1uLmhhbmRsZU9uU3VibWl0LmJpbmQobiksbn1yZXR1cm4gbCh0LGUpLHIodCxbe2tleTpcInJlbmRlclwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIGU9dGhpcy5wcm9wcyx0PXRoaXMuc3RhdGU7cmV0dXJuIGMuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwiZm9ybVwiLHtjbGFzc05hbWU6Zi5kZWZhdWx0KGUuY2xhc3NOYW1lKSxvblN1Ym1pdDp0aGlzLmhhbmRsZU9uU3VibWl0fSxjLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcImlucHV0XCIse2NsYXNzTmFtZTpcInRvZG9zLW5ldy1mb3JtLWlucHV0XCIsdmFsdWU6dC52YWx1ZSxwbGFjZWhvbGRlcjplLnBsYWNlaG9sZGVyLG9uQ2hhbmdlOnRoaXMuaGFuZGxlT25DaGFuZ2V9KSl9fV0pLHR9KHUuQ29tcG9uZW50KTtkLnByb3BUeXBlcz17Y2xhc3NOYW1lOmMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLHBsYWNlaG9sZGVyOmMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLG9uU3VibWl0OmMuZGVmYXVsdC5Qcm9wVHlwZXMuZnVuY30sbi5kZWZhdWx0PWR9LHtjbGFzc25hbWVzOjF9XSwxMjpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7cmV0dXJuIGUmJmUuX19lc01vZHVsZT9lOntkZWZhdWx0OmV9fU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pO3ZhciBhPU9iamVjdC5hc3NpZ258fGZ1bmN0aW9uKGUpe2Zvcih2YXIgdD0xO3Q8YXJndW1lbnRzLmxlbmd0aDt0Kyspe3ZhciBuPWFyZ3VtZW50c1t0XTtmb3IodmFyIG8gaW4gbilPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobixvKSYmKGVbb109bltvXSl9cmV0dXJuIGV9LHM9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3cuUmVhY3Q6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWwuUmVhY3Q6bnVsbCxsPW8ocykscj1lKFwiY2xhc3NuYW1lc1wiKSx1PW8ociksYz1lKFwiLi4vc2l0ZS9zaXRlLWhlYWRlclwiKSxpPW8oYyksZj1lKFwiLi4vdG9kb3MvdG9kb3MtbmV3LWZvcm1cIiksZD1vKGYpLHA9ZShcIi4uL3RvZG9zL3RvZG9zLWxpc3RcIiksbT1vKHApLHk9ZShcIi4uL3RvZG9zL3RvZG9zLXN1bW1hcnlcIiksYj1vKHkpLGc9ZnVuY3Rpb24oZSl7cmV0dXJuIGwuZGVmYXVsdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsbnVsbCxsLmRlZmF1bHQuY3JlYXRlRWxlbWVudChpLmRlZmF1bHQsZS5zaXRlSGVhZGVyKSxsLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcIm1haW5cIix7Y2xhc3NOYW1lOnUuZGVmYXVsdChcInBhZ2VcIixlLmNsYXNzTmFtZSl9LCEhZS5uZXdGb3JtJiZsLmRlZmF1bHQuY3JlYXRlRWxlbWVudChkLmRlZmF1bHQsYSh7Y2xhc3NOYW1lOlwidG9kb3MtbmV3LWZvcm1cIn0sZS5uZXdGb3JtKSksISFlLmxpc3QmJmwuZGVmYXVsdC5jcmVhdGVFbGVtZW50KG0uZGVmYXVsdCx7Y2xhc3NOYW1lOlwidG9kb3MtbGlzdFwiLHRvZG9zOmUubGlzdH0pLCEhZS5zdW1tYXJ5JiZsLmRlZmF1bHQuY3JlYXRlRWxlbWVudChiLmRlZmF1bHQsYSh7Y2xhc3NOYW1lOlwidG9kb3Mtc3VtbWFyeVwifSxlLnN1bW1hcnkpKSkpfTtnLnByb3BUeXBlcz17Y2xhc3NOYW1lOmwuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLHNpdGVIZWFkZXI6bC5kZWZhdWx0LlByb3BUeXBlcy5vYmplY3QsbmV3Rm9ybTpsLmRlZmF1bHQuUHJvcFR5cGVzLm9iamVjdCxsaXN0OmwuZGVmYXVsdC5Qcm9wVHlwZXMuYXJyYXksc3VtbWFyeTpsLmRlZmF1bHQuUHJvcFR5cGVzLm9iamVjdH0sbi5kZWZhdWx0PWd9LHtcIi4uL3NpdGUvc2l0ZS1oZWFkZXJcIjo2LFwiLi4vdG9kb3MvdG9kb3MtbGlzdFwiOjEwLFwiLi4vdG9kb3MvdG9kb3MtbmV3LWZvcm1cIjoxMSxcIi4uL3RvZG9zL3RvZG9zLXN1bW1hcnlcIjoxMyxjbGFzc25hbWVzOjF9XSwxMzpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7cmV0dXJuIGUmJmUuX19lc01vZHVsZT9lOntkZWZhdWx0OmV9fU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pO3ZhciBhPVwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93LlJlYWN0OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Z2xvYmFsLlJlYWN0Om51bGwscz1vKGEpLGw9ZShcImNsYXNzbmFtZXNcIikscj1vKGwpLHU9ZShcIi4uL3RvZG9zL2NvbnN0YW50cy9zdGF0dXNlc1wiKSxjPWZ1bmN0aW9uKGUpe3JldHVybiBzLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIix7Y2xhc3NOYW1lOnIuZGVmYXVsdChcInRvZG8tc3VtbWFyeVwiLGUuY2xhc3NOYW1lKX0scy5kZWZhdWx0LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIse2NsYXNzTmFtZTpyLmRlZmF1bHQoXCJ0b2RvLXN1bW1hcnktcGVuZGluZ1wiLHtcImlzLXNlbGVjdGVkXCI6ZS5zZWxlY3RlZFN1bW1hcnlTdGF0dXM9PT11LlBFTkRJTkd9KSxvbkNsaWNrOmUub25DbGlja1BlbmRpbmd9LGUuY291bnRJbmNvbXBsZXRlKSxzLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcInNwYW5cIix7Y2xhc3NOYW1lOnIuZGVmYXVsdChcInRvZG8tc3VtbWFyeS1jb21wbGV0ZVwiLHtcImlzLXNlbGVjdGVkXCI6ZS5zZWxlY3RlZFN1bW1hcnlTdGF0dXM9PT11LkNPTVBMRVRFfSksb25DbGljazplLm9uQ2xpY2tDb21wbGV0ZX0sZS5jb3VudENvbXBsZXRlKSxzLmRlZmF1bHQuY3JlYXRlRWxlbWVudChcInNwYW5cIix7Y2xhc3NOYW1lOnIuZGVmYXVsdChcInRvZG8tc3VtbWFyeS10b3RhbFwiLHtcImlzLXNlbGVjdGVkXCI6ZS5zZWxlY3RlZFN1bW1hcnlTdGF0dXM9PT11LlRPVEFMfSksb25DbGljazplLm9uQ2xpY2tUb3RhbH0sZS5jb3VudFRvdGFsKSl9O2MucHJvcFR5cGVzPXtjbGFzc05hbWU6cy5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsY291bnRJbmNvbXBsZXRlOnMuZGVmYXVsdC5Qcm9wVHlwZXMuc3RyaW5nLGNvdW50Q29tcGxldGU6cy5kZWZhdWx0LlByb3BUeXBlcy5zdHJpbmcsY291bnRUb3RhbDpzLmRlZmF1bHQuUHJvcFR5cGVzLnN0cmluZyxzZWxlY3RlZFN1bW1hcnlTdGF0dXM6cy5kZWZhdWx0LlByb3BUeXBlcy5vbmVPZihbdS5QRU5ESU5HLHUuQ09NUExFVEUsdS5UT1RBTF0pLG9uQ2xpY2tQZW5kaW5nOnMuZGVmYXVsdC5Qcm9wVHlwZXMuZnVuYyxvbkNsaWNrQ29tcGxldGU6cy5kZWZhdWx0LlByb3BUeXBlcy5mdW5jLG9uQ2xpY2tUb3RhbDpzLmRlZmF1bHQuUHJvcFR5cGVzLmZ1bmN9LG4uZGVmYXVsdD1jfSx7XCIuLi90b2Rvcy9jb25zdGFudHMvc3RhdHVzZXNcIjo4LGNsYXNzbmFtZXM6MX1dfSx7fSxbN10pKDcpfSk7IiwiKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcudG9kb1JlZHV4U3RhdGUgPSBmKCl9fSkoZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiAoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSh7MTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5mdW5jdGlvbiBjcmVhdGVUaHVua01pZGRsZXdhcmUoZXh0cmFBcmd1bWVudCkge1xuICByZXR1cm4gZnVuY3Rpb24gKF9yZWYpIHtcbiAgICB2YXIgZGlzcGF0Y2ggPSBfcmVmLmRpc3BhdGNoO1xuICAgIHZhciBnZXRTdGF0ZSA9IF9yZWYuZ2V0U3RhdGU7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChuZXh0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGFjdGlvbikge1xuICAgICAgICBpZiAodHlwZW9mIGFjdGlvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHJldHVybiBhY3Rpb24oZGlzcGF0Y2gsIGdldFN0YXRlLCBleHRyYUFyZ3VtZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXh0KGFjdGlvbik7XG4gICAgICB9O1xuICAgIH07XG4gIH07XG59XG5cbnZhciB0aHVuayA9IGNyZWF0ZVRodW5rTWlkZGxld2FyZSgpO1xudGh1bmsud2l0aEV4dHJhQXJndW1lbnQgPSBjcmVhdGVUaHVua01pZGRsZXdhcmU7XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHRodW5rO1xufSx7fV0sMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IGFwcGx5TWlkZGxld2FyZTtcblxudmFyIF9jb21wb3NlID0gX2RlcmVxXygnLi9jb21wb3NlJyk7XG5cbnZhciBfY29tcG9zZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb21wb3NlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG4vKipcbiAqIENyZWF0ZXMgYSBzdG9yZSBlbmhhbmNlciB0aGF0IGFwcGxpZXMgbWlkZGxld2FyZSB0byB0aGUgZGlzcGF0Y2ggbWV0aG9kXG4gKiBvZiB0aGUgUmVkdXggc3RvcmUuIFRoaXMgaXMgaGFuZHkgZm9yIGEgdmFyaWV0eSBvZiB0YXNrcywgc3VjaCBhcyBleHByZXNzaW5nXG4gKiBhc3luY2hyb25vdXMgYWN0aW9ucyBpbiBhIGNvbmNpc2UgbWFubmVyLCBvciBsb2dnaW5nIGV2ZXJ5IGFjdGlvbiBwYXlsb2FkLlxuICpcbiAqIFNlZSBgcmVkdXgtdGh1bmtgIHBhY2thZ2UgYXMgYW4gZXhhbXBsZSBvZiB0aGUgUmVkdXggbWlkZGxld2FyZS5cbiAqXG4gKiBCZWNhdXNlIG1pZGRsZXdhcmUgaXMgcG90ZW50aWFsbHkgYXN5bmNocm9ub3VzLCB0aGlzIHNob3VsZCBiZSB0aGUgZmlyc3RcbiAqIHN0b3JlIGVuaGFuY2VyIGluIHRoZSBjb21wb3NpdGlvbiBjaGFpbi5cbiAqXG4gKiBOb3RlIHRoYXQgZWFjaCBtaWRkbGV3YXJlIHdpbGwgYmUgZ2l2ZW4gdGhlIGBkaXNwYXRjaGAgYW5kIGBnZXRTdGF0ZWAgZnVuY3Rpb25zXG4gKiBhcyBuYW1lZCBhcmd1bWVudHMuXG4gKlxuICogQHBhcmFtIHsuLi5GdW5jdGlvbn0gbWlkZGxld2FyZXMgVGhlIG1pZGRsZXdhcmUgY2hhaW4gdG8gYmUgYXBwbGllZC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBzdG9yZSBlbmhhbmNlciBhcHBseWluZyB0aGUgbWlkZGxld2FyZS5cbiAqL1xuZnVuY3Rpb24gYXBwbHlNaWRkbGV3YXJlKCkge1xuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgbWlkZGxld2FyZXMgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICBtaWRkbGV3YXJlc1tfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoY3JlYXRlU3RvcmUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHJlZHVjZXIsIHByZWxvYWRlZFN0YXRlLCBlbmhhbmNlcikge1xuICAgICAgdmFyIHN0b3JlID0gY3JlYXRlU3RvcmUocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUsIGVuaGFuY2VyKTtcbiAgICAgIHZhciBfZGlzcGF0Y2ggPSBzdG9yZS5kaXNwYXRjaDtcbiAgICAgIHZhciBjaGFpbiA9IFtdO1xuXG4gICAgICB2YXIgbWlkZGxld2FyZUFQSSA9IHtcbiAgICAgICAgZ2V0U3RhdGU6IHN0b3JlLmdldFN0YXRlLFxuICAgICAgICBkaXNwYXRjaDogZnVuY3Rpb24gZGlzcGF0Y2goYWN0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIF9kaXNwYXRjaChhY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgY2hhaW4gPSBtaWRkbGV3YXJlcy5tYXAoZnVuY3Rpb24gKG1pZGRsZXdhcmUpIHtcbiAgICAgICAgcmV0dXJuIG1pZGRsZXdhcmUobWlkZGxld2FyZUFQSSk7XG4gICAgICB9KTtcbiAgICAgIF9kaXNwYXRjaCA9IF9jb21wb3NlMlsnZGVmYXVsdCddLmFwcGx5KHVuZGVmaW5lZCwgY2hhaW4pKHN0b3JlLmRpc3BhdGNoKTtcblxuICAgICAgcmV0dXJuIF9leHRlbmRzKHt9LCBzdG9yZSwge1xuICAgICAgICBkaXNwYXRjaDogX2Rpc3BhdGNoXG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xufVxufSx7XCIuL2NvbXBvc2VcIjo1fV0sMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzWydkZWZhdWx0J10gPSBiaW5kQWN0aW9uQ3JlYXRvcnM7XG5mdW5jdGlvbiBiaW5kQWN0aW9uQ3JlYXRvcihhY3Rpb25DcmVhdG9yLCBkaXNwYXRjaCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBkaXNwYXRjaChhY3Rpb25DcmVhdG9yLmFwcGx5KHVuZGVmaW5lZCwgYXJndW1lbnRzKSk7XG4gIH07XG59XG5cbi8qKlxuICogVHVybnMgYW4gb2JqZWN0IHdob3NlIHZhbHVlcyBhcmUgYWN0aW9uIGNyZWF0b3JzLCBpbnRvIGFuIG9iamVjdCB3aXRoIHRoZVxuICogc2FtZSBrZXlzLCBidXQgd2l0aCBldmVyeSBmdW5jdGlvbiB3cmFwcGVkIGludG8gYSBgZGlzcGF0Y2hgIGNhbGwgc28gdGhleVxuICogbWF5IGJlIGludm9rZWQgZGlyZWN0bHkuIFRoaXMgaXMganVzdCBhIGNvbnZlbmllbmNlIG1ldGhvZCwgYXMgeW91IGNhbiBjYWxsXG4gKiBgc3RvcmUuZGlzcGF0Y2goTXlBY3Rpb25DcmVhdG9ycy5kb1NvbWV0aGluZygpKWAgeW91cnNlbGYganVzdCBmaW5lLlxuICpcbiAqIEZvciBjb252ZW5pZW5jZSwgeW91IGNhbiBhbHNvIHBhc3MgYSBzaW5nbGUgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LFxuICogYW5kIGdldCBhIGZ1bmN0aW9uIGluIHJldHVybi5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gYWN0aW9uQ3JlYXRvcnMgQW4gb2JqZWN0IHdob3NlIHZhbHVlcyBhcmUgYWN0aW9uXG4gKiBjcmVhdG9yIGZ1bmN0aW9ucy4gT25lIGhhbmR5IHdheSB0byBvYnRhaW4gaXQgaXMgdG8gdXNlIEVTNiBgaW1wb3J0ICogYXNgXG4gKiBzeW50YXguIFlvdSBtYXkgYWxzbyBwYXNzIGEgc2luZ2xlIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGRpc3BhdGNoIFRoZSBgZGlzcGF0Y2hgIGZ1bmN0aW9uIGF2YWlsYWJsZSBvbiB5b3VyIFJlZHV4XG4gKiBzdG9yZS5cbiAqXG4gKiBAcmV0dXJucyB7RnVuY3Rpb258T2JqZWN0fSBUaGUgb2JqZWN0IG1pbWlja2luZyB0aGUgb3JpZ2luYWwgb2JqZWN0LCBidXQgd2l0aFxuICogZXZlcnkgYWN0aW9uIGNyZWF0b3Igd3JhcHBlZCBpbnRvIHRoZSBgZGlzcGF0Y2hgIGNhbGwuIElmIHlvdSBwYXNzZWQgYVxuICogZnVuY3Rpb24gYXMgYGFjdGlvbkNyZWF0b3JzYCwgdGhlIHJldHVybiB2YWx1ZSB3aWxsIGFsc28gYmUgYSBzaW5nbGVcbiAqIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiaW5kQWN0aW9uQ3JlYXRvcnMoYWN0aW9uQ3JlYXRvcnMsIGRpc3BhdGNoKSB7XG4gIGlmICh0eXBlb2YgYWN0aW9uQ3JlYXRvcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gYmluZEFjdGlvbkNyZWF0b3IoYWN0aW9uQ3JlYXRvcnMsIGRpc3BhdGNoKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgYWN0aW9uQ3JlYXRvcnMgIT09ICdvYmplY3QnIHx8IGFjdGlvbkNyZWF0b3JzID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiaW5kQWN0aW9uQ3JlYXRvcnMgZXhwZWN0ZWQgYW4gb2JqZWN0IG9yIGEgZnVuY3Rpb24sIGluc3RlYWQgcmVjZWl2ZWQgJyArIChhY3Rpb25DcmVhdG9ycyA9PT0gbnVsbCA/ICdudWxsJyA6IHR5cGVvZiBhY3Rpb25DcmVhdG9ycykgKyAnLiAnICsgJ0RpZCB5b3Ugd3JpdGUgXCJpbXBvcnQgQWN0aW9uQ3JlYXRvcnMgZnJvbVwiIGluc3RlYWQgb2YgXCJpbXBvcnQgKiBhcyBBY3Rpb25DcmVhdG9ycyBmcm9tXCI/Jyk7XG4gIH1cblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFjdGlvbkNyZWF0b3JzKTtcbiAgdmFyIGJvdW5kQWN0aW9uQ3JlYXRvcnMgPSB7fTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgdmFyIGFjdGlvbkNyZWF0b3IgPSBhY3Rpb25DcmVhdG9yc1trZXldO1xuICAgIGlmICh0eXBlb2YgYWN0aW9uQ3JlYXRvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgYm91bmRBY3Rpb25DcmVhdG9yc1trZXldID0gYmluZEFjdGlvbkNyZWF0b3IoYWN0aW9uQ3JlYXRvciwgZGlzcGF0Y2gpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYm91bmRBY3Rpb25DcmVhdG9ycztcbn1cbn0se31dLDQ6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0c1snZGVmYXVsdCddID0gY29tYmluZVJlZHVjZXJzO1xuXG52YXIgX2NyZWF0ZVN0b3JlID0gX2RlcmVxXygnLi9jcmVhdGVTdG9yZScpO1xuXG52YXIgX2lzUGxhaW5PYmplY3QgPSBfZGVyZXFfKCdsb2Rhc2gvaXNQbGFpbk9iamVjdCcpO1xuXG52YXIgX2lzUGxhaW5PYmplY3QyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNQbGFpbk9iamVjdCk7XG5cbnZhciBfd2FybmluZyA9IF9kZXJlcV8oJy4vdXRpbHMvd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gZ2V0VW5kZWZpbmVkU3RhdGVFcnJvck1lc3NhZ2Uoa2V5LCBhY3Rpb24pIHtcbiAgdmFyIGFjdGlvblR5cGUgPSBhY3Rpb24gJiYgYWN0aW9uLnR5cGU7XG4gIHZhciBhY3Rpb25OYW1lID0gYWN0aW9uVHlwZSAmJiAnXCInICsgYWN0aW9uVHlwZS50b1N0cmluZygpICsgJ1wiJyB8fCAnYW4gYWN0aW9uJztcblxuICByZXR1cm4gJ0dpdmVuIGFjdGlvbiAnICsgYWN0aW9uTmFtZSArICcsIHJlZHVjZXIgXCInICsga2V5ICsgJ1wiIHJldHVybmVkIHVuZGVmaW5lZC4gJyArICdUbyBpZ25vcmUgYW4gYWN0aW9uLCB5b3UgbXVzdCBleHBsaWNpdGx5IHJldHVybiB0aGUgcHJldmlvdXMgc3RhdGUuJztcbn1cblxuZnVuY3Rpb24gZ2V0VW5leHBlY3RlZFN0YXRlU2hhcGVXYXJuaW5nTWVzc2FnZShpbnB1dFN0YXRlLCByZWR1Y2VycywgYWN0aW9uLCB1bmV4cGVjdGVkS2V5Q2FjaGUpIHtcbiAgdmFyIHJlZHVjZXJLZXlzID0gT2JqZWN0LmtleXMocmVkdWNlcnMpO1xuICB2YXIgYXJndW1lbnROYW1lID0gYWN0aW9uICYmIGFjdGlvbi50eXBlID09PSBfY3JlYXRlU3RvcmUuQWN0aW9uVHlwZXMuSU5JVCA/ICdwcmVsb2FkZWRTdGF0ZSBhcmd1bWVudCBwYXNzZWQgdG8gY3JlYXRlU3RvcmUnIDogJ3ByZXZpb3VzIHN0YXRlIHJlY2VpdmVkIGJ5IHRoZSByZWR1Y2VyJztcblxuICBpZiAocmVkdWNlcktleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICdTdG9yZSBkb2VzIG5vdCBoYXZlIGEgdmFsaWQgcmVkdWNlci4gTWFrZSBzdXJlIHRoZSBhcmd1bWVudCBwYXNzZWQgJyArICd0byBjb21iaW5lUmVkdWNlcnMgaXMgYW4gb2JqZWN0IHdob3NlIHZhbHVlcyBhcmUgcmVkdWNlcnMuJztcbiAgfVxuXG4gIGlmICghKDAsIF9pc1BsYWluT2JqZWN0MlsnZGVmYXVsdCddKShpbnB1dFN0YXRlKSkge1xuICAgIHJldHVybiAnVGhlICcgKyBhcmd1bWVudE5hbWUgKyAnIGhhcyB1bmV4cGVjdGVkIHR5cGUgb2YgXCInICsge30udG9TdHJpbmcuY2FsbChpbnB1dFN0YXRlKS5tYXRjaCgvXFxzKFthLXp8QS1aXSspLylbMV0gKyAnXCIuIEV4cGVjdGVkIGFyZ3VtZW50IHRvIGJlIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgJyArICgna2V5czogXCInICsgcmVkdWNlcktleXMuam9pbignXCIsIFwiJykgKyAnXCInKTtcbiAgfVxuXG4gIHZhciB1bmV4cGVjdGVkS2V5cyA9IE9iamVjdC5rZXlzKGlucHV0U3RhdGUpLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuICFyZWR1Y2Vycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICF1bmV4cGVjdGVkS2V5Q2FjaGVba2V5XTtcbiAgfSk7XG5cbiAgdW5leHBlY3RlZEtleXMuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdW5leHBlY3RlZEtleUNhY2hlW2tleV0gPSB0cnVlO1xuICB9KTtcblxuICBpZiAodW5leHBlY3RlZEtleXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiAnVW5leHBlY3RlZCAnICsgKHVuZXhwZWN0ZWRLZXlzLmxlbmd0aCA+IDEgPyAna2V5cycgOiAna2V5JykgKyAnICcgKyAoJ1wiJyArIHVuZXhwZWN0ZWRLZXlzLmpvaW4oJ1wiLCBcIicpICsgJ1wiIGZvdW5kIGluICcgKyBhcmd1bWVudE5hbWUgKyAnLiAnKSArICdFeHBlY3RlZCB0byBmaW5kIG9uZSBvZiB0aGUga25vd24gcmVkdWNlciBrZXlzIGluc3RlYWQ6ICcgKyAoJ1wiJyArIHJlZHVjZXJLZXlzLmpvaW4oJ1wiLCBcIicpICsgJ1wiLiBVbmV4cGVjdGVkIGtleXMgd2lsbCBiZSBpZ25vcmVkLicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFJlZHVjZXJTYW5pdHkocmVkdWNlcnMpIHtcbiAgT2JqZWN0LmtleXMocmVkdWNlcnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciByZWR1Y2VyID0gcmVkdWNlcnNba2V5XTtcbiAgICB2YXIgaW5pdGlhbFN0YXRlID0gcmVkdWNlcih1bmRlZmluZWQsIHsgdHlwZTogX2NyZWF0ZVN0b3JlLkFjdGlvblR5cGVzLklOSVQgfSk7XG5cbiAgICBpZiAodHlwZW9mIGluaXRpYWxTdGF0ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUmVkdWNlciBcIicgKyBrZXkgKyAnXCIgcmV0dXJuZWQgdW5kZWZpbmVkIGR1cmluZyBpbml0aWFsaXphdGlvbi4gJyArICdJZiB0aGUgc3RhdGUgcGFzc2VkIHRvIHRoZSByZWR1Y2VyIGlzIHVuZGVmaW5lZCwgeW91IG11c3QgJyArICdleHBsaWNpdGx5IHJldHVybiB0aGUgaW5pdGlhbCBzdGF0ZS4gVGhlIGluaXRpYWwgc3RhdGUgbWF5ICcgKyAnbm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9ICdAQHJlZHV4L1BST0JFX1VOS05PV05fQUNUSU9OXycgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNykuc3BsaXQoJycpLmpvaW4oJy4nKTtcbiAgICBpZiAodHlwZW9mIHJlZHVjZXIodW5kZWZpbmVkLCB7IHR5cGU6IHR5cGUgfSkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZHVjZXIgXCInICsga2V5ICsgJ1wiIHJldHVybmVkIHVuZGVmaW5lZCB3aGVuIHByb2JlZCB3aXRoIGEgcmFuZG9tIHR5cGUuICcgKyAoJ0RvblxcJ3QgdHJ5IHRvIGhhbmRsZSAnICsgX2NyZWF0ZVN0b3JlLkFjdGlvblR5cGVzLklOSVQgKyAnIG9yIG90aGVyIGFjdGlvbnMgaW4gXCJyZWR1eC8qXCIgJykgKyAnbmFtZXNwYWNlLiBUaGV5IGFyZSBjb25zaWRlcmVkIHByaXZhdGUuIEluc3RlYWQsIHlvdSBtdXN0IHJldHVybiB0aGUgJyArICdjdXJyZW50IHN0YXRlIGZvciBhbnkgdW5rbm93biBhY3Rpb25zLCB1bmxlc3MgaXQgaXMgdW5kZWZpbmVkLCAnICsgJ2luIHdoaWNoIGNhc2UgeW91IG11c3QgcmV0dXJuIHRoZSBpbml0aWFsIHN0YXRlLCByZWdhcmRsZXNzIG9mIHRoZSAnICsgJ2FjdGlvbiB0eXBlLiBUaGUgaW5pdGlhbCBzdGF0ZSBtYXkgbm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIFR1cm5zIGFuIG9iamVjdCB3aG9zZSB2YWx1ZXMgYXJlIGRpZmZlcmVudCByZWR1Y2VyIGZ1bmN0aW9ucywgaW50byBhIHNpbmdsZVxuICogcmVkdWNlciBmdW5jdGlvbi4gSXQgd2lsbCBjYWxsIGV2ZXJ5IGNoaWxkIHJlZHVjZXIsIGFuZCBnYXRoZXIgdGhlaXIgcmVzdWx0c1xuICogaW50byBhIHNpbmdsZSBzdGF0ZSBvYmplY3QsIHdob3NlIGtleXMgY29ycmVzcG9uZCB0byB0aGUga2V5cyBvZiB0aGUgcGFzc2VkXG4gKiByZWR1Y2VyIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcmVkdWNlcnMgQW4gb2JqZWN0IHdob3NlIHZhbHVlcyBjb3JyZXNwb25kIHRvIGRpZmZlcmVudFxuICogcmVkdWNlciBmdW5jdGlvbnMgdGhhdCBuZWVkIHRvIGJlIGNvbWJpbmVkIGludG8gb25lLiBPbmUgaGFuZHkgd2F5IHRvIG9idGFpblxuICogaXQgaXMgdG8gdXNlIEVTNiBgaW1wb3J0ICogYXMgcmVkdWNlcnNgIHN5bnRheC4gVGhlIHJlZHVjZXJzIG1heSBuZXZlciByZXR1cm5cbiAqIHVuZGVmaW5lZCBmb3IgYW55IGFjdGlvbi4gSW5zdGVhZCwgdGhleSBzaG91bGQgcmV0dXJuIHRoZWlyIGluaXRpYWwgc3RhdGVcbiAqIGlmIHRoZSBzdGF0ZSBwYXNzZWQgdG8gdGhlbSB3YXMgdW5kZWZpbmVkLCBhbmQgdGhlIGN1cnJlbnQgc3RhdGUgZm9yIGFueVxuICogdW5yZWNvZ25pemVkIGFjdGlvbi5cbiAqXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IEEgcmVkdWNlciBmdW5jdGlvbiB0aGF0IGludm9rZXMgZXZlcnkgcmVkdWNlciBpbnNpZGUgdGhlXG4gKiBwYXNzZWQgb2JqZWN0LCBhbmQgYnVpbGRzIGEgc3RhdGUgb2JqZWN0IHdpdGggdGhlIHNhbWUgc2hhcGUuXG4gKi9cbmZ1bmN0aW9uIGNvbWJpbmVSZWR1Y2VycyhyZWR1Y2Vycykge1xuICB2YXIgcmVkdWNlcktleXMgPSBPYmplY3Qua2V5cyhyZWR1Y2Vycyk7XG4gIHZhciBmaW5hbFJlZHVjZXJzID0ge307XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVkdWNlcktleXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIga2V5ID0gcmVkdWNlcktleXNbaV07XG5cbiAgICBpZiAoXCJkZXZlbG9wbWVudFwiICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVkdWNlcnNba2V5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgKDAsIF93YXJuaW5nMlsnZGVmYXVsdCddKSgnTm8gcmVkdWNlciBwcm92aWRlZCBmb3Iga2V5IFwiJyArIGtleSArICdcIicpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0eXBlb2YgcmVkdWNlcnNba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZmluYWxSZWR1Y2Vyc1trZXldID0gcmVkdWNlcnNba2V5XTtcbiAgICB9XG4gIH1cbiAgdmFyIGZpbmFsUmVkdWNlcktleXMgPSBPYmplY3Qua2V5cyhmaW5hbFJlZHVjZXJzKTtcblxuICBpZiAoXCJkZXZlbG9wbWVudFwiICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICB2YXIgdW5leHBlY3RlZEtleUNhY2hlID0ge307XG4gIH1cblxuICB2YXIgc2FuaXR5RXJyb3I7XG4gIHRyeSB7XG4gICAgYXNzZXJ0UmVkdWNlclNhbml0eShmaW5hbFJlZHVjZXJzKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHNhbml0eUVycm9yID0gZTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiBjb21iaW5hdGlvbigpIHtcbiAgICB2YXIgc3RhdGUgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgYWN0aW9uID0gYXJndW1lbnRzWzFdO1xuXG4gICAgaWYgKHNhbml0eUVycm9yKSB7XG4gICAgICB0aHJvdyBzYW5pdHlFcnJvcjtcbiAgICB9XG5cbiAgICBpZiAoXCJkZXZlbG9wbWVudFwiICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHZhciB3YXJuaW5nTWVzc2FnZSA9IGdldFVuZXhwZWN0ZWRTdGF0ZVNoYXBlV2FybmluZ01lc3NhZ2Uoc3RhdGUsIGZpbmFsUmVkdWNlcnMsIGFjdGlvbiwgdW5leHBlY3RlZEtleUNhY2hlKTtcbiAgICAgIGlmICh3YXJuaW5nTWVzc2FnZSkge1xuICAgICAgICAoMCwgX3dhcm5pbmcyWydkZWZhdWx0J10pKHdhcm5pbmdNZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaGFzQ2hhbmdlZCA9IGZhbHNlO1xuICAgIHZhciBuZXh0U3RhdGUgPSB7fTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpbmFsUmVkdWNlcktleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBmaW5hbFJlZHVjZXJLZXlzW2ldO1xuICAgICAgdmFyIHJlZHVjZXIgPSBmaW5hbFJlZHVjZXJzW2tleV07XG4gICAgICB2YXIgcHJldmlvdXNTdGF0ZUZvcktleSA9IHN0YXRlW2tleV07XG4gICAgICB2YXIgbmV4dFN0YXRlRm9yS2V5ID0gcmVkdWNlcihwcmV2aW91c1N0YXRlRm9yS2V5LCBhY3Rpb24pO1xuICAgICAgaWYgKHR5cGVvZiBuZXh0U3RhdGVGb3JLZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBnZXRVbmRlZmluZWRTdGF0ZUVycm9yTWVzc2FnZShrZXksIGFjdGlvbik7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgbmV4dFN0YXRlW2tleV0gPSBuZXh0U3RhdGVGb3JLZXk7XG4gICAgICBoYXNDaGFuZ2VkID0gaGFzQ2hhbmdlZCB8fCBuZXh0U3RhdGVGb3JLZXkgIT09IHByZXZpb3VzU3RhdGVGb3JLZXk7XG4gICAgfVxuICAgIHJldHVybiBoYXNDaGFuZ2VkID8gbmV4dFN0YXRlIDogc3RhdGU7XG4gIH07XG59XG59LHtcIi4vY3JlYXRlU3RvcmVcIjo2LFwiLi91dGlscy93YXJuaW5nXCI6OCxcImxvZGFzaC9pc1BsYWluT2JqZWN0XCI6MTJ9XSw1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcblwidXNlIHN0cmljdFwiO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBjb21wb3NlO1xuLyoqXG4gKiBDb21wb3NlcyBzaW5nbGUtYXJndW1lbnQgZnVuY3Rpb25zIGZyb20gcmlnaHQgdG8gbGVmdC4gVGhlIHJpZ2h0bW9zdFxuICogZnVuY3Rpb24gY2FuIHRha2UgbXVsdGlwbGUgYXJndW1lbnRzIGFzIGl0IHByb3ZpZGVzIHRoZSBzaWduYXR1cmUgZm9yXG4gKiB0aGUgcmVzdWx0aW5nIGNvbXBvc2l0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0gey4uLkZ1bmN0aW9ufSBmdW5jcyBUaGUgZnVuY3Rpb25zIHRvIGNvbXBvc2UuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IEEgZnVuY3Rpb24gb2J0YWluZWQgYnkgY29tcG9zaW5nIHRoZSBhcmd1bWVudCBmdW5jdGlvbnNcbiAqIGZyb20gcmlnaHQgdG8gbGVmdC4gRm9yIGV4YW1wbGUsIGNvbXBvc2UoZiwgZywgaCkgaXMgaWRlbnRpY2FsIHRvIGRvaW5nXG4gKiAoLi4uYXJncykgPT4gZihnKGgoLi4uYXJncykpKS5cbiAqL1xuXG5mdW5jdGlvbiBjb21wb3NlKCkge1xuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgZnVuY3MgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICBmdW5jc1tfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgfVxuXG4gIGlmIChmdW5jcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGFyZykge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9O1xuICB9XG5cbiAgaWYgKGZ1bmNzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBmdW5jc1swXTtcbiAgfVxuXG4gIHZhciBsYXN0ID0gZnVuY3NbZnVuY3MubGVuZ3RoIC0gMV07XG4gIHZhciByZXN0ID0gZnVuY3Muc2xpY2UoMCwgLTEpO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiByZXN0LnJlZHVjZVJpZ2h0KGZ1bmN0aW9uIChjb21wb3NlZCwgZikge1xuICAgICAgcmV0dXJuIGYoY29tcG9zZWQpO1xuICAgIH0sIGxhc3QuYXBwbHkodW5kZWZpbmVkLCBhcmd1bWVudHMpKTtcbiAgfTtcbn1cbn0se31dLDY6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5BY3Rpb25UeXBlcyA9IHVuZGVmaW5lZDtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IGNyZWF0ZVN0b3JlO1xuXG52YXIgX2lzUGxhaW5PYmplY3QgPSBfZGVyZXFfKCdsb2Rhc2gvaXNQbGFpbk9iamVjdCcpO1xuXG52YXIgX2lzUGxhaW5PYmplY3QyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNQbGFpbk9iamVjdCk7XG5cbnZhciBfc3ltYm9sT2JzZXJ2YWJsZSA9IF9kZXJlcV8oJ3N5bWJvbC1vYnNlcnZhYmxlJyk7XG5cbnZhciBfc3ltYm9sT2JzZXJ2YWJsZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zeW1ib2xPYnNlcnZhYmxlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG4vKipcbiAqIFRoZXNlIGFyZSBwcml2YXRlIGFjdGlvbiB0eXBlcyByZXNlcnZlZCBieSBSZWR1eC5cbiAqIEZvciBhbnkgdW5rbm93biBhY3Rpb25zLCB5b3UgbXVzdCByZXR1cm4gdGhlIGN1cnJlbnQgc3RhdGUuXG4gKiBJZiB0aGUgY3VycmVudCBzdGF0ZSBpcyB1bmRlZmluZWQsIHlvdSBtdXN0IHJldHVybiB0aGUgaW5pdGlhbCBzdGF0ZS5cbiAqIERvIG5vdCByZWZlcmVuY2UgdGhlc2UgYWN0aW9uIHR5cGVzIGRpcmVjdGx5IGluIHlvdXIgY29kZS5cbiAqL1xudmFyIEFjdGlvblR5cGVzID0gZXhwb3J0cy5BY3Rpb25UeXBlcyA9IHtcbiAgSU5JVDogJ0BAcmVkdXgvSU5JVCdcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIFJlZHV4IHN0b3JlIHRoYXQgaG9sZHMgdGhlIHN0YXRlIHRyZWUuXG4gKiBUaGUgb25seSB3YXkgdG8gY2hhbmdlIHRoZSBkYXRhIGluIHRoZSBzdG9yZSBpcyB0byBjYWxsIGBkaXNwYXRjaCgpYCBvbiBpdC5cbiAqXG4gKiBUaGVyZSBzaG91bGQgb25seSBiZSBhIHNpbmdsZSBzdG9yZSBpbiB5b3VyIGFwcC4gVG8gc3BlY2lmeSBob3cgZGlmZmVyZW50XG4gKiBwYXJ0cyBvZiB0aGUgc3RhdGUgdHJlZSByZXNwb25kIHRvIGFjdGlvbnMsIHlvdSBtYXkgY29tYmluZSBzZXZlcmFsIHJlZHVjZXJzXG4gKiBpbnRvIGEgc2luZ2xlIHJlZHVjZXIgZnVuY3Rpb24gYnkgdXNpbmcgYGNvbWJpbmVSZWR1Y2Vyc2AuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVkdWNlciBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbmV4dCBzdGF0ZSB0cmVlLCBnaXZlblxuICogdGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBhbmQgdGhlIGFjdGlvbiB0byBoYW5kbGUuXG4gKlxuICogQHBhcmFtIHthbnl9IFtwcmVsb2FkZWRTdGF0ZV0gVGhlIGluaXRpYWwgc3RhdGUuIFlvdSBtYXkgb3B0aW9uYWxseSBzcGVjaWZ5IGl0XG4gKiB0byBoeWRyYXRlIHRoZSBzdGF0ZSBmcm9tIHRoZSBzZXJ2ZXIgaW4gdW5pdmVyc2FsIGFwcHMsIG9yIHRvIHJlc3RvcmUgYVxuICogcHJldmlvdXNseSBzZXJpYWxpemVkIHVzZXIgc2Vzc2lvbi5cbiAqIElmIHlvdSB1c2UgYGNvbWJpbmVSZWR1Y2Vyc2AgdG8gcHJvZHVjZSB0aGUgcm9vdCByZWR1Y2VyIGZ1bmN0aW9uLCB0aGlzIG11c3QgYmVcbiAqIGFuIG9iamVjdCB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGBjb21iaW5lUmVkdWNlcnNgIGtleXMuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZW5oYW5jZXIgVGhlIHN0b3JlIGVuaGFuY2VyLiBZb3UgbWF5IG9wdGlvbmFsbHkgc3BlY2lmeSBpdFxuICogdG8gZW5oYW5jZSB0aGUgc3RvcmUgd2l0aCB0aGlyZC1wYXJ0eSBjYXBhYmlsaXRpZXMgc3VjaCBhcyBtaWRkbGV3YXJlLFxuICogdGltZSB0cmF2ZWwsIHBlcnNpc3RlbmNlLCBldGMuIFRoZSBvbmx5IHN0b3JlIGVuaGFuY2VyIHRoYXQgc2hpcHMgd2l0aCBSZWR1eFxuICogaXMgYGFwcGx5TWlkZGxld2FyZSgpYC5cbiAqXG4gKiBAcmV0dXJucyB7U3RvcmV9IEEgUmVkdXggc3RvcmUgdGhhdCBsZXRzIHlvdSByZWFkIHRoZSBzdGF0ZSwgZGlzcGF0Y2ggYWN0aW9uc1xuICogYW5kIHN1YnNjcmliZSB0byBjaGFuZ2VzLlxuICovXG5mdW5jdGlvbiBjcmVhdGVTdG9yZShyZWR1Y2VyLCBwcmVsb2FkZWRTdGF0ZSwgZW5oYW5jZXIpIHtcbiAgdmFyIF9yZWYyO1xuXG4gIGlmICh0eXBlb2YgcHJlbG9hZGVkU3RhdGUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGVuaGFuY2VyID09PSAndW5kZWZpbmVkJykge1xuICAgIGVuaGFuY2VyID0gcHJlbG9hZGVkU3RhdGU7XG4gICAgcHJlbG9hZGVkU3RhdGUgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIGVuaGFuY2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgZW5oYW5jZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdGhlIGVuaGFuY2VyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVuaGFuY2VyKGNyZWF0ZVN0b3JlKShyZWR1Y2VyLCBwcmVsb2FkZWRTdGF0ZSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHJlZHVjZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSByZWR1Y2VyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gIH1cblxuICB2YXIgY3VycmVudFJlZHVjZXIgPSByZWR1Y2VyO1xuICB2YXIgY3VycmVudFN0YXRlID0gcHJlbG9hZGVkU3RhdGU7XG4gIHZhciBjdXJyZW50TGlzdGVuZXJzID0gW107XG4gIHZhciBuZXh0TGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycztcbiAgdmFyIGlzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBlbnN1cmVDYW5NdXRhdGVOZXh0TGlzdGVuZXJzKCkge1xuICAgIGlmIChuZXh0TGlzdGVuZXJzID09PSBjdXJyZW50TGlzdGVuZXJzKSB7XG4gICAgICBuZXh0TGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycy5zbGljZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkcyB0aGUgc3RhdGUgdHJlZSBtYW5hZ2VkIGJ5IHRoZSBzdG9yZS5cbiAgICpcbiAgICogQHJldHVybnMge2FueX0gVGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBvZiB5b3VyIGFwcGxpY2F0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0U3RhdGUoKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRTdGF0ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgY2hhbmdlIGxpc3RlbmVyLiBJdCB3aWxsIGJlIGNhbGxlZCBhbnkgdGltZSBhbiBhY3Rpb24gaXMgZGlzcGF0Y2hlZCxcbiAgICogYW5kIHNvbWUgcGFydCBvZiB0aGUgc3RhdGUgdHJlZSBtYXkgcG90ZW50aWFsbHkgaGF2ZSBjaGFuZ2VkLiBZb3UgbWF5IHRoZW5cbiAgICogY2FsbCBgZ2V0U3RhdGUoKWAgdG8gcmVhZCB0aGUgY3VycmVudCBzdGF0ZSB0cmVlIGluc2lkZSB0aGUgY2FsbGJhY2suXG4gICAqXG4gICAqIFlvdSBtYXkgY2FsbCBgZGlzcGF0Y2goKWAgZnJvbSBhIGNoYW5nZSBsaXN0ZW5lciwgd2l0aCB0aGUgZm9sbG93aW5nXG4gICAqIGNhdmVhdHM6XG4gICAqXG4gICAqIDEuIFRoZSBzdWJzY3JpcHRpb25zIGFyZSBzbmFwc2hvdHRlZCBqdXN0IGJlZm9yZSBldmVyeSBgZGlzcGF0Y2goKWAgY2FsbC5cbiAgICogSWYgeW91IHN1YnNjcmliZSBvciB1bnN1YnNjcmliZSB3aGlsZSB0aGUgbGlzdGVuZXJzIGFyZSBiZWluZyBpbnZva2VkLCB0aGlzXG4gICAqIHdpbGwgbm90IGhhdmUgYW55IGVmZmVjdCBvbiB0aGUgYGRpc3BhdGNoKClgIHRoYXQgaXMgY3VycmVudGx5IGluIHByb2dyZXNzLlxuICAgKiBIb3dldmVyLCB0aGUgbmV4dCBgZGlzcGF0Y2goKWAgY2FsbCwgd2hldGhlciBuZXN0ZWQgb3Igbm90LCB3aWxsIHVzZSBhIG1vcmVcbiAgICogcmVjZW50IHNuYXBzaG90IG9mIHRoZSBzdWJzY3JpcHRpb24gbGlzdC5cbiAgICpcbiAgICogMi4gVGhlIGxpc3RlbmVyIHNob3VsZCBub3QgZXhwZWN0IHRvIHNlZSBhbGwgc3RhdGUgY2hhbmdlcywgYXMgdGhlIHN0YXRlXG4gICAqIG1pZ2h0IGhhdmUgYmVlbiB1cGRhdGVkIG11bHRpcGxlIHRpbWVzIGR1cmluZyBhIG5lc3RlZCBgZGlzcGF0Y2goKWAgYmVmb3JlXG4gICAqIHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQuIEl0IGlzLCBob3dldmVyLCBndWFyYW50ZWVkIHRoYXQgYWxsIHN1YnNjcmliZXJzXG4gICAqIHJlZ2lzdGVyZWQgYmVmb3JlIHRoZSBgZGlzcGF0Y2goKWAgc3RhcnRlZCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZSBsYXRlc3RcbiAgICogc3RhdGUgYnkgdGhlIHRpbWUgaXQgZXhpdHMuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCBvbiBldmVyeSBkaXNwYXRjaC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGlzIGNoYW5nZSBsaXN0ZW5lci5cbiAgICovXG4gIGZ1bmN0aW9uIHN1YnNjcmliZShsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG5cbiAgICB2YXIgaXNTdWJzY3JpYmVkID0gdHJ1ZTtcblxuICAgIGVuc3VyZUNhbk11dGF0ZU5leHRMaXN0ZW5lcnMoKTtcbiAgICBuZXh0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHVuc3Vic2NyaWJlKCkge1xuICAgICAgaWYgKCFpc1N1YnNjcmliZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpc1N1YnNjcmliZWQgPSBmYWxzZTtcblxuICAgICAgZW5zdXJlQ2FuTXV0YXRlTmV4dExpc3RlbmVycygpO1xuICAgICAgdmFyIGluZGV4ID0gbmV4dExpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIG5leHRMaXN0ZW5lcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoZXMgYW4gYWN0aW9uLiBJdCBpcyB0aGUgb25seSB3YXkgdG8gdHJpZ2dlciBhIHN0YXRlIGNoYW5nZS5cbiAgICpcbiAgICogVGhlIGByZWR1Y2VyYCBmdW5jdGlvbiwgdXNlZCB0byBjcmVhdGUgdGhlIHN0b3JlLCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZVxuICAgKiBjdXJyZW50IHN0YXRlIHRyZWUgYW5kIHRoZSBnaXZlbiBgYWN0aW9uYC4gSXRzIHJldHVybiB2YWx1ZSB3aWxsXG4gICAqIGJlIGNvbnNpZGVyZWQgdGhlICoqbmV4dCoqIHN0YXRlIG9mIHRoZSB0cmVlLCBhbmQgdGhlIGNoYW5nZSBsaXN0ZW5lcnNcbiAgICogd2lsbCBiZSBub3RpZmllZC5cbiAgICpcbiAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb25seSBzdXBwb3J0cyBwbGFpbiBvYmplY3QgYWN0aW9ucy4gSWYgeW91IHdhbnQgdG9cbiAgICogZGlzcGF0Y2ggYSBQcm9taXNlLCBhbiBPYnNlcnZhYmxlLCBhIHRodW5rLCBvciBzb21ldGhpbmcgZWxzZSwgeW91IG5lZWQgdG9cbiAgICogd3JhcCB5b3VyIHN0b3JlIGNyZWF0aW5nIGZ1bmN0aW9uIGludG8gdGhlIGNvcnJlc3BvbmRpbmcgbWlkZGxld2FyZS4gRm9yXG4gICAqIGV4YW1wbGUsIHNlZSB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgdGhlIGByZWR1eC10aHVua2AgcGFja2FnZS4gRXZlbiB0aGVcbiAgICogbWlkZGxld2FyZSB3aWxsIGV2ZW50dWFsbHkgZGlzcGF0Y2ggcGxhaW4gb2JqZWN0IGFjdGlvbnMgdXNpbmcgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhY3Rpb24gQSBwbGFpbiBvYmplY3QgcmVwcmVzZW50aW5nIOKAnHdoYXQgY2hhbmdlZOKAnS4gSXQgaXNcbiAgICogYSBnb29kIGlkZWEgdG8ga2VlcCBhY3Rpb25zIHNlcmlhbGl6YWJsZSBzbyB5b3UgY2FuIHJlY29yZCBhbmQgcmVwbGF5IHVzZXJcbiAgICogc2Vzc2lvbnMsIG9yIHVzZSB0aGUgdGltZSB0cmF2ZWxsaW5nIGByZWR1eC1kZXZ0b29sc2AuIEFuIGFjdGlvbiBtdXN0IGhhdmVcbiAgICogYSBgdHlwZWAgcHJvcGVydHkgd2hpY2ggbWF5IG5vdCBiZSBgdW5kZWZpbmVkYC4gSXQgaXMgYSBnb29kIGlkZWEgdG8gdXNlXG4gICAqIHN0cmluZyBjb25zdGFudHMgZm9yIGFjdGlvbiB0eXBlcy5cbiAgICpcbiAgICogQHJldHVybnMge09iamVjdH0gRm9yIGNvbnZlbmllbmNlLCB0aGUgc2FtZSBhY3Rpb24gb2JqZWN0IHlvdSBkaXNwYXRjaGVkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQsIGlmIHlvdSB1c2UgYSBjdXN0b20gbWlkZGxld2FyZSwgaXQgbWF5IHdyYXAgYGRpc3BhdGNoKClgIHRvXG4gICAqIHJldHVybiBzb21ldGhpbmcgZWxzZSAoZm9yIGV4YW1wbGUsIGEgUHJvbWlzZSB5b3UgY2FuIGF3YWl0KS5cbiAgICovXG4gIGZ1bmN0aW9uIGRpc3BhdGNoKGFjdGlvbikge1xuICAgIGlmICghKDAsIF9pc1BsYWluT2JqZWN0MlsnZGVmYXVsdCddKShhY3Rpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FjdGlvbnMgbXVzdCBiZSBwbGFpbiBvYmplY3RzLiAnICsgJ1VzZSBjdXN0b20gbWlkZGxld2FyZSBmb3IgYXN5bmMgYWN0aW9ucy4nKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFjdGlvbi50eXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb25zIG1heSBub3QgaGF2ZSBhbiB1bmRlZmluZWQgXCJ0eXBlXCIgcHJvcGVydHkuICcgKyAnSGF2ZSB5b3UgbWlzc3BlbGxlZCBhIGNvbnN0YW50PycpO1xuICAgIH1cblxuICAgIGlmIChpc0Rpc3BhdGNoaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZHVjZXJzIG1heSBub3QgZGlzcGF0Y2ggYWN0aW9ucy4nKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgaXNEaXNwYXRjaGluZyA9IHRydWU7XG4gICAgICBjdXJyZW50U3RhdGUgPSBjdXJyZW50UmVkdWNlcihjdXJyZW50U3RhdGUsIGFjdGlvbik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGlzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycyA9IG5leHRMaXN0ZW5lcnM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxpc3RlbmVyc1tpXSgpO1xuICAgIH1cblxuICAgIHJldHVybiBhY3Rpb247XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgdGhlIHJlZHVjZXIgY3VycmVudGx5IHVzZWQgYnkgdGhlIHN0b3JlIHRvIGNhbGN1bGF0ZSB0aGUgc3RhdGUuXG4gICAqXG4gICAqIFlvdSBtaWdodCBuZWVkIHRoaXMgaWYgeW91ciBhcHAgaW1wbGVtZW50cyBjb2RlIHNwbGl0dGluZyBhbmQgeW91IHdhbnQgdG9cbiAgICogbG9hZCBzb21lIG9mIHRoZSByZWR1Y2VycyBkeW5hbWljYWxseS4gWW91IG1pZ2h0IGFsc28gbmVlZCB0aGlzIGlmIHlvdVxuICAgKiBpbXBsZW1lbnQgYSBob3QgcmVsb2FkaW5nIG1lY2hhbmlzbSBmb3IgUmVkdXguXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG5leHRSZWR1Y2VyIFRoZSByZWR1Y2VyIGZvciB0aGUgc3RvcmUgdG8gdXNlIGluc3RlYWQuXG4gICAqIEByZXR1cm5zIHt2b2lkfVxuICAgKi9cbiAgZnVuY3Rpb24gcmVwbGFjZVJlZHVjZXIobmV4dFJlZHVjZXIpIHtcbiAgICBpZiAodHlwZW9mIG5leHRSZWR1Y2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSBuZXh0UmVkdWNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIGN1cnJlbnRSZWR1Y2VyID0gbmV4dFJlZHVjZXI7XG4gICAgZGlzcGF0Y2goeyB0eXBlOiBBY3Rpb25UeXBlcy5JTklUIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVyb3BlcmFiaWxpdHkgcG9pbnQgZm9yIG9ic2VydmFibGUvcmVhY3RpdmUgbGlicmFyaWVzLlxuICAgKiBAcmV0dXJucyB7b2JzZXJ2YWJsZX0gQSBtaW5pbWFsIG9ic2VydmFibGUgb2Ygc3RhdGUgY2hhbmdlcy5cbiAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSB0aGUgb2JzZXJ2YWJsZSBwcm9wb3NhbDpcbiAgICogaHR0cHM6Ly9naXRodWIuY29tL3plbnBhcnNpbmcvZXMtb2JzZXJ2YWJsZVxuICAgKi9cbiAgZnVuY3Rpb24gb2JzZXJ2YWJsZSgpIHtcbiAgICB2YXIgX3JlZjtcblxuICAgIHZhciBvdXRlclN1YnNjcmliZSA9IHN1YnNjcmliZTtcbiAgICByZXR1cm4gX3JlZiA9IHtcbiAgICAgIC8qKlxuICAgICAgICogVGhlIG1pbmltYWwgb2JzZXJ2YWJsZSBzdWJzY3JpcHRpb24gbWV0aG9kLlxuICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9ic2VydmVyIEFueSBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBvYnNlcnZlci5cbiAgICAgICAqIFRoZSBvYnNlcnZlciBvYmplY3Qgc2hvdWxkIGhhdmUgYSBgbmV4dGAgbWV0aG9kLlxuICAgICAgICogQHJldHVybnMge3N1YnNjcmlwdGlvbn0gQW4gb2JqZWN0IHdpdGggYW4gYHVuc3Vic2NyaWJlYCBtZXRob2QgdGhhdCBjYW5cbiAgICAgICAqIGJlIHVzZWQgdG8gdW5zdWJzY3JpYmUgdGhlIG9ic2VydmFibGUgZnJvbSB0aGUgc3RvcmUsIGFuZCBwcmV2ZW50IGZ1cnRoZXJcbiAgICAgICAqIGVtaXNzaW9uIG9mIHZhbHVlcyBmcm9tIHRoZSBvYnNlcnZhYmxlLlxuICAgICAgICovXG4gICAgICBzdWJzY3JpYmU6IGZ1bmN0aW9uIHN1YnNjcmliZShvYnNlcnZlcikge1xuICAgICAgICBpZiAodHlwZW9mIG9ic2VydmVyICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIHRoZSBvYnNlcnZlciB0byBiZSBhbiBvYmplY3QuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvYnNlcnZlU3RhdGUoKSB7XG4gICAgICAgICAgaWYgKG9ic2VydmVyLm5leHQpIHtcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZVN0YXRlKCk7XG4gICAgICAgIHZhciB1bnN1YnNjcmliZSA9IG91dGVyU3Vic2NyaWJlKG9ic2VydmVTdGF0ZSk7XG4gICAgICAgIHJldHVybiB7IHVuc3Vic2NyaWJlOiB1bnN1YnNjcmliZSB9O1xuICAgICAgfVxuICAgIH0sIF9yZWZbX3N5bWJvbE9ic2VydmFibGUyWydkZWZhdWx0J11dID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwgX3JlZjtcbiAgfVxuXG4gIC8vIFdoZW4gYSBzdG9yZSBpcyBjcmVhdGVkLCBhbiBcIklOSVRcIiBhY3Rpb24gaXMgZGlzcGF0Y2hlZCBzbyB0aGF0IGV2ZXJ5XG4gIC8vIHJlZHVjZXIgcmV0dXJucyB0aGVpciBpbml0aWFsIHN0YXRlLiBUaGlzIGVmZmVjdGl2ZWx5IHBvcHVsYXRlc1xuICAvLyB0aGUgaW5pdGlhbCBzdGF0ZSB0cmVlLlxuICBkaXNwYXRjaCh7IHR5cGU6IEFjdGlvblR5cGVzLklOSVQgfSk7XG5cbiAgcmV0dXJuIF9yZWYyID0ge1xuICAgIGRpc3BhdGNoOiBkaXNwYXRjaCxcbiAgICBzdWJzY3JpYmU6IHN1YnNjcmliZSxcbiAgICBnZXRTdGF0ZTogZ2V0U3RhdGUsXG4gICAgcmVwbGFjZVJlZHVjZXI6IHJlcGxhY2VSZWR1Y2VyXG4gIH0sIF9yZWYyW19zeW1ib2xPYnNlcnZhYmxlMlsnZGVmYXVsdCddXSA9IG9ic2VydmFibGUsIF9yZWYyO1xufVxufSx7XCJsb2Rhc2gvaXNQbGFpbk9iamVjdFwiOjEyLFwic3ltYm9sLW9ic2VydmFibGVcIjoxM31dLDc6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5jb21wb3NlID0gZXhwb3J0cy5hcHBseU1pZGRsZXdhcmUgPSBleHBvcnRzLmJpbmRBY3Rpb25DcmVhdG9ycyA9IGV4cG9ydHMuY29tYmluZVJlZHVjZXJzID0gZXhwb3J0cy5jcmVhdGVTdG9yZSA9IHVuZGVmaW5lZDtcblxudmFyIF9jcmVhdGVTdG9yZSA9IF9kZXJlcV8oJy4vY3JlYXRlU3RvcmUnKTtcblxudmFyIF9jcmVhdGVTdG9yZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVTdG9yZSk7XG5cbnZhciBfY29tYmluZVJlZHVjZXJzID0gX2RlcmVxXygnLi9jb21iaW5lUmVkdWNlcnMnKTtcblxudmFyIF9jb21iaW5lUmVkdWNlcnMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29tYmluZVJlZHVjZXJzKTtcblxudmFyIF9iaW5kQWN0aW9uQ3JlYXRvcnMgPSBfZGVyZXFfKCcuL2JpbmRBY3Rpb25DcmVhdG9ycycpO1xuXG52YXIgX2JpbmRBY3Rpb25DcmVhdG9yczIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9iaW5kQWN0aW9uQ3JlYXRvcnMpO1xuXG52YXIgX2FwcGx5TWlkZGxld2FyZSA9IF9kZXJlcV8oJy4vYXBwbHlNaWRkbGV3YXJlJyk7XG5cbnZhciBfYXBwbHlNaWRkbGV3YXJlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2FwcGx5TWlkZGxld2FyZSk7XG5cbnZhciBfY29tcG9zZSA9IF9kZXJlcV8oJy4vY29tcG9zZScpO1xuXG52YXIgX2NvbXBvc2UyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29tcG9zZSk7XG5cbnZhciBfd2FybmluZyA9IF9kZXJlcV8oJy4vdXRpbHMvd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuLypcbiogVGhpcyBpcyBhIGR1bW15IGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHRoZSBmdW5jdGlvbiBuYW1lIGhhcyBiZWVuIGFsdGVyZWQgYnkgbWluaWZpY2F0aW9uLlxuKiBJZiB0aGUgZnVuY3Rpb24gaGFzIGJlZW4gbWluaWZpZWQgYW5kIE5PREVfRU5WICE9PSAncHJvZHVjdGlvbicsIHdhcm4gdGhlIHVzZXIuXG4qL1xuZnVuY3Rpb24gaXNDcnVzaGVkKCkge31cblxuaWYgKFwiZGV2ZWxvcG1lbnRcIiAhPT0gJ3Byb2R1Y3Rpb24nICYmIHR5cGVvZiBpc0NydXNoZWQubmFtZSA9PT0gJ3N0cmluZycgJiYgaXNDcnVzaGVkLm5hbWUgIT09ICdpc0NydXNoZWQnKSB7XG4gICgwLCBfd2FybmluZzJbJ2RlZmF1bHQnXSkoJ1lvdSBhcmUgY3VycmVudGx5IHVzaW5nIG1pbmlmaWVkIGNvZGUgb3V0c2lkZSBvZiBOT0RFX0VOViA9PT0gXFwncHJvZHVjdGlvblxcJy4gJyArICdUaGlzIG1lYW5zIHRoYXQgeW91IGFyZSBydW5uaW5nIGEgc2xvd2VyIGRldmVsb3BtZW50IGJ1aWxkIG9mIFJlZHV4LiAnICsgJ1lvdSBjYW4gdXNlIGxvb3NlLWVudmlmeSAoaHR0cHM6Ly9naXRodWIuY29tL3plcnRvc2gvbG9vc2UtZW52aWZ5KSBmb3IgYnJvd3NlcmlmeSAnICsgJ29yIERlZmluZVBsdWdpbiBmb3Igd2VicGFjayAoaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMDAzMDAzMSkgJyArICd0byBlbnN1cmUgeW91IGhhdmUgdGhlIGNvcnJlY3QgY29kZSBmb3IgeW91ciBwcm9kdWN0aW9uIGJ1aWxkLicpO1xufVxuXG5leHBvcnRzLmNyZWF0ZVN0b3JlID0gX2NyZWF0ZVN0b3JlMlsnZGVmYXVsdCddO1xuZXhwb3J0cy5jb21iaW5lUmVkdWNlcnMgPSBfY29tYmluZVJlZHVjZXJzMlsnZGVmYXVsdCddO1xuZXhwb3J0cy5iaW5kQWN0aW9uQ3JlYXRvcnMgPSBfYmluZEFjdGlvbkNyZWF0b3JzMlsnZGVmYXVsdCddO1xuZXhwb3J0cy5hcHBseU1pZGRsZXdhcmUgPSBfYXBwbHlNaWRkbGV3YXJlMlsnZGVmYXVsdCddO1xuZXhwb3J0cy5jb21wb3NlID0gX2NvbXBvc2UyWydkZWZhdWx0J107XG59LHtcIi4vYXBwbHlNaWRkbGV3YXJlXCI6MixcIi4vYmluZEFjdGlvbkNyZWF0b3JzXCI6MyxcIi4vY29tYmluZVJlZHVjZXJzXCI6NCxcIi4vY29tcG9zZVwiOjUsXCIuL2NyZWF0ZVN0b3JlXCI6NixcIi4vdXRpbHMvd2FybmluZ1wiOjh9XSw4OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHdhcm5pbmc7XG4vKipcbiAqIFByaW50cyBhIHdhcm5pbmcgaW4gdGhlIGNvbnNvbGUgaWYgaXQgZXhpc3RzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIFRoZSB3YXJuaW5nIG1lc3NhZ2UuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gd2FybmluZyhtZXNzYWdlKSB7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gIH1cbiAgLyogZXNsaW50LWVuYWJsZSBuby1jb25zb2xlICovXG4gIHRyeSB7XG4gICAgLy8gVGhpcyBlcnJvciB3YXMgdGhyb3duIGFzIGEgY29udmVuaWVuY2Ugc28gdGhhdCBpZiB5b3UgZW5hYmxlXG4gICAgLy8gXCJicmVhayBvbiBhbGwgZXhjZXB0aW9uc1wiIGluIHlvdXIgY29uc29sZSxcbiAgICAvLyBpdCB3b3VsZCBwYXVzZSB0aGUgZXhlY3V0aW9uIGF0IHRoaXMgbGluZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tZW1wdHkgKi9cbiAgfSBjYXRjaCAoZSkge31cbiAgLyogZXNsaW50LWVuYWJsZSBuby1lbXB0eSAqL1xufVxufSx7fV0sOTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG52YXIgb3ZlckFyZyA9IF9kZXJlcV8oJy4vX292ZXJBcmcnKTtcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgZ2V0UHJvdG90eXBlID0gb3ZlckFyZyhPYmplY3QuZ2V0UHJvdG90eXBlT2YsIE9iamVjdCk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0UHJvdG90eXBlO1xuXG59LHtcIi4vX292ZXJBcmdcIjoxMH1dLDEwOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbi8qKlxuICogQ3JlYXRlcyBhIHVuYXJ5IGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCBpdHMgYXJndW1lbnQgdHJhbnNmb3JtZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB0cmFuc2Zvcm0gVGhlIGFyZ3VtZW50IHRyYW5zZm9ybS5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBvdmVyQXJnKGZ1bmMsIHRyYW5zZm9ybSkge1xuICByZXR1cm4gZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGZ1bmModHJhbnNmb3JtKGFyZykpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG92ZXJBcmc7XG5cbn0se31dLDExOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzT2JqZWN0TGlrZTtcblxufSx7fV0sMTI6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xudmFyIGdldFByb3RvdHlwZSA9IF9kZXJlcV8oJy4vX2dldFByb3RvdHlwZScpLFxuICAgIGlzT2JqZWN0TGlrZSA9IF9kZXJlcV8oJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RUYWcgPSAnW29iamVjdCBPYmplY3RdJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmdW5jVG9TdHJpbmcgPSBmdW5jUHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGluZmVyIHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci4gKi9cbnZhciBvYmplY3RDdG9yU3RyaW5nID0gZnVuY1RvU3RyaW5nLmNhbGwoT2JqZWN0KTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlXG4gKiBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNy4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIHRoYXQgaXMsIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZVxuICogYE9iamVjdGAgY29uc3RydWN0b3Igb3Igb25lIHdpdGggYSBgW1tQcm90b3R5cGVdXWAgb2YgYG51bGxgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMC44LjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqIH1cbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QobmV3IEZvbyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QoeyAneCc6IDAsICd5JzogMCB9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QoT2JqZWN0LmNyZWF0ZShudWxsKSk7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgaWYgKCFpc09iamVjdExpa2UodmFsdWUpIHx8IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpICE9IG9iamVjdFRhZykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgcHJvdG8gPSBnZXRQcm90b3R5cGUodmFsdWUpO1xuICBpZiAocHJvdG8gPT09IG51bGwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2YXIgQ3RvciA9IGhhc093blByb3BlcnR5LmNhbGwocHJvdG8sICdjb25zdHJ1Y3RvcicpICYmIHByb3RvLmNvbnN0cnVjdG9yO1xuICByZXR1cm4gKHR5cGVvZiBDdG9yID09ICdmdW5jdGlvbicgJiZcbiAgICBDdG9yIGluc3RhbmNlb2YgQ3RvciAmJiBmdW5jVG9TdHJpbmcuY2FsbChDdG9yKSA9PSBvYmplY3RDdG9yU3RyaW5nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuXG59LHtcIi4vX2dldFByb3RvdHlwZVwiOjksXCIuL2lzT2JqZWN0TGlrZVwiOjExfV0sMTM6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xubW9kdWxlLmV4cG9ydHMgPSBfZGVyZXFfKCcuL2xpYi9pbmRleCcpO1xuXG59LHtcIi4vbGliL2luZGV4XCI6MTR9XSwxNDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfcG9ueWZpbGwgPSBfZGVyZXFfKCcuL3BvbnlmaWxsJyk7XG5cbnZhciBfcG9ueWZpbGwyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcG9ueWZpbGwpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbnZhciByb290ID0gdW5kZWZpbmVkOyAvKiBnbG9iYWwgd2luZG93ICovXG5cbmlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHRyb290ID0gZ2xvYmFsO1xufSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuXHRyb290ID0gd2luZG93O1xufVxuXG52YXIgcmVzdWx0ID0gKDAsIF9wb255ZmlsbDJbJ2RlZmF1bHQnXSkocm9vdCk7XG5leHBvcnRzWydkZWZhdWx0J10gPSByZXN1bHQ7XG59LHtcIi4vcG9ueWZpbGxcIjoxNX1dLDE1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHN5bWJvbE9ic2VydmFibGVQb255ZmlsbDtcbmZ1bmN0aW9uIHN5bWJvbE9ic2VydmFibGVQb255ZmlsbChyb290KSB7XG5cdHZhciByZXN1bHQ7XG5cdHZhciBfU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cblx0aWYgKHR5cGVvZiBfU3ltYm9sID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0aWYgKF9TeW1ib2wub2JzZXJ2YWJsZSkge1xuXHRcdFx0cmVzdWx0ID0gX1N5bWJvbC5vYnNlcnZhYmxlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBfU3ltYm9sKCdvYnNlcnZhYmxlJyk7XG5cdFx0XHRfU3ltYm9sLm9ic2VydmFibGUgPSByZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9ICdAQG9ic2VydmFibGUnO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn07XG59LHt9XSwxNjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLnN1YnNjcmliZSA9IGV4cG9ydHMuY29uc3RhbnRzID0gZXhwb3J0cy5hY3Rpb25zID0gdW5kZWZpbmVkO1xuXG52YXIgX3N0b3JlID0gX2RlcmVxXygnLi4vc3JjL3N0b3JlJyk7XG5cbnZhciBfc3RvcmUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfc3RvcmUpO1xuXG52YXIgX3BhZ2VzID0gX2RlcmVxXygnLi9zaXRlL2NvbnN0YW50cy9wYWdlcycpO1xuXG52YXIgUEFHRVMgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfcGFnZXMpO1xuXG52YXIgX3N0YXR1c2VzID0gX2RlcmVxXygnLi90b2Rvcy9jb25zdGFudHMvc3RhdHVzZXMnKTtcblxudmFyIFRPRE9TX1NUQVRVU0VTID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX3N0YXR1c2VzKTtcblxudmFyIF91cGRhdGVTZWxlY3RlZFBhZ2UgPSBfZGVyZXFfKCcuL3NpdGUvYWN0aW9ucy91cGRhdGUtc2VsZWN0ZWQtcGFnZScpO1xuXG52YXIgX3VwZGF0ZVNlbGVjdGVkUGFnZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91cGRhdGVTZWxlY3RlZFBhZ2UpO1xuXG52YXIgX2FkZFRvZG8gPSBfZGVyZXFfKCcuL3RvZG9zL2FjdGlvbnMvYWRkLXRvZG8nKTtcblxudmFyIF9hZGRUb2RvMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2FkZFRvZG8pO1xuXG52YXIgX2xvYWRUb2RvcyA9IF9kZXJlcV8oJy4vdG9kb3MvYWN0aW9ucy9sb2FkLXRvZG9zJyk7XG5cbnZhciBfbG9hZFRvZG9zMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2xvYWRUb2Rvcyk7XG5cbnZhciBfcmVtb3ZlVG9kbyA9IF9kZXJlcV8oJy4vdG9kb3MvYWN0aW9ucy9yZW1vdmUtdG9kbycpO1xuXG52YXIgX3JlbW92ZVRvZG8yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcmVtb3ZlVG9kbyk7XG5cbnZhciBfY29tcGxldGVUb2RvID0gX2RlcmVxXygnLi90b2Rvcy9hY3Rpb25zL2NvbXBsZXRlLXRvZG8nKTtcblxudmFyIF9jb21wbGV0ZVRvZG8yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29tcGxldGVUb2RvKTtcblxudmFyIF91cGRhdGVTZWxlY3RlZFN1bW1hcnlTdGF0dXMgPSBfZGVyZXFfKCcuL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXNlbGVjdGVkLXN1bW1hcnktc3RhdHVzJyk7XG5cbnZhciBfdXBkYXRlU2VsZWN0ZWRTdW1tYXJ5U3RhdHVzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3VwZGF0ZVNlbGVjdGVkU3VtbWFyeVN0YXR1cyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKG9iaikgeyBpZiAob2JqICYmIG9iai5fX2VzTW9kdWxlKSB7IHJldHVybiBvYmo7IH0gZWxzZSB7IHZhciBuZXdPYmogPSB7fTsgaWYgKG9iaiAhPSBudWxsKSB7IGZvciAodmFyIGtleSBpbiBvYmopIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIG5ld09ialtrZXldID0gb2JqW2tleV07IH0gfSBuZXdPYmouZGVmYXVsdCA9IG9iajsgcmV0dXJuIG5ld09iajsgfSB9XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBhY3Rpb25zU2V0ID0ge1xuXHRzaXRlOiB7XG5cdFx0dXBkYXRlU2VsZWN0ZWRQYWdlOiBfdXBkYXRlU2VsZWN0ZWRQYWdlMi5kZWZhdWx0XG5cdH0sXG5cdHRvZG9zOiB7XG5cdFx0YWRkVG9kbzogX2FkZFRvZG8yLmRlZmF1bHQsXG5cdFx0bG9hZFRvZG9zOiBfbG9hZFRvZG9zMi5kZWZhdWx0LFxuXHRcdHJlbW92ZVRvZG86IF9yZW1vdmVUb2RvMi5kZWZhdWx0LFxuXHRcdGNvbXBsZXRlVG9kbzogX2NvbXBsZXRlVG9kbzIuZGVmYXVsdCxcblx0XHR1cGRhdGVTZWxlY3RlZFN1bW1hcnlTdGF0dXM6IF91cGRhdGVTZWxlY3RlZFN1bW1hcnlTdGF0dXMyLmRlZmF1bHRcblx0fVxufTtcblxudmFyIGFjdGlvbnMgPSBPYmplY3Qua2V5cyhhY3Rpb25zU2V0KS5yZWR1Y2UoZnVuY3Rpb24gKHAxLCBrZXkxKSB7XG5cdHAxW2tleTFdID0gT2JqZWN0LmtleXMoYWN0aW9uc1NldFtrZXkxXSkucmVkdWNlKGZ1bmN0aW9uIChwMiwga2V5Mikge1xuXHRcdHAyW2tleTJdID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGFjdGlvbiA9IGFjdGlvbnNTZXRba2V5MV1ba2V5Ml0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcblx0XHRcdF9zdG9yZTIuZGVmYXVsdC5kaXNwYXRjaChhY3Rpb24pO1xuXHRcdFx0cmV0dXJuIGFjdGlvbjtcblx0XHR9O1xuXHRcdHJldHVybiBwMjtcblx0fSwge30pO1xuXHRyZXR1cm4gcDE7XG59LCB7fSk7XG5cbnZhciBjb25zdGFudHMgPSB7XG5cdFBBR0VTOiBQQUdFUyxcblx0VE9ET1NfU1RBVFVTRVM6IFRPRE9TX1NUQVRVU0VTXG59O1xuXG52YXIgc3Vic2NyaWJlID0gX3N0b3JlMi5kZWZhdWx0LnN1YnNjcmliZTtcblxudmFyIGZpbmFsID0ge1xuXHRhY3Rpb25zOiBhY3Rpb25zLFxuXHRjb25zdGFudHM6IGNvbnN0YW50cyxcblx0c3Vic2NyaWJlOiBzdWJzY3JpYmVcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShmaW5hbCwgXCJzdGF0ZVwiLCB7IGdldDogX3N0b3JlMi5kZWZhdWx0LmdldFN0YXRlIH0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmaW5hbDtcbmV4cG9ydHMuYWN0aW9ucyA9IGFjdGlvbnM7XG5leHBvcnRzLmNvbnN0YW50cyA9IGNvbnN0YW50cztcbmV4cG9ydHMuc3Vic2NyaWJlID0gc3Vic2NyaWJlO1xuXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcInN0YXRlXCIsIHsgZ2V0OiBfc3RvcmUyLmRlZmF1bHQuZ2V0U3RhdGUgfSk7XG5cbn0se1wiLi4vc3JjL3N0b3JlXCI6MjAsXCIuL3NpdGUvYWN0aW9ucy91cGRhdGUtc2VsZWN0ZWQtcGFnZVwiOjE3LFwiLi9zaXRlL2NvbnN0YW50cy9wYWdlc1wiOjE4LFwiLi90b2Rvcy9hY3Rpb25zL2FkZC10b2RvXCI6MjEsXCIuL3RvZG9zL2FjdGlvbnMvY29tcGxldGUtdG9kb1wiOjIyLFwiLi90b2Rvcy9hY3Rpb25zL2xvYWQtdG9kb3NcIjoyMyxcIi4vdG9kb3MvYWN0aW9ucy9yZW1vdmUtdG9kb1wiOjI0LFwiLi90b2Rvcy9hY3Rpb25zL3VwZGF0ZS1zZWxlY3RlZC1zdW1tYXJ5LXN0YXR1c1wiOjI1LFwiLi90b2Rvcy9jb25zdGFudHMvc3RhdHVzZXNcIjoyN31dLDE3OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKG5ld1NlbGVjdGVkUGFnZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gKGRpc3BhdGNoLCBnZXRTdGF0ZSkge1xuXHRcdHZhciBfZ2V0U3RhdGUgPSBnZXRTdGF0ZSgpO1xuXG5cdFx0dmFyIHNlbGVjdGVkUGFnZSA9IF9nZXRTdGF0ZS5zZWxlY3RlZFBhZ2U7XG5cblx0XHRpZiAoc2VsZWN0ZWRQYWdlICE9PSBuZXdTZWxlY3RlZFBhZ2UpIHtcblx0XHRcdGRpc3BhdGNoKHsgdHlwZTogVVBEQVRFX1NFTEVDVEVEX1BBR0UsIHNlbGVjdGVkUGFnZTogbmV3U2VsZWN0ZWRQYWdlIH0pO1xuXHRcdH1cblx0fTtcbn07XG5cbnZhciBVUERBVEVfU0VMRUNURURfUEFHRSA9IGV4cG9ydHMuVVBEQVRFX1NFTEVDVEVEX1BBR0UgPSAnVVBEQVRFX1NFTEVDVEVEX1BBR0UnO1xuXG59LHt9XSwxODpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgSE9NRSA9IGV4cG9ydHMuSE9NRSA9ICdIT01FJztcbnZhciBBQk9VVCA9IGV4cG9ydHMuQUJPVVQgPSAnQUJPVVQnO1xuXG59LHt9XSwxOTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGVjdGVkUGFnZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAwICYmIGFyZ3VtZW50c1swXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzBdIDogX3BhZ2VzLkhPTUU7XG5cdHZhciBhY3Rpb24gPSBhcmd1bWVudHNbMV07XG5cblx0c3dpdGNoIChhY3Rpb24udHlwZSkge1xuXHRcdGNhc2UgX3VwZGF0ZVNlbGVjdGVkUGFnZS5VUERBVEVfU0VMRUNURURfUEFHRTpcblx0XHRcdHJldHVybiBhY3Rpb24uc2VsZWN0ZWRQYWdlO1xuXG5cdFx0ZGVmYXVsdDpcblx0XHRcdHJldHVybiBzZWxlY3RlZFBhZ2U7XG5cdH1cbn07XG5cbnZhciBfdXBkYXRlU2VsZWN0ZWRQYWdlID0gX2RlcmVxXygnLi4vLi4vc2l0ZS9hY3Rpb25zL3VwZGF0ZS1zZWxlY3RlZC1wYWdlJyk7XG5cbnZhciBfcGFnZXMgPSBfZGVyZXFfKCcuLi8uLi9zaXRlL2NvbnN0YW50cy9wYWdlcycpO1xuXG59LHtcIi4uLy4uL3NpdGUvYWN0aW9ucy91cGRhdGUtc2VsZWN0ZWQtcGFnZVwiOjE3LFwiLi4vLi4vc2l0ZS9jb25zdGFudHMvcGFnZXNcIjoxOH1dLDIwOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9yZWR1eCA9IF9kZXJlcV8oJ3JlZHV4Jyk7XG5cbnZhciBfcmVkdXhUaHVuayA9IF9kZXJlcV8oJ3JlZHV4LXRodW5rJyk7XG5cbnZhciBfcmVkdXhUaHVuazIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9yZWR1eFRodW5rKTtcblxudmFyIF9zZWxlY3RlZFBhZ2UgPSBfZGVyZXFfKCcuL3NpdGUvcmVkdWNlcnMvc2VsZWN0ZWQtcGFnZScpO1xuXG52YXIgX3NlbGVjdGVkUGFnZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zZWxlY3RlZFBhZ2UpO1xuXG52YXIgX3RvZG9zID0gX2RlcmVxXygnLi90b2Rvcy9yZWR1Y2Vycy90b2RvcycpO1xuXG52YXIgX3RvZG9zMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3RvZG9zKTtcblxudmFyIF9zZWxlY3RlZFN1bW1hcnlTdGF0dXMgPSBfZGVyZXFfKCcuL3RvZG9zL3JlZHVjZXJzL3NlbGVjdGVkLXN1bW1hcnktc3RhdHVzJyk7XG5cbnZhciBfc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3NlbGVjdGVkU3VtbWFyeVN0YXR1cyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciByZWR1Y2VycyA9IHtcblx0c2VsZWN0ZWRQYWdlOiBfc2VsZWN0ZWRQYWdlMi5kZWZhdWx0LFxuXHR0b2RvczogX3RvZG9zMi5kZWZhdWx0LFxuXHRzZWxlY3RlZFN1bW1hcnlTdGF0dXM6IF9zZWxlY3RlZFN1bW1hcnlTdGF0dXMyLmRlZmF1bHRcbn07XG5cbi8vIG1pZGRsZXdhcmUgdGhhdCBsb2dzIGFsbCBhY3Rpb25zIHRvIGNvbnNvbGVcblxuXG4vLyByZWR1Y2Vyc1xudmFyIGNvbnNvbGVMb2cgPSBmdW5jdGlvbiBjb25zb2xlTG9nKHN0b3JlKSB7XG5cdHJldHVybiBmdW5jdGlvbiAobmV4dCkge1xuXHRcdHJldHVybiBmdW5jdGlvbiAoYWN0aW9uKSB7XG5cdFx0XHRpZiAodHlwZW9mIGFjdGlvbiAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhhY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5leHQoYWN0aW9uKTtcblx0XHR9O1xuXHR9O1xufTtcblxuLy8gbWlkZGxld2FyZVxudmFyIG1pZGRsZVdhcmUgPSB2b2lkIDA7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuXHRtaWRkbGVXYXJlID0gKDAsIF9yZWR1eC5hcHBseU1pZGRsZXdhcmUpKGNvbnNvbGVMb2csIF9yZWR1eFRodW5rMi5kZWZhdWx0KTtcbn0gZWxzZSB7XG5cdG1pZGRsZVdhcmUgPSAoMCwgX3JlZHV4LmFwcGx5TWlkZGxld2FyZSkoX3JlZHV4VGh1bmsyLmRlZmF1bHQpO1xufVxuXG4vLyBjcmVhdGUgc3RvcmVcbmV4cG9ydHMuZGVmYXVsdCA9ICgwLCBfcmVkdXguY3JlYXRlU3RvcmUpKCgwLCBfcmVkdXguY29tYmluZVJlZHVjZXJzKShyZWR1Y2VycyksIG1pZGRsZVdhcmUpO1xuXG59LHtcIi4vc2l0ZS9yZWR1Y2Vycy9zZWxlY3RlZC1wYWdlXCI6MTksXCIuL3RvZG9zL3JlZHVjZXJzL3NlbGVjdGVkLXN1bW1hcnktc3RhdHVzXCI6MjgsXCIuL3RvZG9zL3JlZHVjZXJzL3RvZG9zXCI6MjksXCJyZWR1eFwiOjcsXCJyZWR1eC10aHVua1wiOjF9XSwyMTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uIChkZXNjcmlwdGlvbikge1xuXHRyZXR1cm4gZnVuY3Rpb24gKGRpc3BhdGNoLCBnZXRTdGF0ZSkge1xuXHRcdGlmICghZGVzY3JpcHRpb24gfHwgIWRlc2NyaXB0aW9uLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gKDAsIF9uZXdUb2RvMi5kZWZhdWx0KShkZXNjcmlwdGlvbikudGhlbihmdW5jdGlvbiAodG9kbykge1xuXHRcdFx0dmFyIGlkID0gdG9kby5pZDtcblx0XHRcdGRlbGV0ZSB0b2RvLmlkO1xuXHRcdFx0ZGlzcGF0Y2goKDAsIF91cGRhdGVUb2RvczMuZGVmYXVsdCkoX2RlZmluZVByb3BlcnR5KHt9LCBpZCwgdG9kbykpKTtcblx0XHR9KTtcblx0fTtcbn07XG5cbnZhciBfbmV3VG9kbyA9IF9kZXJlcV8oJy4uLy4uL3RvZG9zL3NlcnZpY2VzL2Zha2UtYmFja2VuZC9uZXctdG9kbycpO1xuXG52YXIgX25ld1RvZG8yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbmV3VG9kbyk7XG5cbnZhciBfdXBkYXRlVG9kb3MyID0gX2RlcmVxXygnLi4vLi4vdG9kb3MvYWN0aW9ucy91cGRhdGUtdG9kb3MnKTtcblxudmFyIF91cGRhdGVUb2RvczMgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91cGRhdGVUb2RvczIpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHZhbHVlKSB7IGlmIChrZXkgaW4gb2JqKSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgeyB2YWx1ZTogdmFsdWUsIGVudW1lcmFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgd3JpdGFibGU6IHRydWUgfSk7IH0gZWxzZSB7IG9ialtrZXldID0gdmFsdWU7IH0gcmV0dXJuIG9iajsgfVxuXG59LHtcIi4uLy4uL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXRvZG9zXCI6MjYsXCIuLi8uLi90b2Rvcy9zZXJ2aWNlcy9mYWtlLWJhY2tlbmQvbmV3LXRvZG9cIjozMn1dLDIyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKGlkLCBpc0NvbXBsZXRlKSB7XG5cdHJldHVybiBmdW5jdGlvbiAoZGlzcGF0Y2gsIGdldFN0YXRlKSB7XG5cdFx0dmFyIF9nZXRTdGF0ZSA9IGdldFN0YXRlKCk7XG5cblx0XHR2YXIgdG9kb3MgPSBfZ2V0U3RhdGUudG9kb3M7XG5cblx0XHR2YXIgdG9kbyA9IHRvZG9zW2lkXTtcblxuXHRcdGlmICghdG9kbykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRvZG8uaXNDb21wbGV0ZSA9IGlzQ29tcGxldGU7XG5cblx0XHRyZXR1cm4gKDAsIF9zYXZlVG9kbzIuZGVmYXVsdCkoaWQsIHRvZG8pLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuXHRcdFx0ZGlzcGF0Y2goKDAsIF91cGRhdGVUb2RvczMuZGVmYXVsdCkoX2RlZmluZVByb3BlcnR5KHt9LCByZXMuaWQsIHJlcy50b2RvKSkpO1xuXHRcdH0pO1xuXHR9O1xufTtcblxudmFyIF9zYXZlVG9kbyA9IF9kZXJlcV8oJy4uLy4uL3RvZG9zL3NlcnZpY2VzL2Zha2UtYmFja2VuZC9zYXZlLXRvZG8nKTtcblxudmFyIF9zYXZlVG9kbzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zYXZlVG9kbyk7XG5cbnZhciBfdXBkYXRlVG9kb3MyID0gX2RlcmVxXygnLi4vLi4vdG9kb3MvYWN0aW9ucy91cGRhdGUtdG9kb3MnKTtcblxudmFyIF91cGRhdGVUb2RvczMgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91cGRhdGVUb2RvczIpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHZhbHVlKSB7IGlmIChrZXkgaW4gb2JqKSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgeyB2YWx1ZTogdmFsdWUsIGVudW1lcmFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgd3JpdGFibGU6IHRydWUgfSk7IH0gZWxzZSB7IG9ialtrZXldID0gdmFsdWU7IH0gcmV0dXJuIG9iajsgfVxuXG59LHtcIi4uLy4uL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXRvZG9zXCI6MjYsXCIuLi8uLi90b2Rvcy9zZXJ2aWNlcy9mYWtlLWJhY2tlbmQvc2F2ZS10b2RvXCI6MzN9XSwyMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLkxPQURfVE9ET1MgPSB1bmRlZmluZWQ7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICh0b2Rvcykge1xuXHRyZXR1cm4gZnVuY3Rpb24gKGRpc3BhdGNoLCBnZXRTdGF0ZSkge1xuXHRcdHJldHVybiAoMCwgX2xvYWRBbGxUb2RvczIuZGVmYXVsdCkoKS50aGVuKGZ1bmN0aW9uICh0b2Rvcykge1xuXHRcdFx0aWYgKCF0b2Rvcykge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcGF0Y2goKDAsIF91cGRhdGVUb2RvczIuZGVmYXVsdCkodG9kb3MpKTtcblx0XHR9KTtcblx0fTtcbn07XG5cbnZhciBfbG9hZEFsbFRvZG9zID0gX2RlcmVxXygnLi4vLi4vdG9kb3Mvc2VydmljZXMvZmFrZS1iYWNrZW5kL2xvYWQtYWxsLXRvZG9zJyk7XG5cbnZhciBfbG9hZEFsbFRvZG9zMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2xvYWRBbGxUb2Rvcyk7XG5cbnZhciBfdXBkYXRlVG9kb3MgPSBfZGVyZXFfKCcuLi8uLi90b2Rvcy9hY3Rpb25zL3VwZGF0ZS10b2RvcycpO1xuXG52YXIgX3VwZGF0ZVRvZG9zMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3VwZGF0ZVRvZG9zKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIExPQURfVE9ET1MgPSBleHBvcnRzLkxPQURfVE9ET1MgPSAnTE9BRF9UT0RPUyc7XG5cbn0se1wiLi4vLi4vdG9kb3MvYWN0aW9ucy91cGRhdGUtdG9kb3NcIjoyNixcIi4uLy4uL3RvZG9zL3NlcnZpY2VzL2Zha2UtYmFja2VuZC9sb2FkLWFsbC10b2Rvc1wiOjMxfV0sMjQ6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcblx0dmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoaWQpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIChkaXNwYXRjaCwgZ2V0U3RhdGUpIHtcblx0XHRyZXR1cm4gKDAsIF9kZWxldGVUb2RvMi5kZWZhdWx0KShpZCkudGhlbihmdW5jdGlvbiAodG9kbykge1xuXHRcdFx0ZGlzcGF0Y2goKDAsIF91cGRhdGVUb2RvczMuZGVmYXVsdCkoX2RlZmluZVByb3BlcnR5KHt9LCBpZCwgbnVsbCkpKTtcblx0XHR9KTtcblx0fTtcbn07XG5cbnZhciBfZGVsZXRlVG9kbyA9IF9kZXJlcV8oJy4uLy4uL3RvZG9zL3NlcnZpY2VzL2Zha2UtYmFja2VuZC9kZWxldGUtdG9kbycpO1xuXG52YXIgX2RlbGV0ZVRvZG8yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZGVsZXRlVG9kbyk7XG5cbnZhciBfdXBkYXRlVG9kb3MyID0gX2RlcmVxXygnLi4vLi4vdG9kb3MvYWN0aW9ucy91cGRhdGUtdG9kb3MnKTtcblxudmFyIF91cGRhdGVUb2RvczMgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91cGRhdGVUb2RvczIpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHZhbHVlKSB7IGlmIChrZXkgaW4gb2JqKSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgeyB2YWx1ZTogdmFsdWUsIGVudW1lcmFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgd3JpdGFibGU6IHRydWUgfSk7IH0gZWxzZSB7IG9ialtrZXldID0gdmFsdWU7IH0gcmV0dXJuIG9iajsgfVxuXG59LHtcIi4uLy4uL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXRvZG9zXCI6MjYsXCIuLi8uLi90b2Rvcy9zZXJ2aWNlcy9mYWtlLWJhY2tlbmQvZGVsZXRlLXRvZG9cIjozMH1dLDI1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHNlbGVjdGVkU3VtbWFyeVN0YXR1cykge1xuXHRyZXR1cm4geyB0eXBlOiBVUERBVEVfU0VMRUNURURfU1VNTUFSWV9TVEFUVVMsIHNlbGVjdGVkU3VtbWFyeVN0YXR1czogc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzIH07XG59O1xuXG52YXIgVVBEQVRFX1NFTEVDVEVEX1NVTU1BUllfU1RBVFVTID0gZXhwb3J0cy5VUERBVEVfU0VMRUNURURfU1VNTUFSWV9TVEFUVVMgPSAnVVBEQVRFX1NFTEVDVEVEX1NVTU1BUllfU1RBVFVTJztcblxufSx7fV0sMjY6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcblx0dmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAodG9kb3MpIHtcblx0cmV0dXJuIHsgdHlwZTogVVBEQVRFX1RPRE9TLCB0b2RvczogdG9kb3MgfTtcbn07XG5cbnZhciBVUERBVEVfVE9ET1MgPSBleHBvcnRzLlVQREFURV9UT0RPUyA9ICdVUERBVEVfVE9ET1MnO1xuXG59LHt9XSwyNzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgUEVORElORyA9IGV4cG9ydHMuUEVORElORyA9ICdQRU5ESU5HJztcbnZhciBDT01QTEVURSA9IGV4cG9ydHMuQ09NUExFVEUgPSAnQ09NUExFVEUnO1xudmFyIFRPVEFMID0gZXhwb3J0cy5UT1RBTCA9ICdUT1RBTCc7XG5cbn0se31dLDI4OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMF0gOiBfc3RhdHVzZXMuVE9UQUw7XG5cdHZhciBhY3Rpb24gPSBhcmd1bWVudHNbMV07XG5cblx0c3dpdGNoIChhY3Rpb24udHlwZSkge1xuXHRcdGNhc2UgX3VwZGF0ZVNlbGVjdGVkU3VtbWFyeVN0YXR1cy5VUERBVEVfU0VMRUNURURfU1VNTUFSWV9TVEFUVVM6XG5cdFx0XHRyZXR1cm4gYWN0aW9uLnNlbGVjdGVkU3VtbWFyeVN0YXR1cztcblxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzO1xuXHR9XG59O1xuXG52YXIgX3VwZGF0ZVNlbGVjdGVkU3VtbWFyeVN0YXR1cyA9IF9kZXJlcV8oJy4uLy4uL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXNlbGVjdGVkLXN1bW1hcnktc3RhdHVzJyk7XG5cbnZhciBfc3RhdHVzZXMgPSBfZGVyZXFfKCcuLi8uLi90b2Rvcy9jb25zdGFudHMvc3RhdHVzZXMnKTtcblxufSx7XCIuLi8uLi90b2Rvcy9hY3Rpb25zL3VwZGF0ZS1zZWxlY3RlZC1zdW1tYXJ5LXN0YXR1c1wiOjI1LFwiLi4vLi4vdG9kb3MvY29uc3RhbnRzL3N0YXR1c2VzXCI6Mjd9XSwyOTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHRvZG9zID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMF0gOiB7fTtcblx0dmFyIGFjdGlvbiA9IGFyZ3VtZW50c1sxXTtcblxuXHR2YXIgbmV3VG9kb3MgPSB2b2lkIDA7XG5cblx0c3dpdGNoIChhY3Rpb24udHlwZSkge1xuXHRcdGNhc2UgX3VwZGF0ZVRvZG9zLlVQREFURV9UT0RPUzpcblx0XHRcdG5ld1RvZG9zID0gX2V4dGVuZHMoe30sIHRvZG9zKTtcblxuXHRcdFx0T2JqZWN0LmtleXMoYWN0aW9uLnRvZG9zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0aWYgKGFjdGlvbi50b2Rvc1trZXldKSB7XG5cdFx0XHRcdFx0bmV3VG9kb3Nba2V5XSA9IGFjdGlvbi50b2Rvc1trZXldO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlbGV0ZSBuZXdUb2Rvc1trZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIG5ld1RvZG9zO1xuXG5cdFx0ZGVmYXVsdDpcblx0XHRcdHJldHVybiB0b2Rvcztcblx0fVxufTtcblxudmFyIF91cGRhdGVUb2RvcyA9IF9kZXJlcV8oJy4uLy4uL3RvZG9zL2FjdGlvbnMvdXBkYXRlLXRvZG9zJyk7XG5cbn0se1wiLi4vLi4vdG9kb3MvYWN0aW9ucy91cGRhdGUtdG9kb3NcIjoyNn1dLDMwOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcblwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcblx0dmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoaWQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyLCB4KSB7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gcih0cnVlKTtcblx0XHR9LCA1MCk7XG5cdH0pO1xufTtcblxufSx7fV0sMzE6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcblx0dmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciB0b2RvcyA9IHtcblx0XHQnMTAnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ0J1eSB0b21hdG9lcyBmcm9tIGdyb2Nlcnkgc3RvcmUnLFxuXHRcdFx0ZGF0ZUNyZWF0ZWQ6ICcyMDE2LTA5LTE5VDE4OjQ0OjE1LjYzNScsXG5cdFx0XHRpc0NvbXBsZXRlOiBmYWxzZVxuXHRcdH0sXG5cdFx0JzMnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ0ZpbmlzaCB3cml0aW5nIGJsb2cgcG9zdCcsXG5cdFx0XHRkYXRlQ3JlYXRlZDogJzIwMTYtMDktMjBUMTg6NDQ6MTguNjM1Jyxcblx0XHRcdGlzQ29tcGxldGU6IGZhbHNlXG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAociwgeCkge1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHIodG9kb3MpO1xuXHRcdH0sIDUwKTtcblx0fSk7XG59O1xuXG59LHt9XSwzMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKGRlc2NyaXB0aW9uKSB7XG5cdHZhciBpZCA9IE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDEwMDAwKS50b0ZpeGVkKCk7XG5cdHZhciBuZXdUb2RvID0ge1xuXHRcdGlkOiBpZCxcblx0XHRkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24sXG5cdFx0ZGF0ZUNyZWF0ZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcblx0XHRpc0NvbXBsZXRlOiBmYWxzZVxuXHR9O1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAociwgeCkge1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHIobmV3VG9kbyk7XG5cdFx0fSwgNTApO1xuXHR9KTtcbn07XG5cbn0se31dLDMzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcblwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcblx0dmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoaWQsIHRvZG8pIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyLCB4KSB7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gcih7IGlkOiBpZCwgdG9kbzogdG9kbyB9KTtcblx0XHR9LCA1MCk7XG5cdH0pO1xufTtcblxufSx7fV19LHt9LFsxNl0pKDE2KVxufSk7IiwiaW1wb3J0IGNvbWJpbmVTZWxlY3RvcnMgZnJvbSAnY29tYmluZS1zZWxlY3RvcnMnO1xuaW1wb3J0IHsgc3RhdGUsIGFjdGlvbnMsIHN1YnNjcmliZSwgY29uc3RhbnRzIH0gZnJvbSAndG9kby1yZWR1eC1zdGF0ZSc7XG5cbmltcG9ydCBzZWxlY3RlZFBhZ2UgZnJvbSAnLi9zaXRlL3NlbGVjdGVkLXBhZ2UnO1xuaW1wb3J0IHVybCBmcm9tICcuL3NpdGUvdXJsJztcbmltcG9ydCBzaXRlSGVhZGVyIGZyb20gJy4vc2l0ZS9zaXRlLWhlYWRlcic7XG5pbXBvcnQgdG9kb3MgZnJvbSAnLi90b2Rvcy90b2Rvcyc7XG5cbmNvbnN0IHJhd1NlbGVjdG9ycyA9IHtcblx0c2VsZWN0ZWRQYWdlLFxuXHR1cmwsXG5cdHNpdGVIZWFkZXIsXG5cdHRvZG9zXG59O1xuXG5jb25zdCBzZWxlY3RvcnMgPSBjb21iaW5lU2VsZWN0b3JzKHJhd1NlbGVjdG9ycywgKCkgPT4gc3RhdGUpO1xuXG5jb25zdCBmaW5hbCA9IHtcblx0c2VsZWN0b3JzLFxuXHRhY3Rpb25zLFxuXHRjb25zdGFudHMsXG5cdHN1YnNjcmliZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGZpbmFsLCBcInN0YXRlXCIsIHsgZ2V0OiAoKSA9PiBzdGF0ZSB9KTtcblxuZXhwb3J0IGRlZmF1bHQgZmluYWw7XG5cbmV4cG9ydCB7XG5cdHNlbGVjdG9ycyxcblx0YWN0aW9ucyxcblx0Y29uc3RhbnRzLFxuXHRzdWJzY3JpYmVcbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwic3RhdGVcIiwgeyBnZXQ6ICgpID0+IHN0YXRlIH0pOyIsImV4cG9ydCBjb25zdCBIT01FID0gJy8nO1xuZXhwb3J0IGNvbnN0IEFCT1VUID0gJy9hYm91dCc7IiwiaW1wb3J0IG1lbW9pemVyaWZpYyBmcm9tICdtZW1vaXplcmlmaWMnO1xuaW1wb3J0IHsgY29uc3RhbnRzIH0gZnJvbSAndG9kby1yZWFjdC1jb21wb25lbnRzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHN0YXRlKSB7XG5cdGNvbnN0IHsgc2VsZWN0ZWRQYWdlIH0gPSBzdGF0ZTtcblx0cmV0dXJuIHNlbGVjdFNlbGVjdGVkUGFnZShzZWxlY3RlZFBhZ2UpO1xufVxuXG5leHBvcnQgY29uc3Qgc2VsZWN0U2VsZWN0ZWRQYWdlID0gbWVtb2l6ZXJpZmljKDEpKChzZWxlY3RlZFBhZ2UpID0+IHtcblx0cmV0dXJuIGNvbnN0YW50cy5QQUdFU1tzZWxlY3RlZFBhZ2VdO1xufSk7XG4iLCJpbXBvcnQgbWVtb2l6ZXJpZmljIGZyb20gJ21lbW9pemVyaWZpYyc7XG5pbXBvcnQgeyBhY3Rpb25zLCBjb25zdGFudHMgfSBmcm9tICd0b2RvLXJlZHV4LXN0YXRlJztcblxuaW1wb3J0ICogYXMgUEFUSFMgZnJvbSAnLi4vc2l0ZS9jb25zdGFudHMvcGF0aHMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RhdGUpIHtcblx0Y29uc3QgeyBzZWxlY3RlZFBhZ2UgfSA9IHN0YXRlO1xuXHRyZXR1cm4gc2VsZWN0U2l0ZUhlYWRlcihzZWxlY3RlZFBhZ2UpO1xufVxuXG5leHBvcnQgY29uc3Qgc2VsZWN0U2l0ZUhlYWRlciA9IG1lbW9pemVyaWZpYygxKSgoc2VsZWN0ZWRQYWdlKSA9PiB7XG5cblx0cmV0dXJuIHtcblx0XHRsYWJlbEhvbWU6ICdUb2RvIEFwcCcsXG5cdFx0bGFiZWxBYm91dDogJ0Fib3V0JyxcblxuXHRcdGhyZWZIb21lOiBQQVRIU1tjb25zdGFudHMuUEFHRVMuSE9NRV0sXG5cdFx0aHJlZkFib3V0OiBQQVRIU1tjb25zdGFudHMuUEFHRVMuQUJPVVRdLFxuXG5cdFx0c2VsZWN0ZWRQYWdlOiBzZWxlY3RlZFBhZ2UsXG5cblx0XHRvbkNsaWNrSG9tZTogKCkgPT4gYWN0aW9ucy5zaXRlLnVwZGF0ZVNlbGVjdGVkUGFnZShjb25zdGFudHMuUEFHRVMuSE9NRSksXG5cdFx0b25DbGlja0Fib3V0OiAoKSA9PiBhY3Rpb25zLnNpdGUudXBkYXRlU2VsZWN0ZWRQYWdlKGNvbnN0YW50cy5QQUdFUy5BQk9VVClcblx0fTtcbn0pO1xuIiwiaW1wb3J0IG1lbW9pemVyaWZpYyBmcm9tICdtZW1vaXplcmlmaWMnO1xuaW1wb3J0ICogYXMgUEFUSFMgZnJvbSAnLi4vc2l0ZS9jb25zdGFudHMvcGF0aHMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RhdGUpIHtcblx0Y29uc3QgeyBzZWxlY3RlZFBhZ2UgfSA9IHN0YXRlO1xuXHRyZXR1cm4gc2VsZWN0VVJMKHNlbGVjdGVkUGFnZSk7XG59XG5cbmV4cG9ydCBjb25zdCBzZWxlY3RVUkwgPSBtZW1vaXplcmlmaWMoMSkoKHNlbGVjdGVkUGFnZSwgU0lURV9QQVRIUyA9IFBBVEhTKSA9PiB7XG5cdHJldHVybiBTSVRFX1BBVEhTW3NlbGVjdGVkUGFnZV07XG59KTtcbiIsImltcG9ydCBtZW1vaXplcmlmaWMgZnJvbSAnbWVtb2l6ZXJpZmljJztcbmltcG9ydCB7IGFjdGlvbnMsIGNvbnN0YW50cyB9IGZyb20gJ3RvZG8tcmVkdXgtc3RhdGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RhdGUpIHtcblx0Y29uc3QgeyB0b2Rvcywgc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzIH0gPSBzdGF0ZTtcblxuXHRyZXR1cm4gc2VsZWN0VG9kb3ModG9kb3MsIHNlbGVjdGVkU3VtbWFyeVN0YXR1cyk7XG59XG5cbmV4cG9ydCBjb25zdCBzZWxlY3RUb2RvcyA9IG1lbW9pemVyaWZpYygxKSgodG9kb3MsIHNlbGVjdGVkU3VtbWFyeVN0YXR1cykgPT4ge1xuXG5cdGNvbnN0IG5ld0Zvcm0gPSB7XG5cdFx0cGxhY2Vob2xkZXI6ICdXaGF0IGRvIHlvdSBuZWVkIHRvIGRvPycsXG5cdFx0b25TdWJtaXQ6IGRlc2NyaXB0aW9uID0+IGFjdGlvbnMudG9kb3MuYWRkVG9kbyhkZXNjcmlwdGlvbilcblx0fTtcblxuXHRsZXQgbGlzdCA9IE9iamVjdC5rZXlzKHRvZG9zKS5tYXAoa2V5ID0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4udG9kb3Nba2V5XSxcblx0XHRcdGlkOiBrZXksXG5cdFx0XHRidXR0b25MYWJlbDogJ2RlbGV0ZScsXG5cdFx0XHRvbkJ1dHRvbkNsaWNrZWQ6ICgpID0+IGFjdGlvbnMudG9kb3MucmVtb3ZlVG9kbyhrZXkpLFxuXHRcdFx0b25DaGVja2JveFRvZ2dsZWQ6ICgpID0+IGFjdGlvbnMudG9kb3MuY29tcGxldGVUb2RvKGtleSwgIXRvZG9zW2tleV0uaXNDb21wbGV0ZSlcblx0XHR9O1xuXHR9KTtcblxuXHRjb25zdCBzdW1tYXJ5ID0gbGlzdC5yZWR1Y2UoKHAsIHRvZG8pID0+IHtcblx0XHRcdCF0b2RvLmlzQ29tcGxldGUgJiYgcC5jb3VudEluY29tcGxldGUrKztcblx0XHRcdHRvZG8uaXNDb21wbGV0ZSAmJiBwLmNvdW50Q29tcGxldGUrKztcblx0XHRcdHAuY291bnRUb3RhbCsrO1xuXHRcdFx0cmV0dXJuIHA7XG5cdFx0fSwge1xuXHRcdFx0Y291bnRJbmNvbXBsZXRlOiAwLFxuXHRcdFx0Y291bnRDb21wbGV0ZTogMCxcblx0XHRcdGNvdW50VG90YWw6IDBcblx0XHR9KTtcblxuXHRsaXN0ID0gbGlzdFxuXHRcdC5maWx0ZXIodG9kbyA9PiAoXG5cdFx0XHRzZWxlY3RlZFN1bW1hcnlTdGF0dXMgPT09IGNvbnN0YW50cy5UT0RPU19TVEFUVVNFUy5UT1RBTCB8fFxuXHRcdFx0KHNlbGVjdGVkU3VtbWFyeVN0YXR1cyA9PT0gY29uc3RhbnRzLlRPRE9TX1NUQVRVU0VTLkNPTVBMRVRFICYmIHRvZG8uaXNDb21wbGV0ZSkgIHx8XG5cdFx0XHQoc2VsZWN0ZWRTdW1tYXJ5U3RhdHVzID09PSBjb25zdGFudHMuVE9ET1NfU1RBVFVTRVMuUEVORElORyAmJiAhdG9kby5pc0NvbXBsZXRlKVxuXHRcdCkpXG5cdFx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChhLmRhdGVDcmVhdGVkIDwgYi5kYXRlQ3JlYXRlZCkgeyByZXR1cm4gLTE7IH1cblx0XHRcdGlmIChhLmRhdGVDcmVhdGVkID4gYi5kYXRlQ3JlYXRlZCkgeyByZXR1cm4gMTsgfVxuXHRcdFx0aWYgKGEuaWQgPCBiLmlkKSB7IHJldHVybiAtMTsgfVxuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSk7XG5cblx0c3VtbWFyeS5jb3VudEluY29tcGxldGUgPSBgJHtzdW1tYXJ5LmNvdW50SW5jb21wbGV0ZX0gcGVuZGluZ2A7XG5cdHN1bW1hcnkuY291bnRDb21wbGV0ZSA9IGAke3N1bW1hcnkuY291bnRDb21wbGV0ZX0gY29tcGxldGVgO1xuXHRzdW1tYXJ5LmNvdW50VG90YWwgPSBgJHtzdW1tYXJ5LmNvdW50VG90YWx9IHRvdGFsYDtcblxuXHRzdW1tYXJ5LnNlbGVjdGVkU3VtbWFyeVN0YXR1cyA9IHNlbGVjdGVkU3VtbWFyeVN0YXR1cztcblxuXHRzdW1tYXJ5Lm9uQ2xpY2tQZW5kaW5nID0gKCkgPT4gYWN0aW9ucy50b2Rvcy51cGRhdGVTZWxlY3RlZFN1bW1hcnlTdGF0dXMoY29uc3RhbnRzLlRPRE9TX1NUQVRVU0VTLlBFTkRJTkcpO1xuXHRzdW1tYXJ5Lm9uQ2xpY2tDb21wbGV0ZSA9ICgpID0+IGFjdGlvbnMudG9kb3MudXBkYXRlU2VsZWN0ZWRTdW1tYXJ5U3RhdHVzKGNvbnN0YW50cy5UT0RPU19TVEFUVVNFUy5DT01QTEVURSk7XG5cdHN1bW1hcnkub25DbGlja1RvdGFsID0gKCkgPT4gYWN0aW9ucy50b2Rvcy51cGRhdGVTZWxlY3RlZFN1bW1hcnlTdGF0dXMoY29uc3RhbnRzLlRPRE9TX1NUQVRVU0VTLlRPVEFMKTtcblxuXHRyZXR1cm4ge1xuXHRcdG5ld0Zvcm0sXG5cdFx0bGlzdCxcblx0XHRzdW1tYXJ5XG5cdH07XG59KTtcbiJdfQ==
