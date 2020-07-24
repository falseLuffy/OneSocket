(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.OneSocket = factory());
}(this, (function () { 'use strict';

  if (!WebSocket) {
    throw new Error('WebSocket is not exist');
  }

  var ws = null;
  var promiseCallback = [];
  var dataQueue = [];
  var serviceMap = [];
  var watchEventList = [];
  var status = false;

  function OneSocket(option) {
    this.defaultOption = {
      url: '',
      mode: 'vague',
      // 可选参数 exact， vague
      timeout: 13000,
      interval: 50,
      hasHeartbeat: true,
      heartbeatInterval: 10000,
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
    this.__Promise__ = new Promise(function (resolve, reject) {
      promiseCallback = {
        resolve: resolve,
        reject: reject
      };
      this.init(option);
      bindEvent(this);
    }.bind(this));
  }

  OneSocket.prototype.init = function () {
    var _promiseCallback = promiseCallback,
        reject = _promiseCallback.reject;

    try {
      ws = new WebSocket(this.defaultOption.url);
      ws.timeoutInterval = this.defaultOption.timeout;
    } catch (err) {
      reject(err);
    }
  };

  var bindEvent = function bindEvent(that) {
    var _promiseCallback2 = promiseCallback,
        resolve = _promiseCallback2.resolve,
        reject = _promiseCallback2.reject;
    ws.addEventListener('open', function () {
      if (resolve) {
        resolve(true);
        promiseCallback = {};
        if (that.defaultOption.hasHeartbeat) heartbeat(that);
      }
    });
    ws.addEventListener('close', function (err) {
      // socket关闭后，将停止所有请求
      clearTimeout(that.timer);
      clearTimeout(that.heartbeatTimer);
      console.warn('socket has closed');
      that.defaultOption.onClose(err);
    });
    ws.addEventListener('error', function (err) {
      if (reject) {
        reject(false);
        promiseCallback = {};
      } else {
        watchEventList.error.forEach(function (callback) {
          callback(err);
        });
      }
    });

    ws.onmessage = function (res) {
      that.defaultOption.responseParser(res, messageHouse, that);
    };
  };

  var messageHouse = function messageHouse(res, service, isSuccess, that) {
    var path = null;
    var watchedName = service.service;

    if (that.defaultOption.mode === 'exact') {
      path = service.id;
    } else {
      path = service.service;
    }

    if (!path || serviceMap.indexOf(path) < 0 && !watchEventList[watchedName]) {
      console.warn(path + ' is not a defined service');
      return;
    }

    (watchEventList[watchedName] || []).forEach(function (callback) {
      callback(res);
    });
    if (!that.callbackMap[path]) return;
    var callback = that.callbackMap[path].shift();

    if (isSuccess) {
      callback ? callback[0](res) : console.error('callback is undefined');
    } else {
      callback ? callback[1](res) : console.error('callback is undefined');
    }
  };

  var queueSend = function queueSend(data, that) {
    dataQueue.push(data);

    if (!status) {
      send(that);
    }
  };

  var send = function send(that) {
    status = true;
    clearTimeout(that.heartbeatTimer); //  如果在心跳请求等待时间内再次发送请求，则心跳请求取消

    that.timer = setTimeout(function () {
      var data = dataQueue.shift();
      ws.send(data); //  发请求后准备执行心跳请求

      if (that.defaultOption.hasHeartbeat) heartbeat(that);

      if (dataQueue.length) {
        send(that);
      } else {
        status = false;
      }
    }, that.defaultOption.interval);
  };

  var heartbeat = function heartbeat(that) {
    var _that$defaultOption = that.defaultOption,
        heartbeatPack = _that$defaultOption.heartbeatPack,
        heartbeatInterval = _that$defaultOption.heartbeatInterval;
    that.heartbeatTimer = setTimeout(function () {
      ws.send(JSON.stringify(Object.assign({}, heartbeatPack, {
        id: uuid()
      })));
      heartbeat(that);
    }, heartbeatInterval);
  };

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

  OneSocket.prototype.send = function (path, data) {
    var uuidString = uuid();
    var mode = this.defaultOption.mode;

    if (mode === 'exact') {
      path = uuidString;
    }

    serviceMap.push(path);
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

      queueSend(JSON.stringify(data), this);
    }.bind(this));
  };

  OneSocket.prototype.close = function () {
    // socket关闭后，将停止所有请求
    clearTimeout(this.timer);
    clearTimeout(this.heartbeatTimer);
    ws.close();
  };

  OneSocket.prototype.then = function (callback) {
    return this.__Promise__.then(function (data) {
      // eslint-disable-next-line standard/no-callback-literal
      return callback(this);
    }.bind(this));
  };

  OneSocket.prototype["catch"] = function (callback) {
    return this.__Promise__["catch"](function (err) {
      return callback(err);
    });
  };

  OneSocket.prototype.on = function (name, callback) {
    if (watchEventList[name]) {
      watchEventList[name].push(callback);
    } else {
      watchEventList[name] = [callback];
    }
  };

  OneSocket.prototype.remove = function (name, callback) {
    var index = watchEventList[name].findIndex(function (item) {
      return item === callback;
    });
    watchEventList.splice(index, 1);
  };

  OneSocket.prototype.destory = function (name) {
    delete watchEventList[name];
  };

  OneSocket.prototype.updateConfig = function (_ref) {
    var heartbeatPack = _ref.heartbeatPack;
    this.defaultOption.heartbeatPack = heartbeatPack;
  };

  return OneSocket;

})));
