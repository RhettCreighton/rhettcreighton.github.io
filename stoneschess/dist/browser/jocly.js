"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function (f) {
  if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }g.Jocly = f();
  }
})(function () {
  var define, module, exports;return function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;if (!f && c) return c(i, !0);if (u) return u(i, !0);var a = new Error("Cannot find module '" + i + "'");throw a.code = "MODULE_NOT_FOUND", a;
          }var p = n[i] = { exports: {} };e[i][0].call(p.exports, function (r) {
            var n = e[i][1][r];return o(n || r);
          }, p, p.exports, r, e, n, t);
        }return n[i].exports;
      }for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) {
        o(t[i]);
      }return o;
    }return r;
  }()({ 1: [function (require, module, exports) {
      'use strict';

      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;

      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

      var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      for (var i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }

      // Support decoding URL-safe base64 strings, as Node.js does.
      // See: https://en.wikipedia.org/wiki/Base64#URL_applications
      revLookup['-'.charCodeAt(0)] = 62;
      revLookup['_'.charCodeAt(0)] = 63;

      function getLens(b64) {
        var len = b64.length;

        if (len % 4 > 0) {
          throw new Error('Invalid string. Length must be a multiple of 4');
        }

        // Trim off extra bytes after placeholder bytes are found
        // See: https://github.com/beatgammit/base64-js/issues/42
        var validLen = b64.indexOf('=');
        if (validLen === -1) validLen = len;

        var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;

        return [validLen, placeHoldersLen];
      }

      // base64 is 4/3 + up to two characters of the original data
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }

      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }

      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];

        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

        var curByte = 0;

        // if there are placeholders, only get up to the last complete 4 chars
        var len = placeHoldersLen > 0 ? validLen - 4 : validLen;

        var i;
        for (i = 0; i < len; i += 4) {
          tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
          arr[curByte++] = tmp >> 16 & 0xFF;
          arr[curByte++] = tmp >> 8 & 0xFF;
          arr[curByte++] = tmp & 0xFF;
        }

        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
          arr[curByte++] = tmp & 0xFF;
        }

        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 0xFF;
          arr[curByte++] = tmp & 0xFF;
        }

        return arr;
      }

      function tripletToBase64(num) {
        return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
      }

      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i = start; i < end; i += 3) {
          tmp = (uint8[i] << 16 & 0xFF0000) + (uint8[i + 1] << 8 & 0xFF00) + (uint8[i + 2] & 0xFF);
          output.push(tripletToBase64(tmp));
        }
        return output.join('');
      }

      function fromByteArray(uint8) {
        var tmp;
        var len = uint8.length;
        var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
        var parts = [];
        var maxChunkLength = 16383; // must be multiple of 3

        // go through the array every three bytes, we'll deal with trailing stuff later
        for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
          parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
        }

        // pad the end with zeros, but make sure to not forget the extra bytes
        if (extraBytes === 1) {
          tmp = uint8[len - 1];
          parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 0x3F] + '==');
        } else if (extraBytes === 2) {
          tmp = (uint8[len - 2] << 8) + uint8[len - 1];
          parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 0x3F] + lookup[tmp << 2 & 0x3F] + '=');
        }

        return parts.join('');
      }
    }, {}], 2: [function (require, module, exports) {}, {}], 3: [function (require, module, exports) {
      (function (Buffer) {
        (function () {
          /*!
           * The buffer module from node.js, for the browser.
           *
           * @author   Feross Aboukhadijeh <https://feross.org>
           * @license  MIT
           */
          /* eslint-disable no-proto */

          'use strict';

          var base64 = require('base64-js');
          var ieee754 = require('ieee754');
          var customInspectSymbol = typeof Symbol === 'function' && typeof Symbol['for'] === 'function' ? // eslint-disable-line dot-notation
          Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
          : null;

          exports.Buffer = Buffer;
          exports.SlowBuffer = SlowBuffer;
          exports.INSPECT_MAX_BYTES = 50;

          var K_MAX_LENGTH = 0x7fffffff;
          exports.kMaxLength = K_MAX_LENGTH;

          /**
           * If `Buffer.TYPED_ARRAY_SUPPORT`:
           *   === true    Use Uint8Array implementation (fastest)
           *   === false   Print warning and recommend using `buffer` v4.x which has an Object
           *               implementation (most compatible, even IE6)
           *
           * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
           * Opera 11.6+, iOS 4.2+.
           *
           * We report that the browser does not support typed arrays if the are not subclassable
           * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
           * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
           * for __proto__ and has a buggy typed array implementation.
           */
          Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

          if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error('This browser lacks typed array (Uint8Array) support which is required by ' + '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.');
          }

          function typedArraySupport() {
            // Can typed array instances can be augmented?
            try {
              var arr = new Uint8Array(1);
              var proto = { foo: function foo() {
                  return 42;
                } };
              Object.setPrototypeOf(proto, Uint8Array.prototype);
              Object.setPrototypeOf(arr, proto);
              return arr.foo() === 42;
            } catch (e) {
              return false;
            }
          }

          Object.defineProperty(Buffer.prototype, 'parent', {
            enumerable: true,
            get: function get() {
              if (!Buffer.isBuffer(this)) return undefined;
              return this.buffer;
            }
          });

          Object.defineProperty(Buffer.prototype, 'offset', {
            enumerable: true,
            get: function get() {
              if (!Buffer.isBuffer(this)) return undefined;
              return this.byteOffset;
            }
          });

          function createBuffer(length) {
            if (length > K_MAX_LENGTH) {
              throw new RangeError('The value "' + length + '" is invalid for option "size"');
            }
            // Return an augmented `Uint8Array` instance
            var buf = new Uint8Array(length);
            Object.setPrototypeOf(buf, Buffer.prototype);
            return buf;
          }

          /**
           * The Buffer constructor returns instances of `Uint8Array` that have their
           * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
           * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
           * and the `Uint8Array` methods. Square bracket notation works as expected -- it
           * returns a single octet.
           *
           * The `Uint8Array` prototype remains unmodified.
           */

          function Buffer(arg, encodingOrOffset, length) {
            // Common case.
            if (typeof arg === 'number') {
              if (typeof encodingOrOffset === 'string') {
                throw new TypeError('The "string" argument must be of type string. Received type number');
              }
              return allocUnsafe(arg);
            }
            return from(arg, encodingOrOffset, length);
          }

          Buffer.poolSize = 8192; // not used by this implementation

          function from(value, encodingOrOffset, length) {
            if (typeof value === 'string') {
              return fromString(value, encodingOrOffset);
            }

            if (ArrayBuffer.isView(value)) {
              return fromArrayView(value);
            }

            if (value == null) {
              throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' + 'or Array-like Object. Received type ' + (typeof value === "undefined" ? "undefined" : _typeof(value)));
            }

            if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
              return fromArrayBuffer(value, encodingOrOffset, length);
            }

            if (typeof SharedArrayBuffer !== 'undefined' && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
              return fromArrayBuffer(value, encodingOrOffset, length);
            }

            if (typeof value === 'number') {
              throw new TypeError('The "value" argument must not be of type number. Received type number');
            }

            var valueOf = value.valueOf && value.valueOf();
            if (valueOf != null && valueOf !== value) {
              return Buffer.from(valueOf, encodingOrOffset, length);
            }

            var b = fromObject(value);
            if (b) return b;

            if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === 'function') {
              return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length);
            }

            throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' + 'or Array-like Object. Received type ' + (typeof value === "undefined" ? "undefined" : _typeof(value)));
          }

          /**
           * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
           * if value is a number.
           * Buffer.from(str[, encoding])
           * Buffer.from(array)
           * Buffer.from(buffer)
           * Buffer.from(arrayBuffer[, byteOffset[, length]])
           **/
          Buffer.from = function (value, encodingOrOffset, length) {
            return from(value, encodingOrOffset, length);
          };

          // Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
          // https://github.com/feross/buffer/pull/148
          Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
          Object.setPrototypeOf(Buffer, Uint8Array);

          function assertSize(size) {
            if (typeof size !== 'number') {
              throw new TypeError('"size" argument must be of type number');
            } else if (size < 0) {
              throw new RangeError('The value "' + size + '" is invalid for option "size"');
            }
          }

          function alloc(size, fill, encoding) {
            assertSize(size);
            if (size <= 0) {
              return createBuffer(size);
            }
            if (fill !== undefined) {
              // Only pay attention to encoding if it's a string. This
              // prevents accidentally sending in a number that would
              // be interpreted as a start offset.
              return typeof encoding === 'string' ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
            }
            return createBuffer(size);
          }

          /**
           * Creates a new filled Buffer instance.
           * alloc(size[, fill[, encoding]])
           **/
          Buffer.alloc = function (size, fill, encoding) {
            return alloc(size, fill, encoding);
          };

          function allocUnsafe(size) {
            assertSize(size);
            return createBuffer(size < 0 ? 0 : checked(size) | 0);
          }

          /**
           * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
           * */
          Buffer.allocUnsafe = function (size) {
            return allocUnsafe(size);
          };
          /**
           * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
           */
          Buffer.allocUnsafeSlow = function (size) {
            return allocUnsafe(size);
          };

          function fromString(string, encoding) {
            if (typeof encoding !== 'string' || encoding === '') {
              encoding = 'utf8';
            }

            if (!Buffer.isEncoding(encoding)) {
              throw new TypeError('Unknown encoding: ' + encoding);
            }

            var length = byteLength(string, encoding) | 0;
            var buf = createBuffer(length);

            var actual = buf.write(string, encoding);

            if (actual !== length) {
              // Writing a hex string, for example, that contains invalid characters will
              // cause everything after the first invalid character to be ignored. (e.g.
              // 'abxxcd' will be treated as 'ab')
              buf = buf.slice(0, actual);
            }

            return buf;
          }

          function fromArrayLike(array) {
            var length = array.length < 0 ? 0 : checked(array.length) | 0;
            var buf = createBuffer(length);
            for (var i = 0; i < length; i += 1) {
              buf[i] = array[i] & 255;
            }
            return buf;
          }

          function fromArrayView(arrayView) {
            if (isInstance(arrayView, Uint8Array)) {
              var copy = new Uint8Array(arrayView);
              return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
            }
            return fromArrayLike(arrayView);
          }

          function fromArrayBuffer(array, byteOffset, length) {
            if (byteOffset < 0 || array.byteLength < byteOffset) {
              throw new RangeError('"offset" is outside of buffer bounds');
            }

            if (array.byteLength < byteOffset + (length || 0)) {
              throw new RangeError('"length" is outside of buffer bounds');
            }

            var buf;
            if (byteOffset === undefined && length === undefined) {
              buf = new Uint8Array(array);
            } else if (length === undefined) {
              buf = new Uint8Array(array, byteOffset);
            } else {
              buf = new Uint8Array(array, byteOffset, length);
            }

            // Return an augmented `Uint8Array` instance
            Object.setPrototypeOf(buf, Buffer.prototype);

            return buf;
          }

          function fromObject(obj) {
            if (Buffer.isBuffer(obj)) {
              var len = checked(obj.length) | 0;
              var buf = createBuffer(len);

              if (buf.length === 0) {
                return buf;
              }

              obj.copy(buf, 0, 0, len);
              return buf;
            }

            if (obj.length !== undefined) {
              if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
                return createBuffer(0);
              }
              return fromArrayLike(obj);
            }

            if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
              return fromArrayLike(obj.data);
            }
          }

          function checked(length) {
            // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
            // length is NaN (which is otherwise coerced to zero.)
            if (length >= K_MAX_LENGTH) {
              throw new RangeError('Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes');
            }
            return length | 0;
          }

          function SlowBuffer(length) {
            if (+length != length) {
              // eslint-disable-line eqeqeq
              length = 0;
            }
            return Buffer.alloc(+length);
          }

          Buffer.isBuffer = function isBuffer(b) {
            return b != null && b._isBuffer === true && b !== Buffer.prototype; // so Buffer.isBuffer(Buffer.prototype) will be false
          };

          Buffer.compare = function compare(a, b) {
            if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
            if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
            if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
              throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
            }

            if (a === b) return 0;

            var x = a.length;
            var y = b.length;

            for (var i = 0, len = Math.min(x, y); i < len; ++i) {
              if (a[i] !== b[i]) {
                x = a[i];
                y = b[i];
                break;
              }
            }

            if (x < y) return -1;
            if (y < x) return 1;
            return 0;
          };

          Buffer.isEncoding = function isEncoding(encoding) {
            switch (String(encoding).toLowerCase()) {
              case 'hex':
              case 'utf8':
              case 'utf-8':
              case 'ascii':
              case 'latin1':
              case 'binary':
              case 'base64':
              case 'ucs2':
              case 'ucs-2':
              case 'utf16le':
              case 'utf-16le':
                return true;
              default:
                return false;
            }
          };

          Buffer.concat = function concat(list, length) {
            if (!Array.isArray(list)) {
              throw new TypeError('"list" argument must be an Array of Buffers');
            }

            if (list.length === 0) {
              return Buffer.alloc(0);
            }

            var i;
            if (length === undefined) {
              length = 0;
              for (i = 0; i < list.length; ++i) {
                length += list[i].length;
              }
            }

            var buffer = Buffer.allocUnsafe(length);
            var pos = 0;
            for (i = 0; i < list.length; ++i) {
              var buf = list[i];
              if (isInstance(buf, Uint8Array)) {
                if (pos + buf.length > buffer.length) {
                  Buffer.from(buf).copy(buffer, pos);
                } else {
                  Uint8Array.prototype.set.call(buffer, buf, pos);
                }
              } else if (!Buffer.isBuffer(buf)) {
                throw new TypeError('"list" argument must be an Array of Buffers');
              } else {
                buf.copy(buffer, pos);
              }
              pos += buf.length;
            }
            return buffer;
          };

          function byteLength(string, encoding) {
            if (Buffer.isBuffer(string)) {
              return string.length;
            }
            if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
              return string.byteLength;
            }
            if (typeof string !== 'string') {
              throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' + 'Received type ' + (typeof string === "undefined" ? "undefined" : _typeof(string)));
            }

            var len = string.length;
            var mustMatch = arguments.length > 2 && arguments[2] === true;
            if (!mustMatch && len === 0) return 0;

            // Use a for loop to avoid recursion
            var loweredCase = false;
            for (;;) {
              switch (encoding) {
                case 'ascii':
                case 'latin1':
                case 'binary':
                  return len;
                case 'utf8':
                case 'utf-8':
                  return utf8ToBytes(string).length;
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return len * 2;
                case 'hex':
                  return len >>> 1;
                case 'base64':
                  return base64ToBytes(string).length;
                default:
                  if (loweredCase) {
                    return mustMatch ? -1 : utf8ToBytes(string).length; // assume utf8
                  }
                  encoding = ('' + encoding).toLowerCase();
                  loweredCase = true;
              }
            }
          }
          Buffer.byteLength = byteLength;

          function slowToString(encoding, start, end) {
            var loweredCase = false;

            // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
            // property of a typed array.

            // This behaves neither like String nor Uint8Array in that we set start/end
            // to their upper/lower bounds if the value passed is out of range.
            // undefined is handled specially as per ECMA-262 6th Edition,
            // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
            if (start === undefined || start < 0) {
              start = 0;
            }
            // Return early if start > this.length. Done here to prevent potential uint32
            // coercion fail below.
            if (start > this.length) {
              return '';
            }

            if (end === undefined || end > this.length) {
              end = this.length;
            }

            if (end <= 0) {
              return '';
            }

            // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
            end >>>= 0;
            start >>>= 0;

            if (end <= start) {
              return '';
            }

            if (!encoding) encoding = 'utf8';

            while (true) {
              switch (encoding) {
                case 'hex':
                  return hexSlice(this, start, end);

                case 'utf8':
                case 'utf-8':
                  return utf8Slice(this, start, end);

                case 'ascii':
                  return asciiSlice(this, start, end);

                case 'latin1':
                case 'binary':
                  return latin1Slice(this, start, end);

                case 'base64':
                  return base64Slice(this, start, end);

                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return utf16leSlice(this, start, end);

                default:
                  if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
                  encoding = (encoding + '').toLowerCase();
                  loweredCase = true;
              }
            }
          }

          // This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
          // to detect a Buffer instance. It's not possible to use `instanceof Buffer`
          // reliably in a browserify context because there could be multiple different
          // copies of the 'buffer' package in use. This method works even for Buffer
          // instances that were created from another copy of the `buffer` package.
          // See: https://github.com/feross/buffer/issues/154
          Buffer.prototype._isBuffer = true;

          function swap(b, n, m) {
            var i = b[n];
            b[n] = b[m];
            b[m] = i;
          }

          Buffer.prototype.swap16 = function swap16() {
            var len = this.length;
            if (len % 2 !== 0) {
              throw new RangeError('Buffer size must be a multiple of 16-bits');
            }
            for (var i = 0; i < len; i += 2) {
              swap(this, i, i + 1);
            }
            return this;
          };

          Buffer.prototype.swap32 = function swap32() {
            var len = this.length;
            if (len % 4 !== 0) {
              throw new RangeError('Buffer size must be a multiple of 32-bits');
            }
            for (var i = 0; i < len; i += 4) {
              swap(this, i, i + 3);
              swap(this, i + 1, i + 2);
            }
            return this;
          };

          Buffer.prototype.swap64 = function swap64() {
            var len = this.length;
            if (len % 8 !== 0) {
              throw new RangeError('Buffer size must be a multiple of 64-bits');
            }
            for (var i = 0; i < len; i += 8) {
              swap(this, i, i + 7);
              swap(this, i + 1, i + 6);
              swap(this, i + 2, i + 5);
              swap(this, i + 3, i + 4);
            }
            return this;
          };

          Buffer.prototype.toString = function toString() {
            var length = this.length;
            if (length === 0) return '';
            if (arguments.length === 0) return utf8Slice(this, 0, length);
            return slowToString.apply(this, arguments);
          };

          Buffer.prototype.toLocaleString = Buffer.prototype.toString;

          Buffer.prototype.equals = function equals(b) {
            if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer');
            if (this === b) return true;
            return Buffer.compare(this, b) === 0;
          };

          Buffer.prototype.inspect = function inspect() {
            var str = '';
            var max = exports.INSPECT_MAX_BYTES;
            str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
            if (this.length > max) str += ' ... ';
            return '<Buffer ' + str + '>';
          };
          if (customInspectSymbol) {
            Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
          }

          Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
            if (isInstance(target, Uint8Array)) {
              target = Buffer.from(target, target.offset, target.byteLength);
            }
            if (!Buffer.isBuffer(target)) {
              throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. ' + 'Received type ' + (typeof target === "undefined" ? "undefined" : _typeof(target)));
            }

            if (start === undefined) {
              start = 0;
            }
            if (end === undefined) {
              end = target ? target.length : 0;
            }
            if (thisStart === undefined) {
              thisStart = 0;
            }
            if (thisEnd === undefined) {
              thisEnd = this.length;
            }

            if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
              throw new RangeError('out of range index');
            }

            if (thisStart >= thisEnd && start >= end) {
              return 0;
            }
            if (thisStart >= thisEnd) {
              return -1;
            }
            if (start >= end) {
              return 1;
            }

            start >>>= 0;
            end >>>= 0;
            thisStart >>>= 0;
            thisEnd >>>= 0;

            if (this === target) return 0;

            var x = thisEnd - thisStart;
            var y = end - start;
            var len = Math.min(x, y);

            var thisCopy = this.slice(thisStart, thisEnd);
            var targetCopy = target.slice(start, end);

            for (var i = 0; i < len; ++i) {
              if (thisCopy[i] !== targetCopy[i]) {
                x = thisCopy[i];
                y = targetCopy[i];
                break;
              }
            }

            if (x < y) return -1;
            if (y < x) return 1;
            return 0;
          };

          // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
          // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
          //
          // Arguments:
          // - buffer - a Buffer to search
          // - val - a string, Buffer, or number
          // - byteOffset - an index into `buffer`; will be clamped to an int32
          // - encoding - an optional encoding, relevant is val is a string
          // - dir - true for indexOf, false for lastIndexOf
          function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
            // Empty buffer means no match
            if (buffer.length === 0) return -1;

            // Normalize byteOffset
            if (typeof byteOffset === 'string') {
              encoding = byteOffset;
              byteOffset = 0;
            } else if (byteOffset > 0x7fffffff) {
              byteOffset = 0x7fffffff;
            } else if (byteOffset < -0x80000000) {
              byteOffset = -0x80000000;
            }
            byteOffset = +byteOffset; // Coerce to Number.
            if (numberIsNaN(byteOffset)) {
              // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
              byteOffset = dir ? 0 : buffer.length - 1;
            }

            // Normalize byteOffset: negative offsets start from the end of the buffer
            if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
            if (byteOffset >= buffer.length) {
              if (dir) return -1;else byteOffset = buffer.length - 1;
            } else if (byteOffset < 0) {
              if (dir) byteOffset = 0;else return -1;
            }

            // Normalize val
            if (typeof val === 'string') {
              val = Buffer.from(val, encoding);
            }

            // Finally, search either indexOf (if dir is true) or lastIndexOf
            if (Buffer.isBuffer(val)) {
              // Special case: looking for empty string/buffer always fails
              if (val.length === 0) {
                return -1;
              }
              return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
            } else if (typeof val === 'number') {
              val = val & 0xFF; // Search for a byte value [0-255]
              if (typeof Uint8Array.prototype.indexOf === 'function') {
                if (dir) {
                  return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
                } else {
                  return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
                }
              }
              return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
            }

            throw new TypeError('val must be string, number or Buffer');
          }

          function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
            var indexSize = 1;
            var arrLength = arr.length;
            var valLength = val.length;

            if (encoding !== undefined) {
              encoding = String(encoding).toLowerCase();
              if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
                if (arr.length < 2 || val.length < 2) {
                  return -1;
                }
                indexSize = 2;
                arrLength /= 2;
                valLength /= 2;
                byteOffset /= 2;
              }
            }

            function read(buf, i) {
              if (indexSize === 1) {
                return buf[i];
              } else {
                return buf.readUInt16BE(i * indexSize);
              }
            }

            var i;
            if (dir) {
              var foundIndex = -1;
              for (i = byteOffset; i < arrLength; i++) {
                if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                  if (foundIndex === -1) foundIndex = i;
                  if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
                } else {
                  if (foundIndex !== -1) i -= i - foundIndex;
                  foundIndex = -1;
                }
              }
            } else {
              if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
              for (i = byteOffset; i >= 0; i--) {
                var found = true;
                for (var j = 0; j < valLength; j++) {
                  if (read(arr, i + j) !== read(val, j)) {
                    found = false;
                    break;
                  }
                }
                if (found) return i;
              }
            }

            return -1;
          }

          Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
            return this.indexOf(val, byteOffset, encoding) !== -1;
          };

          Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
            return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
          };

          Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
            return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
          };

          function hexWrite(buf, string, offset, length) {
            offset = Number(offset) || 0;
            var remaining = buf.length - offset;
            if (!length) {
              length = remaining;
            } else {
              length = Number(length);
              if (length > remaining) {
                length = remaining;
              }
            }

            var strLen = string.length;

            if (length > strLen / 2) {
              length = strLen / 2;
            }
            for (var i = 0; i < length; ++i) {
              var parsed = parseInt(string.substr(i * 2, 2), 16);
              if (numberIsNaN(parsed)) return i;
              buf[offset + i] = parsed;
            }
            return i;
          }

          function utf8Write(buf, string, offset, length) {
            return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
          }

          function asciiWrite(buf, string, offset, length) {
            return blitBuffer(asciiToBytes(string), buf, offset, length);
          }

          function base64Write(buf, string, offset, length) {
            return blitBuffer(base64ToBytes(string), buf, offset, length);
          }

          function ucs2Write(buf, string, offset, length) {
            return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
          }

          Buffer.prototype.write = function write(string, offset, length, encoding) {
            // Buffer#write(string)
            if (offset === undefined) {
              encoding = 'utf8';
              length = this.length;
              offset = 0;
              // Buffer#write(string, encoding)
            } else if (length === undefined && typeof offset === 'string') {
              encoding = offset;
              length = this.length;
              offset = 0;
              // Buffer#write(string, offset[, length][, encoding])
            } else if (isFinite(offset)) {
              offset = offset >>> 0;
              if (isFinite(length)) {
                length = length >>> 0;
                if (encoding === undefined) encoding = 'utf8';
              } else {
                encoding = length;
                length = undefined;
              }
            } else {
              throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
            }

            var remaining = this.length - offset;
            if (length === undefined || length > remaining) length = remaining;

            if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
              throw new RangeError('Attempt to write outside buffer bounds');
            }

            if (!encoding) encoding = 'utf8';

            var loweredCase = false;
            for (;;) {
              switch (encoding) {
                case 'hex':
                  return hexWrite(this, string, offset, length);

                case 'utf8':
                case 'utf-8':
                  return utf8Write(this, string, offset, length);

                case 'ascii':
                case 'latin1':
                case 'binary':
                  return asciiWrite(this, string, offset, length);

                case 'base64':
                  // Warning: maxLength not taken into account in base64Write
                  return base64Write(this, string, offset, length);

                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return ucs2Write(this, string, offset, length);

                default:
                  if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
                  encoding = ('' + encoding).toLowerCase();
                  loweredCase = true;
              }
            }
          };

          Buffer.prototype.toJSON = function toJSON() {
            return {
              type: 'Buffer',
              data: Array.prototype.slice.call(this._arr || this, 0)
            };
          };

          function base64Slice(buf, start, end) {
            if (start === 0 && end === buf.length) {
              return base64.fromByteArray(buf);
            } else {
              return base64.fromByteArray(buf.slice(start, end));
            }
          }

          function utf8Slice(buf, start, end) {
            end = Math.min(buf.length, end);
            var res = [];

            var i = start;
            while (i < end) {
              var firstByte = buf[i];
              var codePoint = null;
              var bytesPerSequence = firstByte > 0xEF ? 4 : firstByte > 0xDF ? 3 : firstByte > 0xBF ? 2 : 1;

              if (i + bytesPerSequence <= end) {
                var secondByte, thirdByte, fourthByte, tempCodePoint;

                switch (bytesPerSequence) {
                  case 1:
                    if (firstByte < 0x80) {
                      codePoint = firstByte;
                    }
                    break;
                  case 2:
                    secondByte = buf[i + 1];
                    if ((secondByte & 0xC0) === 0x80) {
                      tempCodePoint = (firstByte & 0x1F) << 0x6 | secondByte & 0x3F;
                      if (tempCodePoint > 0x7F) {
                        codePoint = tempCodePoint;
                      }
                    }
                    break;
                  case 3:
                    secondByte = buf[i + 1];
                    thirdByte = buf[i + 2];
                    if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                      tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | thirdByte & 0x3F;
                      if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                        codePoint = tempCodePoint;
                      }
                    }
                    break;
                  case 4:
                    secondByte = buf[i + 1];
                    thirdByte = buf[i + 2];
                    fourthByte = buf[i + 3];
                    if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                      tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | fourthByte & 0x3F;
                      if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                        codePoint = tempCodePoint;
                      }
                    }
                }
              }

              if (codePoint === null) {
                // we did not generate a valid codePoint so insert a
                // replacement char (U+FFFD) and advance only 1 byte
                codePoint = 0xFFFD;
                bytesPerSequence = 1;
              } else if (codePoint > 0xFFFF) {
                // encode to utf16 (surrogate pair dance)
                codePoint -= 0x10000;
                res.push(codePoint >>> 10 & 0x3FF | 0xD800);
                codePoint = 0xDC00 | codePoint & 0x3FF;
              }

              res.push(codePoint);
              i += bytesPerSequence;
            }

            return decodeCodePointsArray(res);
          }

          // Based on http://stackoverflow.com/a/22747272/680742, the browser with
          // the lowest limit is Chrome, with 0x10000 args.
          // We go 1 magnitude less, for safety
          var MAX_ARGUMENTS_LENGTH = 0x1000;

          function decodeCodePointsArray(codePoints) {
            var len = codePoints.length;
            if (len <= MAX_ARGUMENTS_LENGTH) {
              return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
            }

            // Decode in chunks to avoid "call stack size exceeded".
            var res = '';
            var i = 0;
            while (i < len) {
              res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
            }
            return res;
          }

          function asciiSlice(buf, start, end) {
            var ret = '';
            end = Math.min(buf.length, end);

            for (var i = start; i < end; ++i) {
              ret += String.fromCharCode(buf[i] & 0x7F);
            }
            return ret;
          }

          function latin1Slice(buf, start, end) {
            var ret = '';
            end = Math.min(buf.length, end);

            for (var i = start; i < end; ++i) {
              ret += String.fromCharCode(buf[i]);
            }
            return ret;
          }

          function hexSlice(buf, start, end) {
            var len = buf.length;

            if (!start || start < 0) start = 0;
            if (!end || end < 0 || end > len) end = len;

            var out = '';
            for (var i = start; i < end; ++i) {
              out += hexSliceLookupTable[buf[i]];
            }
            return out;
          }

          function utf16leSlice(buf, start, end) {
            var bytes = buf.slice(start, end);
            var res = '';
            // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
            for (var i = 0; i < bytes.length - 1; i += 2) {
              res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
            }
            return res;
          }

          Buffer.prototype.slice = function slice(start, end) {
            var len = this.length;
            start = ~~start;
            end = end === undefined ? len : ~~end;

            if (start < 0) {
              start += len;
              if (start < 0) start = 0;
            } else if (start > len) {
              start = len;
            }

            if (end < 0) {
              end += len;
              if (end < 0) end = 0;
            } else if (end > len) {
              end = len;
            }

            if (end < start) end = start;

            var newBuf = this.subarray(start, end);
            // Return an augmented `Uint8Array` instance
            Object.setPrototypeOf(newBuf, Buffer.prototype);

            return newBuf;
          };

          /*
           * Need to make sure that buffer isn't trying to write out of bounds.
           */
          function checkOffset(offset, ext, length) {
            if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
            if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
          }

          Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var val = this[offset];
            var mul = 1;
            var i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
              val += this[offset + i] * mul;
            }

            return val;
          };

          Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
              checkOffset(offset, byteLength, this.length);
            }

            var val = this[offset + --byteLength];
            var mul = 1;
            while (byteLength > 0 && (mul *= 0x100)) {
              val += this[offset + --byteLength] * mul;
            }

            return val;
          };

          Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 1, this.length);
            return this[offset];
          };

          Buffer.prototype.readUint16LE = Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 2, this.length);
            return this[offset] | this[offset + 1] << 8;
          };

          Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 2, this.length);
            return this[offset] << 8 | this[offset + 1];
          };

          Buffer.prototype.readUint32LE = Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);

            return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 0x1000000;
          };

          Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);

            return this[offset] * 0x1000000 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
          };

          Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var val = this[offset];
            var mul = 1;
            var i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
              val += this[offset + i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) val -= Math.pow(2, 8 * byteLength);

            return val;
          };

          Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var i = byteLength;
            var mul = 1;
            var val = this[offset + --i];
            while (i > 0 && (mul *= 0x100)) {
              val += this[offset + --i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) val -= Math.pow(2, 8 * byteLength);

            return val;
          };

          Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 1, this.length);
            if (!(this[offset] & 0x80)) return this[offset];
            return (0xff - this[offset] + 1) * -1;
          };

          Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 2, this.length);
            var val = this[offset] | this[offset + 1] << 8;
            return val & 0x8000 ? val | 0xFFFF0000 : val;
          };

          Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 2, this.length);
            var val = this[offset + 1] | this[offset] << 8;
            return val & 0x8000 ? val | 0xFFFF0000 : val;
          };

          Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);

            return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
          };

          Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);

            return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
          };

          Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);
            return ieee754.read(this, offset, true, 23, 4);
          };

          Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 4, this.length);
            return ieee754.read(this, offset, false, 23, 4);
          };

          Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 8, this.length);
            return ieee754.read(this, offset, true, 52, 8);
          };

          Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) checkOffset(offset, 8, this.length);
            return ieee754.read(this, offset, false, 52, 8);
          };

          function checkInt(buf, value, offset, ext, max, min) {
            if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
            if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
            if (offset + ext > buf.length) throw new RangeError('Index out of range');
          }

          Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
              var maxBytes = Math.pow(2, 8 * byteLength) - 1;
              checkInt(this, value, offset, byteLength, maxBytes, 0);
            }

            var mul = 1;
            var i = 0;
            this[offset] = value & 0xFF;
            while (++i < byteLength && (mul *= 0x100)) {
              this[offset + i] = value / mul & 0xFF;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
              var maxBytes = Math.pow(2, 8 * byteLength) - 1;
              checkInt(this, value, offset, byteLength, maxBytes, 0);
            }

            var i = byteLength - 1;
            var mul = 1;
            this[offset + i] = value & 0xFF;
            while (--i >= 0 && (mul *= 0x100)) {
              this[offset + i] = value / mul & 0xFF;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
            this[offset] = value & 0xff;
            return offset + 1;
          };

          Buffer.prototype.writeUint16LE = Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
            this[offset] = value & 0xff;
            this[offset + 1] = value >>> 8;
            return offset + 2;
          };

          Buffer.prototype.writeUint16BE = Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
            this[offset] = value >>> 8;
            this[offset + 1] = value & 0xff;
            return offset + 2;
          };

          Buffer.prototype.writeUint32LE = Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
            this[offset + 3] = value >>> 24;
            this[offset + 2] = value >>> 16;
            this[offset + 1] = value >>> 8;
            this[offset] = value & 0xff;
            return offset + 4;
          };

          Buffer.prototype.writeUint32BE = Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
            this[offset] = value >>> 24;
            this[offset + 1] = value >>> 16;
            this[offset + 2] = value >>> 8;
            this[offset + 3] = value & 0xff;
            return offset + 4;
          };

          Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) {
              var limit = Math.pow(2, 8 * byteLength - 1);

              checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            var i = 0;
            var mul = 1;
            var sub = 0;
            this[offset] = value & 0xFF;
            while (++i < byteLength && (mul *= 0x100)) {
              if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                sub = 1;
              }
              this[offset + i] = (value / mul >> 0) - sub & 0xFF;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) {
              var limit = Math.pow(2, 8 * byteLength - 1);

              checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            var i = byteLength - 1;
            var mul = 1;
            var sub = 0;
            this[offset + i] = value & 0xFF;
            while (--i >= 0 && (mul *= 0x100)) {
              if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                sub = 1;
              }
              this[offset + i] = (value / mul >> 0) - sub & 0xFF;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
            if (value < 0) value = 0xff + value + 1;
            this[offset] = value & 0xff;
            return offset + 1;
          };

          Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            this[offset] = value & 0xff;
            this[offset + 1] = value >>> 8;
            return offset + 2;
          };

          Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            this[offset] = value >>> 8;
            this[offset + 1] = value & 0xff;
            return offset + 2;
          };

          Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            this[offset] = value & 0xff;
            this[offset + 1] = value >>> 8;
            this[offset + 2] = value >>> 16;
            this[offset + 3] = value >>> 24;
            return offset + 4;
          };

          Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            if (value < 0) value = 0xffffffff + value + 1;
            this[offset] = value >>> 24;
            this[offset + 1] = value >>> 16;
            this[offset + 2] = value >>> 8;
            this[offset + 3] = value & 0xff;
            return offset + 4;
          };

          function checkIEEE754(buf, value, offset, ext, max, min) {
            if (offset + ext > buf.length) throw new RangeError('Index out of range');
            if (offset < 0) throw new RangeError('Index out of range');
          }

          function writeFloat(buf, value, offset, littleEndian, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) {
              checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
            }
            ieee754.write(buf, value, offset, littleEndian, 23, 4);
            return offset + 4;
          }

          Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
            return writeFloat(this, value, offset, true, noAssert);
          };

          Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
            return writeFloat(this, value, offset, false, noAssert);
          };

          function writeDouble(buf, value, offset, littleEndian, noAssert) {
            value = +value;
            offset = offset >>> 0;
            if (!noAssert) {
              checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
            }
            ieee754.write(buf, value, offset, littleEndian, 52, 8);
            return offset + 8;
          }

          Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
            return writeDouble(this, value, offset, true, noAssert);
          };

          Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
            return writeDouble(this, value, offset, false, noAssert);
          };

          // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
          Buffer.prototype.copy = function copy(target, targetStart, start, end) {
            if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer');
            if (!start) start = 0;
            if (!end && end !== 0) end = this.length;
            if (targetStart >= target.length) targetStart = target.length;
            if (!targetStart) targetStart = 0;
            if (end > 0 && end < start) end = start;

            // Copy 0 bytes; we're done
            if (end === start) return 0;
            if (target.length === 0 || this.length === 0) return 0;

            // Fatal error conditions
            if (targetStart < 0) {
              throw new RangeError('targetStart out of bounds');
            }
            if (start < 0 || start >= this.length) throw new RangeError('Index out of range');
            if (end < 0) throw new RangeError('sourceEnd out of bounds');

            // Are we oob?
            if (end > this.length) end = this.length;
            if (target.length - targetStart < end - start) {
              end = target.length - targetStart + start;
            }

            var len = end - start;

            if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
              // Use built-in when available, missing from IE11
              this.copyWithin(targetStart, start, end);
            } else {
              Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart);
            }

            return len;
          };

          // Usage:
          //    buffer.fill(number[, offset[, end]])
          //    buffer.fill(buffer[, offset[, end]])
          //    buffer.fill(string[, offset[, end]][, encoding])
          Buffer.prototype.fill = function fill(val, start, end, encoding) {
            // Handle string cases:
            if (typeof val === 'string') {
              if (typeof start === 'string') {
                encoding = start;
                start = 0;
                end = this.length;
              } else if (typeof end === 'string') {
                encoding = end;
                end = this.length;
              }
              if (encoding !== undefined && typeof encoding !== 'string') {
                throw new TypeError('encoding must be a string');
              }
              if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                throw new TypeError('Unknown encoding: ' + encoding);
              }
              if (val.length === 1) {
                var code = val.charCodeAt(0);
                if (encoding === 'utf8' && code < 128 || encoding === 'latin1') {
                  // Fast path: If `val` fits into a single byte, use that numeric value.
                  val = code;
                }
              }
            } else if (typeof val === 'number') {
              val = val & 255;
            } else if (typeof val === 'boolean') {
              val = Number(val);
            }

            // Invalid ranges are not set to a default, so can range check early.
            if (start < 0 || this.length < start || this.length < end) {
              throw new RangeError('Out of range index');
            }

            if (end <= start) {
              return this;
            }

            start = start >>> 0;
            end = end === undefined ? this.length : end >>> 0;

            if (!val) val = 0;

            var i;
            if (typeof val === 'number') {
              for (i = start; i < end; ++i) {
                this[i] = val;
              }
            } else {
              var bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
              var len = bytes.length;
              if (len === 0) {
                throw new TypeError('The value "' + val + '" is invalid for argument "value"');
              }
              for (i = 0; i < end - start; ++i) {
                this[i + start] = bytes[i % len];
              }
            }

            return this;
          };

          // HELPER FUNCTIONS
          // ================

          var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

          function base64clean(str) {
            // Node takes equal signs as end of the Base64 encoding
            str = str.split('=')[0];
            // Node strips out invalid characters like \n and \t from the string, base64-js does not
            str = str.trim().replace(INVALID_BASE64_RE, '');
            // Node converts strings with length < 2 to ''
            if (str.length < 2) return '';
            // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
            while (str.length % 4 !== 0) {
              str = str + '=';
            }
            return str;
          }

          function utf8ToBytes(string, units) {
            units = units || Infinity;
            var codePoint;
            var length = string.length;
            var leadSurrogate = null;
            var bytes = [];

            for (var i = 0; i < length; ++i) {
              codePoint = string.charCodeAt(i);

              // is surrogate component
              if (codePoint > 0xD7FF && codePoint < 0xE000) {
                // last char was a lead
                if (!leadSurrogate) {
                  // no lead yet
                  if (codePoint > 0xDBFF) {
                    // unexpected trail
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                    continue;
                  } else if (i + 1 === length) {
                    // unpaired lead
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                    continue;
                  }

                  // valid lead
                  leadSurrogate = codePoint;

                  continue;
                }

                // 2 leads in a row
                if (codePoint < 0xDC00) {
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                  leadSurrogate = codePoint;
                  continue;
                }

                // valid surrogate pair
                codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
              } else if (leadSurrogate) {
                // valid bmp char, but last char was a lead
                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
              }

              leadSurrogate = null;

              // encode utf8
              if (codePoint < 0x80) {
                if ((units -= 1) < 0) break;
                bytes.push(codePoint);
              } else if (codePoint < 0x800) {
                if ((units -= 2) < 0) break;
                bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
              } else if (codePoint < 0x10000) {
                if ((units -= 3) < 0) break;
                bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
              } else if (codePoint < 0x110000) {
                if ((units -= 4) < 0) break;
                bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
              } else {
                throw new Error('Invalid code point');
              }
            }

            return bytes;
          }

          function asciiToBytes(str) {
            var byteArray = [];
            for (var i = 0; i < str.length; ++i) {
              // Node's code seems to be doing this and not & 0x7F..
              byteArray.push(str.charCodeAt(i) & 0xFF);
            }
            return byteArray;
          }

          function utf16leToBytes(str, units) {
            var c, hi, lo;
            var byteArray = [];
            for (var i = 0; i < str.length; ++i) {
              if ((units -= 2) < 0) break;

              c = str.charCodeAt(i);
              hi = c >> 8;
              lo = c % 256;
              byteArray.push(lo);
              byteArray.push(hi);
            }

            return byteArray;
          }

          function base64ToBytes(str) {
            return base64.toByteArray(base64clean(str));
          }

          function blitBuffer(src, dst, offset, length) {
            for (var i = 0; i < length; ++i) {
              if (i + offset >= dst.length || i >= src.length) break;
              dst[i + offset] = src[i];
            }
            return i;
          }

          // ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
          // the `instanceof` check but they should be treated as of that type.
          // See: https://github.com/feross/buffer/issues/166
          function isInstance(obj, type) {
            return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
          }
          function numberIsNaN(obj) {
            // For IE11 support
            return obj !== obj; // eslint-disable-line no-self-compare
          }

          // Create lookup table for `toString('hex')`
          // See: https://github.com/feross/buffer/issues/219
          var hexSliceLookupTable = function () {
            var alphabet = '0123456789abcdef';
            var table = new Array(256);
            for (var i = 0; i < 16; ++i) {
              var i16 = i * 16;
              for (var j = 0; j < 16; ++j) {
                table[i16 + j] = alphabet[i] + alphabet[j];
              }
            }
            return table;
          }();
        }).call(this);
      }).call(this, require("buffer").Buffer);
    }, { "base64-js": 1, "buffer": 3, "ieee754": 4 }], 4: [function (require, module, exports) {
      /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
      exports.read = function (buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];

        i += d;

        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };

      exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;

        value = Math.abs(value);

        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }

          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }

        for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

        buffer[offset + i - d] |= s * 128;
      };
    }, {}], 5: [function (require, module, exports) {
      // shim for using process in browser
      var process = module.exports = {};

      // cached from whatever global is present so that test runners that stub it
      // don't break things.  But we need to wrap it in a try catch in case it is
      // wrapped in strict mode code which doesn't define any globals.  It's inside a
      // function because try/catches deoptimize in certain engines.

      var cachedSetTimeout;
      var cachedClearTimeout;

      function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
      }
      function defaultClearTimeout() {
        throw new Error('clearTimeout has not been defined');
      }
      (function () {
        try {
          if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
          } else {
            cachedSetTimeout = defaultSetTimout;
          }
        } catch (e) {
          cachedSetTimeout = defaultSetTimout;
        }
        try {
          if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
          } else {
            cachedClearTimeout = defaultClearTimeout;
          }
        } catch (e) {
          cachedClearTimeout = defaultClearTimeout;
        }
      })();
      function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
        }
        try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout(fun, 0);
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
          } catch (e) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
          }
        }
      }
      function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
        }
        try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout(marker);
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
          } catch (e) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
          }
        }
      }
      var queue = [];
      var draining = false;
      var currentQueue;
      var queueIndex = -1;

      function cleanUpNextTick() {
        if (!draining || !currentQueue) {
          return;
        }
        draining = false;
        if (currentQueue.length) {
          queue = currentQueue.concat(queue);
        } else {
          queueIndex = -1;
        }
        if (queue.length) {
          drainQueue();
        }
      }

      function drainQueue() {
        if (draining) {
          return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while (len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
            if (currentQueue) {
              currentQueue[queueIndex].run();
            }
          }
          queueIndex = -1;
          len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
      }

      process.nextTick = function (fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
          }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
        }
      };

      // v8 likes predictible objects
      function Item(fun, array) {
        this.fun = fun;
        this.array = array;
      }
      Item.prototype.run = function () {
        this.fun.apply(null, this.array);
      };
      process.title = 'browser';
      process.browser = true;
      process.env = {};
      process.argv = [];
      process.version = ''; // empty string to avoid regexp issues
      process.versions = {};

      function noop() {}

      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.prependListener = noop;
      process.prependOnceListener = noop;

      process.listeners = function (name) {
        return [];
      };

      process.binding = function (name) {
        throw new Error('process.binding is not supported');
      };

      process.cwd = function () {
        return '/';
      };
      process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
      };
      process.umask = function () {
        return 0;
      };
    }, {}], 6: [function (require, module, exports) {
      (function (process, global, Buffer, __argument0, __argument1, __argument2, __argument3, __filename) {
        (function () {
          /*
           * SystemJS v0.20.19 Dev
           */
          !function () {
            "use strict";
            function e(e) {
              return ut ? Symbol() : "@@" + e;
            }function t(e, t) {
              ot || (t = t.replace(at ? /file:\/\/\//g : /file:\/\//g, ""));var r,
                  n = (e.message || e) + "\n  " + t;r = ft && e.fileName ? new Error(n, e.fileName, e.lineNumber) : new Error(n);var o = e.originalErr ? e.originalErr.stack : e.stack;return r.stack = it ? n + "\n  " + o : o, r.originalErr = e.originalErr || e, r;
            }function r(e, t) {
              throw new RangeError('Unable to resolve "' + e + '" to ' + t);
            }function n(e, t) {
              e = e.trim();var n = t && t.substr(0, t.indexOf(":") + 1),
                  o = e[0],
                  i = e[1];if ("/" === o && "/" === i) return n || r(e, t), n + e;if ("." === o && ("/" === i || "." === i && ("/" === e[2] || 2 === e.length && (e += "/")) || 1 === e.length && (e += "/")) || "/" === o) {
                var a,
                    s = !n || "/" !== t[n.length];if (s ? (void 0 === t && r(e, t), a = t) : a = "/" === t[n.length + 1] ? "file:" !== n ? (a = t.substr(n.length + 2)).substr(a.indexOf("/") + 1) : t.substr(8) : t.substr(n.length + 1), "/" === o) {
                  if (!s) return t.substr(0, t.length - a.length - 1) + e;r(e, t);
                }for (var u = a.substr(0, a.lastIndexOf("/") + 1) + e, l = [], c = -1, f = 0; f < u.length; f++) {
                  if (-1 === c) {
                    if ("." !== u[f]) c = f;else {
                      if ("." !== u[f + 1] || "/" !== u[f + 2] && f + 2 !== u.length) {
                        if ("/" !== u[f + 1] && f + 1 !== u.length) {
                          c = f;continue;
                        }f += 1;
                      } else l.pop(), f += 2;s && 0 === l.length && r(e, t);
                    }
                  } else "/" === u[f] && (l.push(u.substring(c, f + 1)), c = -1);
                }return -1 !== c && l.push(u.substr(c)), t.substr(0, t.length - a.length) + l.join("");
              }return -1 !== e.indexOf(":") ? it && ":" === e[1] && "\\" === e[2] && e[0].match(/[a-z]/i) ? "file:///" + e.replace(/\\/g, "/") : e : void 0;
            }function o(e) {
              if (e.values) return e.values();if ("undefined" == typeof Symbol || !Symbol.iterator) throw new Error("Symbol.iterator not supported in this browser");var t = {};return t[Symbol.iterator] = function () {
                var t = Object.keys(e),
                    r = 0;return { next: function next() {
                    return r < t.length ? { value: e[t[r++]], done: !1 } : { value: void 0, done: !0 };
                  } };
              }, t;
            }function i() {
              this.registry = new u();
            }function a(e) {
              if (!(e instanceof l)) throw new TypeError("Module instantiation did not return a valid namespace object.");return e;
            }function s(e) {
              if (void 0 === e) throw new RangeError("No resolution found.");return e;
            }function u() {
              this[mt] = {};
            }function l(e) {
              Object.defineProperty(this, vt, { value: e }), Object.keys(e).forEach(c, this);
            }function c(e) {
              Object.defineProperty(this, e, { enumerable: !0, get: function get() {
                  return this[vt][e];
                } });
            }function f() {
              i.call(this);var e = this.registry.delete;this.registry.delete = function (r) {
                var n = e.call(this, r);return t.hasOwnProperty(r) && !t[r].linkRecord && (delete t[r], n = !0), n;
              };var t = {};this[yt] = { lastRegister: void 0, records: t }, this.trace = !1;
            }function d(e, t, r) {
              return e.records[t] = { key: t, registration: r, module: void 0, importerSetters: void 0, loadError: void 0, evalError: void 0, linkRecord: { instantiatePromise: void 0, dependencies: void 0, execute: void 0, executingRequire: !1, moduleObj: void 0, setters: void 0, depsInstantiatePromise: void 0, dependencyInstantiations: void 0 } };
            }function p(e, t, r, n, o) {
              var i = n[t];if (i) return Promise.resolve(i);var a = o.records[t];return a && !a.module ? a.loadError ? Promise.reject(a.loadError) : h(e, a, a.linkRecord, n, o) : e.resolve(t, r).then(function (t) {
                if (i = n[t]) return i;if ((a = o.records[t]) && !a.module || (a = d(o, t, a && a.registration)), a.loadError) return Promise.reject(a.loadError);var r = a.linkRecord;return r ? h(e, a, r, n, o) : a;
              });
            }function g(e, t, r) {
              return function () {
                var e = r.lastRegister;return e ? (r.lastRegister = void 0, t.registration = e, !0) : !!t.registration;
              };
            }function h(e, r, n, o, i) {
              return n.instantiatePromise || (n.instantiatePromise = (r.registration ? Promise.resolve() : Promise.resolve().then(function () {
                return i.lastRegister = void 0, e[bt](r.key, e[bt].length > 1 && g(e, r, i));
              })).then(function (t) {
                if (void 0 !== t) {
                  if (!(t instanceof l)) throw new TypeError("Instantiate did not return a valid Module object.");return delete i.records[r.key], e.trace && v(e, r, n), o[r.key] = t;
                }var a = r.registration;if (r.registration = void 0, !a) throw new TypeError("Module instantiation did not call an anonymous or correctly named System.register.");return n.dependencies = a[0], r.importerSetters = [], n.moduleObj = {}, a[2] ? (n.moduleObj.default = n.moduleObj.__useDefault = {}, n.executingRequire = a[1], n.execute = a[2]) : y(e, r, n, a[1]), r;
              }).catch(function (e) {
                throw r.linkRecord = void 0, r.loadError = r.loadError || t(e, "Instantiating " + r.key);
              }));
            }function m(e, t, r, n, o, i) {
              return e.resolve(t, r).then(function (r) {
                i && (i[t] = r);var a = o.records[r],
                    s = n[r];if (s && (!a || a.module && s !== a.module)) return s;if (a && a.loadError) throw a.loadError;(!a || !s && a.module) && (a = d(o, r, a && a.registration));var u = a.linkRecord;return u ? h(e, a, u, n, o) : a;
              });
            }function v(e, t, r) {
              e.loads = e.loads || {}, e.loads[t.key] = { key: t.key, deps: r.dependencies, dynamicDeps: [], depMap: r.depMap || {} };
            }function y(e, t, r, n) {
              var o = r.moduleObj,
                  i = t.importerSetters,
                  a = !1,
                  s = n.call(st, function (e, t) {
                if ("object" == (typeof e === "undefined" ? "undefined" : _typeof(e))) {
                  var r = !1;for (var n in e) {
                    t = e[n], "__useDefault" === n || n in o && o[n] === t || (r = !0, o[n] = t);
                  }if (!1 === r) return t;
                } else {
                  if ((a || e in o) && o[e] === t) return t;o[e] = t;
                }for (var s = 0; s < i.length; s++) {
                  i[s](o);
                }return t;
              }, new x(e, t.key));r.setters = s.setters, r.execute = s.execute, s.exports && (r.moduleObj = o = s.exports, a = !0);
            }function b(e, r, n, o, i) {
              if (n.depsInstantiatePromise) return n.depsInstantiatePromise;for (var a = Array(n.dependencies.length), s = 0; s < n.dependencies.length; s++) {
                a[s] = m(e, n.dependencies[s], r.key, o, i, e.trace && n.depMap || (n.depMap = {}));
              }var u = Promise.all(a).then(function (e) {
                if (n.dependencyInstantiations = e, n.setters) for (var t = 0; t < e.length; t++) {
                  var o = n.setters[t];if (o) {
                    var i = e[t];if (i instanceof l) o(i);else {
                      if (i.loadError) throw i.loadError;o(i.module || i.linkRecord.moduleObj), i.importerSetters && i.importerSetters.push(o);
                    }
                  }
                }return r;
              });return e.trace && (u = u.then(function () {
                return v(e, r, n), r;
              })), (u = u.catch(function (e) {
                throw n.depsInstantiatePromise = void 0, t(e, "Loading " + r.key);
              })).catch(function () {}), n.depsInstantiatePromise = u;
            }function w(e, t, r, n, o) {
              return new Promise(function (r, i) {
                function a(t) {
                  var r = t.linkRecord;r && -1 === u.indexOf(t) && (u.push(t), c++, b(e, t, r, n, o).then(s, i));
                }function s(e) {
                  c--;var t = e.linkRecord;if (t) for (var n = 0; n < t.dependencies.length; n++) {
                    var o = t.dependencyInstantiations[n];o instanceof l || a(o);
                  }0 === c && r();
                }var u = [],
                    c = 0;a(t);
              });
            }function x(e, t) {
              this.loader = e, this.key = this.id = t, this.meta = { url: t };
            }function k(e, t, r, n, o, i) {
              if (t.module) return t.module;if (t.evalError) throw t.evalError;if (i && -1 !== i.indexOf(t)) return t.linkRecord.moduleObj;var a = O(e, t, r, n, o, r.setters ? [] : i || []);if (a) throw a;return t.module;
            }function E(e, t, r, n, o, i, a) {
              return function (s) {
                for (var u = 0; u < r.length; u++) {
                  if (r[u] === s) {
                    var c,
                        f = n[u];return c = f instanceof l ? f : k(e, f, f.linkRecord, o, i, a), "__useDefault" in c ? c.__useDefault : c;
                  }
                }throw new Error("Module " + s + " not declared as a System.registerDynamic dependency of " + t);
              };
            }function O(e, r, n, o, i, a) {
              a.push(r);var s;if (n.setters) for (var u, c, f = 0; f < n.dependencies.length; f++) {
                if (!((u = n.dependencyInstantiations[f]) instanceof l) && ((c = u.linkRecord) && -1 === a.indexOf(u) && (s = u.evalError ? u.evalError : O(e, u, c, o, i, c.setters ? a : [])), s)) return r.linkRecord = void 0, r.evalError = t(s, "Evaluating " + r.key), r.evalError;
              }if (n.execute) if (n.setters) s = S(n.execute);else {
                var d = { id: r.key },
                    p = n.moduleObj;Object.defineProperty(d, "exports", { configurable: !0, set: function set(e) {
                    p.default = p.__useDefault = e;
                  }, get: function get() {
                    return p.__useDefault;
                  } });var g = E(e, r.key, n.dependencies, n.dependencyInstantiations, o, i, a);if (!n.executingRequire) for (f = 0; f < n.dependencies.length; f++) {
                  g(n.dependencies[f]);
                }s = j(n.execute, g, p.default, d), d.exports !== p.__useDefault && (p.default = p.__useDefault = d.exports);var h = p.default;if (h && h.__esModule) for (var m in h) {
                  Object.hasOwnProperty.call(h, m) && (p[m] = h[m]);
                }
              }if (r.linkRecord = void 0, s) return r.evalError = t(s, "Evaluating " + r.key);if (o[r.key] = r.module = new l(n.moduleObj), !n.setters) {
                if (r.importerSetters) for (f = 0; f < r.importerSetters.length; f++) {
                  r.importerSetters[f](r.module);
                }r.importerSetters = void 0;
              }
            }function S(e) {
              try {
                e.call(wt);
              } catch (e) {
                return e;
              }
            }function j(e, t, r, n) {
              try {
                var o = e.call(st, t, r, n);void 0 !== o && (n.exports = o);
              } catch (e) {
                return e;
              }
            }function _() {}function P(e) {
              return e instanceof l ? e : new l(e && e.__esModule ? e : { default: e, __useDefault: e });
            }function M(e) {
              return void 0 === xt && (xt = "undefined" != typeof Symbol && !!Symbol.toStringTag), e instanceof l || xt && "[object Module]" == Object.prototype.toString.call(e);
            }function R(e, t) {
              (t || this.warnings && "undefined" != typeof console && console.warn) && console.warn(e);
            }function C(e, t, r) {
              var n = new Uint8Array(t);return 0 === n[0] && 97 === n[1] && 115 === n[2] ? WebAssembly.compile(t).then(function (t) {
                var n = [],
                    o = [],
                    i = {};return WebAssembly.Module.imports && WebAssembly.Module.imports(t).forEach(function (e) {
                  var t = e.module;o.push(function (e) {
                    i[t] = e;
                  }), -1 === n.indexOf(t) && n.push(t);
                }), e.register(n, function (e) {
                  return { setters: o, execute: function execute() {
                      e(new WebAssembly.Instance(t, i).exports);
                    } };
                }), r(), !0;
              }) : Promise.resolve(!1);
            }function L(e, t) {
              if ("." === e[0]) throw new Error("Node module " + e + " can't be loaded as it is not a package require.");if (!kt) {
                var r = this._nodeRequire("module"),
                    n = decodeURI(t.substr(at ? 8 : 7));(kt = new r(n)).paths = r._nodeModulePaths(n);
              }return kt.require(e);
            }function A(e, t) {
              for (var r in t) {
                Object.hasOwnProperty.call(t, r) && (e[r] = t[r]);
              }return e;
            }function I(e, t) {
              for (var r in t) {
                Object.hasOwnProperty.call(t, r) && void 0 === e[r] && (e[r] = t[r]);
              }return e;
            }function F(e, t, r) {
              for (var n in t) {
                if (Object.hasOwnProperty.call(t, n)) {
                  var o = t[n];void 0 === e[n] ? e[n] = o : o instanceof Array && e[n] instanceof Array ? e[n] = [].concat(r ? o : e[n]).concat(r ? e[n] : o) : "object" == (typeof o === "undefined" ? "undefined" : _typeof(o)) && null !== o && "object" == _typeof(e[n]) ? e[n] = (r ? I : A)(A({}, e[n]), o) : r || (e[n] = o);
                }
              }
            }function K(e) {
              if (Pt || Mt) {
                var t = document.createElement("link");Pt ? (t.rel = "preload", t.as = "script") : t.rel = "prefetch", t.href = e, document.head.appendChild(t);
              } else new Image().src = e;
            }function D(e, t, r) {
              try {
                importScripts(e);
              } catch (e) {
                r(e);
              }t();
            }function U(e, t, r, n, o) {
              function i() {
                n(), s();
              }function a(t) {
                s(), o(new Error("Fetching " + e));
              }function s() {
                for (var e = 0; e < Rt.length; e++) {
                  if (Rt[e].err === a) {
                    Rt.splice(e, 1);break;
                  }
                }u.removeEventListener("load", i, !1), u.removeEventListener("error", a, !1), document.head.removeChild(u);
              }if (e = e.replace(/#/g, "%23"), _t) return D(e, n, o);var u = document.createElement("script");u.type = "text/javascript", u.charset = "utf-8", u.async = !0, t && (u.crossOrigin = t), r && (u.integrity = r), u.addEventListener("load", i, !1), u.addEventListener("error", a, !1), u.src = e, document.head.appendChild(u);
            }function q(e, t) {
              for (var r = e.split("."); r.length;) {
                t = t[r.shift()];
              }return t;
            }function T(e, t, r) {
              var o = N(t, r);if (o) {
                var i = t[o] + r.substr(o.length),
                    a = n(i, nt);return void 0 !== a ? a : e + i;
              }return -1 !== r.indexOf(":") ? r : e + r;
            }function z(e) {
              var t = this.name;if (t.substr(0, e.length) === e && (t.length === e.length || "/" === t[e.length] || "/" === e[e.length - 1] || ":" === e[e.length - 1])) {
                var r = e.split("/").length;r > this.len && (this.match = e, this.len = r);
              }
            }function N(e, t) {
              if (Object.hasOwnProperty.call(e, t)) return t;var r = { name: t, match: void 0, len: 0 };return Object.keys(e).forEach(z, r), r.match;
            }function J(e, t, r, n) {
              if ("file:///" === e.substr(0, 8)) {
                if (Ft) return $(e, t, r, n);throw new Error("Unable to fetch file URLs in this environment.");
              }e = e.replace(/#/g, "%23");var o = { headers: { Accept: "application/x-es-module, */*" } };return r && (o.integrity = r), t && ("string" == typeof t && (o.headers.Authorization = t), o.credentials = "include"), fetch(e, o).then(function (e) {
                if (e.ok) return n ? e.arrayBuffer() : e.text();throw new Error("Fetch error: " + e.status + " " + e.statusText);
              });
            }function $(e, t, r, n) {
              return new Promise(function (r, o) {
                function i() {
                  r(n ? s.response : s.responseText);
                }function a() {
                  o(new Error("XHR error: " + (s.status ? " (" + s.status + (s.statusText ? " " + s.statusText : "") + ")" : "") + " loading " + e));
                }e = e.replace(/#/g, "%23");var s = new XMLHttpRequest();n && (s.responseType = "arraybuffer"), s.onreadystatechange = function () {
                  4 === s.readyState && (0 == s.status ? s.response ? i() : (s.addEventListener("error", a), s.addEventListener("load", i)) : 200 === s.status ? i() : a());
                }, s.open("GET", e, !0), s.setRequestHeader && (s.setRequestHeader("Accept", "application/x-es-module, */*"), t && ("string" == typeof t && s.setRequestHeader("Authorization", t), s.withCredentials = !0)), s.send(null);
              });
            }function B(e, t, r, n) {
              return "file:///" != e.substr(0, 8) ? Promise.reject(new Error('Unable to fetch "' + e + '". Only file URLs of the form file:/// supported running in Node.')) : (Lt = Lt || require("fs"), e = at ? e.replace(/\//g, "\\").substr(8) : e.substr(7), new Promise(function (t, r) {
                Lt.readFile(e, function (e, o) {
                  if (e) return r(e);if (n) t(o);else {
                    var i = o + "";"\uFEFF" === i[0] && (i = i.substr(1)), t(i);
                  }
                });
              }));
            }function W() {
              throw new Error("No fetch method is defined for this environment.");
            }function G() {
              return { pluginKey: void 0, pluginArgument: void 0, pluginModule: void 0, packageKey: void 0, packageConfig: void 0, load: void 0 };
            }function H(e, t, r) {
              var n = G();if (r) {
                var o;t.pluginFirst ? -1 !== (o = r.lastIndexOf("!")) && (n.pluginArgument = n.pluginKey = r.substr(0, o)) : -1 !== (o = r.indexOf("!")) && (n.pluginArgument = n.pluginKey = r.substr(o + 1)), n.packageKey = N(t.packages, r), n.packageKey && (n.packageConfig = t.packages[n.packageKey]);
              }return n;
            }function Z(e, t) {
              var r = this[St],
                  n = G(),
                  o = H(this, r, t),
                  i = this;return Promise.resolve().then(function () {
                var r = e.lastIndexOf("#?");if (-1 === r) return Promise.resolve(e);var n = he.call(i, e.substr(r + 2));return me.call(i, n, t, !0).then(function (t) {
                  return t ? e.substr(0, r) : "@empty";
                });
              }).then(function (e) {
                var a = ne(r.pluginFirst, e);return a ? (n.pluginKey = a.plugin, Promise.all([ee.call(i, r, a.argument, o && o.pluginArgument || t, n, o, !0), i.resolve(a.plugin, t)]).then(function (e) {
                  if (n.pluginArgument = e[0], n.pluginKey = e[1], n.pluginArgument === n.pluginKey) throw new Error("Plugin " + n.pluginArgument + " cannot load itself, make sure it is excluded from any wildcard meta configuration via a custom loader: false rule.");return oe(r.pluginFirst, e[0], e[1]);
                })) : ee.call(i, r, e, o && o.pluginArgument || t, n, o, !1);
              }).then(function (e) {
                return ve.call(i, e, t, o);
              }).then(function (e) {
                return re.call(i, r, e, n), n.pluginKey || !n.load.loader ? e : i.resolve(n.load.loader, e).then(function (t) {
                  return n.pluginKey = t, n.pluginArgument = e, e;
                });
              }).then(function (e) {
                return i[jt][e] = n, e;
              });
            }function X(e, t) {
              var r = ne(e.pluginFirst, t);if (r) {
                var n = X.call(this, e, r.plugin);return oe(e.pluginFirst, Q.call(this, e, r.argument, void 0, !1, !1), n);
              }return Q.call(this, e, t, void 0, !1, !1);
            }function Y(e, t) {
              var r = this[St],
                  n = G(),
                  o = o || H(this, r, t),
                  i = ne(r.pluginFirst, e);return i ? (n.pluginKey = Y.call(this, i.plugin, t), oe(r.pluginFirst, V.call(this, r, i.argument, o.pluginArgument || t, n, o, !!n.pluginKey), n.pluginKey)) : V.call(this, r, e, o.pluginArgument || t, n, o, !!n.pluginKey);
            }function Q(e, t, r, o, i) {
              var a = n(t, r || nt);if (a) return T(e.baseURL, e.paths, a);if (o) {
                var s = N(e.map, t);if (s && (t = e.map[s] + t.substr(s.length), a = n(t, nt))) return T(e.baseURL, e.paths, a);
              }if (this.registry.has(t)) return t;if ("@node/" === t.substr(0, 6)) return t;var u = i && "/" !== t[t.length - 1],
                  l = T(e.baseURL, e.paths, u ? t + "/" : t);return u ? l.substr(0, l.length - 1) : l;
            }function V(e, t, r, n, o, i) {
              if (o && o.packageConfig && "." !== t[0]) {
                var a = o.packageConfig.map,
                    s = a && N(a, t);if (s && "string" == typeof a[s]) {
                  var u = ue(this, e, o.packageConfig, o.packageKey, s, t, n, i);if (u) return u;
                }
              }var l = Q.call(this, e, t, r, !0, !0),
                  c = de(e, l);if (n.packageKey = c && c.packageKey || N(e.packages, l), !n.packageKey) return l;if (-1 !== e.packageConfigKeys.indexOf(l)) return n.packageKey = void 0, l;n.packageConfig = e.packages[n.packageKey] || (e.packages[n.packageKey] = Ee());var f = l.substr(n.packageKey.length + 1);return ae(this, e, n.packageConfig, n.packageKey, f, n, i);
            }function ee(e, t, r, n, o, i) {
              var a = this;return Et.then(function () {
                if (o && o.packageConfig && "./" !== t.substr(0, 2)) {
                  var r = o.packageConfig.map,
                      s = r && N(r, t);if (s) return ce(a, e, o.packageConfig, o.packageKey, s, t, n, i);
                }return Et;
              }).then(function (o) {
                if (o) return o;var s = Q.call(a, e, t, r, !0, !0),
                    u = de(e, s);return n.packageKey = u && u.packageKey || N(e.packages, s), n.packageKey ? -1 !== e.packageConfigKeys.indexOf(s) ? (n.packageKey = void 0, n.load = te(), n.load.format = "json", n.load.loader = "", Promise.resolve(s)) : (n.packageConfig = e.packages[n.packageKey] || (e.packages[n.packageKey] = Ee()), (u && !n.packageConfig.configured ? pe(a, e, u.configPath, n) : Et).then(function () {
                  var t = s.substr(n.packageKey.length + 1);return le(a, e, n.packageConfig, n.packageKey, t, n, i);
                })) : Promise.resolve(s);
              });
            }function te() {
              return { extension: "", deps: void 0, format: void 0, loader: void 0, scriptLoad: void 0, globals: void 0, nonce: void 0, integrity: void 0, sourceMap: void 0, exports: void 0, encapsulateGlobal: !1, crossOrigin: void 0, cjsRequireDetection: !0, cjsDeferDepsExecute: !1, esModule: !1 };
            }function re(e, t, r) {
              r.load = r.load || te();var n,
                  o = 0;for (var i in e.meta) {
                if (-1 !== (n = i.indexOf("*")) && i.substr(0, n) === t.substr(0, n) && i.substr(n + 1) === t.substr(t.length - i.length + n + 1)) {
                  var a = i.split("/").length;a > o && (o = a), F(r.load, e.meta[i], o !== a);
                }
              }if (e.meta[t] && F(r.load, e.meta[t], !1), r.packageKey) {
                var s = t.substr(r.packageKey.length + 1),
                    u = {};if (r.packageConfig.meta) {
                  o = 0;ge(r.packageConfig.meta, s, function (e, t, r) {
                    r > o && (o = r), F(u, t, r && o > r);
                  }), F(r.load, u, !1);
                }!r.packageConfig.format || r.pluginKey || r.load.loader || (r.load.format = r.load.format || r.packageConfig.format);
              }
            }function ne(e, t) {
              var r,
                  n,
                  o = e ? t.indexOf("!") : t.lastIndexOf("!");if (-1 !== o) return e ? (r = t.substr(o + 1), n = t.substr(0, o)) : (r = t.substr(0, o), n = t.substr(o + 1) || r.substr(r.lastIndexOf(".") + 1)), { argument: r, plugin: n };
            }function oe(e, t, r) {
              return e ? r + "!" + t : t + "!" + r;
            }function ie(e, t, r, n, o) {
              if (!n || !t.defaultExtension || "/" === n[n.length - 1] || o) return n;var i = !1;if (t.meta && ge(t.meta, n, function (e, t, r) {
                if (0 === r || e.lastIndexOf("*") !== e.length - 1) return i = !0;
              }), !i && e.meta && ge(e.meta, r + "/" + n, function (e, t, r) {
                if (0 === r || e.lastIndexOf("*") !== e.length - 1) return i = !0;
              }), i) return n;var a = "." + t.defaultExtension;return n.substr(n.length - a.length) !== a ? n + a : n;
            }function ae(e, t, r, n, o, i, a) {
              if (!o) {
                if (!r.main) return n;o = "./" === r.main.substr(0, 2) ? r.main.substr(2) : r.main;
              }if (r.map) {
                var s = "./" + o,
                    u = N(r.map, s);if (u || (s = "./" + ie(t, r, n, o, a)) !== "./" + o && (u = N(r.map, s)), u) {
                  var l = ue(e, t, r, n, u, s, i, a);if (l) return l;
                }
              }return n + "/" + ie(t, r, n, o, a);
            }function se(e, t, r) {
              return !(t.substr(0, e.length) === e && r.length > e.length);
            }function ue(e, t, r, n, o, i, a, s) {
              "/" === i[i.length - 1] && (i = i.substr(0, i.length - 1));var u = r.map[o];if ("object" == (typeof u === "undefined" ? "undefined" : _typeof(u))) throw new Error("Synchronous conditional normalization not supported sync normalizing " + o + " in " + n);if (se(o, u, i) && "string" == typeof u) return V.call(e, t, u + i.substr(o.length), n + "/", a, a, s);
            }function le(e, t, r, n, o, i, a) {
              if (!o) {
                if (!r.main) return Promise.resolve(n);o = "./" === r.main.substr(0, 2) ? r.main.substr(2) : r.main;
              }var s, u;return r.map && (s = "./" + o, (u = N(r.map, s)) || (s = "./" + ie(t, r, n, o, a)) !== "./" + o && (u = N(r.map, s))), (u ? ce(e, t, r, n, u, s, i, a) : Et).then(function (e) {
                return e ? Promise.resolve(e) : Promise.resolve(n + "/" + ie(t, r, n, o, a));
              });
            }function ce(e, t, r, n, o, i, a, s) {
              "/" === i[i.length - 1] && (i = i.substr(0, i.length - 1));var u = r.map[o];if ("string" == typeof u) return se(o, u, i) ? ee.call(e, t, u + i.substr(o.length), n + "/", a, a, s).then(function (t) {
                return ve.call(e, t, n + "/", a);
              }) : Et;var l = [],
                  c = [];for (var d in u) {
                var p = he(d);c.push({ condition: p, map: u[d] }), l.push(f.prototype.import.call(e, p.module, n));
              }return Promise.all(l).then(function (e) {
                for (var t = 0; t < c.length; t++) {
                  var r = c[t].condition,
                      n = q(r.prop, "__useDefault" in e[t] ? e[t].__useDefault : e[t]);if (!r.negate && n || r.negate && !n) return c[t].map;
                }
              }).then(function (r) {
                if (r) return se(o, r, i) ? ee.call(e, t, r + i.substr(o.length), n + "/", a, a, s).then(function (t) {
                  return ve.call(e, t, n + "/", a);
                }) : Et;
              });
            }function fe(e) {
              var t = e.lastIndexOf("*"),
                  r = Math.max(t + 1, e.lastIndexOf("/"));return { length: r, regEx: new RegExp("^(" + e.substr(0, r).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^\\/]+") + ")(\\/|$)"), wildcard: -1 !== t };
            }function de(e, t) {
              for (var r, n, o = !1, i = 0; i < e.packageConfigPaths.length; i++) {
                var a = e.packageConfigPaths[i],
                    s = Dt[a] || (Dt[a] = fe(a));if (!(t.length < s.length)) {
                  var u = t.match(s.regEx);!u || r && (o && s.wildcard || !(r.length < u[1].length)) || (r = u[1], o = !s.wildcard, n = r + a.substr(s.length));
                }
              }if (r) return { packageKey: r, configPath: n };
            }function pe(e, r, n, o, i) {
              var a = e.pluginLoader || e;return -1 === r.packageConfigKeys.indexOf(n) && r.packageConfigKeys.push(n), a.import(n).then(function (e) {
                Oe(o.packageConfig, e, o.packageKey, !0, r), o.packageConfig.configured = !0;
              }).catch(function (e) {
                throw t(e, "Unable to fetch package configuration file " + n);
              });
            }function ge(e, t, r) {
              var n;for (var o in e) {
                var i = "./" === o.substr(0, 2) ? "./" : "";if (i && (o = o.substr(2)), -1 !== (n = o.indexOf("*")) && o.substr(0, n) === t.substr(0, n) && o.substr(n + 1) === t.substr(t.length - o.length + n + 1) && r(o, e[i + o], o.split("/").length)) return;
              }var a = e[t] && Object.hasOwnProperty.call(e, t) ? e[t] : e["./" + t];a && r(a, a, 0);
            }function he(e) {
              var t,
                  r,
                  n,
                  o = e.lastIndexOf("|");return -1 !== o ? (t = e.substr(o + 1), r = e.substr(0, o), "~" === t[0] && (n = !0, t = t.substr(1))) : (n = "~" === e[0], t = "default", r = e.substr(n), -1 !== Ut.indexOf(r) && (t = r, r = null)), { module: r || "@system-env", prop: t, negate: n };
            }function me(e, t, r) {
              return f.prototype.import.call(this, e.module, t).then(function (t) {
                var n = q(e.prop, t);if (r && "boolean" != typeof n) throw new TypeError("Condition did not resolve to a boolean.");return e.negate ? !n : n;
              });
            }function ve(e, t, r) {
              var n = e.match(qt);if (!n) return Promise.resolve(e);var o = he.call(this, n[0].substr(2, n[0].length - 3));return me.call(this, o, t, !1).then(function (r) {
                if ("string" != typeof r) throw new TypeError("The condition value for " + e + " doesn't resolve to a string.");if (-1 !== r.indexOf("/")) throw new TypeError("Unabled to interpolate conditional " + e + (t ? " in " + t : "") + "\n\tThe condition value " + r + ' cannot contain a "/" separator.');return e.replace(qt, r);
              });
            }function ye(e, t, r) {
              for (var n = 0; n < Tt.length; n++) {
                var o = Tt[n];t[o] && Er[o.substr(0, o.length - 6)] && r(t[o]);
              }
            }function be(e, t) {
              var r = {};for (var n in e) {
                var o = e[n];t > 1 ? o instanceof Array ? r[n] = [].concat(o) : "object" == (typeof o === "undefined" ? "undefined" : _typeof(o)) ? r[n] = be(o, t - 1) : "packageConfig" !== n && (r[n] = o) : r[n] = o;
              }return r;
            }function we(e, t) {
              var r = e[t];return r instanceof Array ? e[t].concat([]) : "object" == (typeof r === "undefined" ? "undefined" : _typeof(r)) ? be(r, 3) : e[t];
            }function xe(e) {
              if (e) {
                if (-1 !== Or.indexOf(e)) return we(this[St], e);throw new Error('"' + e + '" is not a valid configuration name. Must be one of ' + Or.join(", ") + ".");
              }for (var t = {}, r = 0; r < Or.length; r++) {
                var n = Or[r],
                    o = we(this[St], n);void 0 !== o && (t[n] = o);
              }return t;
            }function ke(e, t) {
              var r = this,
                  o = this[St];if ("warnings" in e && (o.warnings = e.warnings), "wasm" in e && (o.wasm = "undefined" != typeof WebAssembly && e.wasm), ("production" in e || "build" in e) && tt.call(r, !!e.production, !!(e.build || Er && Er.build)), !t) {
                var i;ye(r, e, function (e) {
                  i = i || e.baseURL;
                }), (i = i || e.baseURL) && (o.baseURL = n(i, nt) || n("./" + i, nt), "/" !== o.baseURL[o.baseURL.length - 1] && (o.baseURL += "/")), e.paths && A(o.paths, e.paths), ye(r, e, function (e) {
                  e.paths && A(o.paths, e.paths);
                });for (var a in o.paths) {
                  -1 !== o.paths[a].indexOf("*") && (R.call(o, "Path config " + a + " -> " + o.paths[a] + " is no longer supported as wildcards are deprecated."), delete o.paths[a]);
                }
              }if (e.defaultJSExtensions && R.call(o, "The defaultJSExtensions configuration option is deprecated.\n  Use packages defaultExtension instead.", !0), "boolean" == typeof e.pluginFirst && (o.pluginFirst = e.pluginFirst), e.map) for (var a in e.map) {
                var s = e.map[a];if ("string" == typeof s) {
                  var u = Q.call(r, o, s, void 0, !1, !1);"/" === u[u.length - 1] && ":" !== a[a.length - 1] && "/" !== a[a.length - 1] && (u = u.substr(0, u.length - 1)), o.map[a] = u;
                } else {
                  m = (m = Q.call(r, o, "/" !== a[a.length - 1] ? a + "/" : a, void 0, !0, !0)).substr(0, m.length - 1);var l = o.packages[m];l || ((l = o.packages[m] = Ee()).defaultExtension = ""), Oe(l, { map: s }, m, !1, o);
                }
              }if (e.packageConfigPaths) {
                for (var c = [], f = 0; f < e.packageConfigPaths.length; f++) {
                  var d = e.packageConfigPaths[f],
                      p = Math.max(d.lastIndexOf("*") + 1, d.lastIndexOf("/")),
                      g = Q.call(r, o, d.substr(0, p), void 0, !1, !1);c[f] = g + d.substr(p);
                }o.packageConfigPaths = c;
              }if (e.bundles) for (var a in e.bundles) {
                for (var h = [], f = 0; f < e.bundles[a].length; f++) {
                  h.push(r.normalizeSync(e.bundles[a][f]));
                }o.bundles[a] = h;
              }if (e.packages) for (var a in e.packages) {
                if (a.match(/^([^\/]+:)?\/\/$/)) throw new TypeError('"' + a + '" is not a valid package name.');var m = Q.call(r, o, "/" !== a[a.length - 1] ? a + "/" : a, void 0, !0, !0);m = m.substr(0, m.length - 1), Oe(o.packages[m] = o.packages[m] || Ee(), e.packages[a], m, !1, o);
              }if (e.depCache) for (var a in e.depCache) {
                o.depCache[r.normalizeSync(a)] = [].concat(e.depCache[a]);
              }if (e.meta) for (var a in e.meta) {
                if ("*" === a[0]) A(o.meta[a] = o.meta[a] || {}, e.meta[a]);else {
                  var v = Q.call(r, o, a, void 0, !0, !0);A(o.meta[v] = o.meta[v] || {}, e.meta[a]);
                }
              }"transpiler" in e && (o.transpiler = e.transpiler);for (var y in e) {
                -1 === Or.indexOf(y) && -1 === Tt.indexOf(y) && (r[y] = e[y]);
              }ye(r, e, function (e) {
                r.config(e, !0);
              });
            }function Ee() {
              return { defaultExtension: void 0, main: void 0, format: void 0, meta: void 0, map: void 0, packageConfig: void 0, configured: !1 };
            }function Oe(e, t, r, n, o) {
              for (var i in t) {
                "main" === i || "format" === i || "defaultExtension" === i || "configured" === i ? n && void 0 !== e[i] || (e[i] = t[i]) : "map" === i ? (n ? I : A)(e.map = e.map || {}, t.map) : "meta" === i ? (n ? I : A)(e.meta = e.meta || {}, t.meta) : Object.hasOwnProperty.call(t, i) && R.call(o, '"' + i + '" is not a valid package configuration option in package ' + r);
              }return void 0 === e.defaultExtension && (e.defaultExtension = "js"), void 0 === e.main && e.map && e.map["."] ? (e.main = e.map["."], delete e.map["."]) : "object" == _typeof(e.main) && (e.map = e.map || {}, e.map["./@main"] = e.main, e.main.default = e.main.default || "./", e.main = "@main"), e;
            }function Se(e) {
              return zt ? Wt + new Buffer(e).toString("base64") : "undefined" != typeof btoa ? Wt + btoa(unescape(encodeURIComponent(e))) : "";
            }function je(e, t, r, n) {
              var o = e.lastIndexOf("\n");if (t) {
                if ("object" != (typeof t === "undefined" ? "undefined" : _typeof(t))) throw new TypeError("load.metadata.sourceMap must be set to an object.");t = JSON.stringify(t);
              }return (n ? "(function(System, SystemJS) {" : "") + e + (n ? "\n})(System, System);" : "") + ("\n//# sourceURL=" != e.substr(o, 15) ? "\n//# sourceURL=" + r + (t ? "!transpiled" : "") : "") + (t && Se(t) || "");
            }function _e(e, t, r, n, o) {
              Nt || (Nt = document.head || document.body || document.documentElement);var i = document.createElement("script");i.text = je(t, r, n, !1);var a,
                  s = window.onerror;if (window.onerror = function (e) {
                a = addToError(e, "Evaluating " + n), s && s.apply(this, arguments);
              }, Pe(e), o && i.setAttribute("nonce", o), Nt.appendChild(i), Nt.removeChild(i), Me(), window.onerror = s, a) return a;
            }function Pe(e) {
              0 == Gt++ && (Bt = st.System), st.System = st.SystemJS = e;
            }function Me() {
              0 == --Gt && (st.System = st.SystemJS = Bt);
            }function Re(e, t, r, n, o, i, a) {
              if (t) {
                if (i && Ht) return _e(e, t, r, n, i);try {
                  Pe(e), !Jt && e._nodeRequire && (Jt = e._nodeRequire("vm"), $t = Jt.runInThisContext("typeof System !== 'undefined' && System") === e), $t ? Jt.runInThisContext(je(t, r, n, !a), { filename: n + (r ? "!transpiled" : "") }) : (0, eval)(je(t, r, n, !a)), Me();
                } catch (e) {
                  return Me(), e;
                }
              }
            }function Ce(e) {
              return "file:///" === e.substr(0, 8) ? e.substr(7 + !!at) : Zt && e.substr(0, Zt.length) === Zt ? e.substr(Zt.length) : e;
            }function Le(e, t) {
              return Ce(this.normalizeSync(e, t));
            }function Ae(e) {
              var t,
                  r = e.lastIndexOf("!"),
                  n = (t = -1 !== r ? e.substr(0, r) : e).split("/");return n.pop(), n = n.join("/"), { filename: Ce(t), dirname: Ce(n) };
            }function Ie(e) {
              function t(e, t) {
                for (var r = 0; r < e.length; r++) {
                  if (e[r][0] < t.index && e[r][1] > t.index) return !0;
                }return !1;
              }It.lastIndex = tr.lastIndex = rr.lastIndex = 0;var r,
                  n = [],
                  o = [],
                  i = [];if (e.length / e.split("\n").length < 200) {
                for (; r = rr.exec(e);) {
                  o.push([r.index, r.index + r[0].length]);
                }for (; r = tr.exec(e);) {
                  t(o, r) || i.push([r.index + r[1].length, r.index + r[0].length - 1]);
                }
              }for (; r = It.exec(e);) {
                if (!t(o, r) && !t(i, r)) {
                  var a = r[1].substr(1, r[1].length - 2);if (a.match(/"|'/)) continue;n.push(a);
                }
              }return n;
            }function Fe(e) {
              if (-1 === nr.indexOf(e)) {
                try {
                  var t = st[e];
                } catch (t) {
                  nr.push(e);
                }this(e, t);
              }
            }function Ke(e) {
              if ("string" == typeof e) return q(e, st);if (!(e instanceof Array)) throw new Error("Global exports must be a string or array.");for (var t = {}, r = 0; r < e.length; r++) {
                t[e[r].split(".").pop()] = q(e[r], st);
              }return t;
            }function De(e, t, r, n) {
              var o = st.define;st.define = void 0;var i;if (r) {
                i = {};for (var a in r) {
                  i[a] = st[a], st[a] = r[a];
                }
              }return t || (Yt = {}, Object.keys(st).forEach(Fe, function (e, t) {
                Yt[e] = t;
              })), function () {
                var e,
                    r = t ? Ke(t) : {},
                    a = !!t;if (t && !n || Object.keys(st).forEach(Fe, function (o, i) {
                  Yt[o] !== i && void 0 !== i && (n && (st[o] = void 0), t || (r[o] = i, void 0 !== e ? a || e === i || (a = !0) : e = i));
                }), r = a ? r : e, i) for (var s in i) {
                  st[s] = i[s];
                }return st.define = o, r;
              };
            }function Ue(e, t) {
              var r = ((e = e.replace(tr, "")).match(ar)[1].split(",")[t] || "require").replace(sr, ""),
                  n = ur[r] || (ur[r] = new RegExp(or + r + ir, "g"));n.lastIndex = 0;for (var o, i = []; o = n.exec(e);) {
                i.push(o[2] || o[3]);
              }return i;
            }function qe(e) {
              return function (t, r, n) {
                e(t, r, n), "object" != _typeof(r = n.exports) && "function" != typeof r || "__esModule" in r || Object.defineProperty(n.exports, "__esModule", { value: !0 });
              };
            }function Te(e, t) {
              Vt = e, cr = t, Qt = void 0, lr = !1;
            }function ze(e) {
              Qt ? e.registerDynamic(Vt ? Qt[0].concat(Vt) : Qt[0], !1, cr ? qe(Qt[1]) : Qt[1]) : lr && e.registerDynamic([], !1, _);
            }function Ne(e, t) {
              !e.load.esModule || "object" != (typeof t === "undefined" ? "undefined" : _typeof(t)) && "function" != typeof t || "__esModule" in t || Object.defineProperty(t, "__esModule", { value: !0 });
            }function Je(e, t) {
              var r = this,
                  n = this[St];return (Be(n, this, e) || Et).then(function () {
                if (!t()) {
                  var o = r[jt][e];if ("@node/" === e.substr(0, 6)) {
                    if (!r._nodeRequire) throw new TypeError("Error loading " + e + ". Can only load node core modules in Node.");return r.registerDynamic([], !1, function () {
                      return L.call(r, e.substr(6), r.baseURL);
                    }), void t();
                  }return o.load.scriptLoad ? !o.load.pluginKey && fr || (o.load.scriptLoad = !1, R.call(n, 'scriptLoad not supported for "' + e + '"')) : !1 !== o.load.scriptLoad && !o.load.pluginKey && fr && (o.load.deps || o.load.globals || !("system" === o.load.format || "register" === o.load.format || "global" === o.load.format && o.load.exports) || (o.load.scriptLoad = !0)), o.load.scriptLoad ? new Promise(function (n, i) {
                    if ("amd" === o.load.format && st.define !== r.amdDefine) throw new Error("Loading AMD with scriptLoad requires setting the global `" + pr + ".define = SystemJS.amdDefine`");U(e, o.load.crossOrigin, o.load.integrity, function () {
                      if (!t()) {
                        o.load.format = "global";var e = o.load.exports && Ke(o.load.exports);r.registerDynamic([], !1, function () {
                          return Ne(o, e), e;
                        }), t();
                      }n();
                    }, i);
                  }) : $e(r, e, o).then(function () {
                    return We(r, e, o, t, n.wasm);
                  });
                }
              }).then(function (t) {
                return delete r[jt][e], t;
              });
            }function $e(e, t, r) {
              return r.pluginKey ? e.import(r.pluginKey).then(function (e) {
                r.pluginModule = e, r.pluginLoad = { name: t, address: r.pluginArgument, source: void 0, metadata: r.load }, r.load.deps = r.load.deps || [];
              }) : Et;
            }function Be(e, t, r) {
              var n = e.depCache[r];if (n) for (a = 0; a < n.length; a++) {
                t.normalize(n[a], r).then(K);
              } else {
                var o = !1;for (var i in e.bundles) {
                  for (var a = 0; a < e.bundles[i].length; a++) {
                    var s = e.bundles[i][a];if (s === r) {
                      o = !0;break;
                    }if (-1 !== s.indexOf("*")) {
                      var u = s.split("*");if (2 !== u.length) {
                        e.bundles[i].splice(a--, 1);continue;
                      }if (r.substr(0, u[0].length) === u[0] && r.substr(r.length - u[1].length, u[1].length) === u[1]) {
                        o = !0;break;
                      }
                    }
                  }if (o) return t.import(i);
                }
              }
            }function We(e, t, r, n, o) {
              return r.load.exports && !r.load.format && (r.load.format = "global"), Et.then(function () {
                if (r.pluginModule && r.pluginModule.locate) return Promise.resolve(r.pluginModule.locate.call(e, r.pluginLoad)).then(function (e) {
                  e && (r.pluginLoad.address = e);
                });
              }).then(function () {
                return r.pluginModule ? (o = !1, r.pluginModule.fetch ? r.pluginModule.fetch.call(e, r.pluginLoad, function (e) {
                  return Kt(e.address, r.load.authorization, r.load.integrity, !1);
                }) : Kt(r.pluginLoad.address, r.load.authorization, r.load.integrity, !1)) : Kt(t, r.load.authorization, r.load.integrity, o);
              }).then(function (i) {
                return o && "string" != typeof i ? C(e, i, n).then(function (o) {
                  if (!o) {
                    var a = ot ? new TextDecoder("utf-8").decode(new Uint8Array(i)) : i.toString();return Ge(e, t, a, r, n);
                  }
                }) : Ge(e, t, i, r, n);
              });
            }function Ge(e, t, r, n, o) {
              return Promise.resolve(r).then(function (t) {
                return "detect" === n.load.format && (n.load.format = void 0), Ve(t, n), n.pluginModule ? (n.pluginLoad.source = t, n.pluginModule.translate ? Promise.resolve(n.pluginModule.translate.call(e, n.pluginLoad, n.traceOpts)).then(function (e) {
                  if (n.load.sourceMap) {
                    if ("object" != _typeof(n.load.sourceMap)) throw new Error("metadata.load.sourceMap must be set to an object.");Xe(n.pluginLoad.address, n.load.sourceMap);
                  }return "string" == typeof e ? e : n.pluginLoad.source;
                }) : t) : t;
              }).then(function (r) {
                return n.load.format || '"bundle"' !== r.substring(0, 8) ? "register" === n.load.format || !n.load.format && He(r) ? (n.load.format = "register", r) : "esm" === n.load.format || !n.load.format && r.match(gr) ? (n.load.format = "esm", Ye(e, r, t, n, o)) : r : (n.load.format = "system", r);
              }).then(function (t) {
                if ("string" != typeof t || !n.pluginModule || !n.pluginModule.instantiate) return t;var r = !1;return n.pluginLoad.source = t, Promise.resolve(n.pluginModule.instantiate.call(e, n.pluginLoad, function (e) {
                  if (t = e.source, n.load = e.metadata, r) throw new Error("Instantiate must only be called once.");r = !0;
                })).then(function (e) {
                  return r ? t : P(e);
                });
              }).then(function (r) {
                if ("string" != typeof r) return r;n.load.format || (n.load.format = Ze(r));var i = !1;switch (n.load.format) {case "esm":case "register":case "system":
                    if (u = Re(e, r, n.load.sourceMap, t, n.load.integrity, n.load.nonce, !1)) throw u;if (!o()) return Ot;return;case "json":
                    var a = JSON.parse(r);return e.newModule({ default: a, __useDefault: a });case "amd":
                    var s = st.define;st.define = e.amdDefine, Te(n.load.deps, n.load.esModule);var u = Re(e, r, n.load.sourceMap, t, n.load.integrity, n.load.nonce, !1);if ((i = o()) || (ze(e), i = o()), st.define = s, u) throw u;break;case "cjs":
                    var l = n.load.deps,
                        c = (n.load.deps || []).concat(n.load.cjsRequireDetection ? Ie(r) : []);for (var f in n.load.globals) {
                      n.load.globals[f] && c.push(n.load.globals[f]);
                    }e.registerDynamic(c, !0, function (o, i, a) {
                      if (o.resolve = function (t) {
                        return Le.call(e, t, a.id);
                      }, a.paths = [], a.require = o, !n.load.cjsDeferDepsExecute && l) for (var s = 0; s < l.length; s++) {
                        o(l[s]);
                      }var u = Ae(a.id),
                          c = { exports: i, args: [o, i, a, u.filename, u.dirname, st, st] },
                          f = "(function (require, exports, module, __filename, __dirname, global, GLOBAL";if (n.load.globals) for (var d in n.load.globals) {
                        c.args.push(o(n.load.globals[d])), f += ", " + d;
                      }var p = st.define;st.define = void 0, st.__cjsWrapper = c, r = f + ") {" + r.replace(yr, "") + "\n}).apply(__cjsWrapper.exports, __cjsWrapper.args);";var g = Re(e, r, n.load.sourceMap, t, n.load.integrity, n.load.nonce, !1);if (g) throw g;Ne(n, i), st.__cjsWrapper = void 0, st.define = p;
                    }), i = o();break;case "global":
                    c = n.load.deps || [];for (var f in n.load.globals) {
                      var d = n.load.globals[f];d && c.push(d);
                    }e.registerDynamic(c, !1, function (o, i, a) {
                      var s;if (n.load.globals) {
                        s = {};for (var u in n.load.globals) {
                          n.load.globals[u] && (s[u] = o(n.load.globals[u]));
                        }
                      }var l = n.load.exports;l && (r += "\n" + pr + '["' + l + '"] = ' + l + ";");var c = De(a.id, l, s, n.load.encapsulateGlobal),
                          f = Re(e, r, n.load.sourceMap, t, n.load.integrity, n.load.nonce, !0);if (f) throw f;var d = c();return Ne(n, d), d;
                    }), i = o();break;default:
                    throw new TypeError('Unknown module format "' + n.load.format + '" for "' + t + '".' + ("es6" === n.load.format ? ' Use "esm" instead here.' : ""));}if (!i) throw new Error("Module " + t + " detected as " + n.load.format + " but didn't execute correctly.");
              });
            }function He(e) {
              var t = e.match(hr);return t && "System.register" === e.substr(t[0].length, 15);
            }function Ze(e) {
              return e.match(mr) ? "amd" : (vr.lastIndex = 0, It.lastIndex = 0, It.exec(e) || vr.exec(e) ? "cjs" : "global");
            }function Xe(e, t) {
              var r = e.split("!")[0];t.file && t.file != e || (t.file = r + "!transpiled"), (!t.sources || t.sources.length <= 1 && (!t.sources[0] || t.sources[0] === e)) && (t.sources = [r]);
            }function Ye(e, r, n, o, i) {
              if (!e.transpiler) throw new TypeError("Unable to dynamically transpile ES module\n   A loader plugin needs to be configured via `SystemJS.config({ transpiler: 'transpiler-module' })`.");if (o.load.deps) {
                for (var a = "", s = 0; s < o.load.deps.length; s++) {
                  a += 'import "' + o.load.deps[s] + '"; ';
                }r = a + r;
              }return e.import.call(e, e.transpiler).then(function (t) {
                if (!(t = t.__useDefault || t).translate) throw new Error(e.transpiler + " is not a valid transpiler plugin.");return t === o.pluginModule ? r : ("string" == typeof o.load.sourceMap && (o.load.sourceMap = JSON.parse(o.load.sourceMap)), o.pluginLoad = o.pluginLoad || { name: n, address: n, source: r, metadata: o.load }, o.load.deps = o.load.deps || [], Promise.resolve(t.translate.call(e, o.pluginLoad, o.traceOpts)).then(function (e) {
                  var t = o.load.sourceMap;return t && "object" == (typeof t === "undefined" ? "undefined" : _typeof(t)) && Xe(n, t), "esm" === o.load.format && He(e) && (o.load.format = "register"), e;
                }));
              }, function (e) {
                throw t(e, "Unable to load transpiler to transpile " + n);
              });
            }function Qe(e, t, r) {
              for (var n, o = t.split("."); o.length > 1;) {
                e = e[n = o.shift()] = e[n] || {};
              }void 0 === e[n = o.shift()] && (e[n] = r);
            }function Ve(e, t) {
              var r = e.match(br);if (r) for (var n = r[0].match(wr), o = 0; o < n.length; o++) {
                var i = n[o],
                    a = i.length,
                    s = i.substr(0, 1);if (";" == i.substr(a - 1, 1) && a--, '"' == s || "'" == s) {
                  var u = i.substr(1, i.length - 3),
                      l = u.substr(0, u.indexOf(" "));if (l) {
                    var c = u.substr(l.length + 1, u.length - l.length - 1);"deps" === l && (l = "deps[]"), "[]" === l.substr(l.length - 2, 2) ? (l = l.substr(0, l.length - 2), t.load[l] = t.load[l] || [], t.load[l].push(c)) : "use" !== l && Qe(t.load, l, c);
                  } else t.load[u] = !0;
                }
              }
            }function et() {
              f.call(this), this._loader = {}, this[jt] = {}, this[St] = { baseURL: nt, paths: {}, packageConfigPaths: [], packageConfigKeys: [], map: {}, packages: {}, depCache: {}, meta: {}, bundles: {}, production: !1, transpiler: void 0, loadedBundles: {}, warnings: !1, pluginFirst: !1, wasm: !1 }, this.scriptSrc = dr, this._nodeRequire = er, this.registry.set("@empty", Ot), tt.call(this, !1, !1), Xt(this);
            }function tt(e, t) {
              this[St].production = e, this.registry.set("@system-env", Er = this.newModule({ browser: ot, node: !!this._nodeRequire, production: !t && e, dev: t || !e, build: t, default: !0 }));
            }function rt(e, t) {
              R.call(e[St], "SystemJS." + t + " is deprecated for SystemJS.registry." + t);
            }var nt,
                ot = "undefined" != typeof window && "undefined" != typeof document,
                it = "undefined" != typeof process && process.versions && process.versions.node,
                at = "undefined" != typeof process && "string" == typeof process.platform && process.platform.match(/^win/),
                st = "undefined" != typeof self ? self : global,
                ut = "undefined" != typeof Symbol;if ("undefined" != typeof document && document.getElementsByTagName) {
              if (!(nt = document.baseURI)) {
                var lt = document.getElementsByTagName("base");nt = lt[0] && lt[0].href || window.location.href;
              }
            } else "undefined" != typeof location && (nt = location.href);if (nt) {
              var ct = (nt = nt.split("#")[0].split("?")[0]).lastIndexOf("/");-1 !== ct && (nt = nt.substr(0, ct + 1));
            } else {
              if ("undefined" == typeof process || !process.cwd) throw new TypeError("No environment baseURI");nt = "file://" + (at ? "/" : "") + process.cwd(), at && (nt = nt.replace(/\\/g, "/"));
            }"/" !== nt[nt.length - 1] && (nt += "/");var ft = "_" == new Error(0, "_").fileName,
                dt = Promise.resolve();i.prototype.constructor = i, i.prototype.import = function (e, r) {
              if ("string" != typeof e) throw new TypeError("Loader import method must be passed a module key string");var n = this;return dt.then(function () {
                return n[gt](e, r);
              }).then(a).catch(function (n) {
                throw t(n, "Loading " + e + (r ? " from " + r : ""));
              });
            };var pt = i.resolve = e("resolve"),
                gt = i.resolveInstantiate = e("resolveInstantiate");i.prototype[gt] = function (e, t) {
              var r = this;return r.resolve(e, t).then(function (e) {
                return r.registry.get(e);
              });
            }, i.prototype.resolve = function (e, r) {
              var n = this;return dt.then(function () {
                return n[pt](e, r);
              }).then(s).catch(function (n) {
                throw t(n, "Resolving " + e + (r ? " to " + r : ""));
              });
            };var ht = "undefined" != typeof Symbol && Symbol.iterator,
                mt = e("registry");ht && (u.prototype[Symbol.iterator] = function () {
              return this.entries()[Symbol.iterator]();
            }, u.prototype.entries = function () {
              var e = this[mt];return o(Object.keys(e).map(function (t) {
                return [t, e[t]];
              }));
            }), u.prototype.keys = function () {
              return o(Object.keys(this[mt]));
            }, u.prototype.values = function () {
              var e = this[mt];return o(Object.keys(e).map(function (t) {
                return e[t];
              }));
            }, u.prototype.get = function (e) {
              return this[mt][e];
            }, u.prototype.set = function (e, t) {
              if (!(t instanceof l)) throw new Error("Registry must be set with an instance of Module Namespace");return this[mt][e] = t, this;
            }, u.prototype.has = function (e) {
              return Object.hasOwnProperty.call(this[mt], e);
            }, u.prototype.delete = function (e) {
              return !!Object.hasOwnProperty.call(this[mt], e) && (delete this[mt][e], !0);
            };var vt = e("baseObject");l.prototype = Object.create(null), "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(l.prototype, Symbol.toStringTag, { value: "Module" });var yt = e("register-internal");f.prototype = Object.create(i.prototype), f.prototype.constructor = f;var bt = f.instantiate = e("instantiate");f.prototype[f.resolve = i.resolve] = function (e, t) {
              return n(e, t || nt);
            }, f.prototype[bt] = function (e, t) {}, f.prototype[i.resolveInstantiate] = function (e, t) {
              var r = this,
                  n = this[yt],
                  o = this.registry[mt];return p(r, e, t, o, n).then(function (e) {
                if (e instanceof l) return e;var t = e.linkRecord;if (!t) {
                  if (e.module) return e.module;throw e.evalError;
                }return w(r, e, t, o, n).then(function () {
                  return k(r, e, t, o, n, void 0);
                });
              });
            }, f.prototype.register = function (e, t, r) {
              var n = this[yt];void 0 === r ? n.lastRegister = [e, t, void 0] : (n.records[e] || d(n, e, void 0)).registration = [t, r, void 0];
            }, f.prototype.registerDynamic = function (e, t, r, n) {
              var o = this[yt];"string" != typeof e ? o.lastRegister = [e, t, r] : (o.records[e] || d(o, e, void 0)).registration = [t, r, n];
            }, x.prototype.import = function (e) {
              return this.loader.trace && this.loader.loads[this.key].dynamicDeps.push(e), this.loader.import(e, this.key);
            };var wt = {};Object.freeze && Object.freeze(wt);var xt,
                kt,
                Et = Promise.resolve(),
                Ot = new l({}),
                St = e("loader-config"),
                jt = e("metadata"),
                _t = "undefined" == typeof window && "undefined" != typeof self && "undefined" != typeof importScripts,
                Pt = !1,
                Mt = !1;if (ot && function () {
              var e = document.createElement("link").relList;if (e && e.supports) {
                Mt = !0;try {
                  Pt = e.supports("preload");
                } catch (e) {}
              }
            }(), ot) {
              var Rt = [],
                  Ct = window.onerror;window.onerror = function (e, t) {
                for (var r = 0; r < Rt.length; r++) {
                  if (Rt[r].src === t) return void Rt[r].err(e);
                }Ct && Ct.apply(this, arguments);
              };
            }var Lt,
                At,
                It = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF."'])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)\s*\)/g,
                Ft = "undefined" != typeof XMLHttpRequest,
                Kt = At = "undefined" != typeof self && void 0 !== self.fetch ? J : Ft ? $ : "undefined" != typeof require && "undefined" != typeof process ? B : W,
                Dt = {},
                Ut = ["browser", "node", "dev", "build", "production", "default"],
                qt = /#\{[^\}]+\}/,
                Tt = ["browserConfig", "nodeConfig", "devConfig", "buildConfig", "productionConfig"],
                zt = "undefined" != typeof Buffer;try {
              zt && "YQ==" !== new Buffer("a").toString("base64") && (zt = !1);
            } catch (e) {
              zt = !1;
            }var Nt,
                Jt,
                $t,
                Bt,
                Wt = "\n//# sourceMappingURL=data:application/json;base64,",
                Gt = 0,
                Ht = !1;ot && "undefined" != typeof document && document.getElementsByTagName && (window.chrome && window.chrome.extension || navigator.userAgent.match(/^Node\.js/) || (Ht = !0));var Zt,
                Xt = function Xt(e) {
              function t(r, n, o, i) {
                if ("object" == (typeof r === "undefined" ? "undefined" : _typeof(r)) && !(r instanceof Array)) return t.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));if ("string" == typeof r && "function" == typeof n && (r = [r]), !(r instanceof Array)) {
                  if ("string" == typeof r) {
                    var a = e.decanonicalize(r, i),
                        s = e.get(a);if (!s) throw new Error('Module not already loaded loading "' + r + '" as ' + a + (i ? ' from "' + i + '".' : "."));return "__useDefault" in s ? s.__useDefault : s;
                  }throw new TypeError("Invalid require");
                }for (var u = [], l = 0; l < r.length; l++) {
                  u.push(e.import(r[l], i));
                }Promise.all(u).then(function (e) {
                  n && n.apply(null, e);
                }, o);
              }function r(r, n, o) {
                function i(r, i, l) {
                  for (var c = [], f = 0; f < n.length; f++) {
                    c.push(r(n[f]));
                  }if (l.uri = l.id, l.config = _, -1 !== u && c.splice(u, 0, l), -1 !== s && c.splice(s, 0, i), -1 !== a) {
                    var d = function d(n, o, i) {
                      return "string" == typeof n && "function" != typeof o ? r(n) : t.call(e, n, o, i, l.id);
                    };d.toUrl = function (t) {
                      return e.normalizeSync(t, l.id);
                    }, c.splice(a, 0, d);
                  }var p = st.require;st.require = t;var g = o.apply(-1 === s ? st : i, c);st.require = p, void 0 !== g && (l.exports = g);
                }"string" != typeof r && (o = n, n = r, r = null), n instanceof Array || (o = n, n = ["require", "exports", "module"].splice(0, o.length)), "function" != typeof o && (o = function (e) {
                  return function () {
                    return e;
                  };
                }(o)), r || Vt && (n = n.concat(Vt), Vt = void 0);var a, s, u;-1 !== (a = n.indexOf("require")) && (n.splice(a, 1), r || (n = n.concat(Ue(o.toString(), a)))), -1 !== (s = n.indexOf("exports")) && n.splice(s, 1), -1 !== (u = n.indexOf("module")) && n.splice(u, 1), r ? (e.registerDynamic(r, n, !1, i), Qt ? (Qt = void 0, lr = !0) : lr || (Qt = [n, i])) : e.registerDynamic(n, !1, cr ? qe(i) : i);
              }e.set("@@cjs-helpers", e.newModule({ requireResolve: Le.bind(e), getPathVars: Ae })), e.set("@@global-helpers", e.newModule({ prepareGlobal: De })), r.amd = {}, e.amdDefine = r, e.amdRequire = t;
            };"undefined" != typeof window && "undefined" != typeof document && window.location && (Zt = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : ""));var Yt,
                Qt,
                Vt,
                er,
                tr = /(^|[^\\])(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/gm,
                rr = /("[^"\\\n\r]*(\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(\\.[^'\\\n\r]*)*')/g,
                nr = ["_g", "sessionStorage", "localStorage", "clipboardData", "frames", "frameElement", "external", "mozAnimationStartTime", "webkitStorageInfo", "webkitIndexedDB", "mozInnerScreenY", "mozInnerScreenX"],
                or = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])",
                ir = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)",
                ar = /\(([^\)]*)\)/,
                sr = /^\s+|\s+$/g,
                ur = {},
                lr = !1,
                cr = !1,
                fr = (ot || _t) && "undefined" != typeof navigator && navigator.userAgent && !navigator.userAgent.match(/MSIE (9|10).0/);"undefined" == typeof require || "undefined" == typeof process || process.browser || (er = require);var dr,
                pr = "undefined" != typeof self ? "self" : "global",
                gr = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/,
                hr = /^(\s*\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)*\s*/,
                mr = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/,
                vr = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])(exports\s*(\[['"]|\.)|module(\.exports|\['exports'\]|\["exports"\])\s*(\[['"]|[=,\.]))/,
                yr = /^\#\!.*/,
                br = /^(\s*\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/,
                wr = /\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;if ("undefined" == typeof Promise) throw new Error("SystemJS needs a Promise polyfill.");if ("undefined" != typeof document) {
              var xr = document.getElementsByTagName("script"),
                  kr = xr[xr.length - 1];document.currentScript && (kr.defer || kr.async) && (kr = document.currentScript), dr = kr && kr.src;
            } else if ("undefined" != typeof importScripts) try {
              throw new Error("_");
            } catch (e) {
              e.stack.replace(/(?:at|@).*(http.+):[\d]+:[\d]+/, function (e, t) {
                dr = t;
              });
            } else "undefined" != typeof __filename && (dr = __filename);var Er;et.prototype = Object.create(f.prototype), et.prototype.constructor = et, et.prototype[et.resolve = f.resolve] = et.prototype.normalize = Z, et.prototype.load = function (e, t) {
              return R.call(this[St], "System.load is deprecated."), this.import(e, t);
            }, et.prototype.decanonicalize = et.prototype.normalizeSync = et.prototype.resolveSync = Y, et.prototype[et.instantiate = f.instantiate] = Je, et.prototype.config = ke, et.prototype.getConfig = xe, et.prototype.global = st, et.prototype.import = function () {
              return f.prototype.import.apply(this, arguments).then(function (e) {
                return "__useDefault" in e ? e.__useDefault : e;
              });
            };for (var Or = ["baseURL", "map", "paths", "packages", "packageConfigPaths", "depCache", "meta", "bundles", "transpiler", "warnings", "pluginFirst", "production", "wasm"], Sr = "undefined" != typeof Proxy, jr = 0; jr < Or.length; jr++) {
              !function (e) {
                Object.defineProperty(et.prototype, e, { get: function get() {
                    var t = we(this[St], e);return Sr && "object" == (typeof t === "undefined" ? "undefined" : _typeof(t)) && (t = new Proxy(t, { set: function set(t, r) {
                        throw new Error("Cannot set SystemJS." + e + '["' + r + '"] directly. Use SystemJS.config({ ' + e + ': { "' + r + '": ... } }) rather.');
                      } })), t;
                  }, set: function set(t) {
                    throw new Error("Setting `SystemJS." + e + "` directly is no longer supported. Use `SystemJS.config({ " + e + ": ... })`.");
                  } });
              }(Or[jr]);
            }et.prototype.delete = function (e) {
              return rt(this, "delete"), this.registry.delete(e);
            }, et.prototype.get = function (e) {
              return rt(this, "get"), this.registry.get(e);
            }, et.prototype.has = function (e) {
              return rt(this, "has"), this.registry.has(e);
            }, et.prototype.set = function (e, t) {
              return rt(this, "set"), this.registry.set(e, t);
            }, et.prototype.newModule = function (e) {
              return new l(e);
            }, et.prototype.isModule = M, et.prototype.register = function (e, t, r) {
              return "string" == typeof e && (e = X.call(this, this[St], e)), f.prototype.register.call(this, e, t, r);
            }, et.prototype.registerDynamic = function (e, t, r, n) {
              return "string" == typeof e && (e = X.call(this, this[St], e)), f.prototype.registerDynamic.call(this, e, t, r, n);
            }, et.prototype.version = "0.20.19 Dev";var _r = new et();(ot || _t) && (st.SystemJS = st.System = _r), "undefined" != typeof module && module.exports && (module.exports = _r);
          }();
        }).call(this);
      }).call(this, require('_process'), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}, require("buffer").Buffer, arguments[3], arguments[4], arguments[5], arguments[6], "/node_modules/systemjs/dist/system.js");
    }, { "_process": 5, "buffer": 3, "fs": 2 }], 7: [function (require, module, exports) {
      /*    Copyright 2017 Jocly
       *
       *    This program is free software: you can redistribute it and/or  modify
       *    it under the terms of the GNU Affero General Public License, version 3,
       *    as published by the Free Software Foundation.
       *
       *    This program is distributed in the hope that it will be useful,
       *    but WITHOUT ANY WARRANTY; without even the implied warranty of
       *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
       *    GNU Affero General Public License for more details.
       *
       *    You should have received a copy of the GNU Affero General Public License
       *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
       *
       *    As a special exception, the copyright holders give permission to link the
       *    code of portions of this program with the OpenSSL library under certain
       *    conditions as described in each individual source file and distribute
       *    linked combinations including the program with the OpenSSL library. You
       *    must comply with the GNU Affero General Public License in all respects
       *    for all of the code used other than as permitted herein. If you modify
       *    file(s) with this exception, you may extend this exception to your
       *    version of the file(s), but you are not obligated to do so. If you do not
       *    wish to do so, delete this exception statement from your version. If you
       *    delete this exception statement from all source files in the program,
       *    then also delete it in the license file.
       */

      var SystemJS = require("../../node_modules/systemjs/dist/system.js");

      function GetScriptPath() {
        var scripts = document.getElementsByTagName('script');
        var path = scripts[scripts.length - 1].src.split('?')[0];
        var mydir = path.split('/').slice(0, -1).join('/') + '/';
        return new URL(mydir).pathname;
      }

      var joclyScriptPath = GetScriptPath();

      SystemJS.config({
        baseURL: joclyScriptPath
      });

      function ExportFunction(fName) {
        exports[fName] = function () {
          var args = arguments;
          var promise = new Promise(function (resolve, reject) {
            SystemJS.import("jocly.core.js").then(function (m) {
              m[fName].apply(m, args).then(function () {
                resolve.apply(null, arguments);
              }, function (e) {
                reject(e);
              });
            }, function (e) {
              reject(e);
            });
          });
          return promise;
        };
      }

      ["listGames", "createMatch", "getGameConfig"].forEach(function (fName) {
        ExportFunction(fName);
      });

      exports.PLAYER_A = 1;
      exports.PLAYER_B = -1;
      exports.DRAW = 2;
    }, { "../../node_modules/systemjs/dist/system.js": 6 }] }, {}, [7])(7);
});