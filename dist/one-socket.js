(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.OneSocket = factory());
}(this, (function () { 'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  if (!WebSocket) {
    throw new Error('WebSocket is not exist');
  }

  function uuid() {
    var s = [];
    var hexDigits = '0123456789abcdef';

    for (var i = 0; i < 36; i++) {
      s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }

    s[14] = '4'; // bits 12-15 of the time_hi_and_version field to 0010

    s[19] = hexDigits.substr(s[19] & 0x3 | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01

    s[8] = s[13] = s[18] = s[23] = '-';
    return s.join('');
  }

  var OneSocket = /*#__PURE__*/function () {
    function OneSocket(option) {
      var _this = this;

      _classCallCheck(this, OneSocket);

      _defineProperty(this, "ws", null);

      _defineProperty(this, "promiseCallback", []);

      _defineProperty(this, "dataQueue", []);

      _defineProperty(this, "watchEventList", {});

      _defineProperty(this, "sendStatus", false);

      _defineProperty(this, "timeoutTimer", null);

      _defineProperty(this, "bindEvent", function (that) {
        var _this$promiseCallback = _this.promiseCallback,
            resolve = _this$promiseCallback.resolve,
            reject = _this$promiseCallback.reject;

        _this.ws.addEventListener('open', function () {
          clearTimeout(_this.timeoutTimer);

          if (resolve) {
            resolve(true);
            _this.promiseCallback = {};
            if (that.defaultOption.hasHeartbeat) _this.heartbeat(that);
          }
        });

        _this.ws.addEventListener('close', function (err) {
          clearTimeout(_this.timeoutTimer); // socket关闭后，将停止所有请求

          clearTimeout(that.timer);
          clearTimeout(that.heartbeatTimer);
          console.warn('socket has closed');
          that.defaultOption.onClose(err);
        });

        _this.ws.addEventListener('error', function (err) {
          if (reject) {
            reject(false);
            _this.promiseCallback = {};
          } else {
            _this.watchEventList.error.forEach(function (callback) {
              callback(err);
            });
          }
        });

        _this.ws.addEventListener('message', function (res) {
          that.defaultOption.responseParser(res, _this.messageHouse, that);
        });
      });

      _defineProperty(this, "messageHouse", function (res, service, isSuccess, that) {
        var path = null;
        var watchedName = service.service;

        if (that.defaultOption.mode === 'exact') {
          path = service.id;
        } else {
          path = service.service;
        }

        if (!path || !that.callbackMap[path] && !that.watchEventList[watchedName]) {
          // process.env.NODE_ENV === 'development' && console.warn(path + ' is not a defined service');
          return;
        }

        (that.watchEventList[watchedName] || []).forEach(function (callback) {
          callback(res);
        });
        if (!that.callbackMap[path]) return;
        var callback = that.callbackMap[path].shift();
        if (!that.callbackMap[path].length) that.callbackMap[path] = undefined;

        if (isSuccess) {
          callback ? callback[0](res) : console.error("".concat(path, "'s callback is undefined"));
        } else {
          callback ? callback[1](res) : console.error("".concat(path, "'s callback is undefined"));
        }
      });

      _defineProperty(this, "queueSend", function (data, that) {
        _this.dataQueue.push(data);

        if (!_this.sendStatus && _this.dataQueue.length) {
          _this.sendData(that);
        }
      });

      _defineProperty(this, "sendData", function (that) {
        _this.sendStatus = true;
        clearTimeout(that.heartbeatTimer); //  如果在心跳请求等待时间内再次发送请求，则心跳请求取消

        that.timer = setTimeout(function () {
          if (_this.ws.readyState === WebSocket.OPEN) {
            var data = _this.dataQueue.shift();

            _this.ws.send(data); //  发请求后准备执行心跳请求


            if (that.defaultOption.hasHeartbeat) _this.heartbeat(that);

            if (_this.dataQueue.length) {
              _this.sendData(that);
            } else {
              _this.sendStatus = false;
            }
          } else if (_this.ws.readyState === WebSocket.CONNECTING) {
            _this.sendData(that);
          }
        }, that.defaultOption.interval);
      });

      _defineProperty(this, "heartbeat", function (that) {
        var _that$defaultOption = that.defaultOption,
            heartbeatPack = _that$defaultOption.heartbeatPack,
            heartbeatInterval = _that$defaultOption.heartbeatInterval;
        that.heartbeatTimer = setTimeout(function () {
          _this.ws.send(JSON.stringify(Object.assign({}, heartbeatPack, {
            id: uuid()
          })));

          _this.heartbeat(that);
        }, heartbeatInterval);
      });

      _defineProperty(this, "init", function () {
        var reject = _this.promiseCallback.reject;

        try {
          _this.ws = new WebSocket(_this.defaultOption.url);
          _this.ws.timeoutInterval = _this.defaultOption.timeout;
          _this.timeoutTimer = setTimeout(function () {
            _this.ws.close();

            _this.timeoutTimer = null;
          }, _this.defaultOption.timeout);
        } catch (err) {
          reject(err);
        }
      });

      _defineProperty(this, "send", function (path, data) {
        var uuidString = uuid();
        var mode = _this.defaultOption.mode;

        if (mode === 'exact') {
          path = uuidString;
        }

        return new Promise(function (resolve, reject) {
          if (!this.callbackMap[path]) {
            this.callbackMap[path] = [[resolve, reject]];
          } else {
            this.callbackMap[path].push([resolve, reject]);
          }

          if (mode === 'exact') {
            data = Object.assign({}, data, {
              id: uuidString
            });
          }

          this.queueSend(JSON.stringify(data), this);
        }.bind(_this));
      });

      _defineProperty(this, "close", function () {
        // socket关闭后，将停止所有请求
        clearTimeout(_this.timer);
        clearTimeout(_this.heartbeatTimer);

        _this.ws.close();
      });

      _defineProperty(this, "then", function (callback) {
        return _this.__Promise__.then(function (data) {
          // eslint-disable-next-line standard/no-callback-literal
          return callback(this);
        }.bind(_this));
      });

      _defineProperty(this, "catch", function (callback) {
        return _this.__Promise__["catch"](function (err) {
          return callback(err);
        });
      });

      this.defaultOption = {
        url: '',
        mode: 'vague',
        // 可选参数 exact， vague
        timeout: 2000,
        interval: 50,
        hasHeartbeat: true,
        heartbeatInterval: 10000,
        instance: null,
        heartbeatPack: {
          lang: 'zh_cn',
          service: 'ping',
          token: ''
        },
        responseParser: function responseParser(res, next, scope) {
          var json = JSON.parse(res.data);
          var data = json.result_data;
          var service = data.service;
          var resultCode = json.result_code;
          next(data, {
            service: service
          }, resultCode === 1, scope);
        },
        onClose: function onClose() {}
      };
      this.callbackMap = {};
      this.defaultOption = Object.assign({}, this.defaultOption, option);
      this.heartbeatTimer = null;
      var instance = this.defaultOption.instance;
      this.__Promise__ = new Promise(function (resolve, reject) {
        this.promiseCallback = {
          resolve: resolve,
          reject: reject
        };

        if (!instance) {
          this.init(option);
        } else {
          this.ws = instance;
        }

        this.bindEvent(this);
      }.bind(this));
    }

    _createClass(OneSocket, [{
      key: "on",
      value: function on(name, callback) {
        if (this.watchEventList[name]) {
          this.watchEventList[name].push(callback);
        } else {
          this.watchEventList[name] = [callback];
        }
      }
    }, {
      key: "remove",
      value: function remove(name, callback) {
        var index = this.watchEventList[name].findIndex(function (item) {
          return item === callback;
        });
        this.watchEventList.splice(index, 1);
      }
    }, {
      key: "destroy",
      value: function destroy(name) {
        delete this.watchEventList[name];
      }
    }, {
      key: "updateConfig",
      value: function updateConfig(_ref) {
        var heartbeatPack = _ref.heartbeatPack;
        this.defaultOption.heartbeatPack = heartbeatPack;
      }
    }]);

    return OneSocket;
  }();

  return OneSocket;

})));
